import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { keydown } from "./setup.js"
import { UIResponder, UIView, UIViewController, UIScreen, IBOutlet, IBAction, UIKeyCommand, NotificationCenter } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


function recordingController(name, log) {
    class Controller extends UIViewController {}
    var hooks = ["viewDidLoad", "viewWillAppear", "viewDidAppear", "viewWillDisappear", "viewDidDisappear"]
    hooks.forEach(function(hook) {
        Controller.prototype[hook] = function() { log.push(name + "." + hook) }
    })
    Controller.nib = "<div id=\"" + name + "\"></div>"
    return Controller
}

test("a view looks its element up again once the cached one has left the document", function() {
    var view = new UIView("#icon")
    var stale = {0: {isConnected: false}, length: 1}
    view._$el = stale
    assert.notEqual(view.$el, stale)
    var live = {0: {isConnected: true}, length: 1}
    view._$el = live
    assert.equal(view.$el, live)
})

test("a window resize reaches the root controller, its children and the layout of their bound views", function() {
    var log = []
    var Controller = recordingController("page", [])
    Controller.prototype.viewWillTransition = function({to: size, with: coordinator}) { log.push("page " + size.width + "x" + size.height); coordinator.animate({alongsideTransition: () => log.push("alongside"), completion: () => log.push("done")}) }
    var controller = new Controller()
    var Child = recordingController("child", [])
    Child.prototype.viewWillTransition = function({to: size}) { log.push("child " + size.width) }
    var child = new Child()
    controller.addChild(child)
    var outlet = new UIView("#outlet")
    outlet.layoutSubviews = function() { log.push("outlet layout") }
    var nested = new UIView("#nested")
    nested.layoutSubviews = function() { log.push("nested layout") }
    outlet.addSubview(nested)
    controller._link(outlet)
    var Embedded = recordingController("embedded", [])
    Embedded.prototype.viewWillTransition = function({to: size}) { log.push("embedded " + size.height) }
    controller._link(new Embedded())
    controller.present(controller, {})
    log.length = 0
    window.innerWidth = 1024; window.innerHeight = 700
    window.dispatchEvent(new Event("resize"))
    assert.deepEqual(log, ["page 1024x700", "alongside", "done", "child 1024", "outlet layout", "nested layout", "embedded 700"])
    assert.equal(UIScreen.main.bounds.width, 1024)
})

test("responders start with no next responder", function() {
    assert.equal(new UIResponder("#r").next, null)
    assert.equal(new UIView("#v").superview, null)
})

test("addSubview links the child into the responder chain", function() {
    var parent = new UIView("#parent")
    var child = new UIView("#child")
    parent.addSubview(child)
    assert.equal(child.superview, parent)
    assert.equal(child.next, parent)
    assert.deepEqual(parent.subviews, [child])
})


// The responder chain is Apple's mechanism for reaching the enclosing
// controller; the package carries no parentViewController() convenience.
function enclosingController(view) {
    var responder = view.next
    while (responder && !(responder instanceof UIViewController)) { responder = responder.next }
    return responder || null
}

test("next walks the chain up to the controller", function() {
    var controller = new UIViewController()
    var outer = new UIView("#outer")
    var inner = new UIView("#inner")
    controller.view.addSubview(outer)
    outer.addSubview(inner)
    assert.equal(enclosingController(inner), controller)
    assert.equal(enclosingController(new UIView("#orphan")), null)
    assert.equal(UIView.prototype.parentViewController, undefined)
})

test("a controller has one root view whose next responder is the controller", function() {
    var controller = new UIViewController()
    assert.equal(controller.view, controller.view)
    assert.equal(controller.view.next, controller)
})

test("present runs viewDidLoad, viewWillAppear, viewDidAppear then completion", function() {
    var log = []
    var Controller = recordingController("first", log)
    var controller = new Controller()
    controller.present(controller, {animated: false, completion: function() { log.push("completion") }})
    assert.deepEqual(log, ["first.viewDidLoad", "first.viewWillAppear", "first.viewDidAppear", "completion"])
})

