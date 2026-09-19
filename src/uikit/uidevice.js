import { NSObject } from "../foundation/nsobject.js"


const PHONE_BROWSERS = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i
const PAD_BROWSERS = /iPad/i


export class UIDevice extends NSObject {

    static get current() {
        if (!UIDevice._current) { UIDevice._current = new UIDevice() }
        return UIDevice._current
    }

    // The browser's user agent stands in for the hardware model.
    get model() {
        return typeof navigator === "undefined" ? "" : navigator.userAgent
    }

    get systemName() {
        return typeof navigator === "undefined" ? "" : navigator.platform
    }

    get userInterfaceIdiom() {
        if (PAD_BROWSERS.test(this.model)) { return "pad" }
        if (PHONE_BROWSERS.test(this.model)) { return "phone" }
        return "unspecified"
    }
}
