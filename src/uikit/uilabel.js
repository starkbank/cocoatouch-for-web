import { UIView } from "./uiview.js"
import { NSString } from "../utils/nsstring.js"


export class UILabel extends UIView {

    adjustsFontSizeToFitWidth = false
    minimumScaleFactor = 0

    set text(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        this.$el.html(cleanedScriptText)
        if (this.adjustsFontSizeToFitWidth) { this._fitTextToWidth() }
    }

    get text() {
        return this.$el.text()
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