test("presenting again tears the previous controller down first", function() {
    var log = []
    var First = recordingController("first", log)
    var Second = recordingController("second", log)
    var first = new First()
    first.present(first, {})
    log.length = 0
    var second = new Second()
    second.present(second, {})
    assert.deepEqual(log, [
        "first.viewWillDisappear",
        "first.viewDidDisappear",
        "second.viewDidLoad",
        "second.viewWillAppear",
        "second.viewDidAppear"
    ])
})

// jQuery's ready runs on a later tick in the browser; the stub runs it inline.
// This holds the callbacks back so two present() calls can land in one window.
function withDeferredReady(run) {
    var pending = []
    var original = globalThis.$
    globalThis.$ = function(html) {
        var el = original(html)
        el.ready = function(callback) { pending.push(callback); return el }
        return el
    }
    try { run() } finally { globalThis.$ = original }
    return function flush() { pending.splice(0).forEach(function(callback) { callback() }) }
}

test("a controller superseded before its ready tick never loads and releases its observers", function() {
    var log = []
    var target = new EventTarget()
    var hits = 0
    var First = recordingController("first", log)
    var Second = recordingController("second", log)
    var first = new First()
    var second = new Second()
    NotificationCenter.default.addObserver(first, {selector: function() { hits += 1 }, name: "tick", object: target})
    var flush = withDeferredReady(function() {
        first.present(first, {completion: function() { log.push("first.completion") }})
        second.present(second, {completion: function() { log.push("second.completion") }})
    })
    flush()
    target.dispatchEvent(new Event("tick"))
    assert.deepEqual(log, ["second.viewDidLoad", "second.viewWillAppear", "second.viewDidAppear", "second.completion"])
    assert.equal(hits, 0)
    assert.equal(first.isViewLoaded, false)
    assert.equal(second.isViewLoaded, true)
})

test("teardown removes observers owned by the controller and its whole view tree", function() {
    var target = new EventTarget()
    var hits = {controller: 0, view: 0, nested: 0}
    var First = recordingController("first", [])
    var first = new First()
    first.present(first, {})
    var view = new UIView("#view")
    var nested = new UIView("#nested")
    first.view.addSubview(view)
    view.addSubview(nested)
    NotificationCenter.default.addObserver(first, {selector: function() { hits.controller += 1 }, name: "tick", object: target})
    NotificationCenter.default.addObserver(view, {selector: function() { hits.view += 1 }, name: "tick", object: target})
    NotificationCenter.default.addObserver(nested, {selector: function() { hits.nested += 1 }, name: "tick", object: target})
    target.dispatchEvent(new Event("tick"))
    var Second = recordingController("second", [])
    var second = new Second()
    second.present(second, {})
    target.dispatchEvent(new Event("tick"))
    assert.deepEqual(hits, {controller: 1, view: 1, nested: 1})
})

test("keyboard actions stop firing once their controller is dismissed", function() {
    var pressed = 0
    var First = recordingController("first", [])
    IBAction(UIKeyCommand.inputEscape)(First.prototype, "escapePressed", {})
    First.prototype.escapePressed = function() { pressed += 1 }
    var first = new First()
    first.present(first, {})
    keydown("Escape")
    assert.equal(pressed, 1)
    var Second = recordingController("second", [])
    var second = new Second()
    second.present(second, {})
    keydown("Escape")
    assert.equal(pressed, 1)
})

test("restore runs viewWillAppear and viewDidAppear, not viewDidLoad", function() {
    var log = []
    var Controller = recordingController("restored", log)
    var controller = new Controller()
    controller.restore(controller)
    assert.deepEqual(log, ["restored.viewWillAppear", "restored.viewDidAppear"])
})

function scopeMatching(selectors) {
    return {
        length: 1,
        find: function(selector) {
            return {length: selectors.indexOf(selector) === -1 ? 0 : 1, each: function() {}}
        }
    }
}

function registeredView(selector, log, name) {
    class View extends UIView {}
    IBAction(selector, UIView)(View.prototype, "tapped", {})
    View.prototype.didMoveToWindow = function() { log.push(name) }
    return View
}

test("restore revives only views with a matching action selector in the page", function() {
    Bind._restorePrototypes.clear()
    var log = []
    registeredView(".present", log, "present")
    registeredView(".absent", log, "absent")
    Bind.restoreRegisteredViews(scopeMatching([".present"]), new UIViewController())
    assert.deepEqual(log, ["present"])
})

