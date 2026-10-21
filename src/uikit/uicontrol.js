import { UIView } from "./uiview.js"
import { togglesItself } from "../utils/bind.js"
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


// Every connection, an addTarget pair or an @IBAction of a nib, takes the next
// number, so the actions of one event run in the order they were connected
// whichever of the two kinds made them.
var _connectionCount = 0

// The controls whose targets are bound over an element: two views can be over
// one element (an outlet and a control the app made), and a click on it must
// run both lists as one dispatch. A WeakMap, so the page dropping the element
// drops the entry.
var _controlsOver = new WeakMap()

// The nib connections live in the element's jQuery data, so removing or
// emptying the element drops them with its handlers, as the click handler of
// an @IBAction was dropped before, a reused row included.
const nibConnectionsKey = "cocoatouchNibConnections"

const bridgeNamespace = "cocoatouchTargets"

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
    // again on every placement, through the element's one handler per event:
    // cleared first, so a target never fires twice. Removal leaves them for
    // the next one.
    didMoveToSuperview() {
        this._bindHighlight()
        if (this.superview === null) { return }
        for (var event of new Set(this._targets().map(function(pair) { return pair.event }))) { this._bindBridge(event) }
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

    // The control event Interface Builder connects an action to when it is not
    // given one, which is touchUpInside for a control. A subclass that Apple
    // connects differently (a switch, a text field) overrides it.
    static get _nibEvent() {
        return UIControlEvent.touchUpInside
    }

    // Adding a target never removes another, and the DOM event reaches the
    // actions through one handler per element and event, so two targets, two
    // views over the element and the @IBAction connections of a nib run in the
    // order they were connected. The event stops at the control, as it did, but
    // other handlers on the same element still run, so stopPropagation rather
    // than stopImmediatePropagation.
    /**
     * @param {object} target
     * @param {object} options
     * @param {Function} options.action Called on the target with the sending control as its only argument, as Apple's (sender).
     * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} options.for
     */
    addTarget(target, {action, for: controlEvent} = {}) {
        required(action, "action", FunctionType, "UIControl.addTarget", "Apple's is addTarget(_:action:for:); write addTarget(target, {action, for: UIControlEvent.touchUpInside}).")
        required(controlEvent, "for", eventType, "UIControl.addTarget", "Apple's is addTarget(_:action:for:); write addTarget(target, {action, for: UIControlEvent.touchUpInside}).")
        var event = events[controlEvent]
        this._targets().push({target: target, action: action, controlEvent: controlEvent, event: event, sender: this, isNib: false, seq: ++_connectionCount})
        this._bindBridge(event)
    }

    // The connection Interface Builder makes from this control to its owner:
    // the key is (owner, method, event), so binding it again replaces it, and
    // another owner binding the element for the same event replaces the earlier
    // owner's connections, as the last bind did before. It lives on the element
    // and is not in the instance list, which is only what addTarget put there.
    _connectNibAction({target, method, controlEvent}) {
        var event = events[controlEvent]
        var connection = {target: target, method: method, controlEvent: controlEvent, event: event, sender: this, owner: target, isNib: true, seq: ++_connectionCount}
        this.$el.each(function() {
            var kept = _nibConnectionsAt(this).filter(function(held) { return !(held.event === event && (held.owner !== target || held.method === method)) })
            $.data(this, nibConnectionsKey, kept.concat(connection))
        })
        this._bindBridge(event, {isRegistering: false})
    }

    // A nib connection carries its sender in the element's data, so only the
    // control that holds addTarget pairs is registered over the element: a
    // sender built again on every bind of a row would otherwise pile up in a
    // set the element keeps for its lifetime.
    _bindBridge(event, {isRegistering = true} = {}) {
        var namespaced = event + "." + bridgeNamespace
        if (isRegistering) { _register(this) }
        this.$el.off(namespaced).on(namespaced, _bridge(event))
    }

    // removeTarget(_:action:for:): a null or omitted action removes every
    // action that target registered for the event, as Apple's Selector? does,
    // and the target's @IBAction connections to this control go with them.
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
        var isRemoved = function(connection) {
            return connection.target === target && connection.event === event && (action === null || _actionOf(connection) === action)
        }
        this._targetPairs = this._targets().filter(function(pair) { return !isRemoved(pair) })
        this.$el.each(function() {
            $.data(this, nibConnectionsKey, _nibConnectionsAt(this).filter(function(connection) { return !isRemoved(connection) }))
        })
    }

    _targets() {
        if (!this._targetPairs) { this._targetPairs = [] }
        return this._targetPairs
    }

    // Calls the actions connected for that event, a snapshot of them, directly:
    // Apple's sendActions(for:) runs the target-action table and fires no
    // touch, so there is no DOM event, no default (a submit, a checkbox
    // toggle), no focus change and nothing above the control hears it, and a
    // disabled control sends its actions as it did. A control with no element
    // yet still has its own targets to call.
    /**
     * @param {object} options
     * @param {"touchUpInside"|"valueChanged"|"editingChanged"|"editingDidBegin"|"editingDidEnd"|"touchDown"} options.for
     */
    sendActions({for: controlEvent} = {}) {
        required(controlEvent, "for", eventType, "UIControl.sendActions", "Apple's is sendActions(for:); write sendActions({for: UIControlEvent.touchUpInside}).")
        var event = events[controlEvent]
        var element = this.$el[0]
        var connections = element ? _connectionsAt(element, event) : this._targets().filter(function(pair) { return pair.event === event })
        for (var connection of connections) { _perform(connection) }
    }
}


