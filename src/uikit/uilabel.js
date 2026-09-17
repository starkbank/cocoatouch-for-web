import { UIView } from "./uiview.js"
import { NSString } from "../utils/nsstring.js"


export class UILabel extends UIView {

    set text(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        this.$el.html(cleanedScriptText)
    }

    get text() {
        return this.$el.text()
    }
}