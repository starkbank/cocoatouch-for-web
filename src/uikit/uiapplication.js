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
// to be told. A page that loads visible is `.inactive` and becomes `.active`
// at the first task after load, posting didBecomeActiveNotification once, as
// Apple's launch does; that is a task after the module is evaluated, so an
// observer added by code the page runs later does not hear it. A page that
// loads hidden starts in `.background` and posts nothing. A hidden page posts
// willResignActiveNotification while the state is still `.active`, then is
// `.background` and posts didEnterBackgroundNotification. A page that becomes
// visible again posts willEnterForegroundNotification while the state is still
// `.background`, then is `.active` and posts didBecomeActiveNotification, as on
// Apple, where each of the first two precedes the change it announces. A page
// hidden before the launch task was never active, so it resigns nothing: it
// goes from `.inactive` to `.background` and posts didEnterBackground alone. A
// browser has no inactive phase of its own beyond the launch. One
// visibilitychange listener per document does it, keyed on a symbol so that a
// second copy of the package finds the first's application and installs
// nothing. Window blur and focus are not mapped: they fire on every devtools or
// iframe focus change, which is not the app moving.
// didFinishLaunching, UIScene and the application delegate's callbacks are not
// published: nothing the page can observe says when they would happen, and a
// notification posted without that would be a lie.
export class UIApplication extends UIResponder {

    _applicationState = State.active

    // Apple's application is made by UIKit alone, and a second one would not be
    // the page's.
    constructor() {
        if (!_isLaunching) { throw new TypeError("UIApplication is made by UIKit when it loads: use UIApplication.shared.") }
        super()
    }

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


var _isLaunching = false

var _shared = _launch()

function _make() {
    _isLaunching = true
    try { return new UIApplication() } finally { _isLaunching = false }
}

// A document that already has an application, because another copy of the
// package launched first, keeps it: its listener is the only one, and its
// launch is the only one.
function _launch() {
    if (typeof document === "undefined") { return _make() }
    if (document[applicationKey]) { return document[applicationKey] }
    var application = _make()
    var launched = document
    launched[applicationKey] = application
    launched.addEventListener("visibilitychange", () => _visibilityChanged(application, launched))
    if (launched.visibilityState === "hidden") {
        application._applicationState = State.background
        return application
    }
    application._applicationState = State.inactive
    application._launchTask = setTimeout(() => _activate(application), 0)
    return application
}

// The first task after load: the launch ends and the application is active.
function _activate(application) {
    application._launchTask = null
    application._applicationState = State.active
    NotificationCenter.default.post({name: UIApplication.didBecomeActiveNotification, object: application})
}

function _visibilityChanged(application, launched) {
    var isHidden = launched.visibilityState === "hidden"
    var isBackground = application._applicationState === State.background
    if (isHidden && !isBackground) { return _resign(application) }
    if (!isHidden && isBackground) { return _become(application) }
}

// Hidden while the launch task is pending, the application was never active:
// the task is cancelled and no willResignActive is posted.
function _resign(application) {
    if (application._applicationState === State.active) {
        NotificationCenter.default.post({name: UIApplication.willResignActiveNotification, object: application})
    }
    clearTimeout(application._launchTask)
    application._launchTask = null
    application._applicationState = State.background
    NotificationCenter.default.post({name: UIApplication.didEnterBackgroundNotification, object: application})
}

function _become(application) {
    NotificationCenter.default.post({name: UIApplication.willEnterForegroundNotification, object: application})
    application._applicationState = State.active
    NotificationCenter.default.post({name: UIApplication.didBecomeActiveNotification, object: application})
}
