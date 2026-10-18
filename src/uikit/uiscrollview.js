import { UIView } from "./uiview.js"
import { CGPoint } from "../coregraphics/cgpoint.js"
import { CGSize } from "../coregraphics/cgsize.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { required, typed, Bool, CGPointType } from "../utils/required.js"


// UIKit's UIScrollView: an element that scrolls its overflowing content.
export class UIScrollView extends UIView {

    // UIScrollViewDelegate: scrollViewDidScroll(_:) follows every scroll of the
    // element, whether the user, the page or setContentOffset moved it. The DOM
    // event goes through NotificationCenter, as a text field's selectionchange
    // does, so dismissing the controller releases it with everything else the
    // view observes. A delegate without the method observes nothing.
    set delegate(delegate) {
        var scrollView = this
        var element = this.$el[0]
        if (this._observedElement) {
            NotificationCenter.default.removeObserver(this, {name: "scroll", object: this._observedElement})
            this._observedElement = null
        }
        this._delegate = delegate
        if (!element || !delegate || typeof delegate.scrollViewDidScroll !== "function") { return }
        this._observedElement = element
        NotificationCenter.default.addObserver(this, {name: "scroll", object: element, selector: function() {
            delegate.scrollViewDidScroll(scrollView)
        }})
    }

    get delegate() {
        return this._delegate || null
    }

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
    /**
     * @param {CGPoint} point
     * @param {object} options
     * @param {boolean} options.animated
     */
    setContentOffset(point, {animated} = {}) {
        var signature = "Apple's is setContentOffset(_:animated:); write setContentOffset(point, {animated: false})."
        required(animated, "animated", Bool, "UIScrollView.setContentOffset", signature)
        typed(point, "point", CGPointType, "UIScrollView.setContentOffset", signature)
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
