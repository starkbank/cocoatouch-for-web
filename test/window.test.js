import { page } from "./dom.js"
import { JSDOM } from "jsdom"
import test from "node:test"
import assert from "node:assert/strict"
import { UIApplication, UIWindow, UIView, UIScreen, NotificationCenter } from "../src/index.js"


var keyWindow = UIApplication.shared.keyWindow

test("the application has one key window, a UIView over body, and windows is that one", function() {
    assert.ok(keyWindow instanceof UIWindow)
    assert.ok(keyWindow instanceof UIView)
    assert.equal(UIApplication.shared.keyWindow, keyWindow)
    assert.deepEqual(UIApplication.shared.windows, [keyWindow])
    assert.equal(keyWindow.$el[0], document.body)
})

test("a second construction is refused, with the way to the window in the message", function() {
    assert.throws(() => new UIWindow(), (error) => error instanceof TypeError && /UIWindow/.test(error.message) && /keyWindow/.test(error.message))
    assert.throws(() => new UIWindow("body"), TypeError)
    assert.deepEqual(UIApplication.shared.windows, [keyWindow])
})

test("a view whose element is in the page has the key window as its window", function() {
    page("<div id=\"card\"><span id=\"inner\"></span></div>")
    assert.equal(new UIView("#card").window, keyWindow)
    assert.equal(new UIView("#inner").window, keyWindow)
})

test("a view that is not in the page has no window: never placed, removed, or outside body", function() {
    page("<div id=\"host\"></div>")
    assert.equal(new UIView().window, null, "never placed")
    var host = new UIView("#host")
    var child = new UIView()
    child.nib = "<div id=\"child\"></div>"
    host.addSubview(child)
    assert.equal(child.window, keyWindow)
    child.removeFromSuperview()
    assert.equal(child.window, null, "removed")
    var loose = document.createElement("div")
    loose.id = "loose"
    document.head.appendChild(loose)
    assert.equal(new UIView("#loose").window, null, "in the document but not under body")
    loose.remove()
})

test("window reads the page every time: an element moved out and back is nil, then the window", function() {
    page("<div id=\"card\"></div>")
    var view = new UIView("#card")
    var element = document.getElementById("card")
    assert.equal(view.window, keyWindow)
    var detached = element.parentNode.removeChild(element)
    assert.equal(view.window, null)
    document.body.appendChild(detached)
    assert.equal(view.window, keyWindow)
})

test("window walks the superviews: a view added to a view in the window has the window", function() {
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var middle = new UIView()
    middle.nib = "<div id=\"middle\"></div>"
    host.addSubview(middle)
    var leaf = new UIView()
    leaf.nib = "<div id=\"leaf\"></div>"
    middle.addSubview(leaf)
    assert.equal(leaf.window, keyWindow)
    assert.equal(keyWindow.window, keyWindow)
})

test("a subview added to the window is the last child of body, and has the window", function() {
    page("<div id=\"first\"></div>")
    var overlay = new UIView()
    overlay.nib = "<canvas id=\"overlay\"></canvas>"
    keyWindow.addSubview(overlay)
    assert.equal(document.body.lastElementChild, document.getElementById("overlay"))
    assert.equal(overlay.superview, keyWindow)
    assert.equal(overlay.window, keyWindow)
    overlay.removeFromSuperview()
    assert.equal(document.getElementById("overlay"), null)
    assert.equal(overlay.window, null)
    assert.deepEqual(keyWindow.subviews, [])
})

test("the window has no superview, as on Apple: removeFromSuperview and the dispose that follows it do nothing", function() {
    var heard = []
    NotificationCenter.default.addObserver(keyWindow, {name: "windowSurvives", selector: () => heard.push("heard")})
    var body = document.body
    keyWindow.removeFromSuperview()
    keyWindow._dispose()
    assert.equal(keyWindow.$el[0], body)
    assert.equal(body.isConnected, true, "body stays in the document")
    assert.equal(document.documentElement.contains(body), true)
    assert.equal(keyWindow.superview, null)
    NotificationCenter.default.post({name: "windowSurvives"})
    assert.deepEqual(heard, ["heard"], "the window's observers survive")
    NotificationCenter.default.removeObserver(keyWindow, {name: "windowSurvives"})
    page("<div id=\"card\"></div>")
    assert.equal(new UIView("#card").window, keyWindow, "and it is still the window of the page")
    assert.equal(UIApplication.shared.keyWindow, keyWindow)
})

test("the suite's own addSubview cleanup leaves the key window's subviews empty", function() {
    var overlay = new UIView()
    overlay.nib = "<canvas id=\"overlay\"></canvas>"
    keyWindow.addSubview(overlay)
    assert.deepEqual(keyWindow.subviews, [overlay])
    overlay.removeFromSuperview()
    assert.deepEqual(keyWindow.subviews, [])
})

test("the window's bounds are the screen's", function() {
    var screen = UIScreen.main.bounds
    assert.ok(screen.width > 0)
    assert.equal(keyWindow.bounds.width, screen.width)
    assert.equal(keyWindow.bounds.height, screen.height)
    assert.equal(keyWindow.bounds.origin.x, 0)
    assert.equal(keyWindow.bounds.origin.y, 0)
})

test("the entry evaluated twice on one document makes one window", async function() {
    var original = globalThis.document
    var launched = new JSDOM("<!DOCTYPE html><html><body></body></html>", {url: "http://localhost/"}).window.document
    globalThis.document = launched
    try {
        var first = await import("../src/uikit/uiwindow.js?copy=1")
        var second = await import("../src/uikit/uiwindow.js?copy=2")
        var application = await import("../src/uikit/uiapplication.js?window=1")
        assert.notEqual(first.UIWindow, second.UIWindow, "two evaluations are two copies of the class")
        var windows = application.UIApplication.shared.windows
        assert.equal(windows.length, 1)
        assert.ok(windows[0] instanceof first.UIWindow)
        assert.equal(application.UIApplication.shared.keyWindow, windows[0])
    } finally {
        globalThis.document = original
    }
})

test("with no document there is no key window, and windows is empty", function() {
    var original = globalThis.document
    globalThis.document = undefined
    try {
        assert.equal(UIApplication.shared.keyWindow, null)
        assert.deepEqual(UIApplication.shared.windows, [])
    } finally {
        globalThis.document = original
    }
})
