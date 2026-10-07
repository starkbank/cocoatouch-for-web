// PDFKit's PDFSelection: an immutable result of a find, carrying the matched
// text and the pages it falls on. PDFDocument is the only class that builds
// one, from pdf.js's own public getTextContent() join, never from a private cache.
export class PDFSelection {

    constructor({string, pages}) {
        this._string = string
        this._pages = pages
    }

    get string() {
        return this._string
    }

    get pages() {
        return this._pages
    }
}
