// PDFKit's PDFPage: a lightweight reference to one page of a PDFDocument,
// identified by its 0-based index. It holds no pdf.js state of its own —
// PDFDocument owns the underlying page proxy and its text, by the public
// getTextContent() pdf.js exposes, so a page handed out before its document
// finishes loading is still a valid, stable reference.
export class PDFPage {

    // PDFPage(): Apple's takes no arguments, and so does this. A page that
    // belongs to a document is built by pageIn, which is not exported from
    // PDFKit's index; this one belongs to none.
    constructor() {
        this._document = null
        this._index = -1
    }

    get document() {
        return this._document
    }

    // Apple's label is the page's displayed number, which a PDF can override
    // (roman numerals, a front-matter offset) through its page-labels tree.
    // That tree loads asynchronously with the rest of the document; until it
    // resolves, the 1-based index is Apple's own fallback for an unlabelled
    // page. A page with no document has no number to display: Apple's
    // label is String?, nil here.
    get label() {
        if (!this._document) { return null }
        var labels = this._document._pageLabels
        if (labels && labels[this._index] !== undefined) { return labels[this._index] }
        return String(this._index + 1)
    }
}


// Framework-internal: how PDFDocument.page(at:) builds the page it owns. Not
// re-exported from pdfkit/index.js, so the public surface stays Apple's.
export function pageIn(document, index) {
    var page = new PDFPage()
    page._document = document
    page._index = index
    return page
}
