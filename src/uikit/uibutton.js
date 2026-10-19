import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"
import { required, typed, enumeration, optional, instance } from "../utils/required.js"


const stateType = enumeration(UIControlState, "UIControl.State")
const colorType = instance(UIColor, "UIColor")
const attributedType = instance(NSAttributedString, "NSAttributedString")

// The title stays in flow so the button keeps its intrinsic size, only hidden:
// visibility drops it from sight, the tab order and the accessibility tree where
// display:none or opacity would not both. display:contents keeps the title's
// nodes laying out as the button's own children, as a flex button with an icon
// and a gap needs. The spinner is out of flow: an overlay that fills the button
// and centres the icon with flex. Font Awesome's fa-spin animates transform on
// the icon, and a running animation overrides the icon's own transform, so the
// icon is never positioned; only the overlay, which does not spin, is.
const activityTitle = "<span class=\"uibutton-activity-title\" style=\"display: contents; visibility: hidden;\"></span>"
const activityIndicator = "<span class=\"uibutton-activity-indicator\" style=\"position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;\"><i class=\"fas fa-circle-notch fa-spin\"></i></span>"


export class UIButton extends UIControl {

    // setTitle(_:for:) keeps a title per state and draws the current state's;
    // title(for:) and currentTitle fall back to the normal title when none was
    // set for the state asked about, as Apple's do.
    /**
     * @param {string|null} title
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setTitle(title, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setTitle", "Apple's is setTitle(_:for:); write setTitle(title, {for: UIControlState.normal}).")
        if (!this._titles) { this._titles = {} }
        this._titles[state] = title
        this._drawTitle()
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    title({for: state} = {}) {
        var title = _title(this, required(state, "for", stateType, "UIButton.title", "Apple's is title(for:); write title({for: UIControlState.normal})."))
        return title instanceof NSAttributedString ? title.string : title
    }

    get currentTitle() {
        var title = _title(this, _drawnState(this))
        if (title === null) { return this.$el.text() }
        return title instanceof NSAttributedString ? title.string : title
    }

    _stateDidChange() {
        this._drawTitle()
    }

    // Nothing is drawn while the activity indicator holds the title, nor when
    // no title was ever set, so a title written in the nib stands.
    /**
     * setAttributedTitle(_:for:): markup for a state, through NSAttributedString's
     * html document type, trusted input only; plain attributed strings draw as text.
     * @param {NSAttributedString|null} attributedTitle
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setAttributedTitle(attributedTitle, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setAttributedTitle", "Apple's is setAttributedTitle(_:for:); write setAttributedTitle(attributedTitle, {for: UIControlState.normal}).")
        typed(attributedTitle, "attributedTitle", optional(attributedType), "UIButton.setAttributedTitle", "Apple's is setAttributedTitle(_:for:); the title is an NSAttributedString, or null to clear it.")
        if (!this._titles) { this._titles = {} }
        this._titles[state] = attributedTitle
        this._drawTitle()
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     * @returns {NSAttributedString|null}
     */
    attributedTitle({for: state} = {}) {
        var title = _title(this, required(state, "for", stateType, "UIButton.attributedTitle", "Apple's is attributedTitle(for:); write attributedTitle({for: UIControlState.normal})."))
        if (title === null) { return null }
        return title instanceof NSAttributedString ? title : new NSAttributedString({string: title})
    }

    // A title is drawn as text unless it is an NSAttributedString carrying markup.
    // A title already drawn is left alone: a highlight redraw at pointer-down
    // would replace the nodes under the pointer, and the browser, finding no
    // common ancestor of the down and up targets, would never send the click.
    // The element is part of what was drawn: a view re-resolves its element by
    // selector once it is disconnected, so the same title may need drawing again.
    _drawTitle() {
        if (this._enabledBeforeActivity !== undefined) {
            this._titlePending = true
            return
        }
        var title = _title(this, _drawnState(this))
        if (title === null) { return }
        var isMarkup = title instanceof NSAttributedString && title._isMarkup
        var drawn = isMarkup ? title._markup : title instanceof NSAttributedString ? title.string : title
        var key = (isMarkup ? "markup:" : "text:") + drawn
        var element = this.$el[0]
        if (this._drawnTitle === key && this._drawnElement === element) { return }
        this._drawnTitle = key
        this._drawnElement = element
        if (isMarkup) { setMarkup(this.$el, drawn) }
        if (!isMarkup) { setText(this.$el, drawn) }
    }

