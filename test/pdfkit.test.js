import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFView, PDFDocument, PDFPage, PDFSelection, PDFDisplayMode, PDFDisplayDirection, PDFDocumentFoundSelectionKey } from "../src/pdfkit/index.js"
import { NotificationCenter, NSNotification, NSString, NSNotFound } from "../src/index.js"
import { assertTextLayerStylesheet } from "../src/pdfkit/pdfjsGlobals.js"
import { pageIn } from "../src/pdfkit/pdfpage.js"
import { selectionForMatch } from "../src/pdfkit/pdfselection.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))


// A real stylesheet rule, so every test after the one that checks its absence
// (test 2) can construct a PDFView without tripping the same probe.
var _style = document.createElement("style")
_style.textContent = ".textLayer { position: absolute; }"
document.head.appendChild(_style)


// --- pdf.js stand-ins -------------------------------------------------
// PDFKit never reads a pdf.js prototype or an _- or #-prefixed member, so
// these stand-ins only need to answer the public shape PDFKit's source calls:
// plain properties and methods, nothing pdf.js itself would recognise.

class FakeEventBus {
    constructor() {
        this._listeners = {}
        this.calls = []
    }
    on(name, fn) {
        (this._listeners[name] = this._listeners[name] || []).push(fn)
    }
    off(name, fn) {
        var list = this._listeners[name]
        if (!list) { return }
        var index = list.indexOf(fn)
        if (index !== -1) { list.splice(index, 1) }
    }
    dispatch(name, data) {
        this.calls.push({name: name, data: data})
        for (var fn of (this._listeners[name] || []).slice()) { fn(data) }
    }
}

class FakeLinkService {
    constructor(options) {
        this.options = options
        this.viewer = null
        this.pdfDocument = null
    }
    setViewer(viewer) {
        this.viewer = viewer
    }
    // Real PDFLinkService.setDocument(pdfDocument, baseUrl); PDFFindController
    // reads linkService.pdfDocument through its pagesCount getter to iterate
    // every page, so a stub without this method would have let the missing
    // real call through just as silently as the real bug did.
    setDocument(pdfDocument) {
        this.pdfDocument = pdfDocument
    }
}

class FakeFindController {
    constructor(options) {
        this.options = options
        this.pageMatches = []
        this.pageMatchesLength = []
    }
}

class FakeViewer {
    constructor(options) {
        this.options = options
        this.scaleWrites = []
        this.scrollCalls = []
        this._currentScale = 1
        this._currentPageNumber = 1
        this.document = null
        this.pagesCount = 0
    }
    setDocument(proxy) {
        this.document = proxy
        this.pagesCount = proxy ? proxy.numPages : 0
    }
    // pdf.js's own scrollMode setter writes its class state onto the viewer
    // element (scrollHorizontal / scrollWrapped, pdf_viewer.mjs), the same
    // element PDFKit toggles removePageBorders on; the stand-in does the same so
    // a whole-className write on PDFKit's side would be caught.
    set scrollMode(mode) {
        this._scrollMode = mode
        this.options.viewer.classList.toggle("scrollHorizontal", mode === ScrollMode.HORIZONTAL)
        this.options.viewer.classList.toggle("scrollWrapped", mode === ScrollMode.WRAPPED)
    }
    get scrollMode() {
        return this._scrollMode
    }
    set currentScaleValue(value) {
        this.scaleWrites.push({kind: "value", value: value})
        this._currentScale = value
    }
    get currentScaleValue() {
        return this._currentScale
    }
    set currentScale(value) {
        this.scaleWrites.push({kind: "scale", value: value})
        this._currentScale = value
    }
    get currentScale() {
        return this._currentScale
    }
    set currentPageNumber(n) {
        this._currentPageNumber = n
        this.options.eventBus.dispatch("pagechanging", {pageNumber: n})
    }
    get currentPageNumber() {
        return this._currentPageNumber
    }
    scrollPageIntoView(options) {
        this.scrollCalls.push(options)
    }
    // pdf.js's public accessor: a PDFPageView per page, or undefined before
    // its views exist. Tests install the views they want through pageViews.
    getPageView(index) {
        return this.pageViews ? this.pageViews[index] : undefined
    }
}

// Real values at the pinned version (pdfjs-dist/web/pdf_viewer.mjs), not
// placeholders: a stub that invents its own values for a real enum can hide
// the exact class of bug a mis-sourced global does — nothing here would have
// failed against the wrong numbers either, since nothing compared them to
// the real pdf.js until this was checked by hand against the installed package.
var ScrollMode = Object.freeze({UNKNOWN: -1, VERTICAL: 0, HORIZONTAL: 1, WRAPPED: 2, PAGE: 3})
var SpreadMode = Object.freeze({UNKNOWN: -1, NONE: 0, ODD: 1, EVEN: 2})
var FindState = Object.freeze({FOUND: 0, NOT_FOUND: 1, WRAPPED: 2, PENDING: 3})
// LinkTarget is pdfjsViewer's export (pdf_viewer.mjs), not pdfjsLib's: it has
// no member by that name at all. Values below match pdfjsViewer's real
// LinkTarget object exactly.
var LinkTarget = Object.freeze({NONE: 0, SELF: 1, BLANK: 2, PARENT: 3, TOP: 4})

function fakePdfjsViewer() {
    return {
        EventBus: FakeEventBus,
        PDFLinkService: FakeLinkService,
        PDFFindController: FakeFindController,
        PDFViewer: FakeViewer,
        ScrollMode: ScrollMode,
        SpreadMode: SpreadMode,
        FindState: FindState,
        LinkTarget: LinkTarget,
    }
}

// A fake PDFDocumentProxy/page, so PDFSelection.string's derivation (ruling
// 3c) runs against a real public getTextContent() shape rather than a stub
// that begs the question.
function fakeProxy({numPages, pages, labels}) {
    return {
        numPages: numPages,
        getPage: function(n) {
            return Promise.resolve(pages[n - 1])
        },
        getPageLabels: function() {
            return Promise.resolve(labels || null)
        },
    }
}

function fakePage(items) {
    return {getTextContent: function() { return Promise.resolve({items: items}) }}
}

var _getDocumentCalls = []

function fakePdfjsLib({resolve, reject} = {}) {
    _getDocumentCalls = []
    return {
        version: "6.4.299",
        GlobalWorkerOptions: {workerSrc: "/static/pdfjs/pdf.worker.min.mjs"},
        AnnotationMode: {ENABLE: 1},
        getDocument: function(options) {
            _getDocumentCalls.push(options)
            var destroyed = false
            var promise = new Promise(function(res, rej) {
                if (resolve !== undefined) { res(resolve) }
                if (reject !== undefined) { rej(reject) }
            })
            promise.catch(function() {}) // a stub must not leave this unhandled either
            return {
                promise: promise,
                destroy: function() { destroyed = true; return Promise.resolve() },
                get destroyed() { return destroyed },
            }
        },
    }
}

function installPdfjs(options) {
    globalThis.pdfjsLib = fakePdfjsLib(options)
    globalThis.pdfjsViewer = fakePdfjsViewer()
}

function uninstallPdfjs() {
    delete globalThis.pdfjsLib
    delete globalThis.pdfjsViewer
}

// Builds a connected host element with a PDFView bound to it. awakeFromNib
// runs as it would from an @IBOutlet, through the real attach path.
function makeView() {
    var host = document.createElement("div")
    host.id = "pdf-" + Math.random().toString(36).slice(2)
    document.body.appendChild(host)
    var view = new PDFView("#" + host.id)
    view._$el = $(host)
    view.awakeFromNib()
    return view
}

async function flush() {
    for (var i = 0; i < 10; i++) { await Promise.resolve() }
}


// 1. Missing globals and an empty workerSrc, both at first use.
test("missing pdfjsLib throws naming pdf.js; an empty GlobalWorkerOptions.workerSrc throws naming it", function() {
    uninstallPdfjs()
    assert.throws(function() { new PDFDocument({url: "/a.pdf"}) }, /pdfjsLib.*pdf\.js/s)

    globalThis.pdfjsLib = fakePdfjsLib({resolve: fakeProxy({numPages: 0, pages: []})})
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = ""
    globalThis.pdfjsViewer = fakePdfjsViewer()
    assert.throws(function() { new PDFDocument({url: "/a.pdf"}) }, /workerSrc/)
    uninstallPdfjs()
})

// 2. The stylesheet probe, measured on a document-attached element.
test("an unstyled .textLayer throws naming pdf_viewer.css and pdfjsLib.version", function() {
    installPdfjs({resolve: fakeProxy({numPages: 0, pages: []})})
    document.head.removeChild(_style)
    try {
        assert.throws(function() { assertTextLayerStylesheet() }, /pdf_viewer\.css.*6\.4\.299/s)
    } finally {
        document.head.appendChild(_style)
        uninstallPdfjs()
    }
})

// 3. isEvalSupported: false, unconditionally.
test("PDFDocument always calls getDocument with isEvalSupported: false", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    new PDFDocument({url: "/a.pdf"})
    assert.equal(_getDocumentCalls.length, 1)
    assert.equal(_getDocumentCalls[0].isEvalSupported, false)
    uninstallPdfjs()
})

