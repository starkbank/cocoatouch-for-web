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
}
