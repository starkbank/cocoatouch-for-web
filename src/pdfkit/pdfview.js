import { UIView } from "../uikit/uiview.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { required, typed, instance, optional, enumeration, Float } from "../utils/required.js"
import { PDFDocument } from "./pdfdocument.js"
import { PDFPage } from "./pdfpage.js"
import { PDFSelection } from "./pdfselection.js"
import { PDFDisplayMode } from "./pdfdisplaymode.js"
import { pdfjsLib as _pdfjsLib, pdfjsViewer as _pdfjsViewer, assertTextLayerStylesheet } from "./pdfjsGlobals.js"


const _documentType = optional(instance(PDFDocument, "PDFDocument"))
const _pageType = instance(PDFPage, "PDFPage")
const _selectionType = instance(PDFSelection, "PDFSelection")
const _displayModeType = enumeration(PDFDisplayMode, "PDFDisplayMode")


// PDFKit's PDFView: shows one PDFDocument, as Apple's does. It owns its
// container element the way AVPlayerViewController owns its <video> — the one
// child it builds inside whatever host element it is bound to, found by
// class rather than a hardcoded id, so two PDFViews on one page never collide.
export class PDFView extends UIView {

    static get pageChangedNotification() {
        return "PDFViewPageChanged"
    }

    static get documentChangedNotification() {
        return "PDFViewDocumentChanged"
    }

    static get scaleChangedNotification() {
        return "PDFViewScaleChanged"
    }

    static get selectionChangedNotification() {
        return "PDFViewSelectionChanged"
    }

    awakeFromNib() {
        assertTextLayerStylesheet()
        var pdfjsLib = _pdfjsLib()
        var pdfjsViewer = _pdfjsViewer()

        var host = this.$el[0]
        var viewerElement = document.createElement("div")
        viewerElement.className = "pdfViewer"
        host.appendChild(viewerElement)
        this._viewerElement = viewerElement

        this._eventBus = new pdfjsViewer.EventBus()
        // LinkTarget is pdfjsViewer's export, not pdfjsLib's — pdfjsLib has no
        // member by that name at all.
        this._linkService = new pdfjsViewer.PDFLinkService({
            eventBus: this._eventBus,
            externalLinkTarget: pdfjsViewer.LinkTarget.BLANK,
            externalLinkRel: "noopener noreferrer nofollow",
        })
        // updateMatchesCountOnProgress: false — without it pdf.js fires
        // updatefindmatchescount repeatedly while later pages are still being
        // extracted, with the count standing as it is at that moment; end of
        // find must wait for the one call this makes when every page has been
        // visited, carrying the final total (finding 3).
        this._findController = new pdfjsViewer.PDFFindController({linkService: this._linkService, eventBus: this._eventBus, updateMatchesCountOnProgress: false})
        this._pdfViewer = new pdfjsViewer.PDFViewer({
            container: host,
            viewer: viewerElement,
            eventBus: this._eventBus,
            linkService: this._linkService,
            findController: this._findController,
            // No textLayerMode: the viewer's own default is TextLayerMode.ENABLE
            // when the option is absent. Naming it here, even correctly, is a
            // bare literal PDFKit would have to keep in step with an enum it
            // does not own; omitting it instead ties PDFKit to the default
            // forever, so the only way to lose copying is pdf.js itself
            // changing that default, which the clipboard check at step 7
            // catches against the exact pinned version.
            annotationMode: pdfjsLib.AnnotationMode.ENABLE,
        })
        this._linkService.setViewer(this._pdfViewer)

        this._document = null
        this._documentGeneration = 0
        this._currentSelection = null
        this._highlightedSelections = []
        this._findGeneration = 0
        this._lastFindDispatch = null
        this._lastFindTotalMatches = 0
        this._lastPageNumber = null
        this._pageTextCache = null

        this.minScaleFactor = 0.25
        this.maxScaleFactor = 10
        this.autoScales = true
        this._scaleFactor = 1
        this._displayMode = PDFDisplayMode.singlePageContinuous

        this._eventListeners = [
            ["pagesinit", () => this._applyScale()],
            ["pagechanging", (evt) => this._pageDidChange(evt)],
            ["updatefindmatchescount", (evt) => this._findDidComplete(evt)],
        ]
        for (var entry of this._eventListeners) { this._eventBus.on(entry[0], entry[1]) }
    }

