// The one module-private seam to pdf.js: no other PDFKit module names a
// pdfjs-dist script, so a pdf.js bump touches this file, plus src/PDFKit.js,
// which imports pdfjs-dist/web/pdf_viewer.css for the bundler and so also
// moves if the stylesheet's path does.
// The order matters: pdf_viewer.mjs reads the global pdfjsLib that
// pdf.min.mjs publishes as it evaluates, so the library must be imported
// first. That global is pdf.js's own wiring between its two files; PDFKit
// never reads it, and a host page has nothing to publish.
import * as pdfjsLib from "pdfjs-dist/build/pdf.min.mjs"
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs"


export { pdfjsLib, pdfjsViewer }

// cMapUrl, standardFontDataUrl and wasmUrl have no place in PDFDocument's
// constructor: Apple's PDFDocument(url:) takes no such parameter, so adding
// one would be an interface Apple does not have. A host that needs them —
// correct glyph metrics for a non-Latin script, or wasm image codecs it has
// chosen to accept the CSP cost of — publishes them as globals. Read
// synchronously at call time — no polling, no waiting — and a key is
// omitted rather than passed as empty, null or any other non-string, so a
// host that sets none of them gets exactly today's getDocument() call. An
// empty cMapUrl is the exact defect the old site code shipped with.
function _usableString(value) {
    return typeof value === "string" && value !== ""
}

export function pdfjsRendererOptions() {
    var options = {}
    if (_usableString(globalThis.pdfjsCMapUrl)) {
        options.cMapUrl = globalThis.pdfjsCMapUrl
        options.cMapPacked = true
    }
    if (_usableString(globalThis.pdfjsStandardFontDataUrl)) {
        options.standardFontDataUrl = globalThis.pdfjsStandardFontDataUrl
    }
    if (_usableString(globalThis.pdfjsWasmUrl)) {
        options.wasmUrl = globalThis.pdfjsWasmUrl
    }
    return options
}

// pdf.js's text layer only lines up with its canvas when pdf_viewer.css's
// `.textLayer { position: absolute; ... }` rule is loaded. PDFKit imports that
// stylesheet itself, so a missing rule means a consumer CSS pipeline mangled
// the import the framework made (a stylus or css rule that covers
// node_modules and rewrites the file), not a host that forgot one. Left
// alone it renders the canvas in place under an unselectable, misaligned text
// layer at the document's default static position, which is why the probe
// fails loudly before a consumer ever sees it. The probe element must be
// attached to the document when measured: a detached element reads back as
// unstyled in every real browser, so measuring one in memory would always
// "pass" whether or not the stylesheet is actually loaded.
export function assertTextLayerStylesheet() {
    var probe = document.createElement("div")
    probe.className = "textLayer"
    document.body.appendChild(probe)
    var position = getComputedStyle(probe).position
    document.body.removeChild(probe)
    if (position !== "absolute") {
        throw new TypeError(`PDFKit requires pdfjs-dist/web/pdf_viewer.css to be loaded (pdfjsLib.version ${pdfjsLib.version}): ".textLayer" is not positioned absolutely.`)
    }
}
