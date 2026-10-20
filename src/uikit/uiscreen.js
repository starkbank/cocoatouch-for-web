import { NSObject } from "../foundation/nsobject.js"
import { CGRect } from "../coregraphics/cgrect.js"


// UIKit's UIScreen: the browser viewport stands in for the device screen.
export class UIScreen extends NSObject {

    static get main() {
        if (!UIScreen._main) { UIScreen._main = new UIScreen() }
        return UIScreen._main
    }

    get bounds() {
        if (typeof window === "undefined" || window.innerWidth === undefined) { return CGRect.zero }
        return new CGRect({width: window.innerWidth, height: window.innerHeight})
    }

    // Pixels per point, as Apple's: the display's pixel ratio.
    get nativeScale() {
        if (typeof window === "undefined" || !window.devicePixelRatio) { return 1 }
        return window.devicePixelRatio
    }

    // The screen in physical pixels, from the screen's own size, not the viewport's.
    get nativeBounds() {
        if (typeof window === "undefined" || !window.screen) { return CGRect.zero }
        var scale = this.nativeScale
        return new CGRect({width: window.screen.width * scale, height: window.screen.height * scale})
    }
}
