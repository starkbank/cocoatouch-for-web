import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIControlState } from "./uicontrolstate.js"


const events = {
    [UIControlEvent.valueChanged]: "change",
    [UIControlEvent.touchUpInside]: "click",
    [UIControlEvent.editingChanged]: "input",
    [UIControlEvent.editingDidBegin]: "focus",
    [UIControlEvent.editingDidEnd]: "blur",
    [UIControlEvent.touchDown]: "mousedown",
}


var _pairCount = 0


export class UIControl extends UIView {

    static get Event() {
        return UIControlEvent
    }

    static get State() {
        return UIControlState
    }

    // A control is highlighted while the pointer is down on it, as a touch
    // highlights it on iOS; the handlers bind to the element the control has
    // when constructed.
    init() {
        this.$el.on("pointerdown.uicontrol", () => { if (this.isEnabled) { this.isHighlighted = true } })
        this.$el.on("pointerup.uicontrol pointerleave.uicontrol pointercancel.uicontrol", () => { this.isHighlighted = false })
    }

    // Apple's state is an option set; JavaScript has none, so this is a frozen
    // array of the active cases, [normal] for a plain control.
    get state() {
        var cases = []
        if (this.isHighlighted) { cases.push(UIControlState.highlighted) }
        if (this.isSelected) { cases.push(UIControlState.selected) }
        if (!this.isEnabled) { cases.push(UIControlState.disabled) }
        return Object.freeze(cases.length === 0 ? [UIControlState.normal] : cases)
    }

    // Highlight is the "highlighted" class, as selection is "selected", for stylesheets to draw.
    get isHighlighted() {
        return this.$el.hasClass("highlighted")
    }

    set isHighlighted(highlighted) {
        this.$el.toggleClass("highlighted", highlighted)
        this._stateDidChange()
    }

    // A disabled control ignores the pointer and carries the disabled
    // attribute, for stylesheets to draw it as such.
    set isEnabled(bool) {
        this._isEnabled = bool
        this.$el.css("pointer-events", bool ? "" : "none")
        bool ? this.$el.removeAttr("disabled") : this.$el.attr("disabled", "")
        this._stateDidChange()
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
        this._stateDidChange()
    }

    // A subclass that draws per state, as UIButton does its titles, redraws here.
    _stateDidChange() {

    }

    // Adding a target never removes another: each pair gets its own jQuery
    // namespace, which is also what removeTarget takes off. The event stops
    // at the control, as it did, but other handlers on the same element still
    // run, so stopPropagation rather than stopImmediatePropagation; the
    // test stand-in's event has only the latter, hence the guard.
    addTarget(target, {action, for: controlEvent}) {
        var control = this
        var event = events[controlEvent] || "click"
        var pair = {target: target, action: action, event: event, namespace: event + ".target" + (++_pairCount)}
        this._targets().push(pair)
        this.$el.on(pair.namespace, (e) => {
            if (e.stopPropagation) { e.stopPropagation() }
            return action.call(target, target, control, e)
        })
    }

    // removeTarget(_:action:for:): a null or omitted action removes every
    // action that target registered for the event, as Apple's Selector? does.
    removeTarget(target, {action = null, for: controlEvent} = {}) {
        var event = events[controlEvent] || "click"
        var remaining = []
        for (var pair of this._targets()) {
            var matches = pair.target === target && pair.event === event && (action === null || pair.action === action)
            if (!matches) { remaining.push(pair); continue }
            this.$el.off(pair.namespace)
        }
        this._targetPairs = remaining
    }

    _targets() {
        if (!this._targetPairs) { this._targetPairs = [] }
        return this._targetPairs
    }

    // Fires the event the control would fire for that control event.
    sendActions({for: controlEvent} = {}) {
        this.$el.trigger(events[controlEvent] || "click")
    }
}