test("restore never revives view controllers by page scan", function() {
    Bind._restorePrototypes.clear()
    var log = []
    var Controller = recordingController("other", log)
    IBAction("#everywhere", UIView)(Controller.prototype, "tapped", {})
    Bind.restoreRegisteredViews(scopeMatching(["#everywhere"]), new UIViewController())
    assert.deepEqual(log, [])
})

test("restored views join the owning controller's view tree", function() {
    Bind._restorePrototypes.clear()
    registeredView(".present", [], "present")
    var owner = new UIViewController()
    Bind.restoreRegisteredViews(scopeMatching([".present"]), owner)
    assert.equal(owner.view.subviews.length, 1)
    assert.equal(enclosingController(owner.view.subviews[0]), owner)
})

test("a keyboard-only view is not revived by selector scan", function() {
    Bind._restorePrototypes.clear()
    var log = []
    class View extends UIView {}
    IBAction(UIKeyCommand.inputReturn)(View.prototype, "enterPressed", {})
    View.prototype.didMoveToWindow = function() { log.push("keyboard") }
    Bind.restoreRegisteredViews(scopeMatching([]), new UIViewController())
    assert.deepEqual(log, [])
})

test("a host element that already has an id keeps it and becomes the controller's selector", function() {
    var Controller = recordingController("hosted", [])
    var controller = new Controller()
    var host = $("cocoatouch")
    host.attr = function(name, value) { if (value === undefined) { return "container" } return host }
    host.prop = function(name, value) { throw new Error("id must not be overwritten") }
    var original = globalThis.$
    globalThis.$ = function(selector) { return selector === "cocoatouch" ? host : original(selector) }
    controller.present(controller, {})
    globalThis.$ = original
    assert.equal(controller.selector, "#container")
    assert.equal(controller.identifier, "container")
})

function containerStub() {
    var el = $("<div></div>")
    el.attr = function(name, value) { if (value === undefined) { return "" } return el }
    return el
}

test("a child controller fills its container view and runs its lifecycle", function() {
    var log = []
    var Parent = recordingController("parent", log)
    var Child = recordingController("child", log)
    var parent = new Parent()
    var child = new Child()
    var container = new UIView("#content")
    container._$el = containerStub()
    parent.addChild(child)
    assert.deepEqual(parent.children, [child])
    assert.equal(child.parent, parent)
    assert.equal(child.next, parent)
    container.addSubview(child.view)
    assert.deepEqual(log, ["child.viewDidLoad", "child.viewWillAppear", "child.viewDidAppear"])
    assert.equal(child.selector, "#content")
    assert.ok(container._$el.html().indexOf("<div id=\"child\"></div>") !== -1)
    assert.equal(enclosingController(child.view), child)
})

test("removing a child empties its container, tears it down and releases its observers", function() {
    var log = []
    var hits = 0
    var target = new EventTarget()
    var Parent = recordingController("parent", log)
    var Child = recordingController("child", log)
    var parent = new Parent()
    var child = new Child()
    var container = new UIView("#content")
    container._$el = containerStub()
    parent.addChild(child)
    container.addSubview(child.view)
    NotificationCenter.default.addObserver(child, {selector: function() { hits += 1 }, name: "tick", object: target})
    log.length = 0
    child.removeFromParent()
    target.dispatchEvent(new Event("tick"))
    assert.deepEqual(log, ["child.viewWillDisappear", "child.viewDidDisappear"])
    assert.equal(hits, 0)
    assert.deepEqual(parent.children, [])
    assert.equal(child.parent, null)
    assert.equal(container._$el.html(), "")
})

test("disposing a parent disposes its children", function() {
    var hits = 0
    var target = new EventTarget()
    var parent = new UIViewController()
    var child = new UIViewController()
    parent.addChild(child)
    NotificationCenter.default.addObserver(child, {selector: function() { hits += 1 }, name: "tick", object: target})
    parent._dispose()
    target.dispatchEvent(new Event("tick"))
    assert.equal(hits, 0)
})

test("removeFromSuperview takes a plain view out of its superview", function() {
    var parent = new UIView("#parent")
    var child = new UIView("#child")
    parent.addSubview(child)
    child.removeFromSuperview()
    assert.deepEqual(parent.subviews, [])
    assert.equal(child.superview, null)
})

