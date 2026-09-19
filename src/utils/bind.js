import { UIViewController } from "../uikit/uiviewcontroller.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"


export class Bind {

    static _restorePrototypes = new Set()

    static registerPrototypeForRestore(prototype) {
        Bind._restorePrototypes.add(prototype)
    }

    // Views added at runtime through addSubview are not outlets of the
    // controller, so on a pre-rendered page they are found again by their
    // action selectors. Only prototypes with an action target present in the
    // page are revived; controllers are restored explicitly by restore().
    static restoreRegisteredViews($scope, owner) {
        for (var proto of Bind._restorePrototypes) {
            if (proto instanceof UIViewController) { continue }
            if (!_hasActionTargetIn(proto, $scope)) { continue }
            var instance = Object.create(proto)
            instance._$el = $scope
            owner._link(instance)
            Bind.ibOutletRestore(instance)
            Bind.ibAction(instance)
            if (proto.hasOwnProperty("didMoveToWindow")) {
                instance.didMoveToWindow()
            }
        }
    }

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
            $parent.find(action.selector).each(function() {
                var id = $(this).attr("id")
                var sender = new action.cls(`${control.selector} #${id}`)
                sender._$el = $(this)
                sender.$el.off("click").on("click", (e) => {
                    var method = action.method
                    if (control[method]) {
                        e.preventDefault()
                        control[method](sender)
                    }
                })
            })
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

            var responder = new cls(`${control.selector} ${selector}`)
            responder._$el = $parent.find(selector)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
                Bind.ibOutlet(responder)
            }

            if (responder.constructor.prototype.hasOwnProperty("awakeFromNib")) {
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

            var responder = new cls(`${control.selector} ${selector}`)
            responder._$el = $parent.find(selector)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
                Bind.ibOutletRestore(responder)
            }

            if (responder.constructor.prototype.hasOwnProperty("didMoveToWindow")) {
                responder.didMoveToWindow()
            }

            if (responder["ibactions"] && responder["ibactions"].length > 0) {
                Bind.ibAction(responder)
            }
        }
    }
}


// An outlet found by class gets a stable id from its owner and property
// name, so two nib-drawn fields on one page stay distinguishable.
function _identifyOutlet(owner, responder, property) {
    var $el = responder._$el
    if (!$el || $el.length !== 1 || $el.attr("id")) { return }
    var id = owner.identifier + "-" + property.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
    $el.attr("id", id)
    responder.selector = "#" + id
    responder._identifier = id
}

const KEYBOARD_PREFIX = "keyboard:"

function _isKeyboardAction(action) {
    return action.selector.indexOf(KEYBOARD_PREFIX) !== -1
}

function _hasActionTargetIn(proto, $scope) {
    for (var action of proto["ibactions"] || []) {
        if (_isKeyboardAction(action)) { continue }
        if ($scope.find(action.selector).length > 0) { return true }
    }
    return false
}

// Key commands follow the responder chain: the deepest bound responder that
// contains the focused element handles the key first, and the key only
// travels up when that handler returns false. Responders that do not contain
// the focused element all receive it, as a window-level key command would.
var _keyBindings = []

function _bindKeyboardAction(control, action) {
    var keyboardIndex = action.selector.indexOf(KEYBOARD_PREFIX)
    var modifiers = action.selector.slice(0, keyboardIndex).split("+").filter(Boolean)
    control._disposed = false
    _keyBindings.push({
        control: control,
        method: action.method,
        key: action.selector.slice(keyboardIndex + KEYBOARD_PREFIX.length),
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
    var matching = _keyBindings.filter(function(binding) { return _keyMatches(binding, e) })
    if (matching.length === 0) { return }
    e.preventDefault()
    var active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null
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
