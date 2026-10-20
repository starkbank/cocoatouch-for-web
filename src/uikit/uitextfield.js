import { UIControl } from "./uicontrol.js"
import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { NSRange } from "../foundation/nsrange.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { UIColor } from "./uicolor.js"
import { autocompleteTokenOf, textContentTypeOf, textContentTypeDescriptor, textContentTypeSignature } from "./uitextcontenttype.js"
import { typed, optional } from "../utils/required.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { itemProviderForFlavours } from "../foundation/nsitemprovider.js"
import { textPasteItemFor, resultOfTextPasteItem } from "./uitextpasteitem.js"
import { UTType } from "../uniformtypeidentifiers/uttype.js"


// The only flavours a paste hands over, as strings: a clipboard's files, and
// every flavour not named here, stay with the browser.
const pasteFlavours = [
    ["text/plain", UTType.plainText.identifier],
    ["text/html", UTType.html.identifier],
    ["text/rtf", UTType.rtf.identifier],
]
const retiredPasteDelegateNames = {textPasteConfigurationSupportingTransform: "textPasteConfigurationSupportingTransformPasteItem"}
const pasteFlavourCap = 256 * 1024
const pasteNamespace = "paste.uitextpaste"
const utf8Encoder = new TextEncoder()

export class UITextField extends UIControl {

    get _tagName() {
        if (!this.__tagName) {
            this.__tagName = this.$el.prop("tagName").toLowerCase()
        }
        return this.__tagName
    }

    // text is plain text: a value on an input, escaped text on anything else.
    set text(text) {
        this._attributedText = null
        var value = text === null || text === undefined ? "" : String(text)
        if (this._tagName === "input" || this._tagName === "textarea") {
            this.$el.val(value)
            return
        }
        setText(this.$el, value)
    }

    set attributedText(attributedText) {
        this._attributedText = attributedText
        if (this._tagName === "input" || this._tagName === "textarea") {
            this.$el.val(attributedText ? attributedText.string : "")
            return
        }
        if (attributedText && attributedText._isMarkup) {
            setMarkup(this.$el, attributedText._markup)
            return
        }
        setText(this.$el, attributedText ? attributedText.string : "")
    }

    get attributedText() {
        if (this._attributedText) { return this._attributedText }
        return new NSAttributedString({string: this.text})
    }

    get text() {
        if (this._tagName === "input" || this._tagName === "textarea") {
            return this.$el.val()
        }
        return this.$el.text()
    }

    // Apple's nil is the default color: the inline value is removed, so the
    // stylesheet's returns, and the getter reads the inline value only, so a
    // field nobody colored reads null whatever the stylesheet draws. The
    // placeholder keeps its own color.
    /** @param {UIColor|null} color */
    set textColor(color) {
        this.$el.css("color", color === null || color === undefined ? "" : color.cgColor)
    }

    get textColor() {
        return _inlineColor(this.$el[0])
    }