test("key commands go to the deepest responder holding focus and climb only when it returns false", function() {
    var log = []
    class Field extends UIView {}
    IBAction(UIKeyCommand.inputReturn)(Field.prototype, "enterPressed", {})
    class Page extends UIViewController {}
    IBAction(UIKeyCommand.inputReturn)(Page.prototype, "enterPressed", {})
    Page.prototype.enterPressed = function() { log.push("page") }
    var input = {parentNode: null}
    var fieldNode = {parentNode: null, contains: function(node) { return node === input }}
    var pageNode = {parentNode: null, contains: function(node) { return node === input }}
    fieldNode.parentNode = pageNode
    input.parentNode = fieldNode
    var page = new Page()
    page.view._$el = {0: pageNode, length: 1}
    Bind.ibAction(page)
    var field = new Field()
    field._$el = {0: fieldNode, length: 1}
    Field.prototype.enterPressed = function() { log.push("field") }
    Bind.ibAction(field)
    document.activeElement = input
    keydown("Enter")
    assert.deepEqual(log, ["field"])
    Field.prototype.enterPressed = function() { log.push("field"); return false }
    keydown("Enter")
    assert.deepEqual(log, ["field", "field", "page"])
    document.activeElement = null
    keydown("Enter")
    assert.deepEqual(log, ["field", "field", "page", "page", "field"])
    page._dispose()
    field._dispose()
})

// A container forwards the disappear pair to its children and to the
// controllers bound as its outlets, parent first, as UIKit's automatic
// forwarding does; a root swap must therefore tell the whole tree.
test("a root swap forwards the disappear pair to children and outlet controllers, then clears containment", function() {
    var log = []
    var hooks = ["viewWillDisappear", "viewDidDisappear"]
    function disappearing(name, Base) {
        class Controller extends (Base || UIViewController) {}
        hooks.forEach(function(hook) { Controller.prototype[hook] = function() { log.push(name + "." + hook) } })
        Controller.nib = "<div id=\"" + name + "\"></div>"
        return Controller
    }
    var Host = disappearing("host")
    var OutletController = disappearing("outletVC")
    IBOutlet("#host", OutletController)(Host.prototype, "outletController", {})
    var Child = disappearing("child")
    var host = new Host()
    host.present(host, {})
    var child = new Child()
    host.addChild(child)
    host.view.addSubview(child.view)
    var Next = recordingController("next", log)
    var next = new Next()
    log.length = 0
    next.present(next, {})
    assert.deepEqual(log, [
        "host.viewWillDisappear", "child.viewWillDisappear", "outletVC.viewWillDisappear",
        "host.viewDidDisappear", "child.viewDidDisappear", "outletVC.viewDidDisappear",
        "next.viewDidLoad", "next.viewWillAppear", "next.viewDidAppear",
    ])
    assert.equal(child.parent, null)
    assert.deepEqual(host.children, [])
})

test("removing an embedded child forwards the disappear pair to its own children", function() {
    var log = []
    function disappearing(name) {
        class Controller extends UIViewController {}
        ;["viewWillDisappear", "viewDidDisappear"].forEach(function(hook) { Controller.prototype[hook] = function() { log.push(name + "." + hook) } })
        Controller.nib = "<div id=\"" + name + "\"></div>"
        return Controller
    }
    var host = new (recordingController("host", []))()
    host.present(host, {})
    var child = new (disappearing("child"))()
    host.addChild(child)
    host.view.addSubview(child.view)
    var grandchild = new (disappearing("grandchild"))()
    child.addChild(grandchild)
    child.view.addSubview(grandchild.view)
    log.length = 0
    child.removeFromParent()
    assert.deepEqual(log, ["child.viewWillDisappear", "grandchild.viewWillDisappear", "child.viewDidDisappear", "grandchild.viewDidDisappear"])
    assert.equal(grandchild.parent, null)
    assert.deepEqual(child.children, [])
    assert.deepEqual(host.children, [])
})

