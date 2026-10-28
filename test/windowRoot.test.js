import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIApplication, UIView, UIViewController } from "../src/index.js"


var keyWindow = UIApplication.shared.keyWindow

function viewWithNib(nib) {
    var view = new UIView()
    view.nib = nib
    return view
}

test("rootViewController is nil until a controller is presented, then the presented one", function() {
    page("<cocoatouch id=\"container\"></cocoatouch>")
    assert.equal(keyWindow.rootViewController, null)
    class First extends UIViewController {}
    First.nib = "<div id=\"first\"></div>"
    var first = new First()
    first.present(first, {})
    assert.equal(keyWindow.rootViewController, first)
    class Second extends UIViewController {}
    Second.nib = "<div id=\"second\"></div>"
    var second = new Second()
    second.present(second, {})
    assert.equal(keyWindow.rootViewController, second)
})

test("rootViewController is read-only: a window does not take another root from the app", function() {
    assert.throws(() => { keyWindow.rootViewController = new UIViewController() }, TypeError)
})

test("insertSubview belowSubview puts the view's element directly before the sibling's, and links it before the sibling", function() {
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var first = viewWithNib("<p id=\"first\"></p>")
    var second = viewWithNib("<p id=\"second\"></p>")
    host.addSubview(first)
    host.addSubview(second)
    var inserted = viewWithNib("<p id=\"inserted\"></p>")
    host.insertSubview(inserted, {belowSubview: second})
    assert.deepEqual([...document.getElementById("host").children].map((element) => element.id), ["first", "inserted", "second"])
    assert.deepEqual(host.subviews, [first, inserted, second])
    assert.equal(inserted.superview, host)
    assert.equal(inserted.window, keyWindow)
})

test("insertSubview belowSubview runs the same hooks as addSubview, in the same order", function() {
    page("<div id=\"host\"><p id=\"sibling\"></p></div>")
    var host = new UIView("#host")
    var log = []
    var inserted = viewWithNib("<p id=\"inserted\"></p>")
    inserted.willMove = function({toSuperview}) { log.push("willMove " + (toSuperview === host)) }
    inserted.didMoveToSuperview = function() { log.push("didMoveToSuperview") }
    inserted.awakeFromNib = function() { log.push("awakeFromNib") }
    host.insertSubview(inserted, {belowSubview: new UIView("#sibling")})
    assert.deepEqual(log, ["willMove true", "didMoveToSuperview", "awakeFromNib"])
})

test("the key window takes a view directly before the root controller's view, after what is already before it", function() {
    page("<div class=\"feedback-view\"></div><cocoatouch id=\"container\"></cocoatouch>")
    class Root extends UIViewController {}
    Root.nib = "<div id=\"root\"></div>"
    var root = new Root()
    root.present(root, {})
    var modal = viewWithNib("<div id=\"modal\"></div>")
    keyWindow.insertSubview(modal, {belowSubview: keyWindow.rootViewController.view})
    var modalElement = document.getElementById("modal")
    assert.equal(modalElement.nextElementSibling, document.getElementById("container"))
    assert.ok(modalElement.previousElementSibling.classList.contains("feedback-view"))
    assert.equal(modal.superview, keyWindow)
})

test("insertSubview belowSubview refuses a sibling that is not a subview of the view", function() {
    page("<div id=\"host\"></div><div id=\"elsewhere\"></div>")
    var host = new UIView("#host")
    assert.throws(
        () => host.insertSubview(viewWithNib("<p></p>"), {belowSubview: new UIView("#elsewhere")}),
        (error) => error instanceof TypeError && /UIView\.insertSubview/.test(error.message) && /belowSubview/.test(error.message),
    )
})

test("insertSubview takes at or belowSubview, never both, and one of them", function() {
    page("<div id=\"host\"><p id=\"sibling\"></p></div>")
    var host = new UIView("#host")
    var sibling = new UIView("#sibling")
    assert.throws(() => host.insertSubview(new UIView(), {at: 0, belowSubview: sibling}), (error) => error instanceof TypeError && /UIView\.insertSubview/.test(error.message))
    assert.throws(() => host.insertSubview(new UIView()), (error) => error instanceof TypeError && /insertSubview\(_:at:\)/.test(error.message) && /insertSubview\(_:belowSubview:\)/.test(error.message))
})
