import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { keydown } from "./setup.js"
import { UIResponder, UIView, UIViewController, IBAction, Keyboard, NSNotificationCenter } from "../src/index.js"
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

test("addSubviews links every child", function() {
    var parent = new UIView("#parent")
    var a = new UIView("#a")
    var b = new UIView("#b")
    parent.addSubviews([a, b])
    assert.deepEqual(parent.subviews, [a, b])
    assert.equal(b.next, parent)
})

test("parentViewController walks the chain up to the controller", function() {
    var controller = new UIViewController()
    var outer = new UIView("#outer")
    var inner = new UIView("#inner")
    controller.view.addSubview(outer)
    outer.addSubview(inner)
    assert.equal(inner.parentViewController(), controller)
    assert.equal(new UIView("#orphan").parentViewController(), null)
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
    NSNotificationCenter.addObserver(first, {selector: function() { hits.controller += 1 }, name: "tick", object: target})
    NSNotificationCenter.addObserver(view, {selector: function() { hits.view += 1 }, name: "tick", object: target})
    NSNotificationCenter.addObserver(nested, {selector: function() { hits.nested += 1 }, name: "tick", object: target})
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
    IBAction(Keyboard.escape)(First.prototype, "escapePressed", {})
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

test("restore runs viewWillAppear and viewDidAppear but not viewDidLoad", function() {
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
    View.prototype.viewWillAppear = function() { log.push(name) }
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
    assert.equal(owner.view.subviews[0].parentViewController(), owner)
})

test("a keyboard-only view is not revived by selector scan", function() {
    Bind._restorePrototypes.clear()
    var log = []
    class View extends UIView {}
    IBAction(Keyboard.enter)(View.prototype, "enterPressed", {})
    View.prototype.viewWillAppear = function() { log.push("keyboard") }
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
