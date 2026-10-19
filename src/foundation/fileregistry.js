import { uuid } from "../utils/uuid.js"


// The one place a picked or dropped file lives. Each File is held under a
// synthetic file: URL the framework mints, which resolves only through
// FileManager: nothing here can be loaded by the browser, no object URL is
// ever made, and a path that was not minted finds nothing. An entry
// stays until FileManager.removeItem drops it, and dropping a directory drops
// the entries it listed.
var _entries = new Map()


export function registerFile(file) {
    if (!file || typeof file.arrayBuffer !== "function" || typeof file.name !== "string" || typeof file.size !== "number") {
        throw new TypeError("A picked or dropped item must be a File.")
    }
    return _register({kind: "file", file: file, name: file.name, children: null}, file.name)
}

// `entry` is a FileSystemDirectoryEntry; its children are read when listed.
export function registerDirectory({name, entry}) {
    return _register({kind: "directory", entry: entry, name: name, children: null}, name)
}

export function registered(path) {
    return typeof path === "string" && _entries.has(path) ? _entries.get(path) : null
}

// Drops the entry and, for a directory, every entry it listed.
export function forget(path) {
    var entry = registered(path)
    if (!entry) { return }
    _entries.delete(path)
    for (var child of entry.children || []) { forget(child) }
}

export function registeredCount() {
    return _entries.size
}

export function remember(path, children) {
    registered(path).children = children
}


function _register(entry, name) {
    var segment = encodeURIComponent(name === "" ? "file" : name)
    var url = new URL("file:///" + _token() + "/" + segment)
    _entries.set(url.href, entry)
    return url
}

// Not guessable by accident, though nothing here is a secret: the page that
// holds a URL already holds the File.
function _token() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { return crypto.randomUUID() }
    return uuid()
}
