import { UIView } from "./uiview.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIControlState } from "./uicontrolstate.js"
import { required, enumeration, optional, FunctionType } from "../utils/required.js"


const events = {
    [UIControlEvent.valueChanged]: "change",
    [UIControlEvent.touchUpInside]: "click",
    [UIControlEvent.editingChanged]: "input",
    [UIControlEvent.editingDidBegin]: "focus",
    [UIControlEvent.editingDidEnd]: "blur",
    [UIControlEvent.touchDown]: "mousedown",
}


var _pairCount = 0

const eventType = enumeration(UIControlEvent, "UIControl.Event")


export class UIControl extends UIView {

    static get Event() {
        return UIControlEvent
    }

    static get State() {
        return UIControlState
    }

    // A control is highlighted while the pointer is down on it, as a touch
    // highlights it on iOS. The handlers bind at construction for a control
    // that already has an element, and again when addSubview gives one to a
    // control created in code; the namespace is cleared first, so a control
    // never carries two bindings.
    init() {
        this._bindHighlight()
    }

    // A control created in code has no element until it is placed, and a
    // removed one loses its handlers with its element, so the targets bind
    // again on every placement, each under its own namespace: cleared first,
    // so a target never fires twice. Removal leaves them for the next one.
    didMoveToSuperview() {
        this._bindHighlight()
        if (this.superview === null) { return }
        for (var pair of this._targets()) { this._bindTarget(pair) }
    }

    _bindHighlight() {
        this.$el.off(".uicontrol")
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

    // The element's disabled attribute is the one truth, since two views can be
    // over one element (an outlet and the sender of an @IBAction) and either may
    // be the one that disabled it; the stored value stands in for an element that
    // cannot say.
    get isEnabled() {
        var element = this.$el && this.$el[0]
        if (element && typeof element.hasAttribute === "function") { return !element.hasAttribute("disabled") }
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
    /**
     * @param {object} target
     * @param {object} options
     * @param {Function} options.action
     * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} options.for
     */
    addTarget(target, {action, for: controlEvent} = {}) {
        required(action, "action", FunctionType, "UIControl.addTarget", "Apple's is addTarget(_:action:for:); write addTarget(target, {action, for: UIControlEvent.touchUpInside}).")
        required(controlEvent, "for", eventType, "UIControl.addTarget", "Apple's is addTarget(_:action:for:); write addTarget(target, {action, for: UIControlEvent.touchUpInside}).")
        var control = this
        var event = events[controlEvent]
        var pair = {target: target, action: action, event: event, namespace: event + ".target" + (++_pairCount)}
        pair.handler = (e) => {
            if (e.stopPropagation) { e.stopPropagation() }
            if (!control.isEnabled && !control._isSendingActions) { return }
            return action.call(target, target, control, e)
        }
        this._targets().push(pair)
        this._bindTarget(pair)
    }

    _bindTarget(pair) {
        this.$el.off(pair.namespace).on(pair.namespace, pair.handler)
    }

    // removeTarget(_:action:for:): a null or omitted action removes every
    // action that target registered for the event, as Apple's Selector? does.
    /**
     * @param {object} target
     * @param {object} options
     * @param {Function|null} [options.action]
     * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} options.for
     */
    removeTarget(target, {action = null, for: controlEvent} = {}) {
        required(controlEvent, "for", eventType, "UIControl.removeTarget", "Apple's is removeTarget(_:action:for:); write removeTarget(target, {action, for: UIControlEvent.touchUpInside}).")
        required(action, "action", optional(FunctionType), "UIControl.removeTarget", "Apple's is removeTarget(_:action:for:); action is a function, or null for every action of the target.")
        var event = events[controlEvent]
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
    /**
     * @param {object} options
     * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} options.for
     */
    sendActions({for: controlEvent} = {}) {
        required(controlEvent, "for", eventType, "UIControl.sendActions", "Apple's is sendActions(for:); write sendActions({for: UIControlEvent.touchUpInside}).")
        this._isSendingActions = true
        try {
            this.$el.trigger(events[controlEvent])
        } finally {
            this._isSendingActions = false
        }
    }
}
