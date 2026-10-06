import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFView, PDFDocument, PDFPage, PDFSelection, PDFDisplayMode, NotificationCenter } from "../src/index.js"
import { assertTextLayerStylesheet } from "../src/pdfkit/pdfjsGlobals.js"

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
    }
    setViewer(viewer) {
        this.viewer = viewer
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
    }
    setDocument(proxy) {
        this.document = proxy
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
    NotificationCenter.default.addObserver(observer, {name: PDFView.documentChangedNotification, selector: function(n) { posts.push(n) }})
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
    NotificationCenter.default.addObserver(observer, {name: PDFView.pageChangedNotification, selector: function() { changes.push(1) }})
    var page2 = doc.page({at: 1})
    view.go({to: page2})
    assert.equal(view.currentPage, page2)
    assert.equal(changes.length, 1)
    view.go({to: page2})
    assert.equal(changes.length, 1, "setting the same page again is not a real change")
    NotificationCenter.default.removeObserver(observer)
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

// 13. currentSelection/clearSelection + notification; clearing highlights dispatches an empty find.
test("currentSelection and clearSelection post PDFViewSelectionChanged; clearing highlights dispatches an empty find, not node removal", function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([])]})})
    var view = makeView()
    var posts = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: PDFView.selectionChangedNotification, selector: function() { posts.push(1) }})
    var selection = new PDFSelection({string: "hello", pages: []})
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n) }})

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

// 14. Option mapping: literal -> matchDiacritics, never entireWord; caseInsensitive flips caseSensitive.
test("find option mapping: no options defaults to caseSensitive true; caseInsensitive flips it; literal maps to matchDiacritics, never entireWord; backwards maps to findPrevious", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "a", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    doc.beginFindString("x")
    var last = view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    assert.equal(last.caseSensitive, true)
    assert.equal(last.entireWord, false)
    assert.equal(last.matchDiacritics, false)

    doc.beginFindString("x", {withOptions: [PDFDocument.FindOptions.caseInsensitive]})
    last = view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    assert.equal(last.caseSensitive, false)

    doc.beginFindString("x", {withOptions: [PDFDocument.FindOptions.literal]})
    last = view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    assert.equal(last.matchDiacritics, true)
    assert.equal(last.entireWord, false)

    doc.beginFindString("x", {withOptions: [PDFDocument.FindOptions.backwards]})
    last = view._eventBus.calls.filter(function(c) { return c.name === "find" }).pop().data
    assert.equal(last.findPrevious, true)
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didFindMatchNotification, selector: function(n) { matches.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n) }})

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
    assert.equal(doc._pendingQuery, null)

    var findDispatchesBefore = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    doc.beginFindString("")
    var findDispatchesAfter = view._eventBus.calls.filter(function(c) { return c.name === "find" }).length
    assert.equal(findDispatchesAfter, findDispatchesBefore)
    assert.equal(ends[ends.length - 1].userInfo.matchCount, 0)
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didFindMatchNotification, selector: function(n) { matches.push(n.userInfo.selection) }})
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n.userInfo.matchCount) }})

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
    assert.deepEqual(ends, [1])
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

// The defect findings 3/4 fixed, directly: on a document where the first page
// matches but later pages have not finished extracting, end-of-find must wait
// for every DidFindMatch to post and must carry the final total, not the
// count standing when the renderer selected its first match.
test("DidFindMatch for every page is observed before the single DidEndFind, whose count is matchescount's final total, not a partial one taken on the first match", async function() {
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didFindMatchNotification, selector: function(n) { order.push({kind: "match", string: n.userInfo.selection.string}) }})
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { order.push({kind: "end", matchCount: n.userInfo.matchCount}) }})

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
    assert.equal(order[2].matchCount, 2, "the end's count is the matchescount total, not the one standing when the first match was selected")
    NotificationCenter.default.removeObserver(observer)
    uninstallPdfjs()
})

test("a search with no matches posts exactly one DidEndFind, with zero", async function() {
    installPdfjs({resolve: fakeProxy({numPages: 1, pages: [fakePage([{str: "nothing here", hasEOL: false}])]})})
    var view = makeView()
    var doc = new PDFDocument({url: "/a.pdf"})
    view.document = doc
    await flush()

    var ends = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n.userInfo.matchCount) }})

    doc.beginFindString("needle")
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.PENDING})
    view._eventBus.dispatch("updatefindcontrolstate", {state: FindState.NOT_FOUND})
    assert.equal(ends.length, 0)
    view._findController.pageMatches = [[]]
    view._findController.pageMatchesLength = [[]]
    view._eventBus.dispatch("updatefindmatchescount", {matchesCount: {total: 0, current: 0}})
    await flush()
    assert.deepEqual(ends, [0])
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didFindMatchNotification, selector: function(n) { matches.push(n.userInfo.selection) }})
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n.userInfo.matchCount) }})

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
    assert.deepEqual(ends, [2], "the end still posts, with pdf.js's own total, even though one page failed")
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
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didFindMatchNotification, selector: function(n) { matches.push(n) }})
    NotificationCenter.default.addObserver(observer, {name: PDFDocument.didEndFindNotification, selector: function(n) { ends.push(n) }})

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
    var page = new PDFPage(doc, 0)
    var selection = new PDFSelection({string: "x", pages: [page]})

    view.setCurrentSelection(selection, {animate: false})
    assert.equal(view._pdfViewer.scrollCalls.length, 0)
    view.setCurrentSelection(new PDFSelection({string: "y", pages: [page]}), {animate: true})
    assert.equal(view._pdfViewer.scrollCalls.length, 1)
    assert.equal(view._pdfViewer.scrollCalls[0].pageNumber, 1)
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
    NotificationCenter.default.addObserver(observer, {name: PDFView.documentChangedNotification, selector: function() { posts.push(1) }})

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
    assert.throws(function() { view.setCurrentSelection(null) }, /PDFView\.setCurrentSelection\(_:animate:\)/)
    assert.throws(function() { view.document = "not a document" }, /PDFView\.document/)
    uninstallPdfjs()
})
