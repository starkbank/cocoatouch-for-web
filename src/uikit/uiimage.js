import { NSObject } from "../foundation/nsobject.js"


const dataSignature = "Apple's is the failable UIImage(data:), init?(data: Data); write new UIImage({data: bytes}) with the bytes of a PNG, JPEG, GIF or WebP image."

// A multiple of three, so every chunk's base64 is whole and the chunks join
// into the encoding of the whole; small enough for String.fromCharCode's arguments.
const chunkSize = 24576


// UIImage(named:) is a file in the asset catalog, here a url. UIImage(systemName:)
// is a symbol from the system's icon library, here the classes of an icon font
// such as "fas fa-credit-card". UIImage(data:) is the image in those bytes, here
// a data: url built from them: no object URL is made, so nothing needs
// revoking and nothing outlives the image. Apple's init?(data:) returns nil for
// bytes that are no image, which a constructor cannot, so it throws a TypeError,
// as UTType's initializers do. Exactly one label is taken.
export class UIImage extends NSObject {

    /**
     * @param {object} options
     * @param {string} [options.named]
     * @param {string} [options.systemName]
     * @param {Uint8Array|ArrayBuffer} [options.data]
     */
    constructor({named, systemName, data} = {}) {
        super()
        var labels = [named, systemName, data].filter((label) => label !== undefined)
        if (labels.length !== 1) {
            throw new TypeError(`UIImage takes exactly one of named, systemName and data. ${dataSignature}`)
        }
        this.named = named
        this.systemName = systemName
        this._dataURL = data === undefined ? undefined : _dataURL(data)
    }
}


// What an image view draws: a data image's url, or the named one.
export function imageSource(image) {
    return image._dataURL !== undefined ? image._dataURL : image.named
}


function _dataURL(data) {
    var bytes = _bytes(data)
    var mime = _mimeType(bytes)
    if (mime === null) {
        throw new TypeError(`UIImage(data:) takes the bytes of a PNG, JPEG, GIF or WebP image, and these are none of them (SVG is refused too): ${dataSignature}`)
    }
    return `data:${mime};base64,${_base64(bytes)}`
}

// Bytes and only bytes: a string, a url or an array is no Data. The tag check
// is realm-safe, and a Buffer, a Uint8Array subclass, reads as its bytes.
function _bytes(data) {
    var tag = Object.prototype.toString.call(data)
    if (tag === "[object Uint8Array]") { return data }
    if (tag === "[object ArrayBuffer]") { return new Uint8Array(data) }
    throw new TypeError(`UIImage(data:) takes a Uint8Array or an ArrayBuffer, got ${data === null ? "null" : typeof data}: ${dataSignature}`)
}

// The format is what the leading bytes say, not what a caller claims.
function _mimeType(bytes) {
    if (_startsWith(bytes, [0x89, 0x50, 0x4E, 0x47])) { return "image/png" }
    if (_startsWith(bytes, [0xFF, 0xD8, 0xFF])) { return "image/jpeg" }
    if (_startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) { return "image/gif" }
    if (_startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && _startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) { return "image/webp" }
    return null
}

function _startsWith(bytes, signature) {
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value)
}

function _base64(bytes) {
    var encoded = ""
    for (var start = 0; start < bytes.length; start += chunkSize) {
        encoded += btoa(String.fromCharCode.apply(null, bytes.subarray(start, start + chunkSize)))
    }
    return encoded
}
