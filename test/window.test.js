import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIApplication, UIWindow, UIView, UIViewController, UIScreen } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

class RootViewController extends UIViewController {
    static nib = "<div id=\"root-content\"></div>"
}

test("UIApplication.shared.keyWindow is one UIWindow over the element that holds <cocoatouch>", function() {
    page("<div class=\"feedback-view\"></div><cocoatouch id=\"container\"></cocoatouch>")
    var window = UIApplication.shared.keyWindow
    assert.ok(window instanceof UIWindow)
    assert.ok(window instanceof UIView)
    assert.equal(UIApplication.shared.keyWindow, window)
    assert.equal(window.$el[0], document.body)
    assert.equal(window.window, window)
})

test("the window's rootViewController is the controller present made the page's root", async function() {
    page("<cocoatouch id=\"container\"></cocoatouch>")
    var window = UIApplication.shared.keyWindow
    var root = new RootViewController()
    await present(root)
    assert.equal(window.rootViewController, root)
    assert.equal(window.rootViewController.view.$el[0], document.getElementById("container"))
    var next = new RootViewController()
    await present(next)
    assert.equal(window.rootViewController, next)
})

test("the window's bounds are the screen's", function() {
    page("<cocoatouch></cocoatouch>")
    assert.deepEqual(UIApplication.shared.keyWindow.bounds, UIScreen.main.bounds)
})

test("insertSubview(_:belowSubview:) puts the view right before the sibling's element and makes it a subview", async function() {
    page("<div class=\"feedback-view\"></div><cocoatouch id=\"container\"></cocoatouch>")
    var window = UIApplication.shared.keyWindow
    await present(new RootViewController())
    class Overlay extends UIView {
        static nib = "<div id=\"overlay\"></div>"
    }
    var overlay = new Overlay()
    window.insertSubview(overlay, {belowSubview: window.rootViewController.view})
    var element = document.getElementById("overlay")
    assert.equal(element.nextElementSibling, document.getElementById("container"))
    assert.ok(element.previousElementSibling.classList.contains("feedback-view"))
    assert.equal(overlay.superview, window)
    assert.ok(window.subviews.includes(overlay))
    overlay.removeFromSuperview()
    assert.equal(document.getElementById("overlay"), null)
    assert.equal(overlay.superview, null)
})

test("insertSubview takes exactly one of at and belowSubview, and belowSubview must be a view", function() {
    page("<div id=\"box\"><span id=\"first\"></span></div>")
    var box = new UIView("#box")
    var first = new UIView("#first")
    assert.throws(() => box.insertSubview(new UIView(), {at: 0, belowSubview: first}), /UIView\.insertSubview takes at or belowSubview, not both/)
    assert.throws(() => box.insertSubview(new UIView(), {belowSubview: "#first"}), /UIView\.insertSubview expects an? UIView for belowSubview/)
    assert.throws(() => box.insertSubview(new UIView()), /insertSubview\(_:at:\) and insertSubview\(_:belowSubview:\)/)
})

test("a view's window is the page's window while its element is in the page, and nil once it leaves", function() {
    page("<cocoatouch></cocoatouch><div id=\"card\"></div>")
    var card = new UIView("#card")
    assert.equal(card.window, UIApplication.shared.keyWindow)
    card.$el.remove()
    assert.equal(card.window, null)
    var detached = UIView.loadFromNib("<p>x</p>")
    assert.equal(detached.window, null)
})
