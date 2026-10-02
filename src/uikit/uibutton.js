import { NSString } from "../utils/nsstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"


const ACTIVITY_INDICATOR = "<i class=\"fas fa-circle-notch fa-spin uibutton-activity-indicator\"></i>"


export class UIButton extends UIControl {

    setTitle(title, {for: state} = {}) {
        this.$el.html(NSString.cleanScript(title))
    }

    get currentTitle() {
        return this.$el.text()
    }

    // setTitleColor(_:for:): the normal state's color is drawn; others are kept for titleColor(for:).
    setTitleColor(color, {for: state = UIControlState.normal} = {}) {
        if (!this._titleColors) { this._titleColors = {} }
        this._titleColors[state] = color
        if (state === UIControlState.normal) { this.$el.css("color", color.cgColor) }
    }

    titleColor({for: state = UIControlState.normal} = {}) {
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
            this.$el.html(ACTIVITY_INDICATOR)
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