    get document() {
        return this._document
    }

    // document — Apple's is a plain PDFDocument? property; setting it starts
    // loading if the document has not resolved yet. PDFViewDocumentChanged
    // fires once the load settles, success or failure, so a spinner started
    // in viewDidLoad has one event to stop on either way (ruling: finding 4).
    set document(doc) {
        typed(doc, "document", _documentType, "PDFView.document", "Apple's is document: PDFDocument?; write pdfView.document = new PDFDocument({url}) or null.")
        if (this._document === doc) { return }
        this._detachDocument()
        this._document = doc || null
        this._lastPageNumber = null
        this._pageTextCache = null
        if (!doc) { return }

        doc._attachedView = this
        var generation = ++this._documentGeneration
        doc._loadingTask.promise.then(
            () => {
                if (this._documentGeneration !== generation) { return }
                // Both, not just the viewer: PDFViewer.setDocument propagates
                // to its own findController but never to its linkService, and
                // PDFFindController reads linkService.pagesCount (real pdf.js
                // source, verified directly) to iterate every page during
                // extraction — left unset, pagesCount stays 0, the extraction
                // loop never runs, and a search silently returns nothing ever,
                // for every document, with no error anywhere.
                this._linkService.setDocument(doc._proxy)
                this._pdfViewer.setDocument(doc._proxy)
                NotificationCenter.default.post({name: PDFView.documentChangedNotification, object: this})
            },
            () => {
                if (this._documentGeneration !== generation) { return }
                NotificationCenter.default.post({name: PDFView.documentChangedNotification, object: this})
            }
        )
    }

    get currentPage() {
        if (!this._document || !this._pdfViewer.currentPageNumber) { return null }
        return this._document.page({at: this._pdfViewer.currentPageNumber - 1})
    }

    // No currentPage setter: Apple's currentPage is read-only. go(to:) is
    // the only way to turn the page, as in PDFKit.
    // go(to:)
    /**
     * @param {object} options
     * @param {*} options.to
     */
    go({to} = {}) {
        required(to, "to", _pageType, "PDFView.go(to:)", "Apple's is go(to:); write go({to: page}).")
        this._pdfViewer.currentPageNumber = to._index + 1
    }

    get scaleFactor() {
        return this._scaleFactor
    }

    set scaleFactor(value) {
        typed(value, "scaleFactor", Float, "PDFView.scaleFactor", "Apple's is scaleFactor: CGFloat; write pdfView.scaleFactor = 1.5.")
        this.autoScales = false
        this._scaleFactor = Math.min(this.maxScaleFactor, Math.max(this.minScaleFactor, value))
        this._pdfViewer.currentScale = this._scaleFactor
        NotificationCenter.default.post({name: PDFView.scaleChangedNotification, object: this})
    }

    get displayMode() {
        return this._displayMode
    }

    set displayMode(mode) {
        typed(mode, "displayMode", _displayModeType, "PDFView.displayMode", "Apple's is displayMode: PDFDisplayMode; write pdfView.displayMode = PDFDisplayMode.singlePage.")
        this._displayMode = mode
        var mapped = _scrollAndSpreadFor(mode, _pdfjsViewer())
        this._pdfViewer.scrollMode = mapped.scrollMode
        this._pdfViewer.spreadMode = mapped.spreadMode
    }

    get currentSelection() {
        return this._currentSelection
    }

    set currentSelection(selection) {
        this._setSelection(selection, {animated: false})
    }