// A controller bound as an @IBOutlet is a container view in all but name, so
// it receives the appearance lifecycle after its own bindings, and the
// disappear pair when its host goes; it is not a child and has no parent.
function outletControllerClass(log) {
    class OutletController extends UIViewController {}
    ;["awakeFromNib", "didMoveToWindow", "viewDidLoad", "viewWillAppear", "viewDidAppear", "viewWillDisappear", "viewDidDisappear"].forEach(function(hook) {
        OutletController.prototype[hook] = function() { log.push("outletVC." + hook) }
    })
    OutletController.prototype.viewWillTransition = function() { log.push("outletVC.viewWillTransition") }
    OutletController.nib = "<div id=\"inner\"></div>"
    return OutletController
}

test("a controller bound as an outlet receives awakeFromNib, viewDidLoad, viewWillAppear and viewDidAppear, and later its disappear pair", function() {
    var log = []
    var Host = recordingController("host", [])
    IBOutlet("#panel", outletControllerClass(log))(Host.prototype, "panel", {})
    var host = new Host()
    host.present(host, {})
    assert.deepEqual(log, ["outletVC.awakeFromNib", "outletVC.viewDidLoad", "outletVC.viewWillAppear", "outletVC.viewDidAppear"])
    assert.equal(host.panel.isViewLoaded, true)
    assert.deepEqual(host.children, [])
    assert.equal(host.panel.parent, null)
    log.length = 0
    window.innerWidth = 900; window.innerHeight = 700
    window.dispatchEvent(new Event("resize"))
    assert.deepEqual(log.filter((entry) => entry === "outletVC.viewWillTransition"), ["outletVC.viewWillTransition"])
    log.length = 0
    var next = new (recordingController("next", []))()
    next.present(next, {})
    assert.deepEqual(log, ["outletVC.viewWillDisappear", "outletVC.viewDidDisappear"])
})

test("a controller bound as an outlet of a restored controller receives didMoveToWindow, viewWillAppear and viewDidAppear, not viewDidLoad", function() {
    var log = []
    var Host = recordingController("host", [])
    IBOutlet("#panel", outletControllerClass(log))(Host.prototype, "panel", {})
    var host = new Host()
    host.restore(host)
    assert.deepEqual(log, ["outletVC.didMoveToWindow", "outletVC.viewWillAppear", "outletVC.viewDidAppear"])
    assert.equal(host.panel.isViewLoaded, true)
})

// The controller's full first appearance, with the animated flag present()
// was given and the layout pair around the layout pass, in Apple's order.
function appearingController(log) {
    class Controller extends UIViewController {}
    ;["viewDidLoad", "viewWillLayoutSubviews", "viewDidLayoutSubviews"].forEach(function(hook) {
        Controller.prototype[hook] = function() { log.push(hook) }
    })
    ;["viewWillAppear", "viewDidAppear"].forEach(function(hook) {
        Controller.prototype[hook] = function(animated) { log.push(hook + "(" + animated + ")") }
    })
    Controller.prototype.viewWillTransition = function() { log.push("viewWillTransition") }
    Controller.nib = "<div id=\"appearing\"></div>"
    return Controller
}

test("present(_, {animated: true}) sends viewDidLoad, viewWillAppear(true), the layout pair and viewDidAppear(true)", function() {
    var log = []
    var controller = new (appearingController(log))()
    controller.present(controller, {animated: true})
    assert.deepEqual(log, ["viewDidLoad", "viewWillAppear(true)", "viewWillLayoutSubviews", "viewDidLayoutSubviews", "viewDidAppear(true)"])
    log.length = 0
    var plain = new (appearingController(log))()
    plain.present(plain, {})
    assert.deepEqual(log, ["viewDidLoad", "viewWillAppear(false)", "viewWillLayoutSubviews", "viewDidLayoutSubviews", "viewDidAppear(false)"])
})

test("a resize sends the layout pair around the layout pass", function() {
    var log = []
    var controller = new (appearingController(log))()
    controller.present(controller, {})
    var outlet = new UIView("#outlet")
    outlet.layoutSubviews = function() { log.push("outlet.layoutSubviews") }
    controller._link(outlet)
    log.length = 0
    window.innerWidth = 1100; window.innerHeight = 700
    window.dispatchEvent(new Event("resize"))
    assert.deepEqual(log, ["viewWillTransition", "viewWillLayoutSubviews", "outlet.layoutSubviews", "viewDidLayoutSubviews"])
})
