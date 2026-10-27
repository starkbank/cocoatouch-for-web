import { UIView } from "./uiview.js"
import { UIScreen } from "./uiscreen.js"
import { rootViewController } from "./uiviewcontroller.js"
import { registerWindowMaker } from "../utils/keywindow.js"


// UIKit's UIWindow: the page's one window, over the element that holds
// <cocoatouch>, so the root controller's view is one of its subviews and a
// view inserted below that view is drawn under the page, as a window's
// subviews are. Its bounds are the screen's, as a full-screen window's are.
export class UIWindow extends UIView {

    // The controller present() made the page's root, or null before one.
    // Read-only here: present(_:animated:) is how the root changes.
    /** @returns {import("./uiviewcontroller.js").UIViewController|null} */
    get rootViewController() {
        return rootViewController()
    }

    get bounds() {
        return UIScreen.main.bounds
    }

    get window() {
        return this
    }
}


registerWindowMaker(function() {
    var window = new UIWindow("body")
    var host = $("cocoatouch").parent()
    window._$el = host.length > 0 ? host : $("body")
    return window
})
