import { UIControl } from "./uicontrol.js"


export class UISwitch extends UIControl {

    get isOn() {
        return this.$el.prop("checked")
    }

    set isOn(on) {
        this.$el.prop("checked", on)
    }

    // setOn(_:animated:): animated is required and recorded; a switch here does not animate.
    setOn(on, options) {
        _required(options, "animated", "UISwitch.setOn", "setOn(on, {animated: false}). Apple's is setOn(_:animated:)")
        this.isOn = on
    }
}


// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write.
function _required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
