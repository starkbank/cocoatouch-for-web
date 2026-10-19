import { NSObject } from "../foundation/nsobject.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { itemProviderFor } from "../foundation/nsitemprovider.js"
import { identifierForKnownMime, identifierForFileName } from "../uniformtypeidentifiers/uttype.js"
import { UIDragItem } from "./uidragitem.js"
import { UIDropSession } from "./uidropsession.js"
import { UIDropProposal } from "./uidropproposal.js"
import { UIDropOperation } from "./uidropoperation.js"
import { required, optional, instance } from "../utils/required.js"
import { UIView } from "./uiview.js"


const viewType = optional(instance(UIView, "UIView"))
const signature = "Apple's is UIDropInteraction(delegate:); write new UIDropInteraction({delegate}), then view.addInteraction(interaction)."


// UIKit's UIDropInteraction over a view's element, for files dropped from the
// system. The browser's drag events become the delegate's methods:
//
//   dragenter  -> dropInteractionCanHandle, then dropInteractionSessionDidEnter
//   dragover   -> dropInteractionSessionDidUpdate; a .copy proposal allows the drop
//   dragleave  -> dropInteractionSessionDidExit, once however many children it crossed
//   drop       -> dropInteractionPerformDrop, then dropInteractionSessionDidEnd
//
// A drag the delegate cannot handle is left entirely to the browser. While the
// drag is over the page the browser shows only each item's kind and MIME type,
// so canHandle and hasItemsConforming answer from those, and files load only
// in performDrop. A dropped folder is one item that conforms to UTType.folder:
// FileManager lists it, and an app that wants its files recurses itself.
// A session that left the view ends with the next drop or drag end anywhere on
// the page, or when another drag enters; the page's drag listeners are on the
// document only while a session lives.
export class UIDropInteraction extends NSObject {

    _view = null
    _depth = 0
    _session = null
    _isInside = false

    /**
     * @param {object} options
     * @param {object} options.delegate
     */
    constructor({delegate} = {}) {
        super()
        if (delegate === undefined || delegate === null || typeof delegate !== "object") {
            throw new TypeError(`UIDropInteraction(delegate:) requires a delegate object: ${signature}`)
        }
        this._delegate = delegate
    }

    get view() {
        return this._view
    }

    get delegate() {
        return this._delegate
    }

    // UIInteraction's pair, sent around the move in that order.
    /**
     * @param {object} options
     * @param {UIView|null} options.to
     */
    willMove({to} = {}) {
        required(to, "to", viewType, "UIDropInteraction.willMove", "Apple's is willMove(to view: UIView?); write willMove({to: view}).")
        if (to === null) { this._unbind() }
    }

    /**
     * @param {object} options
     * @param {UIView|null} options.to
     */
    didMove({to} = {}) {
        required(to, "to", viewType, "UIDropInteraction.didMove", "Apple's is didMove(to view: UIView?); write didMove({to: view}).")
        this._view = to
        if (to) { this._bind() }
    }

    _bind() {
        var element = this._view.$el[0]
        if (!element) { return }
        var listen = (name, handler) => NotificationCenter.default.addObserver(this, {name: name, object: element, selector: handler})
        listen("dragenter", (event) => this._enter(event))
        listen("dragover", (event) => this._over(event))
        listen("dragleave", () => this._leave())
        listen("drop", (event) => this._drop(event))
    }

    _unbind() {
        this._end()
        NotificationCenter.default.removeObserver(this)
        this._depth = 0
    }

    _enter(event) {
        this._depth += 1
        if (this._depth > 1) { return }
        this._end()
        var session = _sessionOf(event, false)
        if (!this._canHandle(session)) { return }
        event.preventDefault()
        this._session = session
        this._isInside = true
        this._observeDocument()
        this._send("dropInteractionSessionDidEnter", session)
    }

    _over(event) {
        if (!this._session || !this._isInside) { return }
        var proposal = this._send("dropInteractionSessionDidUpdate", this._session)
        if (!(proposal instanceof UIDropProposal) || !event.dataTransfer) { return }
        if (proposal.operation === UIDropOperation.copy) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
        }
        if (proposal.operation === UIDropOperation.forbidden) { event.dataTransfer.dropEffect = "none" }
    }

    // Exit fires once, when the pointer has left the view and every child of it.
    _leave() {
        this._depth = Math.max(0, this._depth - 1)
        if (this._depth > 0 || !this._session || !this._isInside) { return }
        this._isInside = false
        this._send("dropInteractionSessionDidExit", this._session)
    }

    _drop(event) {
        this._depth = 0
        if (!this._session || !this._isInside) { return }
        var session = _sessionOf(event, true)
        if (!this._canHandle(session)) {
            this._end()
            return
        }
        event.preventDefault()
        this._session = session
        this._send("dropInteractionPerformDrop", session)
        this._end()
    }

    // A drop or drag end elsewhere on the page ends a session that already left.
    _elsewhere() {
        if (this._isInside) { return }
        this._end()
    }

    _observeDocument() {
        var observe = (name) => NotificationCenter.default.addObserver(this, {name: name, object: document, selector: () => this._elsewhere()})
        observe("dragend")
        observe("drop")
    }

    _end() {
        if (!this._session) { return }
        var session = this._session
        this._session = null
        this._isInside = false
        NotificationCenter.default.removeObserver(this, {name: "dragend", object: document})
        NotificationCenter.default.removeObserver(this, {name: "drop", object: document})
        this._send("dropInteractionSessionDidEnd", session)
    }

    // A delegate without canHandle handles every drop; only an explicit false refuses one.
    _canHandle(session) {
        return this._send("dropInteractionCanHandle", session) !== false
    }

    _send(method, session) {
        if (typeof this._delegate[method] !== "function") { return undefined }
        return this._delegate[method](this, session)
    }
}


// The session a drag event shows. Over the page the browser lets a script read
// each item's kind and MIME type and nothing more; in the drop it also gives
// the file, and the entry, which says whether the item is a folder. Only files
// are items.
function _sessionOf(event, isDrop) {
    var items = []
    var list = event.dataTransfer ? Array.from(event.dataTransfer.items || []) : []
    for (var item of list) {
        if (item.kind !== "file") { continue }
        items.push(new UIDragItem(isDrop ? _loadable(item) : _preview(item)))
    }
    return new UIDropSession(items)
}

function _preview(item) {
    return itemProviderFor({identifier: identifierForKnownMime(item.type) || "public.data"})
}

function _loadable(item) {
    var entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null
    var file = typeof item.getAsFile === "function" ? item.getAsFile() : null
    var name = entry ? entry.name : file ? file.name : null
    var isDirectory = Boolean(entry && entry.isDirectory)
    var identifier = isDirectory ? "public.folder" : identifierForKnownMime(item.type) || (name && identifierForFileName(name)) || "public.data"
    return itemProviderFor({identifier: identifier, name: name, file: file, entry: entry})
}