// cMapUrl/standardFontDataUrl/wasmUrl are not Apple's API, so they are not
// PDFDocument(url:) parameters; the host publishes them as globals, the same
// contract as pdfjsLib and pdfjsViewer, and PDFKit reads them at call time.
test("cMapUrl, standardFontDataUrl and wasmUrl reach getDocument when the host publishes them", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    globalThis.pdfjsCMapUrl = "/static/pdfjs/cmaps/"
    globalThis.pdfjsStandardFontDataUrl = "/static/pdfjs/standard_fonts/"
    globalThis.pdfjsWasmUrl = "/static/pdfjs/wasm/"
    new PDFDocument({url: "/a.pdf"})
    var call = _getDocumentCalls[_getDocumentCalls.length - 1]
    assert.equal(call.cMapUrl, "/static/pdfjs/cmaps/")
    assert.equal(call.cMapPacked, true)
    assert.equal(call.standardFontDataUrl, "/static/pdfjs/standard_fonts/")
    assert.equal(call.wasmUrl, "/static/pdfjs/wasm/")
    delete globalThis.pdfjsCMapUrl
    delete globalThis.pdfjsStandardFontDataUrl
    delete globalThis.pdfjsWasmUrl
    uninstallPdfjs()
})

test("a host that publishes none of cMapUrl, standardFontDataUrl or wasmUrl gets today's getDocument() call, with no keys omitted as undefined", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    new PDFDocument({url: "/a.pdf"})
    var call = _getDocumentCalls[_getDocumentCalls.length - 1]
    assert.deepEqual(Object.keys(call).sort(), ["isEvalSupported", "url"])
    uninstallPdfjs()
})

// An empty cMapUrl is the exact defect the old site code shipped with
// (finding 2): only a non-empty string is forwarded, never "", null or 0.
test("an empty string or null for cMapUrl, standardFontDataUrl or wasmUrl leaves the key omitted, not forwarded as empty", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    globalThis.pdfjsCMapUrl = ""
    globalThis.pdfjsStandardFontDataUrl = null
    globalThis.pdfjsWasmUrl = 0
    new PDFDocument({url: "/a.pdf"})
    var call = _getDocumentCalls[_getDocumentCalls.length - 1]
    assert.deepEqual(Object.keys(call).sort(), ["isEvalSupported", "url"])
    delete globalThis.pdfjsCMapUrl
    delete globalThis.pdfjsStandardFontDataUrl
    delete globalThis.pdfjsWasmUrl
    uninstallPdfjs()
})

// 4. Input constraints: relative and http(s) only, judged after resolution —
// not by reading the string as written, which a leading space or an embedded
// control character can fool (finding 1).
test("PDFDocument(url:) refuses javascript:, data:, blob:, mailto: and tel:, and accepts relative, protocol-relative and absolute http(s)", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    for (var scheme of ["javascript", "data", "blob", "mailto", "tel"]) {
        assert.throws(function() { new PDFDocument({url: scheme + ":something"}) }, TypeError, scheme)
    }
    assert.doesNotThrow(function() { new PDFDocument({url: "/static/legal.pdf"}) })
    assert.doesNotThrow(function() { new PDFDocument({url: "https://starkbank.com/static/legal.pdf"}) })
    assert.doesNotThrow(function() { new PDFDocument({url: "//cdn.example/legal.pdf"}) }, "protocol-relative resolves to the page's own http(s) scheme; origin policy is CSP's connect-src, not this check")
    uninstallPdfjs()
})

test("PDFDocument(url:) refuses a scheme hidden by a leading space or an embedded control character the URL parser strips before the framework sees the scheme", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    assert.throws(function() { new PDFDocument({url: " data:application/pdf;base64,x"}) }, TypeError)
    assert.throws(function() { new PDFDocument({url: "\tjavascript:alert(1)"}) }, TypeError)
    assert.throws(function() { new PDFDocument({url: "da\nta:application/pdf;base64,x"}) }, TypeError)
    uninstallPdfjs()
})

// 5. document posts once; pageCount/page(at:) reflect the stub; out of range is null.
test("setting document posts PDFViewDocumentChanged once; pageCount and page(at:) reflect the stub", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 2, pages: [fakePage([]), fakePage([])]})})
    var view = makeView()
    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewDocumentChanged, selector: function(n) { posts.push(n) }})
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(posts.length, 1)
    assert.equal(doc.pageCount, 2)
    assert.ok(doc.page({at: 0}) instanceof PDFPage)
    assert.ok(doc.page({at: 1}) instanceof PDFPage)
    assert.equal(doc.page({at: 2}), null)
    assert.equal(doc.page({at: -1}), null)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 6. currentPage/go(to:) round-trip; PDFViewPageChanged only on a real change.
test("currentPage and go(to:) round-trip; PDFViewPageChanged fires only on a real change", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 2, pages: [fakePage([]), fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    var changes = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewPageChanged, selector: function() { changes.push(1) }})
    var page2 = doc.page({at: 1})
    view.go({to: page2})
    assert.equal(view.currentPage, page2)
    assert.equal(changes.length, 1)
    view.go({to: page2})
    assert.equal(changes.length, 1, "setting the same page again is not a real change")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 6b. go(to:) ignores a page that is not in the displayed document, as Apple's does.
test("go(to:) leaves currentPageNumber alone for a bare PDFPage and for a page of another document, and still turns to its own", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 2, pages: [fakePage([]), fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    var other = new PDFDocument({url: "/b.pdf"})
    view.document = doc
    await flush()
    assert.equal(view._pdfViewer.currentPageNumber, 1)
    assert.doesNotThrow(function() { view.go({to: new PDFPage()}) })
    assert.equal(view._pdfViewer.currentPageNumber, 1, "a bare PDFPage belongs to no document")
    view.go({to: other.page({at: 1})})
    assert.equal(view._pdfViewer.currentPageNumber, 1, "a page of another document must not turn to its index here")
    view.go({to: doc.page({at: 1})})
    assert.equal(view._pdfViewer.currentPageNumber, 2, "a page of the shown document still navigates")
    uninstallPdfjs()
})

// 7. scaleFactor clamps to min/max.
test("scaleFactor clamps to minScaleFactor and maxScaleFactor", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    view.minScaleFactor = 0.5
    view.maxScaleFactor = 2
    view.scaleFactor = 10
    assert.equal(view.scaleFactor, 2)
    view.scaleFactor = 0.1
    assert.equal(view.scaleFactor, 0.5)
    uninstallPdfjs()
})

// displayMode had no test at all before this audit, which is exactly how the
// stub's wrong ScrollMode/SpreadMode values (strings, not pdf.js's real
// integers) went unnoticed: nothing exercised the one path that reads them.
test("displayMode maps onto the viewer's real scrollMode/spreadMode values, default singlePageContinuous", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    assert.equal(view.displayMode, PDFDisplayMode.singlePageContinuous)
    assert.equal(view._pdfViewer.scrollMode, undefined, "the default is never written back to the stub viewer until displayMode is set")

    view.displayMode = PDFDisplayMode.singlePage
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.PAGE)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.NONE)

    view.displayMode = PDFDisplayMode.singlePageContinuous
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.VERTICAL)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.NONE)

    view.displayMode = PDFDisplayMode.twoUp
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.PAGE)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.ODD)

    view.displayMode = PDFDisplayMode.twoUpContinuous
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.VERTICAL)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.ODD)

    assert.throws(function() { view.displayMode = "not a real mode" }, /PDFView\.displayMode/)
    uninstallPdfjs()
})

// 8. Copying from the text layer is never permission-gated. PDFView does not
// pass textLayerMode at all: pdf.js's PDFViewer defaults it to
// TextLayerMode.ENABLE when the option is absent, so omitting it ties PDFKit
// to that default rather than to a bare literal it would have to keep in step
// with an enum it does not own — the only way to lose copying from here on is
// an upstream default change, which the clipboard check at step 7 catches
// against the exact pinned version. Asserting a number, even the right one,
// is how the first version of this test pinned the bug it meant to catch in
// place; this asserts the option's absence instead.
test("the viewer is always constructed with a text layer; textLayerMode is never passed, so copying is never permission-gated, and is not part of PDFView's surface", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    assert.equal("textLayerMode" in view._pdfViewer.options, false)
    assert.equal("textLayerMode" in view, false)
    uninstallPdfjs()
})

