import { UIViewController } from "../uikit/uiviewcontroller.js"
import { UIView } from "../uikit/uiview.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { inspectableValue } from "../uikit/ibinspectable.js"
import { UIDevice } from "../uikit/uidevice.js"
import { outletIndexFor, outletElement } from "./outletindex.js"
import { outletElementClass } from "../uikit/iboutlet.js"
import { ownElement, ownerOf } from "./elementowner.js"
import { controlEventNames } from "./controlevents.js"
import { UIControlEvent } from "../uikit/uicontrolevent.js"


export class Bind {

    static _restorePrototypes = new Set()

    // {cls, selector, $el} of the view a creator is inside `new` for. The view's own
    // constructor fills its empty element but leaves binding to the creator, so
    // awakeFromNib arrives once, after the subclass's fields exist. The previous
    // marker is restored, not cleared: an outlet bound from inside a view's
    // init() goes through here too, and clearing would hand the outer view back
    // to its own constructor for a second bind.
    static _constructing = null

    static construct(cls, selector, $el, ...rest) {
        var previous = Bind._constructing
        Bind._constructing = {cls: cls, selector: selector, $el: $el}
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

    // The element the creator already holds for the view being constructed, so
    // the constructor does not look it up again through its selector: for a
    // repeated id that lookup is a query over the whole document.
    static elementUnderConstruction(view) {
        return Bind.isConstructing(view) ? Bind._constructing.$el : null
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
            Bind.ibAction(instance, {isRestoring: true})
            if (_overrides(instance, "didMoveToWindow")) {
                instance.didMoveToWindow()
            }
        }
    }