    // setCurrentSelection(_:animate:) — Apple's label is animate:, not animated:.
    /**
     * @param {PDFSelection} selection
     * @param {object} [options]
     * @param {boolean} [options.animate]
     */
    setCurrentSelection(selection, {animate = false} = {}) {
        required(selection, "selection", _selectionType, "PDFView.setCurrentSelection(_:animate:)", "Apple's is setCurrentSelection(_:animate:); write setCurrentSelection(selection, {animate: true}).")
        this._setSelection(selection, {animated: animate})
    }

    clearSelection() {
        this._setSelection(null, {animated: false})
    }

    get highlightedSelections() {
        return this._highlightedSelections
    }

    // Clearing to [] dispatches an empty find so pdf.js's own highlighter — the
    // same one that painted the matches — removes them; PDFKit never reaches
    // into a buffered page's text layer to strip span.highlight by hand
    // (ruling: finding 12). This needs no guard against a spurious end-of-find:
    // pdf.js returns from its own match step before matching anything when the
    // query is empty, so an empty find never fires updatefindmatchescount,
    // which is the only event end-of-find now comes from (finding 4).
    set highlightedSelections(selections) {
        this._highlightedSelections = selections || []
        if (this._highlightedSelections.length === 0) {
            this._eventBus.dispatch("find", {source: this, type: "", query: "", highlightAll: true})
        }
    }

    layoutSubviews() {
        this._applyScale()
    }

    // Apple's real PDFView draws its own current selection, so setting one is
    // all its API ever has to do; here, pdf.js's own renderer draws
    // .highlight.selected off its own find-controller pointer (_selected in
    // pdf_viewer.mjs), which setting currentSelection never otherwise moves —
    // confirmed by reading the real pdf.js source, not assumed: _setSelection
    // previously only recorded the selection and scrolled the page, leaving
    // .selected forever on whichever match the controller's own first-match
    // auto-select had already landed on. The fix replays the stored find with
    // type "again" and the direction worked out below — the same public
    // event its own find bar's next/previous buttons dispatch — so this
    // never reads or patches the controller's private state (_selected,
    // _offset) directly.
    //
    // Direction is inferred from the matchOrdinal _reportMatch tagged each
    // selection with (its 0-based position among the current search's
    // matches) rather than asked of the caller, so setCurrentSelection stays
    // exactly Apple's two-label signature. A plain "is the new ordinal
    // smaller" test gets the wrap wrong — stepping forward from the last
    // match to the first has a smaller ordinal but is still a forward step —
    // so wrapping at either end is checked first, against the total this
    // view's own _findDidComplete already counted. The very first selection
    // of a search has no previous to compare against, so "again" is skipped
    // for it — pdf.js's own debounced first dispatch already selected and
    // scrolled to it by the time this runs.
    //
    // Either way, a find result (anything with a matchOrdinal) is never
    // followed by the page-level scroll below: pdf.js always scrolls a
    // .selected match itself (its own #updateMatch sets _scrollMatches and
    // the matched span's own render calls scrollMatchIntoView, honouring the
    // span's scroll-margin — more precise than scrolling to the top of the
    // page), for the very first match exactly as much as for a stepped-to
    // one. The two were not treated alike here before, and the gap showed:
    // the first match called this scrollPageIntoView unconditionally, which
    // does not know about a site's scroll-margin-top and landed the page
    // wherever "top of page" falls, overwriting the position pdf.js's own
    // correct, margin-aware scroll had just put it at a moment earlier.
    _setSelection(selection, {animated}) {
        if (this._currentSelection === selection) { return }
        var previous = this._currentSelection
        this._currentSelection = selection
        NotificationCenter.default.post({name: PDFView.selectionChangedNotification, object: this})
        if (!animated || !selection || !selection.pages || selection.pages.length === 0) { return }

        if (selection._matchOrdinal !== undefined && this._lastFindDispatch) {
            if (previous && previous._matchOrdinal !== undefined) {
                var total = this._lastFindTotalMatches
                var findPrevious
                if (total && previous._matchOrdinal === total - 1 && selection._matchOrdinal === 0) {
                    findPrevious = false
                } else if (total && previous._matchOrdinal === 0 && selection._matchOrdinal === total - 1) {
                    findPrevious = true
                } else {
                    findPrevious = selection._matchOrdinal < previous._matchOrdinal
                }
                this._eventBus.dispatch("find", Object.assign({}, this._lastFindDispatch, {type: "again", findPrevious: findPrevious}))
            }
            return
        }

        var pageNumber = selection.pages[0]._index + 1
        this._pdfViewer.scrollPageIntoView({pageNumber: pageNumber, destArray: null})
    }