// 9. Source-level: no web escape hatches, no scale property, no clipboard listeners.
test("src/pdfkit/ writes no innerHTML, style, href or scale custom property, and binds no clipboard listener", function() {
    var dir = path.join(__dirname, "..", "src", "pdfkit")
    var forbidden = [/innerHTML/, /insertAdjacentHTML/, /\.href\s*=/, /\.style[.[]/, /--scale-factor/, /--total-scale-factor/, /addEventListener\(\s*["'](copy|cut|paste|selectionchange)["']/]
    for (var file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js")) { continue }
        var text = fs.readFileSync(path.join(dir, file), "utf8")
        for (var pattern of forbidden) {
            assert.equal(pattern.test(text), false, `${file} matches forbidden pattern ${pattern}`)
        }
    }
})

// The no-internals rule the whole find design is built around (ruling 3,
// non-negotiable 3): nothing in src/pdfkit/ reads a private member of a
// pdf.js object it holds. Scoped to every name the directory actually binds a
// pdf.js object to — PDFKit's own handles (_findController, _pdfViewer,
// _linkService, _eventBus, a document's _proxy) and the names pdf.js's own
// callback shapes hand back (pageProxy, proxy, content, evt) — rather than
// every underscore in the directory, which would also flag PDFKit's own
// private fields on its own classes, a different and permitted thing. A
// pattern bound only to PDFKit's own handle names would miss a local alias —
// `var controller = this._findController; controller._x` — so this checks the
// object names the directory is written against, not only the handles.
test("src/pdfkit/ never reads a private member of a pdf.js object it holds", function() {
    var dir = path.join(__dirname, "..", "src", "pdfkit")
    var forbidden = [/_findController\._/, /_pdfViewer\._/, /_linkService\._/, /_eventBus\._/, /_proxy\._/, /pageProxy\._/, /proxy\._/, /content\._/, /evt\._/, /\.#/]
    for (var file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js")) { continue }
        var text = fs.readFileSync(path.join(dir, file), "utf8")
        for (var pattern of forbidden) {
            assert.equal(pattern.test(text), false, `${file} matches forbidden pattern ${pattern}`)
        }
    }
})

// 10. One coalesced layout pass makes exactly one scale write.
test("layoutSubviews makes exactly one scale write per call", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var before = view._pdfViewer.scaleWrites.length
    view.layoutSubviews()
    assert.equal(view._pdfViewer.scaleWrites.length, before + 1)
    uninstallPdfjs()
})

// 11. N resize events coalesced by the framework's own resize path produce one layout pass.
test("the framework's existing resize coalescing reaches PDFView as a single layoutSubviews call", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var calls = 0
    var original = view.layoutSubviews.bind(view)
    view.layoutSubviews = function() { calls++; return original() }
    for (var i = 0; i < 5; i++) { view.layoutSubviews() }
    // PDFView makes no resize listener of its own (finding of §3.6); it only
    // ever reacts through the one hook the framework's window-resize path
    // already calls once per burst, so calling it N times here stands in for
    // N real resize events reaching the same framework-coalesced point.
    assert.equal(calls, 5)
    uninstallPdfjs()
})

// 12. Document replacement and disposal destroy exactly once; dispose drops listeners.
test("setting document again destroys the previous one exactly once; _dispose does the same and drops the EventBus listeners", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var first = new PDFDocument({url: "/a.pdf"})
    view.document = first
    await flush()
    var second = new PDFDocument({url: "/b.pdf"})
    view.document = second
    await flush()
    assert.equal(first._loadingTask.destroyed, true)
    first._destroy()
    assert.equal(first._loadingTask.destroyed, true, "destroying twice must not throw or double-run")

    var eventBus = view._eventBus
    var listenersBefore = Object.keys(eventBus._listeners).reduce(function(n, k) { return n + eventBus._listeners[k].length }, 0)
    view._dispose()
    var listenersAfter = Object.keys(eventBus._listeners).reduce(function(n, k) { return n + eventBus._listeners[k].length }, 0)
    assert.ok(listenersAfter < listenersBefore)
    assert.equal(second._loadingTask.destroyed, true)
    uninstallPdfjs()
})

// 5 (performance): detaching a document must tell the viewer, not just
// destroy the loading task — otherwise the viewer keeps the old pages,
// canvases and text layers alive against a worker port that is already gone.
test("setting document to null clears the viewer's own document, not only PDFKit's", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(view._pdfViewer.document, doc._proxy)
    view.document = null
    assert.equal(view._pdfViewer.document, null)
    uninstallPdfjs()
})

// The real PDFViewer.setDocument propagates to its own findController but
// never to its linkService (verified directly against the installed pdf.js
// source), and PDFFindController's extraction loop iterates
// linkService.pagesCount — left unset, it is 0, and a search silently
// returns nothing, for every document, with no error anywhere. Found live,
// against the real library, wiring the search field on starkbank-home.
test("setting document sets the link service's document too, not only the viewer's; clearing does the same", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(view._linkService.pdfDocument, doc._proxy)
    view.document = null
    assert.equal(view._linkService.pdfDocument, null)
    uninstallPdfjs()
})

// 13. currentSelection/clearSelection + notification; clearing highlights dispatches an empty find.
test("currentSelection and clearSelection post PDFViewSelectionChanged; clearing highlights dispatches an empty find, not node removal", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewSelectionChanged, selector: function() { posts.push(1) }})
    var doc = new PDFDocument({url: "/a.pdf"})
    var selection = selectionForMatch({document: doc, string: "hello", pages: []})
    view.currentSelection = selection
    assert.equal(view.currentSelection, selection)
    assert.equal(posts.length, 1)
    view.clearSelection()
    assert.equal(view.currentSelection, null)
    assert.equal(posts.length, 2)

    view.highlightedSelections = [selection]
    assert.deepEqual(view.highlightedSelections, [selection])
    var dispatchesBefore = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    view.highlightedSelections = []
    var findDispatches = view._eventBus.calls.filter(function(c) { return c.name === "find" })
    assert.equal(findDispatches.length, dispatchesBefore + 1)
    assert.equal(findDispatches[findDispatches.length - 1].data.query, "")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// End-of-find comes only from updatefindmatchescount (finding 3), which an
// empty query never fires — pdf.js returns from its own match step before
// matching anything — so the clearing dispatch needs no guard against a
// spurious end (finding 4, which removed the guard this test used to exercise).
// Dispatched in pdf.js's real order: updatefindcontrolstate(PENDING)
// synchronously on every dispatch, find or clear, then FOUND; matchescount,
// when it comes at all, strictly after.
test("clearing highlightedSelections posts no end-of-find; a real search still posts exactly one for itself", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "a", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    view.highlightedSelections = []
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.FOUND})
    assert.equal(ends.length, 0, "clearing never reaches matchescount, so it must never end")

    doc.beginFindString("a")
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.FOUND})
    assert.equal(ends.length, 0, "a real search has not ended until its own matchescount event")
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[1]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    await flush()
    assert.equal(ends.length, 1)

    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 14. Option mapping, Apple-exact: caseSensitive is the absence of
// .caseInsensitive; entireWord is never set; matchDiacritics is true unless
// .diacriticInsensitive is given (Apple's default compare is diacritic-
// sensitive) and .literal always wins over it; .backwards is findPrevious.
test("find option mapping: no options is case- and diacritic-sensitive; .caseInsensitive flips caseSensitive; .diacriticInsensitive flips matchDiacritics and .literal wins over it; entireWord is never set; .backwards maps to findPrevious", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "a", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    function dispatchedFor(options) {
        doc.beginFindString("x", {withOptions: options})
        return view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    }

    var last = dispatchedFor([])
    assert.equal(last.caseSensitive, true)
    assert.equal(last.entireWord, false)
    assert.equal(last.matchDiacritics, true)
    assert.equal(last.findPrevious, false)

    doc.beginFindString("x")
    last = view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    assert.equal(last.matchDiacritics, true, "omitting withOptions is the empty option set")

    last = dispatchedFor([NSString.CompareOptions.caseInsensitive])
    assert.equal(last.caseSensitive, false)
    assert.equal(last.matchDiacritics, true)

    last = dispatchedFor([NSString.CompareOptions.diacriticInsensitive])
    assert.equal(last.matchDiacritics, false)
    assert.equal(last.caseSensitive, true)

    last = dispatchedFor([NSString.CompareOptions.literal])
    assert.equal(last.matchDiacritics, true)
    assert.equal(last.entireWord, false)

    last = dispatchedFor([NSString.CompareOptions.literal, NSString.CompareOptions.diacriticInsensitive])
    assert.equal(last.matchDiacritics, true, ".literal wins even alongside .diacriticInsensitive")

    last = dispatchedFor([NSString.CompareOptions.backwards])
    assert.equal(last.findPrevious, true)

    for (var options of [[], [NSString.CompareOptions.literal], [NSString.CompareOptions.caseInsensitive, NSString.CompareOptions.diacriticInsensitive, NSString.CompareOptions.backwards]]) {
        assert.equal(dispatchedFor(options).entireWord, false)
    }
    uninstallPdfjs()
})

// 15. A second beginFindString supersedes the first; cancelFindString clears; empty string dispatches no find.
test("a second beginFindString supersedes the first; cancelFindString clears; an empty string posts begin/end with zero matches and no find dispatch", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "a", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var matches = []
    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    doc.beginFindString("first")
    var firstGeneration = doc._findGeneration
    doc.beginFindString("second")
    assert.notEqual(doc._findGeneration, firstGeneration)
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[1]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    await flush()
    // Stale results from the superseded "first" search must never post: only
    // the live generation's dispatch above can have produced these matches.
    assert.equal(matches.length, 1)

    doc.cancelFindString()
    assert.equal(doc.isFinding, false)

    var findDispatchesBefore = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    doc.beginFindString("")
    var findDispatchesAfter = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    assert.equal(findDispatchesAfter, findDispatchesBefore)
    assert.equal(ends[ends.length - 1].userInfo, null, "Apple's end-of-find carries no userInfo")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 16. Stubbed matches produce one DidFindMatch each and one DidEndFind, with
// PDFSelection.string from the public join/slice, dispatched in pdf.js's real
// order: FOUND can arrive on the first match while later pages are still
// being extracted, and must not itself end or report anything (finding 3).
test("stubbed matches produce one DidFindMatch each and one DidEndFind, with PDFSelection.string from the public getTextContent() join and slice", async function() {
    installPdfjs({resolve: fakeProxy({
        numPages: 1,
        pages: [fakePage([{str: "stark bank", hasEOL: false}, {str: "contract", hasEOL: true}])],
    })})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var matches = []
    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n.userInfo[PDFDocumentFoundSelectionKey]) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    doc.beginFindString("bank")
    // joined text is "stark bank" + "\n" + "contract" -> "bank" is at [6, 10)
    view._findController.pageMatches = [[6]]
    view._findController.pageMatchesLength = [[4]]
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.FOUND})
    assert.equal(matches.length, 0, "FOUND alone reports nothing; matches come only from matchescount")
    assert.equal(ends.length, 0)

    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    await flush()
    assert.equal(matches.length, 1)
    assert.equal(matches[0].string, "bank")
    assert.equal(matches[0].pages.length, 1)
    assert.ok(matches[0].pages[0] instanceof PDFPage)
    assert.equal(ends.length, 1)
    assert.equal(ends[0].userInfo, null)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// The defect findings 3/4 fixed, directly: on a document where the first page