function _nibConnectionsAt(element) {
    return $.data(element, nibConnectionsKey) || []
}

// Registering is what a placement or an addTarget does to a live control, and a
// control removed and placed again is live again, so it stops counting as disposed.
function _register(control) {
    control._disposed = false
    control.$el.each(function() {
        var controls = _controlsOver.get(this)
        if (!controls) { _controlsOver.set(this, controls = new Set()) }
        controls.add(control)
    })
}

function _actionOf(connection) {
    return connection.isNib ? connection.target[connection.method] : connection.action
}

// What one element answers to an event: every bound control's pairs and the
// nib's connections, in the order they were made.
function _connectionsAt(element, event) {
    var connections = []
    var controls = _controlsOver.get(element) || []
    for (var control of controls) {
        if (control._disposed === true) {
            controls.delete(control)
            continue
        }
        for (var pair of control._targets()) {
            if (pair.event === event) { connections.push(pair) }
        }
    }
    for (var connection of _nibConnectionsAt(element)) {
        if (connection.event === event) { connections.push(connection) }
    }
    return connections.sort(function(a, b) { return a.seq - b.seq })
}

// Apple's action is (sender) on the target; its return value is Void, so
// nothing the action returns, false included, cancels anything. A nib action
// is looked up when it runs, as a selector is, and is skipped when the owner
// no longer has it.
function _perform(connection) {
    if (!connection.isNib) {
        connection.action.call(connection.target, connection.sender)
        return
    }
    var owner = connection.target
    if (!owner[connection.method]) { return }
    owner[connection.method](connection.sender)
}

// The one handler an element has per DOM event. A pair stops its event at the
// control and an @IBAction connection does not but cancels a click's default,
// the two policies the sites were written against. A disabled sender receives
// no touch, so its actions are skipped; a checkbox or radio toggles itself on
// a click and the action then reads the new state, so cancelling it would undo it.
var _bridges = {}

function _bridge(event) {
    if (_bridges[event]) { return _bridges[event] }
    _bridges[event] = function(e) {
        var connections = _connectionsAt(e.currentTarget, event)
        if (connections.some(function(connection) { return !connection.isNib }) && e.stopPropagation) { e.stopPropagation() }
        var isCancelling = event === "click" && connections.some(function(connection) { return connection.isNib })
        if (isCancelling && !togglesItself(e.target)) { e.preventDefault() }
        for (var connection of connections) {
            if (!connection.sender.isEnabled) { continue }
            _perform(connection)
        }
    }
    return _bridges[event]
}


// The controls registered over an element, for a test that counts what an
// element holds on to.
export function controlsOver(element) {
    return Array.from(_controlsOver.get(element) || [])
}
