import { NSString } from "../utils/nsstring.js"
import { UIControl } from "./uicontrol.js"


const ACTIVITY_INDICATOR = "<i class=\"fas fa-circle-notch fa-spin uibutton-activity-indicator\"></i>"


export class UIButton extends UIControl {

    setTitle(title, {for: state} = {}) {
        this.$el.html(NSString.cleanScript(title))
    }

    get currentTitle() {
        return this.$el.text()
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
