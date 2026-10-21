import { setText } from "../utils/text.js"
import { UITextField } from "./uitextfield.js"
import { UIColor } from "./uicolor.js"
import { autocompleteTokenOf, textContentTypeOf, textContentTypeDescriptor, textContentTypeSignature } from "./uitextcontenttype.js"
import { required, typed, optional, Int } from "../utils/required.js"


export class UISearchToken {

    /**
     * @param {object} options
     * @param {string|null} [options.icon]
     * @param {string} options.text
     */
    constructor({icon = null, text}) {
        this.icon = icon
        this.text = text
    }
}


// A text field that shows tokens before its typing area: the element holds
// the tokens and an inner input.
export class UISearchTextField extends UITextField {

    _tokens = []
    _allowsDeletingTokens = true

    init() {
        this._appendInput()
        this._bindInput()
    }

    // A removed view loses its element's and its input's handlers with them, and
    // a view made in code gets its element only when it is placed, so the input
    // and what is bound on it come back on every placement.
    didMoveToSuperview() {
        super.didMoveToSuperview()
        if (this.superview === null) { return }
        this._appendInput()
        this._bindInput()
    }

    // A restored view has its input already, and its element may be the whole
    // restore scope, which must not be given one: it binds and appends nothing
    // new.
    didMoveToWindow() {
        super.didMoveToWindow()
        this._bindInput()
    }

    _appendInput() {
        if (this.$el.children("input").length > 0) { return }
        this.$el.append("<input class=\"search-input-tag\" autocomplete=\"off\" />")
    }

    // Handlers bind under the view's namespace and are removed first, so a
    // second instance on the same element does not stack a second set. A focus
    // or blur does not bubble from the input to the wrapper that holds the
    // targets, so the input's is relayed to the wrapper's own handlers alone:
    // no native event, nothing above the wrapper hears it and no focus moves.
    _bindInput() {
        if (this.textField.length === 0) { return }
        this.$el.off("click.uisearchtextfield").on("click.uisearchtextfield", () => this.textField[0]?.focus())
        this.textField.off(".uisearchtextfield")
        this.textField.on("keydown.uisearchtextfield", (e) => {
            if (e.key !== "Backspace" || this.textField.val() !== "" || !this._allowsDeletingTokens) { return }
            if (this._tokens.length === 0) { return }
            e.preventDefault()
            this.removeToken({at: this._tokens.length - 1})
        })
        this.textField.on("focus.uisearchtextfield", () => this.$el.triggerHandler("focus"))
        this.textField.on("blur.uisearchtextfield", () => this.$el.triggerHandler("blur"))
    }

    get textField() {
        return this.$el.children("input")
    }

    // UITextField's text reads this.$el itself, which is correct for a plain
    // input or textarea; this.$el is the tokens-and-input wrapper here, whose
    // own tagName is never "input", so that getter would read the wrapper's
    // text nodes (the tokens, never what was typed) instead of the field's
    // value. The typed value is always on this.textField, the inner input.
    get text() {
        return this.textField.val()
    }

    set text(text) {
        this.textField.val(text === null || text === undefined ? "" : String(text))
    }

    // The typed text is in the inner input, which does not inherit its color
    // from the wrapper, so the color is the input's.
    set textColor(color) {
        this.textField.css("color", color === null || color === undefined ? "" : color.cgColor)
    }

    get textColor() {
        var element = this.textField[0]
        if (!element || !element.style || element.style.color === "") { return null }
        return new UIColor({hex: element.style.color})
    }

    // The hint belongs to the inner input, where the typed text is.
    /** @param {string|null} type one of UITextContentType, or null */
    set textContentType(type) {
        var value = type === undefined ? null : type
        typed(value, "textContentType", optional(textContentTypeDescriptor), "UITextField.textContentType", textContentTypeSignature)
        if (value === null) {
            this.textField.removeAttr("autocomplete")
            return
        }
        this.textField.attr("autocomplete", autocompleteTokenOf(value))
    }

    get textContentType() {
        return textContentTypeOf(this.textField.attr("autocomplete"))
    }

    // UIView's inherited becomeFirstResponder/resignFirstResponder/
    // isFirstResponder all act on this.$el, same as the unoverridden text
    // getter above — but this.$el is the tokens-and-input wrapper, a plain
    // div, which a browser never gives keyboard focus; the only focusable
    // element here is the inner input, so those three need the same override
    // for the same reason text did.
    becomeFirstResponder() {
        this.textField[0]?.focus()
    }

    resignFirstResponder() {
        this.textField[0]?.blur()
    }

    get isFirstResponder() {
        return this.textField.is(":focus")
    }

    get tokens() {
        return this._tokens.slice()
    }

    set tokens(tokens) {
        this.$el.children(".tag").remove()
        this._tokens = []
        tokens.forEach((token) => this.insertToken(token, {at: this._tokens.length}))
    }

    set allowsDeletingTokens(bool) {
        this._allowsDeletingTokens = bool
    }

    get allowsDeletingTokens() {
        return this._allowsDeletingTokens
    }

    /**
     * @param {UISearchToken} token
     * @param {object} options
     * @param {number} options.at
     */
    insertToken(token, {at} = {}) {
        var index = required(at, "at", Int, "UISearchTextField.insertToken", "Apple's is insertToken(_:at:); write insertToken(token, {at: index}).")
        var $tag = $("<div class=\"tag\"><div class=\"tag-text\"></div></div>")
        setText($tag.children(".tag-text"), token.text)
        if (token.icon) { $tag.prepend(token.icon) }
        var tags = this.$el.children(".tag")
        if (index < tags.length) { tags.eq(index).before($tag) }
        if (index >= tags.length) { this.textField.before($tag) }
        this._tokens.splice(index, 0, token)
    }

    /**
     * @param {object} options
     * @param {number} options.at
     */
    removeToken({at}) {
        this.$el.children(".tag").eq(at).remove()
        this._tokens.splice(at, 1)
    }
}
