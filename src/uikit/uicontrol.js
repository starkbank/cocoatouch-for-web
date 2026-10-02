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

    // A disabled control ignores the pointer and carries the disabled
    // attribute, for stylesheets to draw it as such.
    set isEnabled(bool) {
        this._isEnabled = bool
        this.$el.css("pointer-events", bool ? "" : "none")
        bool ? this.$el.removeAttr("disabled") : this.$el.attr("disabled", "")
    }

    get isEnabled() {
        return this._isEnabled !== false
    }

    // Selection is the "selected" class, as on table view rows, for stylesheets to draw.
    get isSelected() {
        return this.$el.hasClass("selected")
    }

    set isSelected(selected) {
        this.$el.toggleClass("selected", selected)
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