// matches but later pages have not finished extracting, end-of-find must wait
// for every DidFindMatch to post, and PDFKit's own bookkeeping must hold the
// final total, not the count standing when the renderer selected its first
// match. Apple's end-of-find carries no userInfo, so the total is read from the
// view's own field rather than from the notification.
test("DidFindMatch for every page is observed before the single DidEndFind; the view's total is matchescount's final one, not a partial one taken on the first match", async function() {
    installPdfjs({resolve: fakeProxy({
        numPages: 2,
        pages: [fakePage([{str: "needle A", hasEOL: false}]), fakePage([{str: "needle B", hasEOL: false}])],
    })})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var order = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { order.push({kind: "match", string: n.userInfo[PDFDocumentFoundSelectionKey].string}) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { order.push({kind: "end", userInfo: n.userInfo}) }})

    doc.beginFindString("needle")
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    // The renderer selects its first match, on page 0, while page 1 is still
    // being extracted: pageMatches reflects only what has been found so far.
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[6]]
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.FOUND})
    assert.equal(order.length, 0, "FOUND on the first match must not end the search while page 1 is still pending")

    // Extraction completes; pdf.js's one matchescount event carries every
    // page's matches and the final total.
    view._findController.pageMatches = [[0], [0]]
    view._findController.pageMatchesLength = [[6], [6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 2, current: 2}})
    await flush()

    assert.equal(order.length, 3)
    assert.deepEqual(order.slice(0, 2).map(function(o) { return o.kind }), ["match", "match"], "both matches must be observed before the end")
    assert.equal(order[2].kind, "end")
    assert.equal(order[2].userInfo, null)
    assert.equal(view._lastFindTotalMatches, 2, "the total is the matchescount total, not the one standing when the first match was selected")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

test("a search with no matches posts exactly one DidEndFind, with no userInfo, and observes zero matches", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "nothing here", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var ends = []
    var matches = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n) }})

    doc.beginFindString("needle")
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.NOT_FOUND})
    assert.equal(ends.length, 0)
    view._findController.pageMatches = [[]]
    view._findController.pageMatchesLength = [[]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 0, current: 0}})
    await flush()
    assert.equal(ends.length, 1)
    assert.equal(ends[0].userInfo, null)
    assert.equal(matches.length, 0)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Finding A: a page whose text cannot be read — the realistic trigger is the
// document being replaced mid-search and its proxy destroyed out from under
// the pending read — must not strand the whole search, reach
// unhandledRejection, or poison the cache for a later search over the same page.
test("a page whose text cannot be read yields no match, not a stranded search: the other page's match and the end still post, nothing goes unhandled, and a later search retries the read", async function() {
    var attempts = 0
    var rejectingPage = {
        getTextContent: function() {
            attempts++
            return Promise.reject({name: "UnknownErrorException"})
        },
    }
    installPdfjs({resolve: fakeProxy({
        numPages: 2,
        pages: [fakePage([{str: "needle A", hasEOL: false}]), rejectingPage],
    })})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var unhandled = []
    var onUnhandled = function(reason) { unhandled.push(reason) }
    process.on("unhandledRejection", onUnhandled)

    var matches = []
    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n.userInfo[PDFDocumentFoundSelectionKey]) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    var errors = []
    var originalError = console.error
    console.error = function(message) { errors.push(message) }

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0], [0]]
    view._findController.pageMatchesLength = [[6], [6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 2, current: 2}})
    await flush()

    console.error = originalError
    process.off("unhandledRejection", onUnhandled)

    assert.equal(matches.length, 1, "the readable page's match still posts")
    assert.equal(matches[0].string, "needle")
    assert.equal(ends.length, 1, "the end still posts even though one page failed")
    assert.equal(view._lastFindTotalMatches, 2, "and the view still holds pdf.js's own total")
    assert.equal(errors.length, 1)
    assert.match(errors[0], /page 2/)
    assert.deepEqual(unhandled, [], "a page's rejected text read must never reach unhandledRejection")
    assert.equal(attempts, 1)

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0], [0]]
    view._findController.pageMatchesLength = [[6], [6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 2, current: 2}})
    await flush()
    assert.equal(attempts, 2, "a cached rejection must not poison a later search touching the same page")

    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Finding A, the quieter defect: replacing the document while a search's
// match promises are still in flight must drop that search entirely, not let
// a late resolution post with the replaced document as its subject.
test("replacing the document after updatefindmatchescount but before its match promises settle posts neither a match nor an end for the replaced document", async function() {
    var resolveText
    var slowPage = {
        getTextContent: function() {
            return new Promise(function(resolve) { resolveText = resolve })
        },
    }
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [slowPage]})})
    var view = makeView()
    var oldDoc = new PDFDocument({url: "/a.pdf"})
    view.document = oldDoc
    await flush()

    var matches = []
    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    oldDoc.beginFindString("needle")
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    // The match's text read is still in flight (slowPage's promise is unresolved).

    var newDoc = new PDFDocument({url: "/b.pdf"})
    view.document = newDoc
    await flush()

    resolveText({items: [{str: "needle", hasEOL: false}]})
    await flush()

    assert.equal(matches.length, 0, "a match for the replaced document must never post once it is no longer current")
    assert.equal(ends.length, 0, "an end for the replaced document's search must never post either")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 17. setCurrentSelection scrolls only when animated.
test("setCurrentSelection(_:animate:) scrolls when animated is true, not when it is false", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    var page = pageIn(doc, 0)
    var selection = selectionForMatch({document: doc, string: "x", pages: [page]})

    view.setCurrentSelection(selection, {animate: false})
    assert.equal(view._pdfViewer.scrollCalls.length, 0)
    view.setCurrentSelection(selectionForMatch({document: doc, string: "y", pages: [page]}), {animate: true})
    assert.equal(view._pdfViewer.scrollCalls.length, 1)
    assert.equal(view._pdfViewer.scrollCalls[0].pageNumber, 1)
    uninstallPdfjs()
})

// Apple's real PDFView draws its own current selection; here pdf.js's
// renderer draws .selected off its own find-controller pointer, which
// setCurrentSelection must keep in step with through the same public "find
// again" event pdf.js's own find bar uses — this is what the bug report
// actually was ("the second item doesn't become blue"), so the test asserts
// on the dispatched event, not on scrolling or on any particular method
// existing, and fails before the fix in the same way the bug did: with the
// bug present, stepping never dispatches a second "find" at all.
test("stepping to another match drives the renderer's own find-again pointer, in both directions and at both wrap points", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle needle needle needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var selections = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { selections.push(n.userInfo[PDFDocumentFoundSelectionKey]) }})

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0, 7, 14, 21]]
    view._findController.pageMatchesLength = [[6, 6, 6, 6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 4, current: 4}})
    await flush()
    assert.equal(selections.length, 4)

    function findCalls() { return view._eventBus.calls.filter(function(c) { return c.name === "find" }) }

    // The renderer's own "" dispatch above already auto-selects and scrolls
    // the first match once extraction completes, so jumping to it first
    // dispatches no "again" and — just as important, and the fix this test
    // caught missing first — must not fall through to the page-level
    // scrollPageIntoView either: that call does not know about a site's
    // scroll-margin-top and would overwrite the position pdf.js's own
    // margin-aware scroll had already put it at.
    var before = findCalls().length
    view.setCurrentSelection(selections[0], {animate: true})
    assert.equal(findCalls().length, before, "no again-dispatch for the very first selection")
    assert.equal(view._pdfViewer.scrollCalls.length, 0, "no page-level scroll for the first match either — pdf.js already scrolled it")

    // Forward: 0 -> 1 -> 2 -> 3.
    view.setCurrentSelection(selections[1], {animate: true})
    view.setCurrentSelection(selections[2], {animate: true})
    view.setCurrentSelection(selections[3], {animate: true})
    var forward = findCalls().slice(before)
    assert.equal(forward.length, 3)
    for (var call of forward) {
        assert.equal(call.data.type, "again")
        assert.equal(call.data.findPrevious, false)
        assert.equal(call.data.query, "needle", "the replayed find uses the live query, not an empty or stale one")
    }

    // Wrap forward: 3 -> 0. A plain "new ordinal is smaller" test gets this
    // backwards; it must still read as a forward step.
    before = findCalls().length
    view.setCurrentSelection(selections[0], {animate: true})
    var wrapForward = findCalls().slice(before)
    assert.equal(wrapForward.length, 1)
    assert.equal(wrapForward[0].data.findPrevious, false, "wrapping from the last match to the first is still forward")

    // Backward: 0 -> 3 wraps backward, 3 -> 2 is an ordinary backward step.
    before = findCalls().length
    view.setCurrentSelection(selections[3], {animate: true})
    assert.equal(findCalls().slice(before)[0].data.findPrevious, true, "wrapping from the first match to the last is backward")

    before = findCalls().length
    view.setCurrentSelection(selections[2], {animate: true})
    assert.equal(findCalls().slice(before)[0].data.findPrevious, true)

    assert.equal(view._pdfViewer.scrollCalls.length, 0, "no step, including the wraps, ever falls through to the page-level scroll")

    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// A selection not built by a find carries no matchOrdinal, so this must fall
// back to the plain scroll exactly as before — the "again" path is only for
// find results. Apple's public PDFSelection(document:) builds an empty one an
// app cannot fill, so the regression is exercised through the module-private
// factory the framework itself builds find results with.
test("setCurrentSelection with a selection that carries no matchOrdinal still only scrolls, never dispatches again", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    var page = pageIn(doc, 0)

    view.setCurrentSelection(selectionForMatch({document: doc, string: "a", pages: [page]}), {animate: true})
    var before = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    view.setCurrentSelection(selectionForMatch({document: doc, string: "b", pages: [page]}), {animate: true})
    var after = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    assert.equal(after, before)
    assert.equal(view._pdfViewer.scrollCalls.length, 2)
    uninstallPdfjs()
})

