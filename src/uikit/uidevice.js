import { NSObject } from "../foundation/nsobject.js"
import { UIUserInterfaceIdiom } from "./uiuserinterfaceidiom.js"


const phoneBrowsers = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i
const padBrowsers = /iPad/i


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
        if (padBrowsers.test(this.model)) { return UIUserInterfaceIdiom.pad }
        if (phoneBrowsers.test(this.model)) { return UIUserInterfaceIdiom.phone }
        if (this.model) { return UIUserInterfaceIdiom.mac }
        return UIUserInterfaceIdiom.unspecified
    }
}
