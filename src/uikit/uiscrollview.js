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
    // view observes. A delegate without the method observes nothing. The page's
    // own scroller, html or body, is observed on the document: scroll does not
    // bubble, and the root scroller's event is fired at the document alone.
    set delegate(delegate) {
        var scrollView = this
        var element = this.$el[0]
        if (this._observedElement) {
            NotificationCenter.default.removeObserver(this, {name: "scroll", object: this._observedElement})
            this._observedElement = null
        }
        this._delegate = delegate
        if (!element || !delegate || typeof delegate.scrollViewDidScroll !== "function") { return }
        var observed = _isPageScroller(element) ? document : element
        this._observedElement = observed
        NotificationCenter.default.addObserver(this, {name: "scroll", object: observed, selector: function() {
            delegate.scrollViewDidScroll(scrollView)
        }})
    }

    get delegate() {
        return this._delegate || null
    }

    // Whether the element scrolls: either axis computes to auto or scroll, read
    // live so a media query's change is seen. The page's own scroller, html or
    // body, reads true while its overflow is visible, because the viewport
    // scrolls it then.
    get isScrollEnabled() {
        var element = this.$el[0]
        if (!element) { return false }
        var style = getComputedStyle(element)
        var scrolls = (overflow) => overflow === "auto" || overflow === "scroll"
        if (scrolls(style.overflowX) || scrolls(style.overflowY)) { return true }
        var isPageScroller = element === document.documentElement || element === document.body
        return isPageScroller && style.overflowX === "visible" && style.overflowY === "visible"
    }

    // false stops the scrolling with an inline overflow hidden on both axes, as a modal
    // locks the page behind it; true removes that value and gives scrollability
    // back to the stylesheet, so its media queries rule again. A stylesheet that
    // hides the overflow keeps the element from scrolling after true.
    /** @param {boolean} enabled */
    set isScrollEnabled(enabled) {
        typed(enabled, "isScrollEnabled", Bool, "UIScrollView.isScrollEnabled", "Apple's is var isScrollEnabled: Bool.")
        var overflow = enabled ? "" : "hidden"
        this.$el.css({"overflow-x": overflow, "overflow-y": overflow})
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


function _isPageScroller(element) {
    return element === document.scrollingElement || element === document.documentElement || element === document.body
}
