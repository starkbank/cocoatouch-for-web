import { UIControl } from "./uicontrol.js"

export class UISwitch extends UIControl {

    isOn() {
        return $(this.selector).prop("checked")
    }

    setOn(checked) {
        return $(this.selector).prop("checked", checked)
    }
}