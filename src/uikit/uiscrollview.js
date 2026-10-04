import { UIView } from "./uiview.js"
import { CGPoint } from "../coregraphics/cgpoint.js"
import { CGSize } from "../coregraphics/cgsize.js"


// UIKit's UIScrollView: an element that scrolls its overflowing content.
export class UIScrollView extends UIView {

    // The point of the content shown at the view's origin.
    get contentOffset() {
        var element = this.$el[0]
        if (!element) { return new CGPoint({x: 0, y: 0}) }
        return new CGPoint({x: element.scrollLeft, y: element.scrollTop})
    }

    set contentOffset(point) {
        this.setContentOffset(point, {animated: false})
    }

    // The size of the content, whether or not it is on screen.
    get contentSize() {
        var element = this.$el[0]
        if (!element) { return new CGSize({width: 0, height: 0}) }
        return new CGSize({width: element.scrollWidth, height: element.scrollHeight})
    }

    // setContentOffset(_:animated:)
    setContentOffset(point, options) {
        var animated = _required(options, "animated", "UIScrollView.setContentOffset", "setContentOffset(point, {animated: false}). Apple's is setContentOffset(_:animated:)")
        var element = this.$el[0]
        if (!element) { return }
        if (typeof element.scrollTo === "function") {
            element.scrollTo({left: point.x, top: point.y, behavior: animated ? "smooth" : "auto"})
            return
        }
        element.scrollLeft = point.x
        element.scrollTop = point.y
    }
}


// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write.
function _required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