    _applyScale() {
        if (this.autoScales) {
            this._pdfViewer.currentScaleValue = "page-width"
            return
        }
        this._pdfViewer.currentScale = this._scaleFactor
    }

    _pageDidChange(evt) {
        var number = evt && evt.pageNumber
        if (number === this._lastPageNumber) { return }
        this._lastPageNumber = number
        NotificationCenter.default.post({name: PDFView.pageChangedNotification, object: this})
    }

    // Driven by PDFDocument.beginFindString once this view's document is the
    // one searching. The search protocol is the same one pdf.js's own findbar
    // uses — an eventBus dispatch, never a private method call. The dispatch
    // is kept (without its "" type) so _setSelection can replay the same
    // query and options with type "again" when stepping between matches;
    // the total is reset here and filled in once _findDidComplete knows it,
    // so a stale count from a previous search can never be read for this one.
    _beginFind({query, dispatchOptions, generation}) {
        this._findGeneration = generation
        this._lastFindDispatch = Object.assign({source: this, query: query, highlightAll: true}, dispatchOptions)
        this._lastFindTotalMatches = 0
        this._eventBus.dispatch("find", Object.assign({type: ""}, this._lastFindDispatch))
    }

    // updatefindmatchescount, with updateMatchesCountOnProgress: false set on
    // the controller, fires exactly once per search: when every page has been
    // visited, carrying the final matchesCount.total (finding 3). That makes
    // it the one place pageMatches/pageMatchesLength are read — pdf.js's own
    // controller guarantees they are complete here, never mid-extraction —
    // and the one place end-of-find is posted: after every DidFindMatch for
    // this generation has itself posted, not merely been scheduled, so an
    // observer never sees the end arrive before the matches it is the end of.
    _findDidComplete(evt) {
        var doc = this._document
        if (!doc) { return }
        var generation = this._findGeneration
        var pageMatches = this._findController.pageMatches || []
        var pageMatchesLength = this._findController.pageMatchesLength || []
        var pending = []
        var matchOrdinal = 0
        for (var pageIndex = 0; pageIndex < pageMatches.length; pageIndex++) {
            var offsets = pageMatches[pageIndex] || []
            var lengths = pageMatchesLength[pageIndex] || []
            for (var i = 0; i < offsets.length; i++) {
                pending.push(this._reportMatch({pageIndex: pageIndex, offset: offsets[i], length: lengths[i], generation: generation, document: doc, matchOrdinal: matchOrdinal}))
                matchOrdinal++
            }
        }
        var total = evt && evt.matchesCount ? evt.matchesCount.total : pending.length
        if (generation === this._findGeneration) { this._lastFindTotalMatches = total }
        Promise.all(pending).then(() => {
            if (generation !== this._findGeneration) { return }
            doc._postEndFind(total, generation)
        })
    }

