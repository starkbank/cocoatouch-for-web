import { NSObject } from "./nsobject.js"


// The activity type of browsing a web page, as Foundation names it.
export const NSUserActivityTypeBrowsingWeb = "NSUserActivityTypeBrowsingWeb"


// Foundation's NSUserActivity: what the user is doing in a responder. A
// responder whose activity has a webpageURL is a link to that page, so a
// view carrying one renders it as its href (see UIResponder.userActivity).
export class NSUserActivity extends NSObject {

    title = null
    userInfo = {}
    _webpageURL = null

    /**
     * @param {object} options
     * @param {string} options.activityType
     */
    constructor({activityType}) {
        super()
        this.activityType = activityType
    }

    // webpageURL is URL?, as Apple's: a string or a URL, kept as set. It becomes
    // an element's href, so it must be an address a browser may navigate to or
    // hand to another app; a scheme a browser would execute is refused here, at
    // the boundary.
    get webpageURL() {
        return this._webpageURL
    }

    set webpageURL(value) {
        this._webpageURL = _validatedWebpageURL(value)
    }
}


// mailto: and tel: execute nothing; the navigation stack's same-origin test
// keeps them out of history, as it does any foreign address.
const navigableProtocols = ["http:", "https:", "mailto:", "tel:"]

function _validatedWebpageURL(value) {
    if (value === null || value === undefined) { return null }
    var text = String(value)
    var resolved
    try {
        resolved = new URL(text, typeof window !== "undefined" && window.location ? window.location.href : "http://localhost/")
    } catch (error) {
        throw new TypeError(`NSUserActivity.webpageURL must be a relative, http(s), mailto: or tel: url, got ${JSON.stringify(text)}`)
    }
    if (navigableProtocols.indexOf(resolved.protocol) === -1) {
        throw new TypeError(`NSUserActivity.webpageURL must be a relative, http(s), mailto: or tel: url, got ${JSON.stringify(text)}`)
    }
    return value
}
