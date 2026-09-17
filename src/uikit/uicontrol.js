import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"


export class UIControl extends UIView {

    addTarget(target, {action, for: controlEvent}) {
        var control = this
        var event = {
            [UIControlEvent.valueChanged]: "change",
            [UIControlEvent.touchUpInside]: "click"
        }[controlEvent] || "click"
        this.$el.off(event).on(event, (e) => {
            e.stopImmediatePropagation()
            return action(target, control, e)
        })
    }
}
