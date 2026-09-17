import { UILabel } from "./uilabel.js"


export class UIScriptLabel extends UILabel {

    set text(text) {
        this.$el.html(text)
    }
}
