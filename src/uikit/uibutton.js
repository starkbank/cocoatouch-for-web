import { NSString } from "../utils/nsstring.js"
import { UIControl } from "./uicontrol.js"


export class UIButton extends UIControl {

    sendActions(params) {
        this.$el.click()
    }

    addTarget(target, params) {
        var button = this
        this.$el.off("click").on("click", (event) => {
            event.stopImmediatePropagation()
            params["action"](target, button)
        })
    }

    set text(text) {
        var cleanedScriptText = NSString.cleanScript(text)
        this.$el.html(cleanedScriptText)
    }

    get text() {
        return this.$el.text()
    }
}
