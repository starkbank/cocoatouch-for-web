// PDFKit's PDFPage: a lightweight reference to one page of a PDFDocument,
// identified by its 0-based index. It holds no pdf.js state of its own —
// PDFDocument owns the underlying page proxy and its text, by the public
// getTextContent() pdf.js exposes, so a page handed out before its document
// finishes loading is still a valid, stable reference.
export class PDFPage {

    constructor(document, index) {
        this._document = document
        this._index = index
    }

    get document() {
        return this._document
    }

    // Apple's label is the page's displayed number, which a PDF can override
    // (roman numerals, a front-matter offset) through its page-labels tree.
    // That tree loads asynchronously with the rest of the document; until it
    // resolves, the 1-based index is Apple's own fallback for an unlabelled page.
    get label() {
        var labels = this._document._pageLabels
        if (labels && labels[this._index] !== undefined) { return labels[this._index] }
        return String(this._index + 1)
    }
}
