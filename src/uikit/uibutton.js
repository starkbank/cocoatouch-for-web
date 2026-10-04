import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"
import { required, typed, enumeration, optional, instance } from "../utils/required.js"


const stateType = enumeration(UIControlState, "UIControl.State")
const colorType = instance(UIColor, "UIColor")
const attributedType = instance(NSAttributedString, "NSAttributedString")

const activityIndicator = "<i class=\"fas fa-circle-notch fa-spin uibutton-activity-indicator\"></i>"


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

    // Nothing is drawn while the activity indicator holds the html, nor when
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
    _drawTitle() {
        if (this._titleBeforeActivity !== undefined) { return }
        var title = _title(this, _drawnState(this))
        if (title === null) { return }
        if (title instanceof NSAttributedString) {
            if (title._isMarkup) { setMarkup(this.$el, title._markup) }
            if (!title._isMarkup) { setText(this.$el, title.string) }
            return
        }
        setText(this.$el, title)
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

    // Replaces the title with a spinner and disables the button until turned off.
    set showsActivityIndicator(bool) {
        if (bool) {
            if (this._titleBeforeActivity !== undefined) { return }
            this._titleBeforeActivity = this.$el.html()
            this.isEnabled = false
            setMarkup(this.$el, activityIndicator)
            return
        }
        if (this._titleBeforeActivity === undefined) { return }
        setMarkup(this.$el, this._titleBeforeActivity)
        this._titleBeforeActivity = undefined
        this.isEnabled = true
    }

    get showsActivityIndicator() {
        return this._titleBeforeActivity !== undefined
    }
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
