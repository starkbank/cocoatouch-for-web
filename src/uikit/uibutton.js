import { NSString } from "../utils/nsstring.js"
import { UIControl } from "./uicontrol.js"


const ACTIVITY_INDICATOR = "<i class=\"fas fa-circle-notch fa-spin uibutton-activity-indicator\"></i>"


export class UIButton extends UIControl {

    sendActions(params) {
        this.$el.click()
    }

    set text(text) {
        this.$el.html(NSString.cleanScript(text))
    }

    get text() {
        return this.$el.text()
    }

    // An icon beside or instead of the title, like a configuration's image placement.
    set icon({position, icon, text = ""}) {
        var iconHtml = "<div class=\"btn-content-icon-container\">" + icon + "</div>"
        var textHtml = "<div>" + text + "</div>"
        var content = {
            left: iconHtml + textHtml,
            center: iconHtml,
            right: textHtml + iconHtml
        }[position]
        this.text = "<div class=\"btn-content\">" + content + "</div>"
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
