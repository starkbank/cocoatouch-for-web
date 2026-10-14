import { required, instance } from "../utils/required.js"
import { PDFDocument } from "./pdfdocument.js"


const _documentType = instance(PDFDocument, "PDFDocument")


// PDFKit's PDFSelection. Apple's PDFSelection(document:) is empty until it is
// extended, and PDFKit's add/extend are not backable by pdf.js, so a selection
// an app builds stays empty. The ones a find returns are built by
// selectionForMatch, from pdf.js's own public getTextContent() join, never
// from a private cache.
export class PDFSelection {

    // PDFSelection(document:)
    /**
     * @param {object} options
     * @param {PDFDocument} options.document
     */
    constructor({document} = {}) {
        required(document, "document", _documentType, "PDFSelection(document:)", "Apple's is PDFSelection(document:); write new PDFSelection({document}).")
        this._string = ""
        this._pages = []
    }

    get string() {
        return this._string
    }

    get pages() {
        return this._pages
    }
}


// Framework-internal, not re-exported from pdfkit/index.js: how a find builds
// its result. matchOrdinal is PDFView's own bookkeeping for the direction
// check when stepping between matches — Apple's PDFSelection has no such
// property, so it is set on the instance here rather than added to the public
// shape the constructor accepts.
export function selectionForMatch({document, string, pages, matchOrdinal}) {
    var selection = new PDFSelection({document: document})
    selection._string = string
    selection._pages = pages
    selection._matchOrdinal = matchOrdinal
    return selection
}
