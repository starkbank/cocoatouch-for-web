import { UIResponder } from "./uiresponder.js"
import { resolvedNavigableURL } from "../utils/navigableurl.js"
import { typed, optional, URLType, FunctionType } from "../utils/required.js"


// UIApplication.shared: the page's way to hand an address to the browser or
// another app, as the app does on iOS.
export class UIApplication extends UIResponder {

    static get shared() {
        if (!_shared) { _shared = new UIApplication() }
        return _shared
    }

    // Whether open(_:) would act on the address: http(s), mailto: and tel:, the
    // schemes NSUserActivity.webpageURL accepts. Anything a browser would execute
    // or read from disk is no.
    canOpenURL(url) {
        typed(url, "url", URLType, "UIApplication.canOpenURL", "Apple's is canOpenURL(_ url: URL) -> Bool.")
        return resolvedNavigableURL(String(url)) !== null
    }

    // Opens the address in a new tab with noopener, so the page it opens cannot
    // reach back to this one. completionHandler gets true once the request was
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
        var isOpenable = this.canOpenURL(url)
        if (isOpenable) { window.open(String(url), "_blank", "noopener") }
        if (completionHandler) { completionHandler(isOpenable) }
    }
}


var _shared = null
