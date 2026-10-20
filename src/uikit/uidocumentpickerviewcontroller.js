import { UIViewController } from "./uiviewcontroller.js"
import { UTType } from "../uniformtypeidentifiers/uttype.js"
import { registerFile, registerDirectory } from "../foundation/fileregistry.js"
import { required, arrayOf, instance, Bool } from "../utils/required.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"


const typesType = arrayOf(instance(UTType, "UTType"))
const retiredDelegateNames = {documentPickerDidPickDocumentsAt: "documentPickerDidPickDocumentsAtURLs"}
const signature = "Apple's is UIDocumentPickerViewController(forOpeningContentTypes:asCopy:); write new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})."


// UIKit's UIDocumentPickerViewController, as the browser's file input. It has
// no view: presenting it opens the input and leaves the page's root controller
// alone, so it must be presented from the user's tap, like UIPasteboard's
// write. A page can only ever receive copies, so asCopy is true. Each chosen
// File is registered as a file: URL that FileManager reads (see FileManager),
// and the delegate gets those URLs in the order the user chose them. The
// framework never checks that a file matches the content types asked for:
// the input's accept is a hint the user can override, so a caller checks
// the name and size before reading, and the server stays authoritative.
// A folder type asks for the directory picker, and the delegate then gets the
// one folder as a directory URL that FileManager lists; a folder among file
// types adds nothing, as one input cannot pick both. The input's cancel event needs Chrome 113+ or Safari 16.4+; where it never
// fires, documentPickerWasCancelled is never called.
export class UIDocumentPickerViewController extends UIViewController {

    /**
     * @param {object} options
     * @param {UTType[]} options.forOpeningContentTypes
     * @param {boolean} options.asCopy
     */
    constructor({forOpeningContentTypes, asCopy} = {}) {
        super()
        required(forOpeningContentTypes, "forOpeningContentTypes", typesType, "UIDocumentPickerViewController", signature)
        required(asCopy, "asCopy", Bool, "UIDocumentPickerViewController", signature)
        if (forOpeningContentTypes.length === 0) {
            throw new TypeError(`UIDocumentPickerViewController needs at least one content type: ${signature}`)
        }
        if (!asCopy) {
            throw new TypeError(`UIDocumentPickerViewController supports only asCopy: true, as a page can only ever receive a copy of a file: ${signature}`)
        }
        this._contentTypes = forOpeningContentTypes.slice()
        this.allowsMultipleSelection = false
        this._delegate = null
        this._input = null
    }

    get delegate() {
        return this._delegate
    }

    set delegate(delegate) {
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UIDocumentPickerViewController.delegate")
        this._delegate = delegate || null
    }

    // The hook UIViewController.present asks for: no page swap, no view.
    _presentModally({completion}) {
        this._closeInput()
        var input = document.createElement("input")
        input.type = "file"
        input.hidden = true
        input.multiple = this.allowsMultipleSelection
        var accept = _accept(this._contentTypes)
        if (accept !== "") { input.accept = accept }
        if (_isFolderPicker(this._contentTypes)) { input.webkitdirectory = true }
        input.addEventListener("change", () => this._didChoose(input))
        input.addEventListener("cancel", () => this._didCancel(input))
        // Attached while it is open: Safari has refused to open a detached input.
        document.body.appendChild(input)
        this._input = input
        if (!_hasUserActivation()) {
            this._closeInput()
            this._send("documentPickerWasCancelled", [this])
            return
        }
        input.click()
        if (completion) { completion() }
    }

    _didChoose(input) {
        if (input !== this._input) { return }
        var files = Array.from(input.files || [])
        this._closeInput()
        if (files.length === 0) {
            this._send("documentPickerWasCancelled", [this])
            return
        }
        this._send("documentPickerDidPickDocumentsAtURLs", [this, _urlsOf(files, input.webkitdirectory === true)])
    }

    _didCancel(input) {
        if (input !== this._input) { return }
        this._closeInput()
        this._send("documentPickerWasCancelled", [this])
    }

    _send(method, args) {
        if (!this._delegate || typeof this._delegate[method] !== "function") { return }
        this._delegate[method](...args)
    }

    _closeInput() {
        if (!this._input) { return }
        var input = this._input
        this._input = null
        input.remove()
    }

    _dispose() {
        this._closeInput()
        super._dispose()
    }
}


// Every extension and MIME type of the types, or nothing at all when one of
// them is the item type, which allows any file. A folder adds nothing to a file
// picker, and a folder picker has no accept.
function _accept(types) {
    if (_isFolderPicker(types)) { return "" }
    if (types.some((type) => type.identifier === UTType.item.identifier)) { return "" }
    var tokens = []
    for (var type of types) {
        if (type.conforms({to: UTType.folder})) { continue }
        for (var token of type._acceptTokens) {
            if (!tokens.includes(token)) { tokens.push(token) }
        }
    }
    return tokens.join(",")
}

function _isFolderPicker(types) {
    return types.every((type) => type.conforms({to: UTType.folder}))
}

// What the user chose, as the URLs the delegate gets. The directory input hands
// a folder over as its files, each with its path below the folder, so the one
// directory the registry lists is rebuilt from those paths. A browser that
// gives no paths gives the files themselves.
function _urlsOf(files, isFolder) {
    if (!isFolder || !files.every((file) => (file.webkitRelativePath || "").includes("/"))) { return files.map(registerFile) }
    var entry = _folderEntry(files)
    return [registerDirectory({name: entry.name, entry: entry})]
}

function _folderEntry(files) {
    var root = _directoryEntry("")
    var directories = new Map([["", root]])
    for (var file of files) {
        var path = file.webkitRelativePath.split("/")
        var parent = root
        var key = ""
        for (var name of path.slice(0, -1)) {
            key = key + "/" + name
            if (!directories.has(key)) {
                var made = _directoryEntry(name)
                parent.children.push(made)
                directories.set(key, made)
            }
            parent = directories.get(key)
        }
        parent.children.push(_fileEntry(file))
    }
    return root.children[0]
}

function _fileEntry(file) {
    return {isDirectory: false, isFile: true, name: file.name, file: (done) => done(file)}
}

// The part of a FileSystemDirectoryEntry that FileManager reads: readEntries
// answers a batch at a time and an empty batch when it is done.
function _directoryEntry(name) {
    var entry = {isDirectory: true, isFile: false, name: name, children: []}
    entry.createReader = function() {
        var rest = entry.children.slice()
        return {readEntries: (done) => done(rest.splice(0, 100))}
    }
    return entry
}

// A browser opens a file chooser only for a user's tap, and click() on the
// input says nothing when it refuses, which would leave the delegate waiting
// for ever. Where the browser reports the activation, no activation is
// reported as a cancel at once. showPicker() is not used: WebKit accepts it on
// a file input and opens nothing, where click() opens in every engine.
function _hasUserActivation() {
    if (typeof navigator === "undefined" || !navigator.userActivation) { return true }
    return navigator.userActivation.isActive
}
