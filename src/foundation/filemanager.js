import { NSObject } from "./nsobject.js"
import { registered, forget, remember, registerFile, registerDirectory } from "./fileregistry.js"
import { required, instance, StringType } from "../utils/required.js"


// FileAttributeKey, the one key attributesOfItem answers.
export const FileAttributeKey = Object.freeze({
    size: "NSFileSize",
})

const urlType = instance(URL, "URL")

// The read of a directory that is under way, so a second listing joins it
// instead of registering every child a second time and leaving the first set
// of URLs held with no one to release them.
const listings = new WeakMap()

var _default = null


// Foundation's FileManager, cut to reading what the user picked or dropped.
// A page has no file system, so a path here is the file: URL the framework
// minted for a File (UIDocumentPickerViewController, UIDropInteraction), and
// anything else is a path with nothing at it. Nothing here makes a request.
// contents(atPath:) and contentsOfDirectory(at:) answer a Promise, where
// Apple's answer at once, because a browser cannot read a file synchronously.
//
// What each method does with a path that is missing, never minted or released,
// or a file that can no longer be read, as Apple's does:
//
//   displayName(atPath:)           the empty string, never throws
//   attributesOfItem(atPath:)      throws an Error (Apple's throws an NSError)
//   contents(atPath:)              resolves null (Apple's returns nil), never rejects
//   contentsOfDirectory(at:)       resolves an empty array
//   removeItem(at:)                does nothing
//
// A bad argument, a missing label or a wrong type, is a TypeError in every one.
export class FileManager extends NSObject {

    static get default() {
        if (!_default) { _default = new FileManager() }
        return _default
    }

    /**
     * @param {object} options
     * @param {string} options.atPath
     * @returns {string}
     */
    displayName({atPath} = {}) {
        var entry = registered(_path(atPath, "FileManager.displayName", "displayName"))
        return entry ? entry.name : ""
    }

    /**
     * @param {object} options
     * @param {string} options.atPath
     * @returns {{NSFileSize: number}}
     */
    attributesOfItem({atPath} = {}) {
        var entry = registered(_path(atPath, "FileManager.attributesOfItem", "attributesOfItem"))
        if (!entry) { throw new Error(`FileManager.attributesOfItem(atPath:): no item at ${atPath}`) }
        return {[FileAttributeKey.size]: entry.kind === "file" ? entry.file.size : 0}
    }

    // The file's bytes, as Data is in Swift; null for a directory, a path nobody
    // minted, or a file the browser can no longer read (it was moved or deleted
    // after it was picked), where Apple's returns nil.
    /**
     * @param {object} options
     * @param {string} options.atPath
     * @returns {Promise<Uint8Array|null>}
     */
    contents({atPath} = {}) {
        var entry = registered(_path(atPath, "FileManager.contents", "contents"))
        if (!entry || entry.kind !== "file") { return Promise.resolve(null) }
        return entry.file.arrayBuffer().then((buffer) => new Uint8Array(buffer), () => null)
    }

    // The URLs of a directory's children, registering each as it is listed;
    // listing again, or while the first listing is still reading, answers the
    // same URLs, and a folder released by removeItem while it is being read
    // answers []. Properties are not supported, so
    // includingPropertiesForKeys is null, and options is not taken.
    /**
     * @param {object} options
     * @param {URL} options.at
     * @param {null} options.includingPropertiesForKeys
     * @returns {Promise<URL[]>}
     */
    contentsOfDirectory({at, includingPropertiesForKeys} = {}) {
        var signature = "Apple's is contentsOfDirectory(at:includingPropertiesForKeys:options:); write manager.contentsOfDirectory({at: url, includingPropertiesForKeys: null})."
        required(at, "at", urlType, "FileManager.contentsOfDirectory", signature)
        if (includingPropertiesForKeys !== null) {
            throw new TypeError(`FileManager.contentsOfDirectory requires includingPropertiesForKeys, which must be null as no resource keys are supported: ${signature}`)
        }
        var path = at.href
        var entry = registered(path)
        if (!entry || entry.kind !== "directory") { return Promise.resolve([]) }
        if (entry.children) { return Promise.resolve(entry.children.map((child) => new URL(child))) }
        return _listing(entry, path).then((urls) => urls.slice())
    }

    // Releases the file, or the directory and everything it listed.
    /**
     * @param {object} options
     * @param {URL} options.at
     */
    removeItem({at} = {}) {
        required(at, "at", urlType, "FileManager.removeItem", "Apple's is removeItem(at:); write manager.removeItem({at: url}).")
        forget(at.href)
    }
}


function _path(atPath, method, name) {
    return required(atPath, "atPath", StringType, method, `Apple's is ${name}(atPath:); write manager.${name}({atPath: path}).`)
}

function _listing(entry, path) {
    if (listings.has(entry)) { return listings.get(entry) }
    var listing = _readAll(entry.entry).then((children) => Promise.all(children.map(_register))).then((urls) => {
        if (registered(path)) {
            remember(path, urls.map((url) => url.href))
            return urls
        }
        // removeItem released the folder while it was being read: its children
        // have no owner, so they go with it and the listing is empty.
        urls.forEach((url) => forget(url.href))
        return []
    })
    listings.set(entry, listing)
    var done = () => listings.delete(entry)
    listing.then(done, done)
    return listing
}

// readEntries answers a batch at a time and an empty batch when it is done.
function _readAll(directory) {
    var reader = directory.createReader()
    var all = []
    return new Promise((resolve, reject) => {
        var next = () => reader.readEntries((batch) => {
            if (batch.length === 0) { return resolve(all) }
            all.push(...batch)
            next()
        }, reject)
        next()
    })
}

function _register(child) {
    if (child.isDirectory) { return Promise.resolve(registerDirectory({name: child.name, entry: child})) }
    return new Promise((resolve, reject) => child.file(resolve, reject)).then(registerFile)
}