// 18. A search over a never-rendered page still returns matches; no getTextContent before the first beginFindString.
test("a search over a page whose canvas was never rendered still returns matches; getTextContent is not called before the first beginFindString", async function() {
    var getTextContentCalls = 0
    var page = fakePage([{str: "needle", hasEOL: false}])
    var original = page.getTextContent
    page.getTextContent = function() { getTextContentCalls++; return original() }
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [page]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(getTextContentCalls, 0, "extraction is lazy until the first beginFindString")

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[6]]
    view._eventBus.dispatch("updatefindmatchescount", {})
    await flush()
    assert.equal(getTextContentCalls, 1)
    uninstallPdfjs()
})

// 19. Load failure: one console.error naming url and error name; pageCount 0; PDFViewDocumentChanged still posted; no unhandledrejection.
test("a load failure logs one console.error naming the url and error name, leaves pageCount 0, still posts PDFViewDocumentChanged, and never reaches unhandledrejection", async function() {
    var unhandled = []
    var onUnhandled = function(reason) { unhandled.push(reason) }
    process.on("unhandledRejection", onUnhandled)

    installPdfjs({reject: {name: "InvalidPDFException"}})
    var view = makeView()
    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewDocumentChanged, selector: function() { posts.push(1) }})

    var errors = []
    var originalError = console.error
    console.error = function(message) { errors.push(message) }
    var doc = new PDFDocument({url: "/missing.pdf"})
    view.document = doc
    await flush()
    console.error = originalError

    assert.equal(errors.length, 1)
    assert.match(errors[0], /missing\.pdf/)
    assert.match(errors[0], /InvalidPDFException/)
    assert.equal(doc.pageCount, 0)
    assert.equal(posts.length, 1)

    await flush()
    process.off("unhandledRejection", onUnhandled)
    assert.deepEqual(unhandled, [])
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// 20. backgroundColor takes a UIColor (inherited from UIView); two PDFViews do not collide.
test("backgroundColor takes a UIColor as UIView's own setter does; two PDFViews do not collide", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var a = makeView()
    var b = makeView()
    a.backgroundColor = {cgColor: "#f5f7fa"}
    b.backgroundColor = {cgColor: "#ffffff"}
    assert.equal(a.$el.css("background-color"), "rgb(245, 247, 250)")
    assert.equal(b.$el.css("background-color"), "rgb(255, 255, 255)")
    assert.notEqual(a._viewerElement, b._viewerElement)
    uninstallPdfjs()
})

// 21. required()/typed() guards name the method and the Swift signature.
test("required()/typed() guards throw naming the method and the Swift signature", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    assert.throws(function() { new PDFDocument({}) }, /PDFDocument\(url:\)/)
    var view = makeView()
    assert.throws(function() { view.go({}) }, /PDFView\.go\(to:\)/)
    assert.throws(function() { view.setCurrentSelection("not a selection") }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.throws(function() { view.setCurrentSelection() }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.throws(function() { view.setCurrentSelection(null) }, /PDFView\.setCurrentSelection\(_:animate:\)/, "Apple's animate: has no default, so omitting it throws even for nil")
    assert.throws(function() { view.setCurrentSelection(null, {}) }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.doesNotThrow(function() { view.setCurrentSelection(null, {animate: false}) }, "Apple's selection is PDFSelection?, so nil is a value, not a missing argument")
    assert.throws(function() { view.document = "not a document" }, /PDFView\.document/)
    uninstallPdfjs()
})


// PDFKit's notification constants live on NSNotification.Name, as Apple's do
// (`extension NSNotification.Name`). Publishing a name PDFKit never posts would
// hand a consumer an observer that waits forever, so the set is pinned to what
// the source actually posts.
var _pdfkitNames = [
    "PDFViewDocumentChanged",
    "PDFViewPageChanged",
    "PDFViewScaleChanged",
    "PDFViewSelectionChanged",
    "PDFViewDisplayModeChanged",
    "PDFDocumentDidBeginFind",
    "PDFDocumentDidFindMatch",
    "PDFDocumentDidEndFind",
]

test("the eight PDFKit names are on NSNotification.Name, and PDFKit references no name outside that set", function() {
    for (var name of _pdfkitNames) {
        assert.equal(NSNotification.Name[name], name, `${name} is not published with its own raw value`)
    }
    var extra = Object.keys(NSNotification.Name).filter(function(name) { return name.indexOf("PDF") === 0 && _pdfkitNames.indexOf(name) === -1 && name.indexOf("PDFTest") !== 0 })
    assert.deepEqual(extra, [], "PDFKit must publish only the names it posts")

    var dir = path.join(__dirname, "..", "src", "pdfkit")
    var referenced = new Set()
    for (var file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js")) { continue }
        var text = fs.readFileSync(path.join(dir, file), "utf8")
        for (var match of text.matchAll(/NSNotification\.Name\.(\w+)/g)) { referenced.add(match[1]) }
    }
    for (var used of referenced) {
        assert.ok(_pdfkitNames.indexOf(used) !== -1, `src/pdfkit/ references NSNotification.Name.${used}, which PDFKit does not publish`)
    }
    for (var published of _pdfkitNames) {
        assert.ok(referenced.has(published), `${published} is published but no src/pdfkit/ post site uses it`)
    }
})

// No consumer ever shipped these: PDFKit has never been released, so the old
// spellings simply cease to exist rather than being kept with a diagnostic.
test("the retired class-nested notification spellings are gone", function() {
    for (var retired of ["pageChangedNotification", "documentChangedNotification", "scaleChangedNotification", "selectionChangedNotification"]) {
        assert.equal(PDFView[retired], undefined, `PDFView.${retired}`)
    }
    for (var retiredDocument of ["didBeginFindNotification", "didFindMatchNotification", "didEndFindNotification"]) {
        assert.equal(PDFDocument[retiredDocument], undefined, `PDFDocument.${retiredDocument}`)
    }
    assert.equal(PDFDocument.FindOptions, undefined, "the invented PDFDocument.FindOptions is NSString.CompareOptions now")
})

// Apple's userInfo key for the match is PDFDocumentFoundSelectionKey, and the
// end of a find carries nothing.
test("DidFindMatch's userInfo is keyed by PDFDocumentFoundSelectionKey and carries nothing else; DidEndFind carries no userInfo", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var matches = []
    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidFindMatch, selector: function(n) { matches.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function(n) { ends.push(n) }})

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    await flush()

    assert.equal(PDFDocumentFoundSelectionKey, "PDFDocumentFoundSelection")
    assert.equal(matches.length, 1)
    assert.deepEqual(Object.keys(matches[0].userInfo), [PDFDocumentFoundSelectionKey])
    assert.ok(matches[0].userInfo[PDFDocumentFoundSelectionKey] instanceof PDFSelection)
    assert.equal(matches[0].object, doc)
    assert.equal(ends.length, 1)
    assert.equal(ends[0].userInfo, null)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// withOptions is Apple's NSString.CompareOptions, an OptionSet; here an array
// of its cases. The guard is arrayOf(enumeration(...)), the one array check in
// the package, and a rejected call must not supersede a running search.
test("beginFindString rejects a non-array and an unknown option, naming the signature and NSString.CompareOptions", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "a", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var findsBefore = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    var generationBefore = doc._findGeneration
    assert.throws(function() { doc.beginFindString("x", {withOptions: "caseInsensitive"}) }, /PDFDocument\.beginFindString\(_:withOptions:\).*NSString\.CompareOptions/s)
    assert.throws(function() { doc.beginFindString("x", {withOptions: ["notAnOption"]}) }, /PDFDocument\.beginFindString\(_:withOptions:\).*NSString\.CompareOptions/s)
    assert.throws(function() { doc.beginFindString("x", {withOptions: [NSString.CompareOptions.literal, "caseInsensitiv"]}) }, /NSString\.CompareOptions/)
    assert.throws(function() { doc.beginFindString("x", {withOptions: null}) }, /NSString\.CompareOptions/)
    assert.equal(view._eventBus.calls.filter(function(c) { return c.name === "find" }).length, findsBefore, "a refused call dispatches no find")
    assert.equal(doc._findGeneration, generationBefore, "a refused call does not supersede the running search")
    assert.doesNotThrow(function() { doc.beginFindString("x", {withOptions: [NSString.CompareOptions.caseInsensitive, NSString.CompareOptions.backwards]}) })
    uninstallPdfjs()
})

// Apple documents PDFViewDisplayModeChanged for displayMode; the setter posts
// once per set, unconditionally, as scaleFactor's does. Apple documents no
// notification for displayDirection, so that one is covered with its own member.
test("displayMode posts exactly one PDFViewDisplayModeChanged per set", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewDisplayModeChanged, selector: function(n) { posts.push(n) }})
    view.displayMode = PDFDisplayMode.singlePage
    assert.equal(posts.length, 1)
    assert.equal(posts[0].object, view)
    view.displayMode = PDFDisplayMode.singlePage
    assert.equal(posts.length, 2, "unconditional, like the scaleFactor setter")
    view.displayMode = PDFDisplayMode.twoUp
    assert.equal(posts.length, 3)
    assert.throws(function() { view.displayMode = "nope" }, /PDFView\.displayMode/)
    assert.equal(posts.length, 3, "a refused set posts nothing")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Apple's setCurrentSelection(_:animate:) takes a PDFSelection?; nil clears.
