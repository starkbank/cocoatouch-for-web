import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIImageView, UIImage, UIScrollView, IBAction, UIViewController, UIKeyCommand, UIKeyModifierFlags } from "../src/index.js"
import { NSUserActivity, NSUserActivityTypeBrowsingWeb } from "../src/index.js"
import { CGPoint } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { IBOutlet, UIView } from "../src/index.js"
import { keydown } from "./setup.js"


test("a responder's user activity with a webpage url is rendered as the element's href", function() {
    var button = new UIButton("#read-more")
    var activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
    activity.webpageURL = "/get-started/pix-invoice"
    button.userActivity = activity
    assert.equal(button.userActivity, activity)
    assert.equal(button.$el.attr("href"), "/get-started/pix-invoice")
    button.userActivity = null
    assert.equal(button.userActivity, null)
    assert.equal(button.$el.attr("href"), "")
})

test("a URL object is written as its string", function() {
    var button = new UIButton("#github")
    var activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
    activity.webpageURL = new URL("https://github.com/starkbank/sdk-python")
    button.userActivity = activity
    assert.equal(button.$el.attr("href"), "https://github.com/starkbank/sdk-python")
})

test("UIImage(systemName:) swaps the icon font classes and keeps the element's own", function() {
    var icon = new UIImageView("#icon")
    icon.$el.addClass("fa-2x home-compliance-logo")
    icon.image = new UIImage({systemName: "fas fa-credit-card"})
    assert.deepEqual(icon.$el._classes, ["fa-2x", "home-compliance-logo", "fas", "fa-credit-card"])
    icon.image = new UIImage({systemName: "fas fa-shield"})
    assert.deepEqual(icon.$el._classes, ["fa-2x", "home-compliance-logo", "fas", "fa-shield"])
    assert.equal(icon.$el.attr("src"), "")
})

test("UIScrollView reads and sets its content offset through the element", function() {
    var scrollView = new UIScrollView("#messages")
    var element = {scrollLeft: 0, scrollTop: 0, scrollWidth: 300, scrollHeight: 1200}
    scrollView.$el[0] = element
    assert.equal(scrollView.contentSize.height, 1200)
    scrollView.setContentOffset(new CGPoint({x: 0, y: 1200}))
    assert.equal(element.scrollTop, 1200)
    scrollView.contentOffset = new CGPoint({x: 10, y: 40})
    assert.deepEqual({x: scrollView.contentOffset.x, y: scrollView.contentOffset.y}, {x: 10, y: 40})
})

test("a key command without modifiers goes to a focused text input instead of the responder, as on iOS", function() {
    var fired = []
    class Page extends UIViewController {
        slashPressed() { fired.push("slash") }
        commandK() { fired.push("command-k") }
        escapePressed() { fired.push("escape") }
    }
    IBAction(UIKeyCommand.input("/"))(Page.prototype, "slashPressed", {})
    IBAction(UIKeyModifierFlags.command + UIKeyCommand.input("k"))(Page.prototype, "commandK", {})
    IBAction(UIKeyCommand.inputEscape)(Page.prototype, "escapePressed", {})
    var page = new Page()
    Bind.ibAction(page)

    document.activeElement = {tagName: "TEXTAREA"}
    keydown("/")
    assert.deepEqual(fired, [], "the slash was typed into the textarea")
    var event = new Event("keydown")
    event.key = "k"; event.metaKey = true; event.shiftKey = event.altKey = event.ctrlKey = false
    event.preventDefault = function() {}
    document.dispatchEvent(event)
    keydown("Escape")
    assert.deepEqual(fired, ["command-k", "escape"], "modified and non-character commands still fire while typing")

    document.activeElement = undefined
    keydown("/")
    assert.deepEqual(fired, ["command-k", "escape", "slash"])
    page._dispose()
})


test("an outlet whose class inherits awakeFromNib from a parent view is still awakened", function() {
    var awakened = []
    class MenuView extends UIView {
        awakeFromNib() { awakened.push(this.constructor.name) }
    }
    class ApiMenuView extends MenuView {}
    class Plain extends UIView {}
    class Page extends UIView {}
    IBOutlet("#menu", ApiMenuView)(Page.prototype, "menu", {})
    IBOutlet("#plain", Plain)(Page.prototype, "plain", {})
    var page = new Page("#page")
    Bind.ibOutlet(page)
    assert.deepEqual(awakened, ["ApiMenuView"])
})
