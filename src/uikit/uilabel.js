import { UIView } from "./uiview.js"
import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { UIColor } from "./uicolor.js"


export class UILabel extends UIView {

    adjustsFontSizeToFitWidth = false
    minimumScaleFactor = 0

    // text is plain text, escaped by the DOM; markup goes through attributedText.
    set text(text) {
        this._attributedText = null
        setText(this.$el, text)
        if (this.adjustsFontSizeToFitWidth) { this._fitTextToWidth() }
    }

    // attributedText: an NSAttributedString, rendered as markup when it carries
    // the html document type and as plain text otherwise. Trusted input only.
    set attributedText(attributedText) {
        this._attributedText = attributedText
        if (attributedText && attributedText._isMarkup) {
            setMarkup(this.$el, attributedText._markup)
        }
        if (!attributedText || !attributedText._isMarkup) {
            setText(this.$el, attributedText ? attributedText.string : "")
        }
        if (this.adjustsFontSizeToFitWidth) { this._fitTextToWidth() }
    }

    get attributedText() {
        if (this._attributedText) { return this._attributedText }
        return new NSAttributedString({string: this.text})
    }

    get text() {
        return this.$el.text()
    }

    set textColor(color) {
        this.$el.css("color", color.cgColor)
    }

    get textColor() {
        return new UIColor({hex: this.$el.css("color")})
    }

    // Shrinks the font on one line until the text fits, no further than the
    // stylesheet size times minimumScaleFactor.
    _fitTextToWidth() {
        var element = this.$el[0]
        if (!element) { return }
        element.style.fontSize = ""
        element.style.lineHeight = ""
        if (element.offsetParent === null || element.clientWidth === 0) { return }
        element.style.whiteSpace = "nowrap"
        var available = element.clientWidth - 1
        var required = element.scrollWidth
        if (required <= available) { return }
        var size = parseFloat(getComputedStyle(element).fontSize)
        var fitted = Math.max(size * this.minimumScaleFactor, Math.floor(size * available / required))
        element.style.fontSize = `${fitted}px`
        element.style.lineHeight = `${fitted}px`
    }
}