    // An action binds under its own namespace, beside any target the app adds
    // to the same element; binding twice over one element leaves one handler,
    // since a row element outlives the cell bound to it on the previous reload.
    // A matched element without an id is given one, as an outlet is, so the
    // sender's selector resolves again when its node is replaced. A restored
    // page binds its senders the way ibOutletRestore binds an outlet. The
    // action listens for the event Interface Builder connects for the sender's
    // class, Value Changed for a switch, Editing Did End for a text field, Touch
    // Up Inside for the rest, and runs with the sender as its one argument.
    static ibAction(control, {isRestoring = false} = {}) {
        if (!control) { return }
        var actions = control["ibactions"] || []
        if (actions.length === 0) { return }
        var $parent = control._$el || $(control.selector)
        var index = outletIndexFor($parent, actions)
        for (const action of actions) {
            if (_isKeyboardAction(action)) {
                _bindKeyboardAction(control, action)
                continue
            }
            var unnamed = 0
            var eventName = controlEventNames[_interfaceBuilderEvent(action.cls)]
            outletElement({selector: action.selector, $parent, index}).each(function() {
                var $target = $(this)
                if (!$target.attr("id")) {
                    $target.attr("id", _dashed(control.identifier, action.method) + "-" + (++unnamed))
                }
                var sender = _sender(control, action, $target, {isRestoring})
                var namespaced = eventName + ".ibaction"
                $target.off(namespaced).on(namespaced, (e) => {
                    var method = action.method
                    if (!control[method]) { return }
                    // A checkbox or radio toggles itself on a click, and the action
                    // then reads the new state; cancelling the click would undo it.
                    // Anchors and buttons keep the cancel, which is what stops an
                    // app action from navigating or submitting a form.
                    if (eventName === "click" && !_togglesItself(e.target)) { e.preventDefault() }
                    if (_isDisabledControl(sender, $target[0])) { return }
                    control[method](sender)
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
        var index = outletIndexFor($parent, outlets)

        for (const outlet of outlets) {
            var cls = outlet.cls
            var method = outlet.method
            var selector = outlet.selector

            var $el = outletElement({selector, $parent, index})
            if (Array.isArray(cls)) {
                _bindCollection(control, {outlet, $el, isRestoring: false})
                continue
            }
            var responder = Bind.construct(cls, `${control.selector} ${selector}`, $el)
            responder._$el = $el
            ownElement($el, responder)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            _finishOutlet(responder, {isRestoring: false})
        }
    }

    static ibOutletRestore(control) {
        if (!control) { return }
        var outlets = control["iboutlets"] || []
        if (outlets.length === 0) { return }

        var $parent = control._$el || $(control.selector)
        var index = outletIndexFor($parent, outlets)

        for (const outlet of outlets) {
            var cls = outlet.cls
            var method = outlet.method
            var selector = outlet.selector

            var $el = outletElement({selector, $parent, index})
            if (Array.isArray(cls)) {
                _bindCollection(control, {outlet, $el, isRestoring: true})
                continue
            }
            var responder = Bind.construct(cls, `${control.selector} ${selector}`, $el)
            responder._$el = $el
            ownElement($el, responder)
            _identifyOutlet(control, responder, method)
            control._link(responder)

            Object.defineProperty(control, method, {value: responder, writable: true})

            _finishOutlet(responder, {isRestoring: true})
        }
    }
}


// What a bound outlet does once it is linked and reachable from its owner, one
// path for a single outlet and for each element of a collection. A fresh bind
// awakes it; a restored page, whose prerenderer already awoke it, only tells it
// it is in the window.
function _finishOutlet(responder, {isRestoring}) {
    if (responder["iboutlets"] && responder["iboutlets"].length > 0) {
        isRestoring ? Bind.ibOutletRestore(responder) : Bind.ibOutlet(responder)
    }
    Bind.ibInspectable(responder)
    var hook = isRestoring ? "didMoveToWindow" : "awakeFromNib"
    if (_overrides(responder, hook)) {
        responder[hook]()
    }
    if (responder["ibactions"] && responder["ibactions"].length > 0) {
        Bind.ibAction(responder, {isRestoring})
    }
    _appear(responder, {isRestoring})
}


// Swift's outlet collection: one view per element the selector matched, in
// document order, the array complete before any element's hooks run so an
// awakeFromNib can read its siblings. An element without an id is given
// `<owner id>-<property>-<position>`, as an @IBAction sender is, so each view
// stays addressable. Refused up front, before anything is bound, when an
// element is already owned by another outlet of this same owner: one element
// has one owner, and a collection silently stealing it would leave the first
// outlet bound to a node it no longer drives.
function _bindCollection(control, {outlet, $el, isRestoring}) {
    var elementClass = outletElementClass(outlet)
    var elements = $el.toArray()
    for (var element of elements) {
        _rejectCollectionOverOwned(control, outlet, ownerOf(element))
    }
    var responders = elements.map(function(element, position) {
        var $item = $(element)
        if (!element.id) { $item.attr("id", _dashed(control.identifier, outlet.method) + "-" + (position + 1)) }
        var responder = Bind.construct(elementClass, `${control.selector} #${element.id}`, $item)
        responder._$el = $item
        ownElement($item, responder)
        control._link(responder)
        return responder
    })
    Object.defineProperty(control, outlet.method, {value: responders, writable: true})
    for (var responder of responders) {
        _finishOutlet(responder, {isRestoring})
    }
}


// An owner counts as this control's own when the control sits on its responder
// chain, which holds for an outlet, and for anything bound inside one. The
// owner a previous cell left on a reused row element does not: that cell is
// not above the one binding now, so the new cell takes the element over.
function _rejectCollectionOverOwned(control, outlet, owner) {
    for (var at = owner; at; at = at.next) {
        if (at !== control && at !== control.view) { continue }
        throw new TypeError(
            `@IBOutlet("${outlet.selector}", [${outletElementClass(outlet).name}]) ${outlet.method} matches an element ` +
            `${owner.constructor.name} already owns. One element has one owner: give the collection a selector that ` +
            `leaves that element out, or drop the outlet that holds it.`
        )
    }
}


// A controller bound as an outlet is a container view in all but name, so
// once its own bindings are in place it appears, as an embedded child does.
// On a restored page the prerenderer loaded it, so viewDidLoad is not sent
// again, the one rule restore() follows for the root. It is not added to
// children: _layoutTree already reaches it through the view tree, and a
// child entry would send viewWillTransition twice.
function _appear(responder, {isRestoring}) {
    if (!(responder instanceof UIViewController)) { return }
    responder._isViewLoaded = true
    if (!isRestoring) {
        responder._viewDidLoad()
        responder.viewDidLoad()
    }
    responder.viewWillAppear(false)
    responder.viewDidAppear(false)
}


// The sender is the view that owns the element, as Apple's sender is the
// control itself: an outlet and its action hand over one object. An element
// nobody owns yet gets a sender bound like an outlet, lent the element it was
// matched on, since its own selector is a descendant one that $el would
// otherwise answer with a query over the whole document; one owned by a view
// of another class gets a sender built to be handed to the handler and
// nothing else.
function _sender(control, action, $target, {isRestoring}) {
    var owner = ownerOf($target[0])
    if (owner && action.cls && owner instanceof action.cls) { return owner }
    _rejectNibOverOwnedElement(owner, action)
    var sender = Bind.construct(action.cls, `${control.selector} #${$target.attr("id")}`, $target)
    sender._$el = $target
    if (!owner) {
        _awakeSender(sender, {isRestoring})
    }
    return sender
}

function _interfaceBuilderEvent(cls) {
    return (cls && cls._interfaceBuilderEvent) || UIControlEvent.touchUpInside
}


// construct() holds the marker that makes a view's own nib loading leave
// binding to its creator, so a sender class carrying a nib is bound here in
// the order ibOutlet binds an outlet, or ibOutletRestore on a restored page,
// where the prerenderer already ran awakeFromNib and the client sends
// didMoveToWindow in its place.
function _awakeSender(sender, {isRestoring}) {
    ownElement(sender._$el, sender)
    var hook = isRestoring ? "didMoveToWindow" : "awakeFromNib"
    if (isRestoring) { Bind.ibOutletRestore(sender) }
    if (!isRestoring) { Bind.ibOutlet(sender) }
    Bind.ibInspectable(sender)
    if (_overrides(sender, hook)) {
        sender[hook]()
    }
    Bind.ibAction(sender, {isRestoring})
}


// A sender class carrying a nib asserts that the element's contents are its
// own, and UIView's nib loading fills an empty element before it learns who is
// constructing it. Over an element another class already owns that would write
// one view's nib inside another's element and leave it unawoken, a state no
// released version ever produced. The same class owning it is the ordinary nib
// wiring, where the outlet already loaded that nib, so it is allowed.
function _rejectNibOverOwnedElement(owner, action) {
    if (!owner || !action.cls || !action.cls.nib) { return }
    if (owner instanceof action.cls) { return }
    throw new TypeError(
        `@IBAction("${action.selector}", ${action.cls.name}) matches an element ${owner.constructor.name} already owns, ` +
        `and ${action.cls.name} carries a nib. One element has one owner: declare the action with the class that owns ` +
        `the element, or give the action an element of its own.`
    )
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
const priorityFlag = "priority"

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
    var flags = action.selector.slice(0, keyboardIndex).split("+").filter(Boolean)
    var modifiers = flags.filter(function(flag) { return flag !== priorityFlag })
    control._disposed = false
    _keyBindings.push({
        control: control,
        method: action.method,
        key: action.selector.slice(keyboardIndex + keyboardPrefix.length),
        wantsPriority: flags.indexOf(priorityFlag) !== -1,
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

function _togglesItself(element) {
    return !!element && element.tagName === "INPUT" && (element.type === "checkbox" || element.type === "radio")
}

// A disabled control receives no touches, so no action of it runs; sendActions(for:)
// is a direct call and does. The sender is one view over the element and an outlet
// may be another, so the flag is read from both, and a UIControl's isEnabled reads
// the element's own disabled state. A sender that is no UIControl is never gated.
function _isDisabledControl(sender, element) {
    if (!_isControl(sender)) { return false }
    if (sender._isSendingActions) { return false }
    var owner = ownerOf(element)
    if (_isControl(owner) && owner._isSendingActions) { return false }
    return sender.isEnabled === false
}

// UIControl is told by its target-action methods: this module is loaded by
// UIView, which UIControl extends, so it cannot import the class.
function _isControl(view) {
    return !!view && typeof view.addTarget === "function" && typeof view.sendActions === "function"
}

// Command exists on Apple hardware only. Elsewhere the Control key carries the
// same shortcuts (Ctrl+F, Ctrl+K) and the Windows or Super key belongs to the OS.
const commandKeyPlatforms = /^(Mac|iPhone|iPad|iPod)/i

// Read per keydown, not cached at load: a test stands in a platform through
// UIDevice._current, and one anchored regex per keystroke is not worth a cache.
function _usesCommandKey() {
    return commandKeyPlatforms.test(UIDevice.current.systemName)
}

// null when the event is not the binding's chord. "substituted" marks a chord
// that matched through Control standing in for Command, so a twin binding on
// Control itself can be told apart and not run twice.
function _matchKind(binding, e, usesCommandKey) {
    if (e.key !== binding.key) { return null }
    if (binding.modifiers.length === 0) { return "native" }
    if (usesCommandKey) {
        var matches = binding.requiresMeta === e.metaKey && binding.requiresShift === e.shiftKey && binding.requiresAlt === e.altKey && binding.requiresCtrl === e.ctrlKey
        return matches ? "native" : null
    }
    if (binding.requiresMeta && binding.requiresCtrl) { return null }
    if (e.metaKey) { return null }
    var effectiveCtrl = binding.requiresCtrl || binding.requiresMeta
    if (e.ctrlKey !== effectiveCtrl || e.shiftKey !== binding.requiresShift || e.altKey !== binding.requiresAlt) { return null }
    return binding.requiresMeta ? "substituted" : "native"
}

// A text input that is first responder consumes the characters typed into it
// and the delete keys, so a key command with no modifiers on one of those never
// fires while one has the focus, unless it wantsPriorityOverSystemBehavior.
const textInputs = /^(input|textarea|select)$/i
const textConsumedKeys = ["Backspace", "Delete"]

function _isTypedInto(binding, active) {
    if (!active || binding.wantsPriority || binding.modifiers.length > 0) { return false }
    if (binding.key.length !== 1 && textConsumedKeys.indexOf(binding.key) === -1) { return false }
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

// Off Apple, Ctrl+K reaches a .command binding by substitution and a .control
// binding natively, so a control that declares both for one chord would run
// twice for one keystroke. The native one wins: it is what the author wrote
// for Control. It must itself require Control, or a binding with no modifiers
// would count as a twin and swallow the substituted command.
function _withoutTwins(matching, kinds) {
    var natives = matching.filter(function(binding) { return kinds.get(binding) === "native" && binding.requiresCtrl && !binding.requiresMeta })
    if (natives.length === 0) { return matching }
    return matching.filter(function(binding) {
        if (kinds.get(binding) !== "substituted") { return true }
        return !natives.some(function(twin) {
            return twin.control === binding.control && twin.key === binding.key && twin.requiresShift === binding.requiresShift && twin.requiresAlt === binding.requiresAlt
        })
    })
}

function _dispatchKey(e) {
    _keyBindings = _keyBindings.filter(function(binding) { return !binding.control._disposed })
    var active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null
    var usesCommandKey = _usesCommandKey()
    var kinds = new Map()
    var matching = _keyBindings.filter(function(binding) {
        var kind = _matchKind(binding, e, usesCommandKey)
        if (kind === null || _isTypedInto(binding, active)) { return false }
        kinds.set(binding, kind)
        return true
    })
    matching = _withoutTwins(matching, kinds)
    if (matching.length === 0) { return }
    if (matching.some(function(binding) { return !binding.wantsPriority })) {
        e.preventDefault()
        e._cocoaTouchKeyClaimed = true
    }
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
        if (handled) { return _consume(link.binding, e) }
    }
    for (var other of others) {
        if (_perform(other, e)) { _consume(other, e) }
    }
}

// A command that wants priority prevents the system's behaviour only when it
// acted: a handler that declines, returning false, leaves the key to the text
// field it was typed into.
function _consume(binding, e) {
    if (binding.wantsPriority) { e.preventDefault() }
}

function _perform(binding, e) {
    var method = binding.control[binding.method]
    if (!method) { return false }
    return method.call(binding.control, e) !== false
}
