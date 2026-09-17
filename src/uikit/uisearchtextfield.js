import { uuid } from "../utils/uuid.js"
import { NSString } from "../utils/nsstring.js"
import { UITextField } from "./uitextfield.js"


// A text field that turns entries into tokens, like the search field's tokens
// on iOS. The element holds the tokens and an inner input for typing.
export class UISearchTextField extends UITextField {

    _tokens = []
    _invalidTokens = []
    _mask = {}
    _delegate = null
    _entryLimit = null
    _allSelected = false
    _placeholder = ""
    _tagValidation = false
    _selectionCursor = null
    _isTagLowercased = true
    _validationFunction = null
    _highlightTextField = false
    _enableVerticalScroll = false
    _preservesWhitespaceOnPaste = false
    _isLegacy = true

    init() {
        this.$el.append("<input class=\"search-input-tag\" autocomplete=\"off\" />")
        var input = this.textField
        var text = input.val()

        this.$el.on("click", (e) => {
            if (e.target === this.$el[0] || e.target === input[0]) {
                this._clearSelection()
            }
            input.trigger("focus")
        })
        input.on("keydown", (e) => {
            text = input.val()
            if (text !== "") { this._clearSelection() }
            this._updateTextField(text)
            this._triggerActions(e, text)
            this._handleCut(e)
            this._handleCopy(e)
            this._handleArrowKeys(e.key, text)
            this._handleSelectAll(e, text)
            this._handleRemoveSelection(e)
        })
        input.on("keyup", () => {
            text = input.val()
            this._updateTextField(text)
        })
        input.on("focus", () => {
            var tag = this.$el.children(".tag")[this._selectionCursor]
            if (tag) { this._scrollTo(tag) }
        })
        input.on("blur", (e) => {
            if (text === "" || text === "," || this._tokens.indexOf(text) !== -1) { return }
            this._insertTagsFromText(text)
            text = ""
            e.preventDefault()
        })
        input.on("paste", (e) => this._handlePaste(e))
    }

    get textField() {
        return $(this.selector + " > input")
    }

    get tokens() {
        return this._tokens
    }

    set tokens(tokens) {
        tokens.forEach((token) => this.insertToken({data: token}))
    }

    get validEntries() {
        return this._invalidTokens.length === 0
    }

    get delegate() {
        return this._delegate
    }

    set delegate(delegate) {
        this._delegate = delegate
    }

    get isLegacy() {
        return this._isLegacy
    }

    set isLegacy(bool) {
        this._isLegacy = bool
        if (bool) { return }
        this.$el.css("font-family", "Pretendard-Light")
        this.textField.addClass("search-input-tag-placeholder")
        $(".tag-text").css("font-size", "16px")
    }

    set placeholder(placeholder) {
        this._placeholder = placeholder
        this.textField.attr("placeholder", placeholder)
        this._updateTextFieldSize(placeholder)
    }

    set tagValidation(bool) {
        this._tagValidation = bool
    }

    set validationFunction(validator) {
        this._validationFunction = validator
    }

    set entryLimit(limit) {
        this._entryLimit = limit
    }

    set isTagLowercased(bool) {
        this._isTagLowercased = bool
    }

    set preservesWhitespaceOnPaste(bool) {
        this._preservesWhitespaceOnPaste = bool
    }

    set enableVerticalScroll(bool) {
        this._enableVerticalScroll = bool
        this.$el.toggleClass("request-search-textfield-v3-override-enable-vertical-scroll", bool)
    }

    set mask(maskConfig) {
        this._mask = maskConfig
        this.textField.mask(maskConfig.pattern, maskConfig.options)
    }

    get mask() {
        return this._mask
    }

    set highlightInvalidTextField(bool) {
        this._highlightTextField = bool
        var input = this.textField
        if (bool) {
            this.$el.siblings("label").addClass("invalid-label")
            input.parent().addClass("invalid-input")
            return
        }
        this.$el.siblings("label").removeClass("invalid-label")
        input.parent().removeClass("invalid-input")
    }

    insertToken({data, styleClass = ""}) {
        data = NSString.cleanScript(data)
        if (this._entryLimit && this._tokens.length >= this._entryLimit) { return }
        data = data.trim()
        if (this._tokens.indexOf(data) !== -1 || data === "" || data === ",") { return }
        if (this._isTagLowercased) { data = data.toLowerCase() }
        var id = "tag-" + uuid()
        var input = this.textField
        this._updatePlaceholder()
        this._updateTextFieldSize("")
        this._tokens.push(data)
        this._selectionCursor = this._tokens.length
        input.val("")
        input.attr("placeholder", "")
        input.before("<div id=\"" + id + "\" class=\"tag " + styleClass + "\"> <div class=\"tag-text\">" + NSString.cleanScript(data) + "</div> <div class=\"remove-tag\">&times;</div> </div>")
        var tag = $("#" + id)
        if (this._preservesWhitespaceOnPaste) {
            tag.children(".tag-text").css("white-space", "pre-wrap")
        }
        tag.children(".remove-tag").off("click").on("click", () => this.removeToken({data: data, tag: tag}))
        tag.on("click", () => {
            this._allSelected = false
            this._selectionCursor = this._tokens.indexOf(data)
            this._selectTag(tag[0])
        })
        if (this._tagValidation) {
            this._validate(data, id)
            this._checkForInvalidInput()
        }
        this._tokensUpdated()
        return tag
    }

    removeToken({data, tag}) {
        var index = this._tokens.indexOf(data)
        var invalidIndex = this._invalidTokens.indexOf(data)
        tag.remove()
        if (index !== -1) {
            this._tokens.splice(index, 1)
            this._selectionCursor = this._tokens.length
        }
        if (invalidIndex !== -1) {
            this._invalidTokens.splice(invalidIndex, 1)
        }
        this._tokensUpdated()
        this._updatePlaceholder()
        this._checkForInvalidInput()
    }

