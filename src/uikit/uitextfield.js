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
        this._delegate = delegate
        this.$el.off("keyup.delegate").on("keyup.delegate", function(e) {
            if (e.which === 13 && delegate.textFieldShouldReturn) {
                delegate.textFieldShouldReturn(textField)
            }
            if (delegate.textFieldDidEndEditing) {
                delegate.textFieldDidEndEditing(textField)
            }
        })
        this.$el.off("focusin.delegate").on("focusin.delegate", function() {
            if (delegate.textFieldDidBeginEditing) {
                delegate.textFieldDidBeginEditing(textField)
            }
        })
    }

    get delegate() {
        return this._delegate || null
    }

    set isSecureTextEntry(bool) {
        bool ? this.$el.attr("type", "password") : this.$el.attr("type", "text")
    }

    get isSecureTextEntry() {
        return this.$el.prop("type") === "password" ? true : false
    }

    // The selection as offsets into the text, like UITextInput's selectedTextRange.
    get selectedTextRange() {
        var element = this.$el[0]
        if (!element || element.selectionStart === undefined || element.selectionStart === null) { return null }
        return {start: element.selectionStart, end: element.selectionEnd}
    }

    set selectedTextRange(range) {
        var element = this.$el[0]
        if (!element || !range || typeof element.setSelectionRange !== "function") { return }
        element.setSelectionRange(range.start, range.end)
    }

    // The browser's autocomplete hint stands in for the content type.
    set textContentType(type) {
        this.$el.attr("autocomplete", type)
    }

    get textContentType() {
        return this.$el.attr("autocomplete") || ""
    }
}
