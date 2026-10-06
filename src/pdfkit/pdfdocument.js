import { required, typed, StringType } from "../utils/required.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { PDFPage } from "./pdfpage.js"
import { pdfjsLib as _pdfjsLib, pdfjsRendererOptions } from "./pdfjsGlobals.js"


const FindOptions = Object.freeze({
    caseInsensitive: "caseInsensitive",
    literal: "literal",
    backwards: "backwards",
})

// Apple's find is case-sensitive unless .caseInsensitive is given; pdf.js
// defaults the other way (caseSensitive: false), so the no-options case must
// explicitly dispatch caseSensitive: true to land on Apple's default, not
// pdf.js's. .literal means no linguistic folding, not whole-word — it maps to
// matchDiacritics, never to entireWord, which stays false always because
// Apple has no whole-word find option to misreport.
function _dispatchOptionsFor(options) {
    var caseInsensitive = options.indexOf(FindOptions.caseInsensitive) !== -1
    var literal = options.indexOf(FindOptions.literal) !== -1
    var backwards = options.indexOf(FindOptions.backwards) !== -1
    return {
        caseSensitive: !caseInsensitive,
        entireWord: false,
        matchDiacritics: literal,
        findPrevious: backwards,
    }
}

// A PDF is site-owned content fetched by url, never a user-suppliable scheme
// that could run script or read a blob the page already holds — relative
// paths and http(s): only, the same boundary a browser's own navigation draws.
// Reading the string as written is not that boundary: getDocument resolves a
// string url with the URL parser, which strips leading/trailing C0 controls
// and spaces and removes embedded tabs and newlines before it ever looks at
// the scheme, so " data:..." or "da\tta:..." would read as relative here and
// load as something else entirely. Resolve first, the way
// src/foundation/nsuseractivity.js's webpageURL already does, and judge the
// resolved protocol, not the text.
function _validateScheme(url) {
    var resolved
    try {
        resolved = new URL(url, typeof window !== "undefined" && window.location ? window.location.href : "http://localhost/")
    } catch (error) {
        throw new TypeError(`PDFDocument(url:) refuses a url it cannot resolve; only relative paths and http(s): are accepted: ${url}`)
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
        throw new TypeError(`PDFDocument(url:) refuses a "${resolved.protocol}" url; only relative paths and http(s): are accepted: ${url}`)
    }
}


// PDFKit's PDFDocument: a parsed PDF, independent of any PDFView showing it,
// as in PDFKit. Loading is asynchronous — pdf.js has no other way to do it —
// but nothing about that asynchrony is new API: the host globals are read
// synchronously in the constructor, same as everywhere else in PDFKit, and
// only the network fetch that follows is a promise.
export class PDFDocument {

    static get FindOptions() {
        return FindOptions
    }

    static get didBeginFindNotification() {
        return "PDFDocumentDidBeginFind"
    }

    static get didFindMatchNotification() {
        return "PDFDocumentDidFindMatch"
    }

    static get didEndFindNotification() {
        return "PDFDocumentDidEndFind"
    }

    // PDFDocument(url:)
    /**
     * @param {object} options
     * @param {string} options.url
     */
    constructor({url} = {}) {
        required(url, "url", StringType, "PDFDocument(url:)", "Apple's is PDFDocument(url:); write new PDFDocument({url}).")
        _validateScheme(url)

        this._documentURL = url
        this._pages = new Map()
        this._pageLabels = null
        this._pageCount = 0
        this._proxy = null
        this._destroyed = false
        this._attachedView = null
        this._findGeneration = 0
        this._pendingQuery = null

        this._loadingTask = _pdfjsLib().getDocument(Object.assign({url: url}, pdfjsRendererOptions(), {isEvalSupported: false}))
        this._loadingTask.promise.then(
            (proxy) => this._didLoad(proxy),
            (reason) => this._didFail(reason)
        )
    }

    get documentURL() {
        return this._documentURL
    }

    get pageCount() {
        return this._pageCount
    }

