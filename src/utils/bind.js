import { UIViewController } from "../uikit/uiviewcontroller.js"
import { NSNotificationCenter } from "../foundation/nsnotificationcenter.js"


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
            if (proto.hasOwnProperty("viewWillAppear")) {
                instance.viewWillAppear()
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
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
                Bind.ibOutletRestore(responder)
            }

            if (responder.constructor.prototype.hasOwnProperty("viewWillAppear")) {
                responder.viewWillAppear()
            }

            if (responder["ibactions"] && responder["ibactions"].length > 0) {
                Bind.ibAction(responder)
            }
        }
    }
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

// Key actions observe the document through their controller, so they are
// released with it instead of stacking up on every navigation.
function _bindKeyboardAction(control, action) {
    var keyboardIndex = action.selector.indexOf(KEYBOARD_PREFIX)
    var modifiers = action.selector.slice(0, keyboardIndex).split("+").filter(Boolean)
    var key = action.selector.slice(keyboardIndex + KEYBOARD_PREFIX.length)
    var requiresMeta = modifiers.indexOf("meta") !== -1
    var requiresShift = modifiers.indexOf("shift") !== -1
    var requiresAlt = modifiers.indexOf("alt") !== -1
    var requiresCtrl = modifiers.indexOf("ctrl") !== -1
    var selector = (e) => {
        if (e.key !== key) { return }
        if (modifiers.length > 0) {
            if (requiresMeta !== e.metaKey) { return }
            if (requiresShift !== e.shiftKey) { return }
            if (requiresAlt !== e.altKey) { return }
            if (requiresCtrl !== e.ctrlKey) { return }
        }
        e.preventDefault()
        var method = action.method
        if (control[method]) {
            control[method](e)
        }
    }
    NSNotificationCenter.addObserver(control, {selector: selector, name: "keydown", object: document})
}
