import { NSObject } from "./nsobject.js"


// NSAttributedString.DocumentType, the two cases a page can carry.
export const NSAttributedStringDocumentType = Object.freeze({
    html: "html",
    plain: "plain",
})


// Foundation's NSAttributedString, modelled narrowly: NSAttributedString(string:)
// for plain text and NSAttributedString(data:options:documentAttributes:) with
// the html document type for markup, plus .string. The attribute-and-range
// model is not implemented; a caller that wants bold writes <b> through the
// html document type. Markup given here is rendered as given, trusted.
export class NSAttributedString extends NSObject {

    /**
     * @param {object} options
     * @param {string} [options.string]
     * @param {string} [options.data]
     * @param {object} [options.options]
     * @param {"html"|"plain"} [options.options.documentType]
     */
    constructor({string, data, options} = {}) {
        super()
        var documentType = options && options.documentType ? options.documentType : NSAttributedStringDocumentType.plain
        if (data !== undefined && documentType === NSAttributedStringDocumentType.html) {
            this._markup = data === null ? "" : String(data)
            this._string = null
            return
        }
        var text = string !== undefined ? string : data
        this._markup = null
        this._string = text === null || text === undefined ? "" : String(text)
    }

    // The plain-text content: the text as given, or an html document's text.
    get string() {
        if (this._markup === null) { return this._string }
        if (typeof document === "undefined") { return this._markup }
        var scratch = document.createElement("div")
        scratch.innerHTML = this._markup
        return scratch.textContent
    }

    get _isMarkup() {
        return this._markup !== null
    }
}
