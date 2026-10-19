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
    "com.compuserve.gif": {parents: ["public.image"], extensions: ["gif"], mime: "image/gif"},
    "org.webmproject.webp": {parents: ["public.image"], extensions: ["webp"], mime: "image/webp"},
    "com.microsoft.bmp": {parents: ["public.image"], extensions: ["bmp"], mime: "image/bmp"},
    "public.tiff": {parents: ["public.image"], extensions: ["tiff", "tif"], mime: "image/tiff"},
    "public.svg-image": {parents: ["public.image"], extensions: ["svg"], mime: "image/svg+xml"},
    "public.heif-standard": {parents: ["public.image"], extensions: [], mime: null},
    "public.heic": {parents: ["public.heif-standard"], extensions: ["heic"], mime: "image/heic"},
    "public.heif": {parents: ["public.heif-standard"], extensions: ["heif"], mime: "image/heif"},
    "public.text": {parents: ["public.data"], extensions: [], mime: null},
    "public.comma-separated-values-text": {parents: ["public.text"], extensions: ["csv"], mime: "text/csv"},
    "public.plain-text": {parents: ["public.text"], extensions: ["txt"], mime: "text/plain"},
    "public.html": {parents: ["public.text"], extensions: ["html", "htm"], mime: "text/html"},
    "public.rtf": {parents: ["public.text"], extensions: ["rtf"], mime: "text/rtf"},
})

const dynamicPrefix = "dyn."

var _cache = new Map()

const initSignature = "Apple's are UTType(filenameExtension:) and UTType(mimeType:); write new UTType({filenameExtension: \"pem\"}) or new UTType({mimeType: \"application/pdf\"})."


// UniformTypeIdentifiers' UTType. Apple's two initializers are failable, which
// `new` cannot be: a filename extension or a well-formed MIME type nobody
// declared is a dynamic type, as Apple's makes one, and a value that is not
// even shaped like one (an empty string, a MIME type without a subtype)
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

    static get gif() { return _constant("com.compuserve.gif") }

    static get webP() { return _constant("org.webmproject.webp") }

    static get bmp() { return _constant("com.microsoft.bmp") }

    static get heic() { return _constant("public.heic") }

    static get heif() { return _constant("public.heif") }

    static get tiff() { return _constant("public.tiff") }

    static get svg() { return _constant("public.svg-image") }

    static get commaSeparatedText() { return _constant("public.comma-separated-values-text") }

    static get plainText() { return _constant("public.plain-text") }

    static get html() { return _constant("public.html") }

    static get rtf() { return _constant("public.rtf") }

    static get item() { return _constant("public.item") }

    static get folder() { return _constant("public.folder") }

    get identifier() {
        return this._identifier
    }

    get preferredFilenameExtension() {
        var known = table[this._identifier]
        if (known) { return known.extensions.length === 0 ? null : known.extensions[0] }
        return _isDynamicMime(this._identifier) ? null : this._identifier.slice(dynamicPrefix.length)
    }

    get preferredMIMEType() {
        var known = table[this._identifier]
        if (known) { return known.mime }
        return _isDynamicMime(this._identifier) ? this._identifier.slice(dynamicPrefix.length) : null
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
        if (!known && _isDynamicMime(this._identifier)) { return [this.preferredMIMEType] }
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
    if (typeof extension !== "string" || extension.replace(/^\./, "") === "" || extension.includes("/")) {
        throw new TypeError(`UTType(filenameExtension:) takes a non-empty string: ${initSignature}`)
    }
    var normalized = extension.replace(/^\./, "").toLowerCase()
    for (var identifier of Object.keys(table)) {
        if (table[identifier].extensions.includes(normalized)) { return identifier }
    }
    return dynamicPrefix + normalized
}

// Dynamic identifiers made from a MIME type carry its slash; an extension's never does.
function _isDynamicMime(identifier) {
    return identifier.startsWith(dynamicPrefix) && identifier.includes("/")
}

const mimeShape = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

function _identifierForMime(mime) {
    if (typeof mime !== "string" || !mimeShape.test(mime)) {
        throw new TypeError(`UTType(mimeType:) takes a MIME type of the form type/subtype: ${initSignature}`)
    }
    var normalized = mime.toLowerCase()
    for (var identifier of Object.keys(table)) {
        if (table[identifier].mime === normalized) { return identifier }
    }
    return dynamicPrefix + normalized
}

function _conforms(identifier, ancestor) {
    if (identifier === ancestor) { return true }
    var parents = table[identifier] ? table[identifier].parents : ["public.data"]
    return parents.some((parent) => _conforms(parent, ancestor))
}


// The identifier of the type a MIME type names, or null when none is known;
// what a drag shows of an item before the drop.
export function identifierForKnownMime(mime) {
    var normalized = String(mime).toLowerCase()
    return Object.keys(table).find((identifier) => table[identifier].mime === normalized) || null
}

// The identifier of the type a file name's extension names; a dynamic one for
// an extension nobody declared, and null for a name with no extension.
export function identifierForFileName(name) {
    var dot = String(name).lastIndexOf(".")
    if (dot <= 0 || dot === name.length - 1) { return null }
    return _identifierForExtension(name.slice(dot + 1))
}

// Whether the type with this identifier conforms to the one named, for any
// string a caller passes: an identifier nobody declared conforms to itself only.
export function identifierConforms(identifier, ancestor) {
    return typeof ancestor === "string" && _conforms(identifier, ancestor)
}