test("setCurrentSelection(null) clears, posts PDFViewSelectionChanged and scrolls nothing; a non-selection throws", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    var selection = new PDFSelection({document: doc})
    view.setCurrentSelection(selection, {animate: false})
    assert.equal(view.currentSelection, selection)

    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewSelectionChanged, selector: function() { posts.push(1) }})
    view.setCurrentSelection(null, {animate: true})
    assert.equal(view.currentSelection, null)
    assert.equal(posts.length, 1)
    assert.equal(view._pdfViewer.scrollCalls.length, 0, "clearing scrolls nothing, even animated")
    assert.throws(function() { view.setCurrentSelection({string: "x", pages: []}) }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.throws(function() { view.setCurrentSelection(undefined) }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.equal(posts.length, 1)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

test("currentSelection = null does the same; a non-selection throws naming PDFView.currentSelection", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    view.currentSelection = new PDFSelection({document: doc})

    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewSelectionChanged, selector: function() { posts.push(1) }})
    view.currentSelection = null
    assert.equal(view.currentSelection, null)
    assert.equal(posts.length, 1)
    assert.equal(view._pdfViewer.scrollCalls.length, 0)
    assert.throws(function() { view.currentSelection = "not a selection" }, /PDFView\.currentSelection/)
    assert.throws(function() { view.currentSelection = undefined }, /PDFView\.currentSelection/)
    assert.equal(posts.length, 1)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Apple's PDFPage() takes no arguments; a page the document hands out is the
// framework's own, built by the module-private pageIn, never a public initializer.
test("new PDFPage() has no document and no label; page(at:) returns the identical object across calls", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 2, pages: [fakePage([]), fakePage([])], labels: ["i", "ii"]})})
    var bare = new PDFPage()
    assert.equal(bare.document, null)
    assert.equal(bare.label, null)

    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(doc.page({at: 0}), doc.page({at: 0}))
    assert.notEqual(doc.page({at: 0}), doc.page({at: 1}))
    assert.equal(doc.page({at: 0}).document, doc)
    assert.equal(doc.page({at: 1}).label, "ii", "an attached page keeps the page-labels logic")
    uninstallPdfjs()
})

test("an attached page without a page-labels entry labels itself with its 1-based number", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 2, pages: [fakePage([]), fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()
    assert.equal(doc.page({at: 1}).label, "2")
    uninstallPdfjs()
})

// Apple's PDFSelection(document:) is empty until extended, and PDFKit cannot
// extend one (add/extend are not backable), so it stays empty.
test("new PDFSelection({document}) is empty; omitting the document throws naming PDFSelection(document:)", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var doc = new PDFDocument({url: "/a.pdf"})
    var selection = new PDFSelection({document: doc})
    assert.equal(selection.string, "")
    assert.deepEqual(selection.pages, [])
    assert.throws(function() { new PDFSelection() }, /PDFSelection\(document:\)/)
    assert.throws(function() { new PDFSelection({}) }, /PDFSelection\(document:\)/)
    assert.throws(function() { new PDFSelection({document: "not a document"}) }, /PDFSelection\(document:\)/)
    assert.throws(function() { new PDFSelection({document: null}) }, /PDFSelection\(document:\)/)
    uninstallPdfjs()
})

test("neither module-private factory is part of PDFKit's public surface", async function() {
    var pdfkit = await import("../src/pdfkit/index.js")
    assert.equal(pdfkit.selectionForMatch, undefined)
    assert.equal(pdfkit.pageIn, undefined)
})

// Apple's isFinding is true from the begin of a find until its end. The
// dead _pendingQuery this replaces was set and never read.
test("isFinding: false initially; true from begin until DidEndFind; false after cancelFindString, an empty-string find, a refused call and a detach mid-search", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    assert.equal(doc.isFinding, false)
    assert.equal(doc._pendingQuery, undefined, "the dead _pendingQuery is gone")

    // Never attached: the throw must not strand isFinding true.
    assert.throws(function() { doc.beginFindString("needle") }, /requires this document to be set on a PDFView/)
    assert.equal(doc.isFinding, false)

    view.document = doc
    await flush()

    var atBegin = null
    var atEnd = null
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidBeginFind, selector: function() { atBegin = doc.isFinding }})
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFDocumentDidEndFind, selector: function() { atEnd = doc.isFinding }})

    doc.beginFindString("needle")
    assert.equal(doc.isFinding, true)
    assert.equal(atBegin, true, "isFinding is already true when DidBeginFind is observed")
    view._findController.pageMatches = [[0]]
    view._findController.pageMatchesLength = [[6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
    await flush()
    assert.equal(atEnd, false, "isFinding is already false when DidEndFind is observed")
    assert.equal(doc.isFinding, false)

    doc.beginFindString("needle")
    assert.equal(doc.isFinding, true)
    doc.cancelFindString()
    assert.equal(doc.isFinding, false)

    doc.beginFindString("needle")
    assert.equal(doc.isFinding, true)
    doc.beginFindString("")
    assert.equal(doc.isFinding, false, "an empty find supersedes the running one and ends inside the same call")

    // A refused call (bad option) must not leave a flag behind either.
    assert.throws(function() { doc.beginFindString("needle", {withOptions: ["bogus"]}) }, /NSString\.CompareOptions/)
    assert.equal(doc.isFinding, false)

    // Detached mid-search: the view bumps its own generation, so the
    // end-of-find is dropped and would otherwise leave the flag true forever.
    doc.beginFindString("needle")
    assert.equal(doc.isFinding, true)
    view.document = null
    assert.equal(doc.isFinding, false)
    await flush()
    assert.equal(doc.isFinding, false)

    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Apple's index(for:) answers NSNotFound for a page the document does not own.
test("index(for:) round-trips with page(at:); NSNotFound for another document's page and for a bare PDFPage()", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 3, pages: [fakePage([]), fakePage([]), fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    var other = new PDFDocument({url: "/b.pdf"})
    view.document = doc
    await flush()
    await other._loadingTask.promise
    await flush()

    for (var at = 0; at < 3; at++) {
        assert.equal(doc.index({for: doc.page({at: at})}), at)
    }
    assert.equal(other.page({at: 0}).document, other)
    assert.equal(doc.index({for: other.page({at: 0})}), NSNotFound)
    assert.equal(doc.index({for: new PDFPage()}), NSNotFound)
    assert.throws(function() { doc.index() }, /PDFDocument\.index\(for:\)/)
    assert.throws(function() { doc.index({}) }, /PDFDocument\.index\(for:\)/)
    assert.throws(function() { doc.index({for: 1}) }, /PDFDocument\.index\(for:\)/)
    uninstallPdfjs()
})

// Apple's goTo*Page(_:) are target/action methods, so they take a sender;
// each is a no-op when its canGoTo* is false, as Apple's are.
test("goToNextPage/PreviousPage/FirstPage/LastPage move currentPageNumber; the canGoTo* are false at the ends and with no document, where the goTo* are no-ops", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 3, pages: [fakePage([]), fakePage([]), fakePage([])]})})
    var view = makeView()
    for (var name of ["canGoToNextPage", "canGoToPreviousPage", "canGoToFirstPage", "canGoToLastPage"]) {
        assert.equal(view[name], false, `${name} with no document`)
    }
    var before = view._pdfViewer.currentPageNumber
    view.goToNextPage(null)
    view.goToLastPage(null)
    view.goToPreviousPage(null)
    view.goToFirstPage(null)
    assert.equal(view._pdfViewer.currentPageNumber, before, "with no document every goTo* is a no-op")

    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    assert.equal(view.canGoToNextPage, false, "false until the document has loaded and its pages exist")
    await flush()

    assert.equal(view.currentPage, doc.page({at: 0}))
    assert.equal(view.canGoToNextPage, true)
    assert.equal(view.canGoToLastPage, true)
    assert.equal(view.canGoToPreviousPage, false)
    assert.equal(view.canGoToFirstPage, false)
    view.goToPreviousPage(null)
    view.goToFirstPage(null)
    assert.equal(view._pdfViewer.currentPageNumber, 1, "at the first page, the backward moves are no-ops")

    view.goToNextPage(null)
    assert.equal(view.currentPage, doc.page({at: 1}))
    assert.equal(view.canGoToPreviousPage, true)
    assert.equal(view.canGoToFirstPage, true)
    assert.equal(view.canGoToNextPage, true)

    view.goToLastPage(null)
    assert.equal(view.currentPage, doc.page({at: 2}))
    assert.equal(view.canGoToNextPage, false)
    assert.equal(view.canGoToLastPage, false)
    var changes = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewPageChanged, selector: function() { changes.push(1) }})
    view.goToNextPage(null)
    view.goToLastPage(null)
    assert.equal(view._pdfViewer.currentPageNumber, 3, "at the last page, the forward moves are no-ops")
    assert.equal(changes.length, 0)

    view.goToPreviousPage(null)
    assert.equal(view.currentPage, doc.page({at: 1}))
    view.goToFirstPage(null)
    assert.equal(view.currentPage, doc.page({at: 0}))
    assert.equal(changes.length, 2)

    view.goToNextPage()
    assert.equal(view.currentPage, doc.page({at: 1}), "the sender is optional, as Apple's Any? is")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Apple's displayDirection picks the scroll axis of the continuous modes; it
