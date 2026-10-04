import { NSString } from "../utils/nsstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"


const activityIndicator = "<i class=\"fas fa-circle-notch fa-spin uibutton-activity-indicator\"></i>"


export class UIButton extends UIControl {

    // setTitle(_:for:) keeps a title per state and draws the current state's;
    // title(for:) and currentTitle fall back to the normal title when none was
    // set for the state asked about, as Apple's do.
    setTitle(title, options) {
        var state = _required(options, "for", "UIButton.setTitle", "setTitle(title, {for: UIControlState.normal}). Apple's is setTitle(_:for:)")
        if (!this._titles) { this._titles = {} }
        this._titles[state] = title
        this._drawTitle()
    }

    title(options) {
        return _title(this, _required(options, "for", "UIButton.title", "title({for: UIControlState.normal}). Apple's is title(for:)"))
    }

    get currentTitle() {
        var title = _title(this, _drawnState(this))
        return title === null ? this.$el.text() : title
    }

    _stateDidChange() {
        this._drawTitle()
    }

    // Nothing is drawn while the activity indicator holds the html, nor when
    // no title was ever set, so a title written in the nib stands.
    _drawTitle() {
        if (this._titleBeforeActivity !== undefined) { return }
        var title = _title(this, _drawnState(this))
        if (title === null) { return }
        this.$el.html(NSString.cleanScript(title))
    }

    // setTitleColor(_:for:): the normal state's color is drawn; others are kept for titleColor(for:).
    setTitleColor(color, options) {
        var state = _required(options, "for", "UIButton.setTitleColor", "setTitleColor(color, {for: UIControlState.normal}). Apple's is setTitleColor(_:for:)")
        if (!this._titleColors) { this._titleColors = {} }
        this._titleColors[state] = color
        if (state === UIControlState.normal) { this.$el.css("color", color.cgColor) }
    }

    titleColor(options) {
        var state = _required(options, "for", "UIButton.titleColor", "titleColor({for: UIControlState.normal}). Apple's is titleColor(for:)")
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
            this.$el.html(activityIndicator)
            return
        }
        if (this._titleBeforeActivity === undefined) { return }
        this.$el.html(this._titleBeforeActivity)
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

// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write.
function _required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
