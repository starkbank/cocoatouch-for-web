import { NSObject } from "../foundation/nsobject.js"
import { required, instance } from "../utils/required.js"


// The types the app's file pickers and drop zones name, with what a browser
// can say about them: the extensions and MIME type of each, and what each
// conforms to. Everything is an item; the rest is Apple's hierarchy, cut down
// to the nodes these types need.
const table = Object.freeze({
    "public.item": {parents: [], extensions: [], mime: null},
    "public.data": {parents: ["public.item"], extensions: [], mime: null},
    "public.directory": {parents: ["public.item"], extensions: [], mime: null},
    "public.folder": {parents: ["public.directory"], extensions: [], mime: null},
    "public.image": {parents: ["public.data"], extensions: [], mime: null},
    "public.png": {parents: ["public.image"], extensions: ["png"], mime: "image/png"},
    "public.jpeg": {parents: ["public.image"], extensions: ["jpeg", "jpg"], mime: "image/jpeg"},
    "com.adobe.pdf": {parents: ["public.data"], extensions: ["pdf"], mime: "application/pdf"},
    "public.text": {parents: ["public.data"], extensions: [], mime: null},
    "public.comma-separated-values-text": {parents: ["public.text"], extensions: ["csv"], mime: "text/csv"},
})

const dynamicPrefix = "dyn."

var _cache = new Map()

const initSignature = "Apple's are UTType(filenameExtension:) and UTType(mimeType:); write new UTType({filenameExtension: \"pem\"}) or new UTType({mimeType: \"application/pdf\"})."


// UniformTypeIdentifiers' UTType. Apple's two initializers are failable and
// return nil for an unknown value, which `new` cannot: a filename extension
// nobody declared is a dynamic type, as Apple's is, and an unknown MIME type
// throws a TypeError.
export class UTType extends NSObject {

    /**
     * @param {object} options
     * @param {string} [options.filenameExtension]
     * @param {string} [options.mimeType]
     */
    constructor({filenameExtension, mimeType} = {}) {
        super()
        if ((filenameExtension === undefined) === (mimeType === undefined)) {
            throw new TypeError(`UTType takes exactly one of filenameExtension and mimeType: ${initSignature}`)
        }
        this._identifier = filenameExtension === undefined ? _identifierForMime(mimeType) : _identifierForExtension(filenameExtension)
    }

    static get pdf() { return _constant("com.adobe.pdf") }

    static get image() { return _constant("public.image") }

    static get png() { return _constant("public.png") }

    static get jpeg() { return _constant("public.jpeg") }

    static get commaSeparatedText() { return _constant("public.comma-separated-values-text") }

    static get item() { return _constant("public.item") }

    static get folder() { return _constant("public.folder") }

    get identifier() {
        return this._identifier
    }

    get preferredFilenameExtension() {
        var known = table[this._identifier]
        if (known) { return known.extensions.length === 0 ? null : known.extensions[0] }
        return this._identifier.slice(dynamicPrefix.length)
    }

    get preferredMIMEType() {
        var known = table[this._identifier]
        return known ? known.mime : null
    }

    // conforms(to:): a type conforms to itself and to every type above it.
    /**
     * @param {object} options
     * @param {UTType} options.to
     * @returns {boolean}
     */
    conforms({to} = {}) {
        required(to, "to", typeType, "UTType.conforms", "Apple's is conforms(to:); write type.conforms({to: UTType.image}).")
        return _conforms(this._identifier, to._identifier)
    }

    // Every extension and MIME type that stands for this type, for an input's accept.
    get _acceptTokens() {
        var known = table[this._identifier]
        if (!known) { return ["." + this.preferredFilenameExtension] }
        var tokens = known.extensions.map((extension) => "." + extension)
        if (known.mime) { tokens.push(known.mime) }
        if (this._identifier === "public.image") { tokens.push("image/*") }
        return tokens
    }
}

const typeType = instance(UTType, "UTType")


function _constant(identifier) {
    if (!_cache.has(identifier)) { _cache.set(identifier, _make(identifier)) }
    return _cache.get(identifier)
}

function _make(identifier) {
    var type = Object.create(UTType.prototype)
    type._identifier = identifier
    return type
}

function _identifierForExtension(extension) {
    if (typeof extension !== "string" || extension.replace(/^\./, "") === "") {
        throw new TypeError(`UTType(filenameExtension:) takes a non-empty string: ${initSignature}`)
    }
    var normalized = extension.replace(/^\./, "").toLowerCase()
    for (var identifier of Object.keys(table)) {
        if (table[identifier].extensions.includes(normalized)) { return identifier }
    }
    return dynamicPrefix + normalized
}

function _identifierForMime(mime) {
    if (typeof mime !== "string") { throw new TypeError(`UTType(mimeType:) takes a string: ${initSignature}`) }
    var normalized = mime.toLowerCase()
    for (var identifier of Object.keys(table)) {
        if (table[identifier].mime === normalized) { return identifier }
    }
    throw new TypeError(`UTType(mimeType:) knows no type for "${mime}", where Apple's initializer returns nil: ${initSignature}`)
}

function _conforms(identifier, ancestor) {
    if (identifier === ancestor) { return true }
    var parents = table[identifier] ? table[identifier].parents : ["public.data"]
    return parents.some((parent) => _conforms(parent, ancestor))
}