// documents no notification, so the setter posts nothing.
test("displayDirection defaults to vertical; horizontal maps continuous modes to ScrollMode.HORIZONTAL and leaves paged modes alone; the setter posts nothing", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    assert.equal(view.displayDirection, PDFDisplayDirection.vertical)

    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFViewDisplayModeChanged, selector: function() { posts.push(1) }})

    view.displayDirection = PDFDisplayDirection.horizontal
    assert.equal(view.displayDirection, PDFDisplayDirection.horizontal)
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.HORIZONTAL, "the default singlePageContinuous goes horizontal")
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.NONE)
    assert.equal(posts.length, 0)

    view.displayMode = PDFDisplayMode.singlePage
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.PAGE, "a paged mode has no scroll axis")
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.NONE)
    view.displayMode = PDFDisplayMode.twoUp
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.PAGE)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.ODD)
    view.displayMode = PDFDisplayMode.twoUpContinuous
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.HORIZONTAL)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.ODD)
    view.displayMode = PDFDisplayMode.singlePageContinuous
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.HORIZONTAL)
    assert.equal(view._pdfViewer.spreadMode, SpreadMode.NONE)
    var postsAfterModes = posts.length
    assert.equal(postsAfterModes, 4, "only displayMode posts")

    view.displayDirection = PDFDisplayDirection.vertical
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.VERTICAL)
    assert.equal(posts.length, postsAfterModes, "the direction setter posts nothing")
    view.displayMode = PDFDisplayMode.twoUp
    view.displayDirection = PDFDisplayDirection.horizontal
    assert.equal(view._pdfViewer.scrollMode, ScrollMode.PAGE, "changing the direction while paged leaves the paged mapping")

    assert.throws(function() { view.displayDirection = "diagonal" }, /PDFView\.displayDirection/)
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// Apple's displaysPageBreaks hides the gaps and borders between pages. pdf.js's
// public removePageBorders field and its .pdfViewer.removePageBorders rules
// back it. The viewer element also carries the classes pdf.js's scrollMode
// setter writes, so only the one class PDFKit owns is touched: a whole-className
// write would silently undo displayDirection.
test("displaysPageBreaks defaults true; false writes removePageBorders and PDFKit's own class, true restores both, the host is untouched, and displayDirection's scrollHorizontal survives both writes", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var host = view.$el[0]
    var hostClasses = host.className
    assert.equal(view.displaysPageBreaks, true)
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), false)

    view.displaysPageBreaks = false
    assert.equal(view.displaysPageBreaks, false)
    assert.equal(view._pdfViewer.removePageBorders, true)
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), true)
    assert.equal(host.className, hostClasses, "the host element's classes are untouched")

    view.displaysPageBreaks = true
    assert.equal(view.displaysPageBreaks, true)
    assert.equal(view._pdfViewer.removePageBorders, false)
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), false)
    assert.equal(host.className, hostClasses)
    assert.ok(view._viewerElement.classList.contains("pdfViewer"), "PDFKit's own pdfViewer class stays")

    view.displayDirection = PDFDisplayDirection.horizontal
    assert.equal(view._viewerElement.classList.contains("scrollHorizontal"), true)
    view.displaysPageBreaks = false
    assert.equal(view._viewerElement.classList.contains("scrollHorizontal"), true, "a false write leaves the class pdf.js wrote")
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), true)
    view.displaysPageBreaks = true
    assert.equal(view._viewerElement.classList.contains("scrollHorizontal"), true, "a true write leaves it too")
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), false)

    view.displaysPageBreaks = false
    view.displayDirection = PDFDisplayDirection.vertical
    assert.equal(view._viewerElement.classList.contains("removePageBorders"), true, "a later scrollMode write does not drop PDFKit's class")
    assert.equal(view._viewerElement.classList.contains("scrollHorizontal"), false)

    assert.throws(function() { view.displaysPageBreaks = "yes" }, /PDFView\.displaysPageBreaks/)
    assert.equal(view.displaysPageBreaks, false, "a refused set changes nothing")
    uninstallPdfjs()
})

// jsdom lays nothing out and reports every rect as zeros, so the host and each
// page-view div get stubbed rects here; what is under test is which pages
// PDFKit selects from those rects and in what order, not pdf.js's layout.
function stubRect(element, rect) {
    element.getBoundingClientRect = function() {
        return {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.right - rect.left, height: rect.bottom - rect.top}
    }
}

function pageViewAt(rect) {
    var div = document.createElement("div")
    stubRect(div, rect)
    return {div: div}
}

test("visiblePages returns the pages whose page-view divs intersect the container on both axes, in page order; [] with no document or before page views exist", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 5, pages: [fakePage([]), fakePage([]), fakePage([]), fakePage([]), fakePage([])]})})
    var view = makeView()
    stubRect(view.$el[0], {left: 0, top: 0, right: 100, bottom: 100})
    assert.deepEqual(view.visiblePages, [], "no document")

    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    assert.deepEqual(view.visiblePages, [], "a document that has not loaded has no page views")
    await flush()
    assert.deepEqual(view.visiblePages, [], "loaded, but pdf.js has built no page views yet")

    view._pdfViewer.pageViews = [
        pageViewAt({left: 0, top: -300, right: 100, bottom: -100}),
        pageViewAt({left: 0, top: -50, right: 100, bottom: 50}),
        pageViewAt({left: 0, top: 50, right: 100, bottom: 150}),
        pageViewAt({left: 0, top: 200, right: 100, bottom: 300}),
        pageViewAt({left: 150, top: 0, right: 250, bottom: 100}),
    ]
    var visible = view.visiblePages
    assert.deepEqual(visible, [doc.page({at: 1}), doc.page({at: 2})], "pages 1 and 2 overlap vertically; page 4 overlaps only on the vertical axis and sits off to the right")
    assert.equal(visible[0], doc.page({at: 1}), "the document's own cached PDFPage, not a copy")

    view._pdfViewer.pageViews[3] = undefined
    view._pdfViewer.pageViews[1] = {div: null}
    assert.deepEqual(view.visiblePages, [doc.page({at: 2})], "a missing page view or div is skipped, not an error")

    view._pdfViewer.pageViews = [
        pageViewAt({left: 0, top: 100, right: 100, bottom: 200}),
        pageViewAt({left: -100, top: 0, right: 0, bottom: 100}),
        pageViewAt({left: 99, top: 99, right: 199, bottom: 199}),
    ]
    assert.deepEqual(view.visiblePages, [doc.page({at: 2})], "touching edges is not intersecting; a one-pixel overlap is")

    // In the paged modes pdf.js detaches every page but the current one, and a
    // detached div measures as {0,0,0,0}; with the host scrolled partly off the
    // top-left (negative left/top) that rect passes a naive overlap test.
    stubRect(view.$el[0], {left: -50, top: -50, right: 50, bottom: 50})
    view._pdfViewer.pageViews = [
        pageViewAt({left: 0, top: 0, right: 0, bottom: 0}),
        pageViewAt({left: 0, top: 0, right: 100, bottom: 100}),
        pageViewAt({left: 0, top: 0, right: 0, bottom: 100}),
        pageViewAt({left: 0, top: 0, right: 100, bottom: 0}),
    ]
    assert.deepEqual(view.visiblePages, [doc.page({at: 1})], "a zero-area page view is never visible, wherever the host is")

    view.document = null
    assert.deepEqual(view.visiblePages, [])
    uninstallPdfjs()
})

// PDFDocumentDelegate's four optional methods carry Apple's own signatures: the
// selection or the notification and no sender, which is the one place the
// sender-first convention has nothing to put first. Arity is asserted because
// a helper that prepended the document, as UITableView's does, would still
// pass a check that only looked at the last argument.
test("PDFDocumentDelegate: didMatchString and documentDidFindMatch once per match, documentDidBegin/EndDocumentFind once each, each with exactly Apple's one argument", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var calls = []
    var delegate = {}
    for (var method of ["didMatchString", "documentDidBeginDocumentFind", "documentDidFindMatch", "documentDidEndDocumentFind"]) {
        delegate[method] = (function(name) {
            return function() { calls.push({method: name, args: Array.prototype.slice.call(arguments), self: this}) }
        })(method)
    }
    doc.delegate = delegate
    assert.equal(doc.delegate, delegate)

    var observed = []
    var observer = {}
    for (var name of [NSNotification.Name.PDFDocumentDidBeginFind, NSNotification.Name.PDFDocumentDidFindMatch, NSNotification.Name.PDFDocumentDidEndFind]) {
        NotificationCenter.default.addObserver(observer, {name: name, selector: function(n) { observed.push(n) }})
    }

    doc.beginFindString("needle")
    view._findController.pageMatches = [[0, 7]]
    view._findController.pageMatchesLength = [[6, 6]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 2, current: 2}})
    await flush()

    var named = function(method) { return calls.filter(function(c) { return c.method === method }) }
    assert.equal(named("documentDidBeginDocumentFind").length, 1)
    assert.equal(named("documentDidEndDocumentFind").length, 1)
    assert.equal(named("documentDidFindMatch").length, 2)
    assert.equal(named("didMatchString").length, 2)

    for (var call of calls) {
        assert.equal(call.args.length, 1, `${call.method} receives exactly one argument, no sender`)
        assert.equal(call.self, delegate)
    }
    for (var matched of named("didMatchString")) {
        assert.ok(matched.args[0] instanceof PDFSelection)
        assert.equal(matched.args[0].string, "needle")
    }
    for (var notified of calls.filter(function(c) { return c.method !== "didMatchString" })) {
        var argument = notified.args[0]
        assert.ok(observed.indexOf(argument) !== -1, `${notified.method} receives the very notification object observers got`)
        assert.equal(argument.object, doc)
    }
    assert.equal(observed.length, 4, "the delegate does not add or remove a notification: begin, two matches, end")
    assert.equal(named("documentDidFindMatch")[0].args[0].userInfo[PDFDocumentFoundSelectionKey], named("didMatchString")[0].args[0])
    assert.deepEqual(calls.map(function(c) { return c.method }).filter(function(m) { return m === "documentDidBeginDocumentFind" || m === "documentDidEndDocumentFind" }), ["documentDidBeginDocumentFind", "documentDidEndDocumentFind"])
    assert.equal(calls[0].method, "documentDidBeginDocumentFind")
    assert.equal(calls[calls.length - 1].method, "documentDidEndDocumentFind")

    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

