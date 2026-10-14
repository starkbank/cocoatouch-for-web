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

// The worker is PDFKit's own, created at first use and terminated only when it
// reports an error, and it is handed to every getDocument() call as `worker`. It is never published
// through GlobalWorkerOptions.workerPort, not even for compatibility: with a
// shared global, getDocument() records the port-backed PDFWorker on the task
// (`task._worker`), and the first completed loadingTask.destroy() then
// terminates the thread and drops its port from pdf.js's cache for every later
// document, while PDFWorker.create() throws "the worker is being destroyed"
// for one that starts in the same tick. getDocument() sets `task._worker` only
// when no `worker` was passed, so passing one leaves destroy() nothing to
// terminate (pdfjs-dist@6.4.299 build/pdf.mjs, getDocument and
// PDFWorker.destroy). That also makes the port exclusive: `new PDFWorker({port})`
// throws "Cannot use more than one PDFWorker per port" if anything else already
// registered one, so nothing but this module may.
//
// The URL is written inline in `new Worker(new URL(...), ...)` because that
// is the exact shape webpack compiles into a worker chunk emitted beside the
// consumer's bundle; hoisting the URL into a variable would make it a plain
// asset instead. If webpack's recompiled chunk ever misbehaves on a future
// pdfjs-dist bump, fall back to `workerSrc = new URL(...).toString()` and
// re-add the consumer's `.mjs` MIME gate.
var _worker = null
var _pendingLoads = new Set()

export function pdfjsWorker() {
    if (_worker) { return _worker }
    var port = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {type: "classic"})
    port.addEventListener("error", (event) => _workerDidFail(port, event))
    _worker = new pdfjsLib.PDFWorker({port})
    return _worker
}

// getDocument() through the shared worker. pdf.js never settles a load whose
// worker chunk failed to arrive, so a 404 on the chunk would leave a
// consumer's spinner running forever — the failure the old empty-workerSrc
// check covered. The returned promise rejects instead when the worker errors;
// PDFDocument and PDFView both settle on it. release() takes the load out of
// that bookkeeping and PDFDocument calls it when it is destroyed: pdf.js
// settles a load destroyed after its handshake never, so an entry left behind
// would retain the document, its view and their elements for the life of the
// page.
export function openDocument(options) {
    var loadingTask = pdfjsLib.getDocument(Object.assign({}, options, {worker: pdfjsWorker()}))
    var settling = _settleOrWorkerFailure(loadingTask.promise)
    return {loadingTask: loadingTask, promise: settling.promise, release: settling.release}
}

function _settleOrWorkerFailure(promise) {
    var release = function() {}
    var settling = new Promise(function(resolve, reject) {
        release = function() { _pendingLoads.delete(reject) }
        _pendingLoads.add(reject)
        promise.then(
            function(value) { _pendingLoads.delete(reject); resolve(value) },
            function(reason) { _pendingLoads.delete(reject); reject(reason) }
        )
    })
    return {promise: settling, release: release}
}

// A Worker's error event is a failed chunk load and also an uncaught
// exception inside a worker that loaded fine, so the failure is not latched:
// the pending loads reject, the worker is torn down and forgotten, and the
// next document makes a fresh one. A chunk that 404s therefore fails every
// document, each with its own message, and a worker that crashed on one
// pathological document heals on the next. An event from a worker already
// replaced is ignored, so it cannot tear down its successor.
function _workerDidFail(port, event) {
    if (!_worker || _worker.port !== port) { return }
    var detail = event && event.message ? `: ${event.message}` : ""
    console.error(`PDFKit: pdf.js worker failed (pdfjs-dist/build/pdf.worker.min.mjs)${detail}`)
    var failure = new Error("pdf.js worker failed")
    failure.name = "WorkerError"
    var rejects = [..._pendingLoads]
    _pendingLoads.clear()
    for (var reject of rejects) { reject(failure) }
    var worker = _worker
    _worker = null
    worker.destroy()
    port.terminate()
}

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
