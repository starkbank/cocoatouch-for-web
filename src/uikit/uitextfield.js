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

    // UITextFieldDelegate, on the events Apple sends it for: editing begins on
    // focus and ends on blur, not on every key; Return asks
    // textFieldShouldReturn. Only an explicit false prevents a default, so a
    // delegate that returns nothing proceeds. focusin and focusout bubble,
    // which keeps a field whose input is a child element, as a search field's
    // is, covered.
    set delegate(delegate) {
        var textField = this
        this._delegate = delegate
        this.$el.off(".delegate")
        this.$el.on("keydown.delegate", function(e) {
            if (e.key !== "Enter" && e.which !== 13) { return }
            if (!delegate.textFieldShouldReturn) { return }
            if (delegate.textFieldShouldReturn(textField) === false) { e.preventDefault() }
        })
        this.$el.on("focusin.delegate", function() {
            if (textField._isKeepingFocus) {
                textField._isKeepingFocus = false
                return
            }
            if (delegate.textFieldDidBeginEditing) {
                delegate.textFieldDidBeginEditing(textField)
            }
        })
        // A blur cannot be cancelled, and the element taking the focus gets it
        // after this handler returns, so the focus is taken back on the next
        // tick; that focusin is the same editing session, not a new one.
        this.$el.on("focusout.delegate", function(e) {
            if (delegate.textFieldShouldEndEditing && delegate.textFieldShouldEndEditing(textField) === false) {
                var target = e.target
                textField._isKeepingFocus = true
                setTimeout(function() { target.focus() }, 0)
                return
            }
            if (delegate.textFieldDidEndEditing) {
                delegate.textFieldDidEndEditing(textField)
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