test("PDFDocumentDelegate: a delegate implementing none of the methods, or none at all, is never an error; a superseded or cancelled generation calls nothing", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var search = function() {
        doc.beginFindString("needle")
        view._findController.pageMatches = [[0]]
        view._findController.pageMatchesLength = [[6]]
        view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 1, current: 1}})
        return flush()
    }

    assert.equal(doc.delegate, null)
    await search()
    doc.delegate = {}
    await search()
    doc.delegate = {documentDidFindMatch: "not a function"}
    await search()
    doc.delegate = null
    await search()
    assert.equal(doc.isFinding, false)

    var calls = []
    doc.delegate = {
        didMatchString: function() { calls.push("didMatchString") },
        documentDidFindMatch: function() { calls.push("documentDidFindMatch") },
        documentDidEndDocumentFind: function() { calls.push("documentDidEndDocumentFind") },
    }
    doc.beginFindString("needle")
    var stale = doc._findGeneration
    doc.cancelFindString()
    doc._postFindMatch(new PDFSelection({document: doc}), stale)
    doc._postEndFind(0, stale)
    assert.deepEqual(calls, [], "a cancelled generation calls nothing")

    doc.beginFindString("again")
    doc._postFindMatch(new PDFSelection({document: doc}), stale)
    assert.deepEqual(calls, [], "a superseded generation calls nothing")
    uninstallPdfjs()
})

// Apple's PDFViewDelegate.pdfViewWillClick(onLink:with:) is the delegate's
// chance to handle a link the user clicked; implementing it means PDFKit does
// not open the URL itself. pdf.js rebuilds its annotation layer on every
// render, so the handler is delegated from the host rather than bound per link.
function clickLink(view, href) {
    var layer = document.createElement("div")
    layer.className = "annotationLayer"
    var link = document.createElement("a")
    link.setAttribute("href", href)
    var inner = document.createElement("span")
    link.appendChild(inner)
    layer.appendChild(link)
    view._viewerElement.appendChild(layer)

    // jsdom would try to navigate on an unprevented click; this listener runs
    // after PDFKit's (bubbling, on document), records what PDFKit left of the
    // default, then prevents it so the test never navigates.
    var defaultPreventedByPDFKit = null
    var probe = function(event) { defaultPreventedByPDFKit = event.defaultPrevented; event.preventDefault() }
    document.addEventListener("click", probe)
    inner.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    document.removeEventListener("click", probe)
    view._viewerElement.removeChild(layer)
    return defaultPreventedByPDFKit
}

test("PDFViewDelegate: a click on an annotation-layer link with an http(s) href calls pdfViewWillClickOnLinkWithURL(view, url) with a WHATWG URL and prevents the default", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var calls = []
    view.delegate = {pdfViewWillClickOnLinkWithURL: function() { calls.push(Array.prototype.slice.call(arguments)) }}
    assert.equal(typeof view.delegate.pdfViewWillClickOnLinkWithURL, "function")

    var prevented = clickLink(view, "https://starkbank.com/legal?a=1#top")
    assert.equal(prevented, true, "implementing the method means PDFKit does not open the URL")
    assert.equal(calls.length, 1)
    assert.equal(calls[0].length, 2, "Apple's order: sender first, then the url")
    assert.equal(calls[0][0], view)
    assert.ok(calls[0][1] instanceof URL)
    assert.equal(calls[0][1].href, "https://starkbank.com/legal?a=1#top")

    clickLink(view, "/static/other.pdf")
    assert.equal(calls.length, 2)
    assert.equal(calls[1][1].href, "http://localhost/static/other.pdf", "a relative href resolves against the page")
    uninstallPdfjs()
})

test("PDFViewDelegate: internal destinations, empty and non-http(s) hrefs never reach the delegate, and leave the default alone", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var calls = []
    view.delegate = {pdfViewWillClickOnLinkWithURL: function() { calls.push(1) }}

    for (var href of ["#page=3", "#nameddest", "", "mailto:legal@starkbank.com", "javascript:void(0)", "ftp://example.com/a.pdf", "data:text/plain,x", "tel:+5511"]) {
        assert.equal(clickLink(view, href), false, `${JSON.stringify(href)} leaves the default untouched`)
    }
    assert.equal(calls.length, 0)
    uninstallPdfjs()
})

test("PDFViewDelegate: with no delegate, or one without the method, the default is untouched; the handler is gone after _dispose", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    assert.equal(view.delegate, null)
    assert.equal(clickLink(view, "https://starkbank.com/a"), false, "no delegate")
    view.delegate = {}
    assert.equal(clickLink(view, "https://starkbank.com/a"), false, "a delegate without the method")
    view.delegate = {pdfViewWillClickOnLinkWithURL: "not a function"}
    assert.equal(clickLink(view, "https://starkbank.com/a"), false)

    var calls = []
    view.delegate = {pdfViewWillClickOnLinkWithURL: function() { calls.push(1) }}
    assert.equal(clickLink(view, "https://starkbank.com/a"), true)
    assert.equal(calls.length, 1)
    view._dispose()
    assert.equal(clickLink(view, "https://starkbank.com/a"), false)
    assert.equal(calls.length, 1, "no click reaches the delegate after _dispose")
    uninstallPdfjs()
})

// Apple's highlightedSelections is [PDFSelection]?; nil is accepted and clears,
// as an empty array does.
test("highlightedSelections: null is accepted, stores [] and dispatches the empty find; a non-array or a non-PDFSelection element throws naming PDFView.highlightedSelections", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    var selection = new PDFSelection({document: doc})
    function findDispatches() { return view._eventBus.calls.filter(function(c) { return c.name === "find" }) }

    view.highlightedSelections = [selection]
    assert.deepEqual(view.highlightedSelections, [selection])
    var before = findDispatches().length

    view.highlightedSelections = null
    assert.deepEqual(view.highlightedSelections, [])
    assert.equal(findDispatches().length, before + 1)
    assert.equal(findDispatches()[before].data.query, "", "pdf.js's own highlighter is told to remove its spans")

    var unchanged = [selection]
    view.highlightedSelections = unchanged
    for (var bad of ["not an array", {length: 1, 0: selection}, undefined, 5]) {
        assert.throws(function() { view.highlightedSelections = bad }, /PDFView\.highlightedSelections/)
    }
    assert.throws(function() { view.highlightedSelections = [selection, {string: "x", pages: []}] }, /PDFView\.highlightedSelections/)
    assert.throws(function() { view.highlightedSelections = [null] }, /PDFView\.highlightedSelections/)
    assert.deepEqual(view.highlightedSelections, [selection], "a refused set changes nothing")
    uninstallPdfjs()
})

// The delegate is fed by a one-shot observer registered for the length of one
// post (PDFDocument._post). It must be gone afterwards, on the normal path and
// when a delegate method throws, or every match would leave an observer behind.
test("the delegate's one-shot forwarder leaves no observer behind after a find, and none after a delegate method throws", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "needle needle", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var center = NotificationCenter.default
    var search = function() {
        doc.beginFindString("needle")
        view._findController.pageMatches = [[0, 7]]
        view._findController.pageMatchesLength = [[6, 6]]
        view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 2, current: 2}})
        return flush()
    }

    var calls = []
    doc.delegate = {
        didMatchString: function() { calls.push("didMatchString") },
        documentDidBeginDocumentFind: function() { calls.push("documentDidBeginDocumentFind") },
        documentDidFindMatch: function() { calls.push("documentDidFindMatch") },
        documentDidEndDocumentFind: function() { calls.push("documentDidEndDocumentFind") },
    }
    var recorded = center._observers.size
    await search()
    assert.equal(calls.length, 6, "begin, two matches each through two methods, end")
    assert.equal(center._observers.size, recorded, "every forwarder is removed once its post returns")

    // A throwing delegate surfaces from the post, as an observer's throw always
    // has; in a live search that is the rejection of the promise chain that
    // posts the end of the find. Driven directly here, because that chain is
    // not returned to a caller the test could catch it from (and the test
    // runner fails on an unhandled rejection however it is listened for).
    // The finally must still remove the forwarder.
    doc.delegate = {documentDidEndDocumentFind: function() { throw new Error("delegate failed") }}
    doc.beginFindString("needle")
    assert.throws(function() { doc._postEndFind(2, doc._findGeneration) }, /delegate failed/)
    assert.equal(center._observers.size, recorded, "the forwarder is removed even when the delegate throws")
    assert.equal(doc.isFinding, false, "the find had already ended when the delegate threw")
    doc.cancelFindString()
    doc.delegate = {documentDidFindMatch: function() { throw new Error("match delegate failed") }}
    doc.beginFindString("needle")
    assert.throws(function() { doc._postFindMatch(new PDFSelection({document: doc}), doc._findGeneration) }, /match delegate failed/)
    assert.equal(center._observers.size, recorded)
    uninstallPdfjs()
})


// 0. The test seam: test/register.mjs maps pdfjs-dist's two entry points onto
// stand-ins this file configures, because the real ones need a worker, a
// canvas and a network that node does not have.
test("test/register.mjs maps pdfjs-dist's entry points onto the stand-ins and installs a Worker", async function() {
    var lib = await import("./pdfjs/lib.mjs")
    var viewer = await import("./pdfjs/viewer.mjs")
    lib.use({getDocument: function() { return "stand-in getDocument" }})
    viewer.use({EventBus: class { constructor() { this.stood = "in" } }})
    var pdfjsLib = await import("pdfjs-dist/build/pdf.min.mjs")
    var pdfjsViewer = await import("pdfjs-dist/web/pdf_viewer.mjs")
    assert.equal(pdfjsLib.getDocument(), "stand-in getDocument")
    assert.equal(new pdfjsViewer.EventBus().stood, "in")
    assert.equal(typeof Worker, "function")
    lib.use(null)
    viewer.use(null)
})
