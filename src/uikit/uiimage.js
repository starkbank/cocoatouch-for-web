import { NSObject } from "../foundation/nsobject.js"
import { UIImageRenderingMode } from "./uiimagerenderingmode.js"
import { typed, enumeration } from "../utils/required.js"


const renderingModeType = enumeration(UIImageRenderingMode, "UIImage.RenderingMode")
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
// as UTType's initializers do. Exactly one label is taken. A symbol is a
// template image, as on Apple, and a file or bytes are automatic, which a view
// draws as the picture it is; withRenderingMode(_:) makes the other kind.
export class UIImage extends NSObject {

    static get RenderingMode() {
        return UIImageRenderingMode
    }

    /**
     * @param {object} options
     * @param {string} [options.named]
     * @param {string} [options.systemName]
     * @param {Uint8Array|ArrayBuffer} [options.data]
     */
    constructor({named, systemName, data} = {}) {
        super()
        // A label counts by being there, not by its value: apps pass
        // {named: item.icon} with an icon that may be missing, and get an empty
        // image. Destructuring cannot tell {named: undefined} from {}, so the
        // argument itself is asked.
        var given = arguments[0] || {}
        var labels = ["named", "systemName", "data"].filter((label) => hasLabel(given, label))
        if (labels.length !== 1) {
            throw new TypeError(`UIImage takes exactly one of named, systemName and data. ${dataSignature}`)
        }
        this.named = named
        this.systemName = systemName
        this._dataURL = hasLabel(given, "data") ? _dataURL(data) : undefined
        this._renderingMode = hasLabel(given, "systemName") ? UIImageRenderingMode.alwaysTemplate : UIImageRenderingMode.automatic
    }

    /** @returns {"automatic"|"alwaysOriginal"|"alwaysTemplate"} */
    get renderingMode() {
        return this._renderingMode
    }

    // A new image of the same picture: UIImage is immutable, so the receiver keeps its mode.
    /**
     * @param {"automatic"|"alwaysOriginal"|"alwaysTemplate"} renderingMode
     * @returns {UIImage}
     */
    withRenderingMode(renderingMode) {
        typed(renderingMode, "renderingMode", renderingModeType, "UIImage.withRenderingMode", "Apple's is withRenderingMode(_:); write image.withRenderingMode(UIImage.RenderingMode.alwaysTemplate).")
        var copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this)
        copy._renderingMode = renderingMode
        return copy
    }
}


function hasLabel(options, label) {
    return Object.prototype.hasOwnProperty.call(options, label)
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