    // An attribute value is text by construction; it is written as given.
    set placeholder(text) {
        this.$el.attr("placeholder", text === null || text === undefined ? "" : String(text))
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
            var original = e.originalEvent || e
            var replacement = original.data === null || original.data === undefined ? "" : original.data
            if (_mayChange(textField, e.target, replacement) === false) { e.preventDefault() }
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

    // UITextPasteDelegate, on the paste event of the field's input: the
    // listener exists only while a delegate is set. The delegate is asked
    // synchronously, once per paste, with one item whose provider holds the
    // plain-text, html and rtf flavours the clipboard carries, each capped at
    // 256 KiB of UTF-8; the browser's clipboardData and event never leave the
    // framework. setNoResult consumes the paste, setStringResult consumes it
    // and inserts that string as text once the field's delegate agrees to it
    // (textField(_:shouldChangeCharactersIn:replacementString:), asked with
    // that string), and setDefaultResult or no result leaves it to the browser,
    // whose own beforeinput asks that same question with the clipboard's text.
    /** @param {import("./uitextpasteitem.js").UITextPasteDelegate|null} pasteDelegate */
    set pasteDelegate(pasteDelegate) {
        rejectRetiredDelegateNames(pasteDelegate, retiredPasteDelegateNames, "UITextField.pasteDelegate")
        this._pasteDelegate = pasteDelegate || null
        this._bindPaste()
    }

    get pasteDelegate() {
        return this._pasteDelegate || null
    }

    // A control created in code has no element until it is placed, and a
    // removed one loses its handlers with its element, so the listener binds
    // again on every placement.
    didMoveToSuperview() {
        super.didMoveToSuperview()
        this._bindPaste()
    }

    _bindPaste() {
        if (!this.$el) { return }
        this.$el.off(pasteNamespace)
        if (!this._pasteDelegate) { return }
        this.$el.on(pasteNamespace, (e) => _pasted(this, e))
    }

    _dispose() {
        if (this.$el) { this.$el.off(pasteNamespace) }
        super._dispose()
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

    // The browser's hint for what the field holds, drawn as its autocomplete
    // token through this setter alone. nil removes it, so the browser's default
    // returns; the getter reads back the case a token names, null for none.
    /** @param {string|null} type one of UITextContentType, or null */
    set textContentType(type) {
        var value = type === undefined ? null : type
        typed(value, "textContentType", optional(textContentTypeDescriptor), "UITextField.textContentType", textContentTypeSignature)
        if (value === null) {
            this.$el.removeAttr("autocomplete")
            return
        }
        this.$el.attr("autocomplete", autocompleteTokenOf(value))
    }

    get textContentType() {
        return textContentTypeOf(this.$el.attr("autocomplete"))
    }
}


function _pasted(textField, e) {
    var delegate = textField._pasteDelegate
    if (!delegate || !delegate.textPasteConfigurationSupportingTransformPasteItem) { return }
    var flavours = _flavoursOf((e.originalEvent || e).clipboardData)
    if (flavours === null) { return }
    var item = textPasteItemFor({itemProvider: itemProviderForFlavours({flavours: flavours})})
    delegate.textPasteConfigurationSupportingTransformPasteItem(textField, item)
    var result = resultOfTextPasteItem(item)
    if (result.kind === "default") { return }
    e.preventDefault()
    if (result.kind !== "string") { return }
    if (_mayChange(textField, e.target, result.string) === false) { return }
    _insert(e.target, result.string)
}

// textField(_:shouldChangeCharactersIn:replacementString:) for the selection of
// `input`, as a typed character or a paste would replace it: the selection is
// the range, `replacement` empty for a deletion. Only an explicit false refuses.
function _mayChange(textField, input, replacement) {
    var delegate = textField._delegate
    if (!delegate || !delegate.textFieldShouldChangeCharactersInRangeReplacementString) { return true }
    var start = input.selectionStart === null || input.selectionStart === undefined ? 0 : input.selectionStart
    var end = input.selectionEnd === null || input.selectionEnd === undefined ? start : input.selectionEnd
    var range = new NSRange({location: start, length: end - start})
    return delegate.textFieldShouldChangeCharactersInRangeReplacementString(textField, range, replacement)
}

// null when the clipboard has none of the three flavours, a file alone included.
function _flavoursOf(clipboardData) {
    if (!clipboardData || typeof clipboardData.getData !== "function") { return null }
    var flavours = {}
    var count = 0
    for (var [mimeType, identifier] of pasteFlavours) {
        var string = clipboardData.getData(mimeType)
        if (typeof string !== "string" || string === "") { continue }
        flavours[identifier] = _capped(string)
        count += 1
    }
    return count === 0 ? null : flavours
}

// A flavour longer than the cap in UTF-16 units is longer in bytes too, so it
// is cut before it is encoded, and the bytes are cut back to a code point.
function _capped(string) {
    var bytes = utf8Encoder.encode(string.length > pasteFlavourCap ? string.slice(0, pasteFlavourCap) : string)
    if (bytes.length <= pasteFlavourCap) { return bytes }
    var end = pasteFlavourCap
    while (end > 0 && (bytes[end] & 0xC0) === 0x80) { end -= 1 }
    return bytes.slice(0, end)
}

// An input whose type has no selection (email, number) takes the string at the end.
function _insert(input, string) {
    var start = input.selectionStart
    if (start === null || start === undefined) {
        input.value = input.value + string
    }
    if (start !== null && start !== undefined) {
        input.setRangeText(string, start, input.selectionEnd, "end")
    }
    var view = input.ownerDocument.defaultView
    input.dispatchEvent(new view.InputEvent("input", {bubbles: true, inputType: "insertFromPaste"}))
}


function _inlineColor(element) {
    if (!element || !element.style || element.style.color === "") { return null }
    return new UIColor({hex: element.style.color})
}
