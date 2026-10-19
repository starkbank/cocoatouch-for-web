import { NSObject } from "./nsobject.js"
import { registered, forget, remember, registerFile, registerDirectory } from "./fileregistry.js"
import { required, instance, StringType } from "../utils/required.js"


// FileAttributeKey, the one key attributesOfItem answers.
export const FileAttributeKey = Object.freeze({
    size: "NSFileSize",
})

const urlType = instance(URL, "URL")

var _default = null


// Foundation's FileManager, cut to reading what the user picked or dropped.
// A page has no file system, so a path here is the file: URL the framework
// minted for a File (UIDocumentPickerViewController, UIDropInteraction), and
// anything else finds nothing: an empty name, null attributes, null contents,
// an empty listing. Nothing here makes a request. contents(atPath:) and
// contentsOfDirectory(atPath:) answer a Promise, where Apple's answer at once,
// because a browser cannot read a file synchronously; and the listing answers
// each child's path, which the other methods take, where Apple's answers bare
// names.
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
     * @returns {{NSFileSize: number}|null}
     */
    attributesOfItem({atPath} = {}) {
        var entry = registered(_path(atPath, "FileManager.attributesOfItem", "attributesOfItem"))
        if (!entry) { return null }
        return {[FileAttributeKey.size]: entry.kind === "file" ? entry.file.size : 0}
    }

    // The file's bytes, as Data is in Swift; null for a directory or a path nobody minted.
    /**
     * @param {object} options
     * @param {string} options.atPath
     * @returns {Promise<Uint8Array|null>}
     */
    contents({atPath} = {}) {
        var entry = registered(_path(atPath, "FileManager.contents", "contents"))
        if (!entry || entry.kind !== "file") { return Promise.resolve(null) }
        return entry.file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
    }

    // The paths of a directory's children, registering each as it is listed;
    // listing again answers the same paths.
    /**
     * @param {object} options
     * @param {string} options.atPath
     * @returns {Promise<string[]>}
     */
    contentsOfDirectory({atPath} = {}) {
        var path = _path(atPath, "FileManager.contentsOfDirectory", "contentsOfDirectory")
        var entry = registered(path)
        if (!entry || entry.kind !== "directory") { return Promise.resolve([]) }
        if (entry.children) { return Promise.resolve(entry.children.slice()) }
        return _readAll(entry.entry).then((children) => Promise.all(children.map(_register))).then((urls) => {
            var paths = urls.map((url) => url.href)
            remember(path, paths)
            return paths.slice()
        })
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
