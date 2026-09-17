import { UIControl } from "./uicontrol.js"
import { NSString } from "../utils/nsstring.js"

export class UITextField extends UIControl {

    get _tagName() {
        if (!this.__tagName) {
            this.__tagName = this.$el.prop("tagName").toLowerCase()
        }
        return this.__tagName
    }

    set text(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        if (this._tagName === "input" || this._tagName === "textarea") {
            return this.$el.val(cleanedScriptText)
        }
        return this.$el.html(cleanedScriptText)
    }

    get text() {
        if (this._tagName === "input" || this._tagName === "textarea") {
            return this.$el.val()
        }
        return this.$el.text()
    }

    set placeholder(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        this.$el.attr("placeholder", cleanedScriptText)
    }

    set delegate(delegate) {
        var textField = this
        this.$el.on("keyup", function(e){
            if(e.which == 13) {
                try {
                    delegate.textFieldShouldReturn(textField)
                } catch(e) {}
            }
            delegate.textFieldDidEndEditing(textField)
        })
    }

    set secureTextEntry(bool) {
        bool ? this.$el.attr("type", "password") : this.$el.attr("type", "text")
    }

    get secureTextEntry() {
        return this.$el.prop("type") === "password" ? true : false
    }

    set userInteractionEnabled(bool) {
        this.$el.prop("disabled", !bool)
    }

    get userInteractionEnabled() {
        return this.$el.prop("disabled")
    }

    becomeFirstResponder() {
        this.$el.focus()
    }

    resignFirstResponder() {
        this.$el.blur()
    }
}
