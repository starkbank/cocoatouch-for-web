import { NSObject } from "../foundation/nsobject.js"


const MOBILE_BROWSERS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i


export class UIDevice extends NSObject {

    static get current() {
        if (!UIDevice._current) { UIDevice._current = new UIDevice() }
        return UIDevice._current
    }

    get model() {
        return typeof navigator === "undefined" ? "" : navigator.userAgent
    }

    get mobileBrowsers() {
        return MOBILE_BROWSERS
    }

    // The mobile browser family, or undefined on a desktop browser.
    get platform() {
        var match = this.model.match(MOBILE_BROWSERS)
        if (!match) { return undefined }
        return match[0]
    }

    get userInterfaceIdiom() {
        return this.platform ? "phone" : "desktop"
    }
}
