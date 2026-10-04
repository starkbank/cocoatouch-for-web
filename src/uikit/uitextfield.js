import { UIControl } from "./uicontrol.js"
import { NSString } from "../utils/nsstring.js"
import { NSRange } from "../foundation/nsrange.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"

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

    get placeholder() {
        var placeholder = this.$el.attr("placeholder")
        return placeholder === undefined ? null : placeholder
    }

    // True while the element, or a descendant such as a search field's input, has the focus.
    get isEditing() {
        var element = this.$el[0]
        var active = typeof document === "undefined" ? null : document.activeElement
        return !!element && !!active && active !== document.body && (element === active || element.contains(active))
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
        // textFieldShouldBeginEditing: a focus cannot be refused in the DOM, so
        // an explicit false resigns it again before editing is said to begin.
        this.$el.on("focusin.delegate", function(e) {
            if (textField._isKeepingFocus) {
                textField._isKeepingFocus = false
                return
            }
            if (delegate.textFieldShouldBeginEditing && delegate.textFieldShouldBeginEditing(textField) === false) {
                e.target.blur()
                return
            }
            if (delegate.textFieldDidBeginEditing) {
                delegate.textFieldDidBeginEditing(textField)
            }
        })
        // textField(_:shouldChangeCharactersIn:replacementString:), on beforeinput:
        // the range is the selection, the string the event's data, empty for a deletion.
        this.$el.on("beforeinput.delegate", function(e) {
            if (!delegate.textFieldShouldChangeCharactersInRangeReplacementString) { return }
            var original = e.originalEvent || e
            var target = e.target
            var start = target.selectionStart === null || target.selectionStart === undefined ? 0 : target.selectionStart
            var end = target.selectionEnd === null || target.selectionEnd === undefined ? start : target.selectionEnd
            var range = new NSRange({location: start, length: end - start})
            var replacement = original.data === null || original.data === undefined ? "" : original.data
            if (delegate.textFieldShouldChangeCharactersInRangeReplacementString(textField, range, replacement) === false) { e.preventDefault() }
        })
        // textFieldDidChangeSelection: selectionchange fires on the document in
        // every browser the fleet supports, and on the element in few, so it is
        // observed there while the field is the active element. It goes through
        // NotificationCenter, as the document keydown does, so dismissing the
        // controller releases it with everything else the field observes.
        if (typeof document !== "undefined") {
            NotificationCenter.default.removeObserver(this, {name: "selectionchange", object: document})
        }
        if (delegate.textFieldDidChangeSelection && typeof document !== "undefined") {
            NotificationCenter.default.addObserver(this, {name: "selectionchange", object: document, selector: function() {
                if (!textField.isEditing) { return }
                delegate.textFieldDidChangeSelection(textField)
            }})
        }
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
