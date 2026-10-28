import { UIView } from "./uiview.js"
import { UIScreen } from "./uiscreen.js"
import { keyWindowKey } from "../utils/documentkeys.js"
import { currentRootViewController } from "./uiviewcontroller.js"


var _isConstructing = false


// UIKit's UIWindow: the root every view hierarchy of the page hangs from, here
// the page's body. The framework makes the one window when UIKit loads, and
// UIApplication.shared.keyWindow hands it out, so `new UIWindow()` is refused:
// Apple's UIWindow(frame:) would make a second screen-sized root over the same
// body. The window never disposes and removeFromSuperview does nothing, as it
// has no superview on Apple; a view added to it stays until the app removes it.
export class UIWindow extends UIView {

    constructor() {
        if (!_isConstructing) {
            throw new TypeError("UIWindow is made once, when UIKit loads: read UIApplication.shared.keyWindow. Apple's is UIWindow(frame:), which a page cannot repeat over one body.")
        }
        super("body")
    }

    // The controller the page presented last, the one whose view fills the
    // window. Apple's is settable, but a page's root is made by present() and
    // swapped by the next one, so an app reads it and never assigns it.
    /** @returns {import("./uiviewcontroller.js").UIViewController | null} */
    get rootViewController() {
        return currentRootViewController()
    }

    // The screen's bounds, as on Apple, where a window fills the screen. The
    // body's own rectangle is only as tall as its content.
    get bounds() {
        return UIScreen.main.bounds
    }

    // A window has no superview on Apple, so there is nothing to leave: taking
    // it out would remove body from the page.
    removeFromSuperview() {}

    // The window lives as long as the page; disposing it would drop the
    // observers the framework and the app hold on it.
    _dispose() {}
}


_launch()

function _launch() {
    if (typeof document === "undefined") { return }
    if (document[keyWindowKey]) { return }
    _isConstructing = true
    try {
        document[keyWindowKey] = new UIWindow()
    } finally {
        _isConstructing = false
    }
}
