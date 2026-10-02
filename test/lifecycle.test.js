import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { keydown } from "./setup.js"
import { UIResponder, UIView, UIViewController, IBAction, UIKeyCommand, NotificationCenter } from "../src/index.js"
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
    assert.equal(owner.view.subviews[0].parentViewController(), owner)
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
    assert.equal(child.view.parentViewController(), child)
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
