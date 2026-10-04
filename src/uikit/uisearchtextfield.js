import { NSString } from "../utils/nsstring.js"
import { UITextField } from "./uitextfield.js"
import { required, Int } from "../utils/required.js"


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

    // Handlers bind under the view's namespace and are removed first, so a
    // second instance on the same element does not stack a second pair.
    init() {
        if (this.$el.children("input").length === 0) {
            this.$el.append("<input class=\"search-input-tag\" autocomplete=\"off\" />")
        }
        this.$el.off("click.uisearchtextfield").on("click.uisearchtextfield", () => this.textField.trigger("focus"))
        this.textField.off("keydown.uisearchtextfield").on("keydown.uisearchtextfield", (e) => {
            if (e.key !== "Backspace" || this.textField.val() !== "" || !this._allowsDeletingTokens) { return }
            if (this._tokens.length === 0) { return }
            e.preventDefault()
            this.removeToken({at: this._tokens.length - 1})
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

    /**
     * @param {UISearchToken} token
     * @param {object} options
     * @param {number} options.at
     */
    insertToken(token, {at} = {}) {
        var index = required(at, "at", Int, "UISearchTextField.insertToken", "Apple's is insertToken(_:at:); write insertToken(token, {at: index}).")
        var $tag = $("<div class=\"tag\"><div class=\"tag-text\">" + NSString.cleanScript(token.text) + "</div></div>")
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
