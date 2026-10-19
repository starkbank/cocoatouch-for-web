import { UIScrollView } from "./uiscrollview.js"
import { typed, Bool } from "../utils/required.js"


var measuringHeight = "0px"


// UIKit's UITextView, as far as a text area that grows with its text needs:
// text, delegate.textViewDidChange(_:), isScrollEnabled and the first-responder
// methods UIView already has. It wraps the xib's <textarea> and reads and
// writes its value only, so markup typed or set stays literal text.
export class UITextView extends UIScrollView {

    // The handler binds at construction for a view that already has an element,
    // and again when addSubview gives one to a view created in code; the
    // namespace is cleared first, so a view never carries two handlers.
    init() {
        super.init()
        this._bindInput()
    }

    didMoveToSuperview() {
        super.didMoveToSuperview()
        this._bindInput()
    }

    // The padding and border the height has to add or take off is read here,
    // once, so the sizing routine never asks for computed style while the user
    // types. A view that is not in the page yet reads it at its first fit.
    awakeFromNib() {
        super.awakeFromNib()
        this._adjustment = undefined
        var element = this.$el[0]
        if (!element || !element.isConnected) { return }
        this._adjustment = _adjustmentOf(element)
    }

    // The text is plain text: a value, never markup. Setting it sizes the view
    // like an edit does, so a prefilled form opens at its height, and does not
    // tell the delegate, which Apple does not either.
    get text() {
        var element = this.$el[0]
        return element ? element.value : ""
    }

    set text(text) {
        var element = this.$el[0]
        if (!element) { return }
        element.value = text === null || text === undefined ? "" : String(text)
        this._fitIfChanged()
    }

    // Unlike UIScrollView's, which is read-only because the stylesheet owns
    // whether a general scroll view scrolls, a text view owns its own height:
    // false sizes it to its content, true leaves the height to the stylesheet.
    get isScrollEnabled() {
        return this._isScrollEnabled !== false
    }

    set isScrollEnabled(enabled) {
        typed(enabled, "isScrollEnabled", Bool, "UITextView.isScrollEnabled", "Apple's is var isScrollEnabled: Bool.")
        this._isScrollEnabled = enabled
        if (!enabled) {
            this._fit()
            return
        }
        this._releaseHeight()
    }

    // UITextViewDelegate extends UIScrollViewDelegate, so scrollViewDidScroll
    // keeps working beside textViewDidChange(_:).
    set delegate(delegate) {
        super.delegate = delegate
    }

    get delegate() {
        return super.delegate
    }

    // The content height depends on the width, which resize changes.
    layoutSubviews() {
        super.layoutSubviews()
        this._fit()
    }

    _bindInput() {
        this.$el.off(".uitextview")
        this.$el.on("input.uitextview", () => this._didEdit())
    }

    // The delegate hears the user's edit after the view has taken its height,
    // so it reads the size the text ended at.
    _didEdit() {
        this._fitIfChanged()
        var delegate = this._delegate
        if (!delegate || typeof delegate.textViewDidChange !== "function") { return }
        delegate.textViewDidChange(this)
    }

    // An edit or a set that leaves the text as it was cannot change the height,
    // so it makes no style write: the width only changes in layoutSubviews.
    _fitIfChanged() {
        var element = this.$el[0]
        if (!element || element.value === this._fittedValue) { return }
        this._fit()
    }

    // One write, one read, one write. scrollHeight never reports less than the
    // box, so the box is pinned to nothing first: height auto would not do, as a
    // textarea's auto height is its two rows. The measured height goes back
    // with the cached adjustment.
    _fit() {
        var element = this.$el[0]
        if (!element || !element.isConnected || this.isScrollEnabled) { return }
        if (this._adjustment === undefined) { this._adjustment = _adjustmentOf(element) }
        element.style.height = measuringHeight
        var height = element.scrollHeight + this._adjustment
        element.style.height = height + "px"
        this._fittedValue = element.value
        this._hasFittedHeight = true
    }

    _releaseHeight() {
        this._fittedValue = undefined
        if (!this._hasFittedHeight) { return }
        this._hasFittedHeight = false
        var element = this.$el[0]
        if (element) { element.style.height = "" }
    }
}


// What a height written for the element differs from its scrollHeight by:
// scrollHeight spans the content and padding but not the border, so a
// border-box height adds the border and a content-box height drops the padding.
function _adjustmentOf(element) {
    var style = getComputedStyle(element)
    var pixels = (value) => parseFloat(value) || 0
    if (style.boxSizing === "border-box") { return pixels(style.borderTopWidth) + pixels(style.borderBottomWidth) }
    return -(pixels(style.paddingTop) + pixels(style.paddingBottom))
}
