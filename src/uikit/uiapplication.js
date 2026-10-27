import { UIResponder } from "./uiresponder.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { resolvedNavigableURL } from "../utils/navigableurl.js"
import { typed, optional, URLType, FunctionType } from "../utils/required.js"


const State = Object.freeze({active: 0, inactive: 1, background: 2})


// UIApplication.shared: the page's way to hand an address to the browser or
// another app, as the app does on iOS, and the page's applicationState.
//
// The state is the page's visibility, which is all a browser offers of an
// app's life: a hidden page is `.background` and posts
// didEnterBackgroundNotification; becoming visible again posts
// willEnterForegroundNotification while the state is still `.inactive`, then
// the state is `.active` and didBecomeActiveNotification follows, in Apple's
// order, where the app is not yet active while the first is delivered. A
// browser has no inactive phase of its own, so `.inactive` exists only during
// that post. A page that loads hidden starts in `.background`. One
// visibilitychange listener on the document does it, made the first time
// `shared` is read and kept for the page's life, as the app's is. The launch's
// didBecomeActive, willResignActive, didFinishLaunching, UIScene and the
// application delegate's callbacks are not published: nothing the page can
// observe says when they would happen, and a notification posted without that
// would be a lie.
export class UIApplication extends UIResponder {

    _applicationState = State.active

    static get State() {
        return State
    }

    static get didEnterBackgroundNotification() {
        return "UIApplicationDidEnterBackgroundNotification"
    }

    static get willEnterForegroundNotification() {
        return "UIApplicationWillEnterForegroundNotification"
    }

    static get didBecomeActiveNotification() {
        return "UIApplicationDidBecomeActiveNotification"
    }

    static get shared() {
        if (_shared) { return _shared }
        _shared = new UIApplication()
        _observeVisibility(_shared)
        return _shared
    }

    // Read-only, as Apple's: only the page's visibility moves it.
    get applicationState() {
        return this._applicationState
    }

    // Whether open(_:) would act on the address: http(s), mailto: and tel:, the
    // schemes NSUserActivity.webpageURL accepts. Anything a browser would execute
    // or read from disk is no.
    canOpenURL(url) {
        typed(url, "url", URLType, "UIApplication.canOpenURL", "Apple's is canOpenURL(_ url: URL) -> Bool.")
        return resolvedNavigableURL(String(url)) !== null
    }

    // Opens the resolved address, not the text: window.open resolves a relative
    // one against the document's base URL, which may differ from the page's
    // address the check used. It opens in a new tab with noopener, so the page
    // it opens cannot reach back to this one. completionHandler gets true once the request was
    // made and false when the address is refused. A browser that blocks the
    // popup does not say so, and noopener makes window.open return null, so
    // true means "requested", not "shown". Called synchronously, where Apple's
    // arrives later on the main queue. options is accepted and ignored: Apple's
    // keys (universalLinksOnly) have no meaning in a browser.
    /**
     * @param {string|URL} url
     * @param {object} [parameters]
     * @param {object} [parameters.options]
     * @param {Function|null} [parameters.completionHandler]
     */
    open(url, {options = {}, completionHandler = null} = {}) {
        var signature = "Apple's is open(_ url: URL, options: [OpenExternalURLOptionsKey: Any] = [:], completionHandler: ((Bool) -> Void)? = nil)."
        typed(url, "url", URLType, "UIApplication.open", signature)
        typed(completionHandler, "completionHandler", optional(FunctionType), "UIApplication.open", signature)
        var resolved = resolvedNavigableURL(String(url))
        if (resolved) { window.open(resolved.href, "_blank", "noopener") }
        if (completionHandler) { completionHandler(resolved !== null) }
    }
}


var _shared = null

function _observeVisibility(application) {
    if (typeof document === "undefined") { return }
    application._applicationState = document.visibilityState === "hidden" ? State.background : State.active
    document.addEventListener("visibilitychange", () => _visibilityChanged(application))
}

function _visibilityChanged(application) {
    var isHidden = document.visibilityState === "hidden"
    if (isHidden && application._applicationState !== State.background) {
        application._applicationState = State.background
        NotificationCenter.default.post({name: UIApplication.didEnterBackgroundNotification, object: application})
        return
    }
    if (isHidden || application._applicationState !== State.background) { return }
    application._applicationState = State.inactive
    NotificationCenter.default.post({name: UIApplication.willEnterForegroundNotification, object: application})
    application._applicationState = State.active
    NotificationCenter.default.post({name: UIApplication.didBecomeActiveNotification, object: application})
}
