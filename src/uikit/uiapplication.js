import { UIResponder } from "./uiresponder.js"
import "./uiwindow.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { resolvedNavigableURL } from "../utils/navigableurl.js"
import { applicationKey, keyWindowKey } from "../utils/documentkeys.js"
import { typed, optional, URLType, FunctionType } from "../utils/required.js"


const State = Object.freeze({active: 0, inactive: 1, background: 2})


// UIApplication.shared: the page's way to hand an address to the browser or
// another app, as the app does on iOS, the page's applicationState and its
// window.
//
// The state is the page's visibility, which is all a browser offers of an
// app's life, and the application exists from the moment UIKit loads, the
// equivalent of the process starting, so an observer needs no read of `shared`
// to be told. A hidden page posts willResignActiveNotification while the state
// is `.inactive`, then didEnterBackgroundNotification once it is `.background`.
// A page that becomes visible again posts willEnterForegroundNotification
// while the state is `.inactive`, then didBecomeActiveNotification once it is
// `.active`, as on Apple, where the app is not active until the second one. A
// browser has no inactive phase of its own, so `.inactive` exists only inside
// the first post of each pair. A page that loads hidden starts in
// `.background`. One visibilitychange listener per document does it, keyed on a
// symbol so that a second copy of the package finds the first's application
// and installs nothing. Window blur and focus are not mapped: they fire on
// every devtools or iframe focus change, which is not the app moving.
// didFinishLaunching, UIScene and the application delegate's callbacks are not
// published: nothing the page can observe says when they would happen, and a
// notification posted without that would be a lie.
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

    static get willResignActiveNotification() {
        return "UIApplicationWillResignActiveNotification"
    }

    static get shared() {
        return _shared
    }

    // Read-only, as Apple's: only the page's visibility moves it.
    get applicationState() {
        return this._applicationState
    }

    // The window UIKit made over body when it loaded. Apple deprecated keyWindow
    // in iOS 13 for windowScene.keyWindow, but it is still Apple's name here:
    // there are no scenes.
    get keyWindow() {
        if (typeof document === "undefined") { return null }
        return document[keyWindowKey] || null
    }

    // One window, since a page has one body.
    get windows() {
        var keyWindow = this.keyWindow
        return keyWindow ? [keyWindow] : []
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


var _shared = _launch()

// A document that already has an application, because another copy of the
// package launched first, keeps it: its listener is the only one.
function _launch() {
    if (typeof document === "undefined") { return new UIApplication() }
    if (document[applicationKey]) { return document[applicationKey] }
    var application = new UIApplication()
    var launched = document
    application._applicationState = launched.visibilityState === "hidden" ? State.background : State.active
    launched[applicationKey] = application
    launched.addEventListener("visibilitychange", () => _visibilityChanged(application, launched))
    return application
}

function _visibilityChanged(application, launched) {
    var isHidden = launched.visibilityState === "hidden"
    var isBackground = application._applicationState === State.background
    if (isHidden && !isBackground) { return _resign(application) }
    if (!isHidden && isBackground) { return _become(application) }
}

function _resign(application) {
    application._applicationState = State.inactive
    NotificationCenter.default.post({name: UIApplication.willResignActiveNotification, object: application})
    application._applicationState = State.background
    NotificationCenter.default.post({name: UIApplication.didEnterBackgroundNotification, object: application})
}

function _become(application) {
    application._applicationState = State.inactive
    NotificationCenter.default.post({name: UIApplication.willEnterForegroundNotification, object: application})
    application._applicationState = State.active
    NotificationCenter.default.post({name: UIApplication.didBecomeActiveNotification, object: application})
}
