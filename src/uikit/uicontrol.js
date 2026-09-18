import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"


const EVENTS = {
    [UIControlEvent.valueChanged]: "change",
    [UIControlEvent.touchUpInside]: "click",
    [UIControlEvent.editingChanged]: "input",
}


export class UIControl extends UIView {

    addTarget(target, {action, for: controlEvent}) {
        var control = this
        var event = EVENTS[controlEvent] || "click"
        this.$el.off(event).on(event, (e) => {
            e.stopImmediatePropagation()
            return action(target, control, e)
        })
    }

    // Fires the event the control would fire for that control event.
    sendActions({for: controlEvent} = {}) {
        this.$el.trigger(EVENTS[controlEvent] || "click")
    }
}