    // page(at:) — Apple's index is 0-based, like PDFPage's own position.
    /**
     * @param {object} options
     * @param {number} options.at
     */
    page({at} = {}) {
        if (at < 0 || at >= this._pageCount) { return null }
        if (!this._pages.has(at)) { this._pages.set(at, new PDFPage(this, at)) }
        return this._pages.get(at)
    }

    // beginFindString(_:withOptions:) — Apple's find is asynchronous here
    // because pdf.js extracts text through a worker; a synchronous
    // findString(_:withOptions:) would be the one lying signature in the
    // package, so PDFKit ships only the asynchronous form. A new call
    // supersedes whichever search is still running; an empty string clears
    // without ever reaching pdf.js, so it can never dispatch a find.
    /**
     * @param {string} string
     * @param {object} [options]
     * @param {string[]} [options.withOptions]
     */
    beginFindString(string, {withOptions = []} = {}) {
        typed(string, "string", StringType, "PDFDocument.beginFindString(_:withOptions:)", "Apple's is beginFindString(_:withOptions:); write beginFindString(query, {withOptions: []}).")
        var generation = ++this._findGeneration
        this._pendingQuery = string

        if (string === "") {
            this._post(PDFDocument.didBeginFindNotification, generation)
            this._post(PDFDocument.didEndFindNotification, generation, {matchCount: 0})
            // Bookkeeping only, not the public highlightedSelections setter:
            // that setter dispatches an empty find to make pdf.js drop the
            // spans it drew (finding 12), and an empty query here must
            // dispatch nothing at all. A previous search's highlights, if any,
            // are left on screen — clearing them is the consumer's to do
            // through the public setter, exactly as the search field does on
            // DidEndFind with an empty match list (README's recorded limitation).
            if (this._attachedView) { this._attachedView._highlightedSelections = [] }
            return
        }

        if (!this._attachedView) {
            throw new Error("PDFDocument.beginFindString(_:withOptions:) requires this document to be set on a PDFView's document first.")
        }

        this._post(PDFDocument.didBeginFindNotification, generation)
        this._attachedView._beginFind({
            query: string,
            dispatchOptions: _dispatchOptionsFor(withOptions),
            generation: generation,
        })
    }

    cancelFindString() {
        this._findGeneration++
        this._pendingQuery = null
    }

    _post(name, generation, userInfo) {
        if (generation !== this._findGeneration) { return }
        NotificationCenter.default.post({name: name, object: this, userInfo: userInfo || null})
    }

    // Called by the attached PDFView once per match and once at the end of a
    // search; both check the generation themselves so a superseded search's
    // late results can never surface as if they were the current one's.
    _postFindMatch(selection, generation) {
        this._post(PDFDocument.didFindMatchNotification, generation, {selection: selection})
    }

    _postEndFind(matchCount, generation) {
        this._post(PDFDocument.didEndFindNotification, generation, {matchCount: matchCount})
    }

    _didLoad(proxy) {
        if (this._destroyed) { return }
        this._proxy = proxy
        this._pageCount = proxy.numPages
        proxy.getPageLabels().then(
            (labels) => { this._pageLabels = labels },
            () => {}
        )
    }

    // A load failure is Apple-shaped and silent in the API — pageCount simply
    // stays 0 — but silent everywhere is a regression a spinner can hide
    // behind forever, so one console.error names what failed, logging rather
    // than inventing an `error` property pdf.js gives no basis for.
    _didFail(reason) {
        var name = (reason && reason.name) || "UnknownError"
        console.error(`PDFDocument(url:) failed to load "${this._documentURL}": ${name}`)
    }

    // Not Apple's API — pdf.js's own cleanup, called by whichever PDFView
    // detaches this document. Idempotent: a document handed from one view to
    // another, or set twice, is only ever torn down once.
    _destroy() {
        if (this._destroyed) { return }
        this._destroyed = true
        if (this._loadingTask && typeof this._loadingTask.destroy === "function") {
            this._loadingTask.destroy()
        }
        if (this._attachedView) { this._attachedView = null }
    }
}
