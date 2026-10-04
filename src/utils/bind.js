import { UIViewController } from "../uikit/uiviewcontroller.js"
import { UIView } from "../uikit/uiview.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { inspectableValue } from "../uikit/ibinspectable.js"


export class Bind {

    static _restorePrototypes = new Set()

    // {cls, selector} of the view a creator is inside `new` for. The view's own
    // constructor fills its empty element but leaves binding to the creator, so
    // awakeFromNib arrives once, after the subclass's fields exist. The previous
    // marker is restored, not cleared: an outlet bound from inside a view's
    // init() goes through here too, and clearing would hand the outer view back
    // to its own constructor for a second bind.
    static _constructing = null

    static construct(cls, selector, ...rest) {
        var previous = Bind._constructing
        Bind._constructing = {cls: cls, selector: selector}
        try {
            return new cls(selector, ...rest)
        } finally {
            Bind._constructing = previous
        }
    }

    static isConstructing(view) {
        var marker = Bind._constructing
        return !!marker && marker.cls === view.constructor && marker.selector === view.selector
    }

    static registerPrototypeForRestore(prototype) {
        Bind._restorePrototypes.add(prototype)
    }

    // Views added at runtime through addSubview are not outlets of the
    // controller, so on a pre-rendered page they are found again by their
    // action selectors. One element has one owner: a target already answered
    // by a bound responder declaring that same selector is not a reason to
    // revive anything, and when a class and its subclass both match a target
    // only the most derived is revived. The instance is constructed with no
    // selector, so its fields and init() run as they would in code; a
    // selector would point init() at the page root instead of an element.
    static restoreRegisteredViews($scope, owner) {
        var bound = _boundResponders(owner)
        var candidates = []
        for (var proto of Bind._restorePrototypes) {
            if (proto instanceof UIViewController) { continue }
            var targets = _unclaimedTargets(proto, $scope, bound)
            if (targets.length === 0) { continue }
            candidates.push({proto: proto, targets: targets})
        }
        for (var candidate of candidates) {
            if (_hasMoreDerived(candidate, candidates)) { continue }
            var instance = new candidate.proto.constructor()
            instance._$el = $scope
            owner._link(instance)
            Bind.ibOutletRestore(instance)
            Bind.ibAction(instance)
            if (_overrides(instance, "didMoveToWindow")) {
                instance.didMoveToWindow()
            }
        }
    }

    // An action binds under its own namespace, beside any target the app adds
    // to the same element. A matched element without an id is given one, as an
    // outlet is, so the sender's selector resolves again when its node is replaced.
    static ibAction(control) {
        if (!control) { return }
        var actions = control["ibactions"] || []
        if (actions.length === 0) { return }
        var $parent = control._$el || $(control.selector)
        for (const action of actions) {
            if (_isKeyboardAction(action)) {
                _bindKeyboardAction(control, action)
                continue
            }
            var unnamed = 0
            $parent.find(action.selector).each(function() {
                var $target = $(this)
                if (!$target.attr("id")) {
                    $target.attr("id", _dashed(control.identifier, action.method) + "-" + (++unnamed))
                }
                var sender = new action.cls(`${control.selector} #${$target.attr("id")}`)
                sender._$el = $target
                $target.on("click.ibaction", (e) => {
                    var method = action.method
                    if (control[method]) {
                        e.preventDefault()
                        control[method](sender)
                    }
                })
            })
        }
    }

    // Runtime attributes come after the connections and before awakeFromNib,
    // in Interface Builder's order, so awakeFromNib sees the configured view.
    static ibInspectable(view) {
        if (!view) { return }
        var inspectables = view["ibinspectables"] || []
        if (inspectables.length === 0) { return }
        var $el = view._$el || $(view.selector)
        for (const inspectable of inspectables) {
            var value = $el.attr("data-" + _dash(inspectable.property))
            if (value === undefined) { continue }
            view[inspectable.property] = inspectableValue({type: inspectable.type, value: value, property: inspectable.property})
        }
    }

    static ibOutlet(control) {
        if (!control) { return }
        var outlets = control["iboutlets"] || []
        if (outlets.length === 0) { return }

        var $parent = control._$el || $(control.selector)

        for (const outlet of outlets) {
            var cls = outlet.cls
            var method = outlet.method
            var selector = outlet.selector

            var responder = Bind.construct(cls, `${control.selector} ${selector}`)
            responder._$el = $parent.find(selector)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
                Bind.ibOutlet(responder)
            }

            Bind.ibInspectable(responder)

            if (_overrides(responder, "awakeFromNib")) {
                responder.awakeFromNib()
            }

            if (responder["ibactions"] && responder["ibactions"].length > 0) {
                Bind.ibAction(responder)
            }
        }
    }

    static ibOutletRestore(control) {
        if (!control) { return }
        var outlets = control["iboutlets"] || []
        if (outlets.length === 0) { return }

        var $parent = control._$el || $(control.selector)

        for (const outlet of outlets) {
            var cls = outlet.cls
            var method = outlet.method
            var selector = outlet.selector

            var responder = Bind.construct(cls, `${control.selector} ${selector}`)
            responder._$el = $parent.find(selector)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
                Bind.ibOutletRestore(responder)
            }

            Bind.ibInspectable(responder)

            if (_overrides(responder, "didMoveToWindow")) {
                responder.didMoveToWindow()
            }

            if (responder["ibactions"] && responder["ibactions"].length > 0) {
                Bind.ibAction(responder)
            }
        }
    }
}