    removeAllTokens() {
        this._tokens = []
        this._invalidTokens = []
        this._allSelected = false
        this.$el.children(".tag").remove()
        this._updatePlaceholder()
        this._checkForInvalidInput()
        this._tokensUpdated()
    }

    _tokensUpdated() {
        if (this._delegate && this._delegate.tokensUpdated) {
            this._delegate.tokensUpdated(this)
        }
    }

    _insertTagsFromText(text) {
        if (this._delegate && this._delegate.textFieldWillInsertText) {
            return this._delegate.textFieldWillInsertText({textField: this, text: text})
        }
        return this.insertToken({data: text})
    }

    _handlePaste(event) {
        if (this._delegate && this._delegate.textFieldDidPaste) {
            event.preventDefault()
            return this._delegate.textFieldDidPaste({textField: this, event: event})
        }
        var whitespace = this._preservesWhitespaceOnPaste ? /(\r\n|\n|\r)/gm : /(\r\n|\n|\r|\s+)/gm
        var entries = event.originalEvent.clipboardData.getData("text").replace(whitespace, "").split(/[;,×]+/)
        entries.forEach((item) => {
            var match = item.match(/<([^>]+)>/)
            this.insertToken({data: match ? match[1] : item.replace(/<|>/gm, "")})
        })
        event.preventDefault()
    }

    _updatePlaceholder() {
        var input = this.textField
        if (this._tokens.length === 0) {
            input.attr("placeholder", this._placeholder)
            return this._updateTextFieldSize(this._placeholder)
        }
        input.attr("placeholder", "")
        this._updateTextFieldSize("")
    }

    _updateTextField(text) {
        if (text.length > 0) {
            return this._updateTextFieldSize(text)
        }
        this._updatePlaceholder()
    }

    _updateTextFieldSize(str) {
        this.textField.css("width", str ? ((str.length * 15) + 20) + "px" : "40px")
    }

    _triggerActions(event, text) {
        var key = event.key
        var tags = this.$el.children(".tag")
        if (key === "," || key === ";" || key === "188" || key === "Enter") {
            event.preventDefault()
            this._insertTagsFromText(text)
        }
        if (key !== "Backspace" || text !== "") { return }
        event.preventDefault()
        if (this._allSelected) { return this.removeAllTokens() }
        if (!tags.length) { return }
        if (this._selectionCursor === tags.length || this._selectionCursor === this._tokens.length) {
            var last = this._tokens.length - 1
            this.removeToken({data: this._tokens[last], tag: $(tags[last])})
        }
        if (this._selectionCursor < tags.length || this._selectionCursor < this._tokens.length) {
            this.removeToken({data: this._tokens[this._selectionCursor], tag: $(tags[this._selectionCursor])})
        }
        this._updatePlaceholder()
    }

    _clearSelection() {
        this._allSelected = false
        this._selectionCursor = this._tokens.length
        this._toggleSelectedTags(false)
    }

    _handleArrowKeys(key, text) {
        if (text !== "") { return }
        var tags = this.$el.children(".tag")
        var last = this._tokens.length - 1
        if (key === "ArrowUp") { this._selectionCursor = 0 }
        if (key === "ArrowDown") { this._selectionCursor = last }
        if (key === "ArrowRight") {
            if (this._selectionCursor >= last) { return this.textField.trigger("click") }
            this._selectionCursor += 1
        }
        if (key === "ArrowLeft") {
            if (this._selectionCursor === 0) { return }
            this._selectionCursor -= 1
        }
        if (tags[this._selectionCursor]) {
            this._selectTag(tags[this._selectionCursor])
            this._scrollTo(tags[this._selectionCursor])
        }
    }

    _handleSelectAll(event, text) {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "a" || text !== "") { return }
        this._allSelected = true
        this._toggleSelectedTags(true)
    }

    _handleRemoveSelection(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === "Backspace") {
            this.removeAllTokens()
        }
    }

    _handleCopy(event) {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") { return }
        if (this._allSelected) { return navigator.clipboard.writeText(this._tokens.join(", ")) }
        var selection = this._tokens[this._selectionCursor]
        if (selection) { navigator.clipboard.writeText(selection) }
    }

    _handleCut(event) {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "x") { return }
        if (this._allSelected) {
            navigator.clipboard.writeText(this._tokens.join(", "))
            return this.removeAllTokens()
        }
        var selection = this._tokens[this._selectionCursor]
        if (!selection) { return }
        navigator.clipboard.writeText(selection)
        this.removeToken({data: selection, tag: $(this.$el.children(".tag")[this._selectionCursor])})
    }

    _scrollTo(tag) {
        tag.scrollIntoView({behavior: "auto", block: "center", inline: "center"})
    }

    _validate(data, id) {
        if (this._validationFunction(data)) { return }
        this._invalidTokens.push(data)
        $("#" + id).addClass("tag-invalid")
    }

    _selectTag(tag) {
        this._toggleSelectedTags(false)
        $(tag).addClass("tag-selected").css("background-color", this.tintColor.hex + "10")
    }

    _toggleSelectedTags(selected) {
        var tags = this.$el.children(".tag")
        if (selected) {
            tags.addClass("tag-selected").css("background-color", this.tintColor.hex + "10")
            return
        }
        tags.removeClass("tag-selected").removeAttr("style")
    }

    _checkForInvalidInput() {
        this.highlightInvalidTextField = this._invalidTokens.length > 0 && this._tokens.length > 0
    }
}
