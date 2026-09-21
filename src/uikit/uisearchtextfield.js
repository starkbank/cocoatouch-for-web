import { NSString } from "../utils/nsstring.js"
import { UITextField } from "./uitextfield.js"


export class UISearchToken {

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
        this.$el.append("<input class=\"search-input-tag\" autocomplete=\"off\" />")
        this.$el.on("click", () => this.textField.trigger("focus"))
        this.textField.on("keydown", (e) => {
            if (e.key !== "Backspace" || this.textField.val() !== "" || !this._allowsDeletingTokens) { return }
            if (this._tokens.length === 0) { return }
            e.preventDefault()
            this._removeToken(this._tokens.length - 1)
        })
    }

    get textField() {
        return this.$el.children("input")
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

    insertToken(token, {at} = {}) {
        var index = at === undefined ? this._tokens.length : at
        var $tag = $("<div class=\"tag\"><div class=\"tag-text\">" + NSString.cleanScript(token.text) + "</div></div>")
        if (token.icon) { $tag.prepend(token.icon) }
        var tags = this.$el.children(".tag")
        if (index < tags.length) { tags.eq(index).before($tag) }
        if (index >= tags.length) { this.textField.before($tag) }
        this._tokens.splice(index, 0, token)
    }

    _removeToken(index) {
        this.$el.children(".tag").eq(index).remove()
        this._tokens.splice(index, 1)
    }
}
