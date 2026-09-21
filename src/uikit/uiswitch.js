import { UIControl } from "./uicontrol.js"


export class UISwitch extends UIControl {

    get isOn() {
        return this.$el.prop("checked")
    }

    set isOn(on) {
        this.$el.prop("checked", on)
    }

    setOn(on, {animated} = {}) {
        this.isOn = on
    }
}
