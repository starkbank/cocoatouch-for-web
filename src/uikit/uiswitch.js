import { UIControl } from "./uicontrol.js"
import { required, typed, Bool } from "../utils/required.js"


export class UISwitch extends UIControl {

    get isOn() {
        return this.$el.prop("checked")
    }

    set isOn(on) {
        this.$el.prop("checked", on)
    }

    // setOn(_:animated:): animated is required and recorded; a switch here does not animate.
    /**
     * @param {boolean} on
     * @param {object} options
     * @param {boolean} options.animated
     */
    setOn(on, {animated} = {}) {
        var signature = "Apple's is setOn(_:animated:); write setOn(on, {animated: false})."
        required(animated, "animated", Bool, "UISwitch.setOn", signature)
        typed(on, "on", Bool, "UISwitch.setOn", signature)
        this.isOn = on
    }
}