    // PDFSelection.string is never derived from pdf.js's private per-page
    // cache: it reproduces pdf.js's own join — items' str, plus "\n" where
    // hasEOL — from the page's public getTextContent(), the same text the
    // match offsets were computed against (ruling 3c). Returns the promise so
    // _findDidComplete can wait for every match of a search to post before
    // posting that search's end. A page whose text cannot be read — most
    // realistically because the document was replaced mid-search and the old
    // proxy was destroyed out from under this call — yields no match rather
    // than an unhandled rejection that would otherwise strand every match
    // still pending for this search and leave DidEndFind never posted.
    // matchOrdinal is PDFView's own bookkeeping for _setSelection's direction
    // check, not a PDFSelection constructor label — Apple's PDFSelection has
    // no such property, so it is set on the instance after construction, the
    // same way PDFDocument._attachedView is, rather than added to the public
    // shape PDFSelection's constructor accepts.
    _reportMatch({pageIndex, offset, length, generation, document, matchOrdinal}) {
        return this._textFor(pageIndex).then(
            (text) => {
                if (generation !== this._findGeneration) { return }
                var page = document.page({at: pageIndex})
                var selection = new PDFSelection({string: text.slice(offset, offset + length), pages: page ? [page] : []})
                selection._matchOrdinal = matchOrdinal
                document._postFindMatch(selection, generation)
            },
            (reason) => {
                console.error(`PDFKit: failed to read text for page ${pageIndex + 1} during find: ${(reason && reason.name) || "UnknownError"}`)
            }
        )
    }

    _textFor(pageIndex) {
        if (!this._pageTextCache) { this._pageTextCache = new Map() }
        if (this._pageTextCache.has(pageIndex)) { return this._pageTextCache.get(pageIndex) }
        var cache = this._pageTextCache
        var promise = this._document._proxy.getPage(pageIndex + 1)
            .then((pageProxy) => pageProxy.getTextContent())
            .then((content) => content.items.map((item) => item.str + (item.hasEOL ? "\n" : "")).join(""))
        // A rejection (the document replaced mid-flight, its proxy already
        // destroyed) must not poison every later search that touches this
        // page: drop the cache entry so the next one retries the read, rather
        // than caching the failure forever. Guarded by identity, not just
        // presence, so this never evicts a newer entry a cache reset and
        // repopulation already installed for the same index.
        promise.catch(() => { if (cache.get(pageIndex) === promise) { cache.delete(pageIndex) } })
        this._pageTextCache.set(pageIndex, promise)
        return promise
    }

    _detachDocument() {
        var previous = this._document
        if (!previous) { return }
        // A search's pending match/end promises check this generation when
        // they settle; bumping it here means an in-flight result against the
        // document this call is about to destroy is dropped on both the match
        // and the end-of-find path, rather than resolving late and posting
        // with the replaced document as its subject.
        this._findGeneration++
        this._lastFindDispatch = null
        this._lastFindTotalMatches = 0
        // Public; pdf.js propagates document(null) to the find controller on
        // its own, but never to the link service (see the document setter),
        // so that one is cleared here explicitly too. Without the viewer
        // call, it keeps the old pages, canvases and text layers alive
        // against a worker port the next line destroys, and a scroll after
        // replacement renders from a document that is already gone.
        this._linkService.setDocument(null)
        this._pdfViewer.setDocument(null)
        previous._destroy()
    }

    _dispose() {
        this._detachDocument()
        for (var entry of this._eventListeners || []) { this._eventBus.off(entry[0], entry[1]) }
        this._eventListeners = []
        super._dispose()
    }
}


function _scrollAndSpreadFor(mode, pdfjsViewer) {
    var ScrollMode = pdfjsViewer.ScrollMode
    var SpreadMode = pdfjsViewer.SpreadMode
    switch (mode) {
        case PDFDisplayMode.singlePage: return {scrollMode: ScrollMode.PAGE, spreadMode: SpreadMode.NONE}
        case PDFDisplayMode.twoUp: return {scrollMode: ScrollMode.PAGE, spreadMode: SpreadMode.ODD}
        case PDFDisplayMode.twoUpContinuous: return {scrollMode: ScrollMode.VERTICAL, spreadMode: SpreadMode.ODD}
        default: return {scrollMode: ScrollMode.VERTICAL, spreadMode: SpreadMode.NONE}
    }
}