    // setTitleColor(_:for:): the normal state's color is drawn; others are kept for titleColor(for:).
    /**
     * @param {UIColor|null} color
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setTitleColor(color, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setTitleColor", "Apple's is setTitleColor(_:for:); write setTitleColor(color, {for: UIControlState.normal}).")
        typed(color, "color", optional(colorType), "UIButton.setTitleColor", "Apple's is setTitleColor(_:for:); the color is a UIColor, or null to clear it.")
        if (!this._titleColors) { this._titleColors = {} }
        this._titleColors[state] = color
        if (state === UIControlState.normal) { this.$el.css("color", color === null ? "" : color.cgColor) }
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    titleColor({for: state} = {}) {
        required(state, "for", stateType, "UIButton.titleColor", "Apple's is titleColor(for:); write titleColor({for: UIControlState.normal}).")
        var kept = this._titleColors && this._titleColors[state]
        if (kept) { return kept }
        if (state !== UIControlState.normal) { return null }
        return new UIColor({hex: this.$el.css("color")})
    }

    // Apple's isEnabled is the control's own; while the activity indicator
    // shows the button is disabled, so what the app assigns then is kept and
    // takes effect when the indicator turns off.
    set isEnabled(bool) {
        if (this._enabledBeforeActivity !== undefined) {
            this._enabledAfterActivity = bool
            return
        }
        super.isEnabled = bool
    }

    get isEnabled() {
        return super.isEnabled
    }

    // Draws a spinner over the title and disables the button until turned off.
    // As in UIButton.Configuration, the button keeps its size meanwhile. The
    // button becomes the spinner's containing block only when nothing already is.
    // The title's nodes are moved under a wrapper and back, never re-created, so
    // an outlet to one of them, and the nodes a click needs, stay the same.
    set showsActivityIndicator(bool) {
        if (bool) {
            if (this._enabledBeforeActivity !== undefined) { return }
            this._enabledBeforeActivity = this.isEnabled
            this._enabledAfterActivity = undefined
            this._positionedForActivity = _isStatic(this.$el.css("position"))
            if (this._positionedForActivity) { this.$el.css("position", "relative") }
            super.isEnabled = false
            this._titlePending = false
            this.$el.contents().wrapAll(activityTitle)
            this.$el.append(activityIndicator)
            return
        }
        if (this._enabledBeforeActivity === undefined) { return }
        var title = this.$el.children(".uibutton-activity-title")
        title.before(title.contents())
        title.remove()
        this.$el.children(".uibutton-activity-indicator").remove()
        var pending = this._titlePending
        var enabled = this._enabledAfterActivity === undefined ? this._enabledBeforeActivity : this._enabledAfterActivity
        this._enabledBeforeActivity = undefined
        this._enabledAfterActivity = undefined
        this._titlePending = false
        if (this._positionedForActivity) { this.$el.css("position", "") }
        this._positionedForActivity = false
        super.isEnabled = enabled
        if (pending) { this._drawTitle() }
    }

    get showsActivityIndicator() {
        return this._enabledBeforeActivity !== undefined
    }
}


function _isStatic(position) {
    return position === "static" || position === ""
}

// The drawn title is resolved here rather than through title({for:}): a
// subclass may declare a `title` member of its own, as a Swift subclass may
// beside title(for:), and in JavaScript an instance field shadows the
// prototype method it is named after.
function _title(button, state) {
    var titles = button._titles || {}
    if (titles[state] !== undefined) { return titles[state] }
    return titles[UIControlState.normal] === undefined ? null : titles[UIControlState.normal]
}

// The single state whose title is drawn: disabled wins over selected, as a
// disabled control cannot be interacted with whatever else it is.
function _drawnState(button) {
    if (!button.isEnabled) { return UIControlState.disabled }
    if (button.isSelected) { return UIControlState.selected }
    return UIControlState.normal
}
