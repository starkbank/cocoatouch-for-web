import { NSObject } from "../foundation/nsobject.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { itemProviderFor } from "../foundation/nsitemprovider.js"
import { identifierForKnownMime, identifierForFileName } from "../uniformtypeidentifiers/uttype.js"
import { UIDragItem } from "./uidragitem.js"
import { UIDropSession } from "./uidropsession.js"
import { UIDropProposal } from "./uidropproposal.js"
import { UIDropOperation } from "./uidropoperation.js"
import { required, optional, instance } from "../utils/required.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { UIView } from "./uiview.js"


const viewType = optional(instance(UIView, "UIView"))
const signature = "Apple's is UIDropInteraction(delegate:); write new UIDropInteraction({delegate}), then view.addInteraction(interaction)."
const retiredDelegateNames = {dropInteractionCanHandle: "dropInteractionCanHandleSession"}

// What a proposal does to the browser's own handling of the drag: each case
// prevents it, so the browser never opens a file, and sets the effect.
const dropEffects = {
    [UIDropOperation.copy]: "copy",
    [UIDropOperation.forbidden]: "none",
    [UIDropOperation.cancel]: "none",
}

// The dragover and drop events an interaction has already decided, so that in
// nested views only the innermost accepting one does. The event keeps bubbling:
// a session left elsewhere ends on the document's drop.
const decided = new WeakSet()


// UIKit's UIDropInteraction over a view's element, for files dropped from the
// system. The browser's drag events become the delegate's methods:
//
//   dragenter  -> dropInteractionCanHandleSession, then dropInteractionSessionDidEnter
//   dragover   -> dropInteractionSessionDidUpdate; a .copy proposal allows the drop
//   dragleave  -> dropInteractionSessionDidExit, once however many children it crossed
//   drop       -> dropInteractionPerformDrop, dropInteractionConcludeDrop, then
//                 dropInteractionSessionDidEnd
//
// canHandle runs once, at enter, and the one session object lives to the drop.
// While the drag is over the page the browser shows only each item's kind and
// MIME type, so the session's items answer conformance from those and load
// nothing; the same items load their files in the drop, which is the only time
// the browser gives them. A delegate that decides by type and count does it in
// canHandle, and one that needs the files, a size for example, does it in
// performDrop, where FileManager answers attributesOfItem without reading.
// A dropped folder is one item that conforms to UTType.folder: FileManager
// lists it, and an app that wants its files recurses itself.
// A drag the interaction refuses is swallowed, never left to the browser: its
// dragover and drop are prevented with dropEffect none, as are those of a
// .forbidden or .cancel proposal, so the browser does not open the file. In
// nested views the innermost interaction that accepted the drag decides and
// handles the drop once; an outer one only ends its session.
// A session that left the view ends with the next drop or drag end anywhere on
// the page, or when another drag enters; the page's drag listeners are on the
// document only while a session lives.
export class UIDropInteraction extends NSObject {

    _view = null
    _depth = 0
    _session = null
    _isInside = false
    _isRefused = false
    _operation = null

    /**
     * @param {object} options
     * @param {object} options.delegate
     */
    constructor({delegate} = {}) {
        super()
        if (delegate === undefined || delegate === null || typeof delegate !== "object") {
            throw new TypeError(`UIDropInteraction(delegate:) requires a delegate object: ${signature}`)
        }
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UIDropInteraction.delegate")
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
        if (to === null) {
            this._unbind()
            return
        }
        if (this._view && this._view !== to) { this._view.removeInteraction(this) }
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
        var session = _sessionOf(event)
        this._isRefused = !this._canHandle(session)
        if (this._isRefused) { return }
        event.preventDefault()
        this._session = session
        this._operation = null
        this._isInside = true
        this._observeDocument()
        this._send("dropInteractionSessionDidEnter", session)
    }

    _over(event) {
        if (decided.has(event)) { return }
        if (this._isRefused) {
            _swallow(event)
            return
        }
        if (!this._session || !this._isInside) { return }
        decided.add(event)
        var proposal = this._send("dropInteractionSessionDidUpdate", this._session)
        this._operation = proposal instanceof UIDropProposal ? proposal.operation : null
        if (this._operation === null || !event.dataTransfer) { return }
        event.preventDefault()
        event.dataTransfer.dropEffect = dropEffects[this._operation]
    }

    // Exit fires once, when the pointer has left the view and every child of it.
    _leave() {
        this._depth = Math.max(0, this._depth - 1)
        if (this._depth > 0) { return }
        this._isRefused = false
        if (!this._session || !this._isInside) { return }
        this._isInside = false
        this._send("dropInteractionSessionDidExit", this._session)
    }

    _drop(event) {
        this._depth = 0
        var wasRefused = this._isRefused
        this._isRefused = false
        if (decided.has(event)) {
            this._end()
            return
        }
        if (wasRefused) {
            _swallow(event)
            return
        }
        if (!this._session || !this._isInside) { return }
        decided.add(event)
        if (this._operation === UIDropOperation.forbidden || this._operation === UIDropOperation.cancel) {
            _swallow(event)
            this._end()
            return
        }
        event.preventDefault()
        _load(this._session, event)
        this._send("dropInteractionPerformDrop", this._session)
        this._send("dropInteractionConcludeDrop", this._session)
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
        return this._send("dropInteractionCanHandleSession", session) !== false
    }

    _send(method, session) {
        if (typeof this._delegate[method] !== "function") { return undefined }
        return this._delegate[method](this, session)
    }
}


// The session a drag shows at enter. Over the page the browser lets a script
// read each item's kind and MIME type and nothing more, so the items carry
// providers that answer conformance and load nothing. Only files are items.
function _sessionOf(event) {
    var items = _fileItems(event).map((item) => new UIDragItem({itemProvider: _preview(item)}))
    return new UIDropSession(items)
}

// The drop gives the file, and the entry, which says whether the item is a
// folder: the session's own items take loadable providers, so the object the
// delegate was shown at enter is the one it performs the drop on.
function _load(session, event) {
    var providers = _fileItems(event).map(_loadable)
    session.items.splice(providers.length)
    providers.forEach((provider, index) => {
        if (index < session.items.length) {
            session.items[index].itemProvider = provider
            return
        }
        session.items.push(new UIDragItem({itemProvider: provider}))
    })
}

function _fileItems(event) {
    var list = event.dataTransfer ? Array.from(event.dataTransfer.items || []) : []
    return list.filter((item) => item.kind === "file")
}

function _swallow(event) {
    event.preventDefault()
    if (event.dataTransfer) { event.dataTransfer.dropEffect = "none" }
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