// A lifecycle hook runs when the view's class, or any class between it and
// UIView, defines it: a subclass inherits its parent's awakeFromNib on iOS too.
function _overrides(view, hook) {
    return typeof view[hook] === "function" && view[hook] !== UIView.prototype[hook]
}


// An outlet found by class gets a stable id from its owner and property
// name, so two nib-drawn fields on one page stay distinguishable.
function _identifyOutlet(owner, responder, property) {
    var $el = responder._$el
    if (!$el || $el.length !== 1 || $el.attr("id")) { return }
    var id = _dashed(owner.identifier, property)
    $el.attr("id", id)
    responder.selector = "#" + id
    responder._identifier = id
}

function _dashed(ownerIdentifier, property) {
    return ownerIdentifier + "-" + _dash(property)
}

function _dash(property) {
    return property.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

const keyboardPrefix = "keyboard:"

function _isKeyboardAction(action) {
    return action.selector.indexOf(keyboardPrefix) !== -1
}

// The owner and every responder bound under it, which is where ibOutletRestore
// links what it binds; these are the views that may already own a target.
function _boundResponders(owner) {
    var responders = [owner]
    var walk = function(view) {
        for (var subview of view.subviews || []) {
            responders.push(subview)
            walk(subview)
        }
    }
    walk(owner.view)
    return responders
}

function _unclaimedTargets(proto, $scope, bound) {
    var targets = []
    for (var action of proto["ibactions"] || []) {
        if (_isKeyboardAction(action)) { continue }
        var found = $scope.find(action.selector)
        for (var i = 0; i < found.length; i++) {
            if (!_isClaimed(found[i], action.selector, bound)) { targets.push(found[i]) }
        }
    }
    return targets
}

function _isClaimed(target, selector, bound) {
    for (var responder of bound) {
        if (!_declaresAction(responder, selector)) { continue }
        var $el = responder._$el || $(responder.selector)
        for (var i = 0; i < $el.length; i++) {
            if ($el[i] === target || $el[i].contains(target)) { return true }
        }
    }
    return false
}

function _declaresAction(responder, selector) {
    for (var action of responder["ibactions"] || []) {
        if (action.selector === selector) { return true }
    }
    return false
}

function _hasMoreDerived(candidate, candidates) {
    for (var other of candidates) {
        if (other === candidate || !candidate.proto.isPrototypeOf(other.proto)) { continue }
        if (other.targets.some(function(target) { return candidate.targets.indexOf(target) !== -1 })) { return true }
    }
    return false
}

// Key commands follow the responder chain: the deepest bound responder that
// contains the focused element handles the key first, and the key only
// travels up when that handler returns false. Responders that do not contain
// the focused element all receive it, as a window-level key command would.
var _keyBindings = []

function _bindKeyboardAction(control, action) {
    var keyboardIndex = action.selector.indexOf(keyboardPrefix)
    var modifiers = action.selector.slice(0, keyboardIndex).split("+").filter(Boolean)
    control._disposed = false
    _keyBindings.push({
        control: control,
        method: action.method,
        key: action.selector.slice(keyboardIndex + keyboardPrefix.length),
        modifiers: modifiers,
        requiresMeta: modifiers.indexOf("meta") !== -1,
        requiresShift: modifiers.indexOf("shift") !== -1,
        requiresAlt: modifiers.indexOf("alt") !== -1,
        requiresCtrl: modifiers.indexOf("ctrl") !== -1,
    })
    var selector = (e) => {
        if (e._cocoaTouchKeyDispatched) { return }
        e._cocoaTouchKeyDispatched = true
        _dispatchKey(e)
    }
    NotificationCenter.default.addObserver(control, {selector: selector, name: "keydown", object: document})
}

function _keyMatches(binding, e) {
    if (e.key !== binding.key) { return false }
    if (binding.modifiers.length === 0) { return true }
    return binding.requiresMeta === e.metaKey && binding.requiresShift === e.shiftKey && binding.requiresAlt === e.altKey && binding.requiresCtrl === e.ctrlKey
}

// A text input that is first responder consumes the characters typed into it,
// so a key command with no modifiers never fires while one has the focus.
const textInputs = /^(input|textarea|select)$/i

function _isTypedInto(binding, active) {
    if (!active || binding.modifiers.length > 0 || binding.key.length !== 1) { return false }
    return textInputs.test(active.tagName || "") || active.isContentEditable === true
}

function _elementOf(control) {
    var $el = control.view ? control.view.$el : (control._$el || $(control.selector))
    return $el && $el[0] ? $el[0] : null
}

function _depth(element) {
    var depth = 0
    while (element.parentNode) { depth += 1; element = element.parentNode }
    return depth
}

function _dispatchKey(e) {
    _keyBindings = _keyBindings.filter(function(binding) { return !binding.control._disposed })
    var active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null
    var matching = _keyBindings.filter(function(binding) { return _keyMatches(binding, e) && !_isTypedInto(binding, active) })
    if (matching.length === 0) { return }
    e.preventDefault()
    var chain = [], others = []
    for (var binding of matching) {
        var element = active ? _elementOf(binding.control) : null
        var contains = element && typeof element.contains === "function" && element.contains(active)
        if (contains) { chain.push({binding: binding, depth: _depth(element)}); continue }
        others.push(binding)
    }
    chain.sort(function(a, b) { return b.depth - a.depth })
    for (var link of chain) {
        var handled = _perform(link.binding, e)
        if (handled) { return }
    }
    for (var other of others) { _perform(other, e) }
}

function _perform(binding, e) {
    var method = binding.control[binding.method]
    if (!method) { return false }
    return method.call(binding.control, e) !== false
}
