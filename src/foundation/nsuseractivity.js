import { NSObject } from "./nsobject.js"


// The activity type of browsing a web page, as Foundation names it.
export const NSUserActivityTypeBrowsingWeb = "NSUserActivityTypeBrowsingWeb"


// Foundation's NSUserActivity: what the user is doing in a responder. A
// responder whose activity has a webpageURL is a link to that page, so a
// view carrying one renders it as its href (see UIResponder.userActivity).
export class NSUserActivity extends NSObject {

    title = null
    userInfo = {}
    webpageURL = null

    /**
     * @param {object} options
     * @param {string} options.activityType
     */
    constructor({activityType}) {
        super()
        this.activityType = activityType
    }
}
