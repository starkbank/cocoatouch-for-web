import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIControlState } from "./uicontrolstate.js"


const EVENTS = {
    [UIControlEvent.valueChanged]: "change",
    [UIControlEvent.touchUpInside]: "click",
    [UIControlEvent.editingChanged]: "input",
    [UIControlEvent.editingDidBegin]: "focus",
    [UIControlEvent.editingDidEnd]: "blur",
    [UIControlEvent.touchDown]: "mousedown",
}


export class UIControl extends UIView {

    static get Event() {
        return UIControlEvent
    }

    static get State() {
        return UIControlState
    }

    set isEnabled(bool) {
        this._isEnabled = bool
        this.$el.css("pointer-events", bool ? "" : "none")
    }

    get isEnabled() {
        return this._isEnabled !== false
    }

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
