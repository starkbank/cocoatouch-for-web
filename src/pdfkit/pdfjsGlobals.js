// The framework never bundles pdf.js: the host page publishes pdfjsLib and
// pdfjsViewer as globals from its own bundle, through a static import
// evaluated before any controller is constructed. PDFKit's half of that
// contract is to read them the one way that keeps it honest — synchronously,
// at first use, throwing when they are missing. No polling, no await, no
// readiness event: a missing global is a wiring mistake the host needs to see
// immediately, not one PDFKit papers over with a retry.

export function pdfjsLib() {
    var lib = globalThis.pdfjsLib
    if (!lib) {
        throw new TypeError("PDFKit requires globalThis.pdfjsLib: the host page must load pdf.js (pdfjs-dist's build/pdf.min.mjs) and publish it as globalThis.pdfjsLib before constructing a PDFView or PDFDocument.")
    }
    if (!lib.GlobalWorkerOptions || !lib.GlobalWorkerOptions.workerSrc) {
        throw new TypeError("PDFKit requires pdfjsLib.GlobalWorkerOptions.workerSrc to be set: an empty workerSrc lets pdf.js silently fall back to parsing on the main thread instead of failing loudly.")
    }
    return lib
}

export function pdfjsViewer() {
    var viewer = globalThis.pdfjsViewer
    if (!viewer) {
        throw new TypeError("PDFKit requires globalThis.pdfjsViewer: the host page must load pdf.js's viewer (pdfjs-dist's web/pdf_viewer.mjs) and publish it as globalThis.pdfjsViewer before constructing a PDFView.")
    }
    return viewer
}

// cMapUrl, standardFontDataUrl and wasmUrl have no place in PDFDocument's
// constructor: Apple's PDFDocument(url:) takes no such parameter, so adding
// one would be an interface Apple does not have. A host that needs them —
// correct glyph metrics for a non-Latin script, or wasm image codecs it has
// chosen to accept the CSP cost of — publishes them the same way it publishes
// pdfjsLib and pdfjsViewer: as globals, from the same module that already
// sets GlobalWorkerOptions.workerSrc. Read synchronously at call time, same
// contract as everywhere else — no polling, no waiting — and a key is
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
// `.textLayer { position: absolute; ... }` rule is loaded. A host that
// forgets the stylesheet otherwise renders a page with the canvas in place
// and an unselectable, misaligned text layer sitting at the document's
// default static position — exactly the silent-looking failure this probe
// exists to catch before a consumer ever sees it. The probe element must be
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
        var version = globalThis.pdfjsLib ? globalThis.pdfjsLib.version : "unknown"
        throw new TypeError(`PDFKit requires pdfjs-dist/web/pdf_viewer.css to be loaded (pdfjsLib.version ${version}): ".textLayer" is not positioned absolutely.`)
    }
}
