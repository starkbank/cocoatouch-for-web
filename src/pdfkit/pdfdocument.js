import { required, typed, arrayOf, enumeration, instance, StringType } from "../utils/required.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { NSNotification } from "../foundation/nsnotification.js"
import { NSString } from "../foundation/nsstring.js"
import { PDFDocumentFoundSelectionKey } from "./notifications.js"
import { NSNotFound } from "../foundation/nsrange.js"
import { PDFPage, pageIn } from "./pdfpage.js"
import { openDocument, pdfjsRendererOptions } from "./pdfjs.js"


const _pageType = instance(PDFPage, "PDFPage")

// The PDFDocumentDelegate method each find notification is also delivered
// through. Apple's own signatures carry the notification (or, for
// didMatchString, the selection) and no sender.
const _delegateMethods = {
    [NSNotification.Name.PDFDocumentDidBeginFind]: "documentDidBeginDocumentFind",
    [NSNotification.Name.PDFDocumentDidFindMatch]: "documentDidFindMatch",
    [NSNotification.Name.PDFDocumentDidEndFind]: "documentDidEndDocumentFind",
}
const _compareOptionsType = arrayOf(enumeration(NSString.CompareOptions, "NSString.CompareOptions"))

// Apple's find is case-sensitive unless .caseInsensitive is given, and
// diacritic-sensitive unless .diacriticInsensitive is; pdf.js's defaults run
// the other way (caseSensitive: false, matchDiacritics: false), so the
// no-options case must dispatch both explicitly to land on Apple's, not
// pdf.js's. .literal means no linguistic folding at all, so it wins over
// .diacriticInsensitive. It is never whole-word: entireWord stays false
// always because Apple has no whole-word compare option to misreport.
function _dispatchOptionsFor(options) {
    var caseInsensitive = options.indexOf(NSString.CompareOptions.caseInsensitive) !== -1
    var literal = options.indexOf(NSString.CompareOptions.literal) !== -1
    var diacriticInsensitive = options.indexOf(NSString.CompareOptions.diacriticInsensitive) !== -1
    var backwards = options.indexOf(NSString.CompareOptions.backwards) !== -1
    return {
        caseSensitive: !caseInsensitive,
        entireWord: false,
        matchDiacritics: literal || !diacriticInsensitive,
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
// but nothing about that asynchrony is new API: the constructor starts the
// load synchronously, same as everywhere else in PDFKit, and only the network
// fetch that follows is a promise.
export class PDFDocument {

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
        this._isFinding = false
        this._delegate = null

        var opened = openDocument(Object.assign({url: url}, pdfjsRendererOptions(), {isEvalSupported: false}))
        this._loadingTask = opened.loadingTask
        this._loaded = opened.promise
        this._releaseLoad = opened.release
        this._loaded.then(
            (proxy) => this._didLoad(proxy),
            (reason) => this._didFail(reason)
        )
    }

    get delegate() {
        return this._delegate
    }

    set delegate(delegate) {
        this._delegate = delegate
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
        if (!this._pages.has(at)) { this._pages.set(at, pageIn(this, at)) }
        return this._pages.get(at)
    }

    // index(for:) — NSNotFound for a page this document does not own, which
    // includes a bare PDFPage(), as Apple's does.
    /**
     * @param {object} options
     * @param {PDFPage} options.for
     */
    index({for: page} = {}) {
        required(page, "for", _pageType, "PDFDocument.index(for:)", "Apple's is index(for:); write doc.index({for: page}).")
        if (page._document !== this) { return NSNotFound }
        return page._index
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
     * @param {string[]} [options.withOptions] NSString.CompareOptions cases
     */
    beginFindString(string, {withOptions = []} = {}) {
        typed(string, "string", StringType, "PDFDocument.beginFindString(_:withOptions:)", "Apple's is beginFindString(_:withOptions:); write beginFindString(query, {withOptions: []}).")
        typed(withOptions, "withOptions", _compareOptionsType, "PDFDocument.beginFindString(_:withOptions:)", "Apple's is beginFindString(_:withOptions:); write beginFindString(query, {withOptions: [NSString.CompareOptions.caseInsensitive]}).")
        var generation = ++this._findGeneration

        if (string === "") {
            this._isFinding = true
            this._post(NSNotification.Name.PDFDocumentDidBeginFind, generation)
            this._postEndFind(0, generation)
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

        this._isFinding = true
        this._post(NSNotification.Name.PDFDocumentDidBeginFind, generation)
        this._attachedView._beginFind({
            query: string,
            dispatchOptions: _dispatchOptionsFor(withOptions),
            generation: generation,
        })
    }

    // Apple's isFinding: true from the begin of a find until its end, which
    // is a cancel, a superseding empty find, the detach of the document, or
    // the DidEndFind itself.
    get isFinding() {
        return this._isFinding
    }

    cancelFindString() {
        this._findGeneration++
        this._isFinding = false
    }

    // The delegate is handed the very notification object observers receive.
    // NotificationCenter.post builds that object and returns nothing, so a
    // one-shot observer, registered last and removed before this returns,
    // forwards it — which keeps NotificationCenter exactly Apple's.
    _post(name, generation, userInfo) {
        if (generation !== this._findGeneration) { return }
        var center = NotificationCenter.default
        var method = _delegateMethods[name]
        if (!this._delegateImplements(method)) {
            center.post({name: name, object: this, userInfo: userInfo || null})
            return
        }
        var forwarder = {}
        center.addObserver(forwarder, {name: name, object: this, selector: (notification) => this._notifyDelegate(method, notification)})
        try {
            center.post({name: name, object: this, userInfo: userInfo || null})
        } finally {
            center.removeObserver(forwarder)
        }
    }

    // PDFDocumentDelegate's methods have no sender in Apple's signatures, so
    // this is deliberately not UITableView's _delegateCall, which would put
    // `this` first. Exactly one argument is passed, as Apple's signature has.
    _notifyDelegate(method, argument) {
        if (!this._delegateImplements(method)) { return }
        this._delegate[method](argument)
    }

    _delegateImplements(method) {
        var delegate = this._delegate
        return !!delegate && typeof delegate[method] === "function"
    }

    // Called by the attached PDFView once per match and once at the end of a
    // search; both check the generation themselves so a superseded search's
    // late results can never surface as if they were the current one's.
    _postFindMatch(selection, generation) {
        if (generation !== this._findGeneration) { return }
        this._post(NSNotification.Name.PDFDocumentDidFindMatch, generation, {[PDFDocumentFoundSelectionKey]: selection})
        this._notifyDelegate("didMatchString", selection)
    }

    // Apple's end-of-find carries no userInfo. The count is the view's own
    // bookkeeping (_lastFindTotalMatches), passed here only so the call site
    // says what the search found.
    _postEndFind(matchCount, generation) {
        if (generation !== this._findGeneration) { return }
        this._isFinding = false
        this._post(NSNotification.Name.PDFDocumentDidEndFind, generation)
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
        // A document the consumer replaced is not a failure the consumer needs
        // told about; pdf.js aborts a load destroyed in the same tick.
        if (this._destroyed) { return }
        var name = (reason && reason.name) || "UnknownError"
        console.error(`PDFDocument(url:) failed to load "${this._documentURL}": ${name}`)
    }

    // Not Apple's API — pdf.js's own cleanup, called by whichever PDFView
    // detaches this document. Idempotent: a document handed from one view to
    // another, or set twice, is only ever torn down once.
    _destroy() {
        if (this._destroyed) { return }
        this._destroyed = true
        this._releaseLoad()
        // The view bumps its own find generation before destroying the document,
        // so this document's end-of-find is dropped and would never clear the flag.
        this._isFinding = false
        if (this._loadingTask && typeof this._loadingTask.destroy === "function") {
            this._loadingTask.destroy()
        }
        if (this._attachedView) { this._attachedView = null }
    }
}
