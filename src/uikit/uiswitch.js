import { UIControl } from "./uicontrol.js"
import { required } from "../utils/required.js"


export class UISwitch extends UIControl {

    get isOn() {
        return this.$el.prop("checked")
    }

    set isOn(on) {
        this.$el.prop("checked", on)
    }

    // setOn(_:animated:): animated is required and recorded; a switch here does not animate.
    setOn(on, options) {
        required(options, "animated", "UISwitch.setOn", "setOn(on, {animated: false}). Apple's is setOn(_:animated:)")
        this.isOn = on
    }
}
