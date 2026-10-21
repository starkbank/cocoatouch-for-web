import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIControlState, UIImage, NSDirectionalRectEdge } from "../src/index.js"
import * as uikit from "../src/uikit/index.js"
import { NSDirectionalRectEdge as declared } from "../src/uikit/uibuttonconfiguration.js"


const Configuration = UIButton.Configuration

function button(markup = "<button id=\"b\">Pay now</button>") {
    page(markup)
    return new UIButton("#b")
}

function element() {
    return document.getElementById("b")
}


test("UIButton.Configuration has the four factories, each a configuration with Apple's defaults", function() {
    for (var factory of ["plain", "filled", "tinted", "gray"]) {
        var configuration = Configuration[factory]()
        assert.ok(configuration instanceof Configuration, factory)
        assert.equal(configuration.title, null)
        assert.equal(configuration.image, null)
        assert.equal(configuration.showsActivityIndicator, false)
        assert.equal(configuration.imagePlacement, NSDirectionalRectEdge.leading)
    }
    assert.notEqual(Configuration.plain(), Configuration.plain(), "a value, never a shared instance")
})

test("a button loaded from markup starts with a plain configuration holding the title of its markup", function() {
    var pay = button()
    assert.ok(pay.configuration instanceof Configuration)
    assert.equal(pay.configuration.title, "Pay now")
    assert.equal(pay.configuration.image, null)
    assert.equal(pay.configuration.showsActivityIndicator, false)
    assert.equal(pay.configuration, pay.configuration, "the same value on every read, so a write lands on the button")
})

test("button.configuration.showsActivityIndicator = true writes back to the button, as Swift's configuration?.showsActivityIndicator = true", function() {
    var pay = button()
    pay.configuration.showsActivityIndicator = true
    assert.equal(pay.configuration.showsActivityIndicator, true)
    assert.equal(element().hasAttribute("activity-indicator"), true)
    assert.equal(element().querySelectorAll(".uibutton-activity-indicator").length, 1)
    pay.configuration.showsActivityIndicator = false
    assert.equal(pay.configuration.showsActivityIndicator, false)
    assert.equal(element().hasAttribute("activity-indicator"), false)
    assert.equal(element().querySelectorAll(".uibutton-activity-indicator").length, 0)
})

test("the indicator neither hides the title nor touches isEnabled", function() {
    var pay = button()
    pay.configuration.showsActivityIndicator = true
    assert.equal(pay.isEnabled, true)
    assert.equal(element().hasAttribute("disabled"), false)
    assert.equal(element().style.pointerEvents, "")
    assert.equal(element().querySelector(".uibutton-activity-title"), null, "no wrapper around the title")
    assert.equal(element().textContent, "Pay now")
    assert.equal(element().querySelector("[style*=\"visibility\"]:not(.uibutton-activity-indicator)"), null)
})

test("isEnabled stays the app's: a button disabled before stays so, and an assignment during the indicator takes effect at once", function() {
    var pay = button()
    pay.isEnabled = false
    pay.configuration.showsActivityIndicator = true
    assert.equal(pay.isEnabled, false)
    pay.configuration.showsActivityIndicator = false
    assert.equal(pay.isEnabled, false)
    pay.configuration.showsActivityIndicator = true
    pay.isEnabled = true
    assert.equal(pay.isEnabled, true)
    assert.equal(element().hasAttribute("disabled"), false)
})

test("the title nodes are the same nodes while the indicator shows, and a title set meanwhile keeps the spinner", function() {
    var save = button("<button id=\"b\"><svg id=\"icon\"></svg><span id=\"label\">Save</span></button>")
    var icon = document.getElementById("icon")
    save.configuration.showsActivityIndicator = true
    assert.equal(document.getElementById("icon"), icon)
    assert.equal(icon.parentNode, element())
    save.setTitle("Send", {for: UIControlState.normal})
    assert.equal(element().textContent, "Send")
    assert.equal(element().querySelectorAll(".uibutton-activity-indicator").length, 1, "the redraw of the title does not wipe the spinner")
    assert.equal(element().hasAttribute("activity-indicator"), true)
})

test("a second on is idempotent, and off leaves the button as it was", function() {
    var pay = button()
    var before = element().innerHTML
    pay.configuration.showsActivityIndicator = true
    pay.configuration.showsActivityIndicator = true
    assert.equal(element().querySelectorAll(".uibutton-activity-indicator").length, 1)
    pay.configuration.showsActivityIndicator = false
    pay.configuration.showsActivityIndicator = false
    assert.equal(element().innerHTML, before)
    assert.equal(element().getAttribute("style") || "", "")
})

test("the old UIButton.showsActivityIndicator throws on a write and on a read, naming the configuration path", function() {
    var pay = button()
    var names = (error) => error instanceof TypeError && /configuration\.showsActivityIndicator/.test(error.message)
    assert.throws(() => { pay.showsActivityIndicator = true }, names)
    assert.throws(() => pay.showsActivityIndicator, names)
    assert.equal(element().hasAttribute("activity-indicator"), false)
})

test("configuration.title is the button's title, in both directions", function() {
    var pay = button()
    pay.configuration.title = "Paying"
    assert.equal(element().textContent, "Paying")
    assert.equal(pay.title({for: UIControlState.normal}), "Paying")
    pay.setTitle("Paid", {for: UIControlState.normal})
    assert.equal(pay.configuration.title, "Paid")
    assert.equal(element().textContent, "Paid")
})

test("assigning a configuration applies it, copies it, and null clears every drawing", function() {
    var pay = button()
    var assigned = Configuration.filled()
    assigned.title = "Send"
    assigned.showsActivityIndicator = true
    pay.configuration = assigned
    assert.equal(element().textContent, "Send")
    assert.equal(element().hasAttribute("activity-indicator"), true)
    assigned.showsActivityIndicator = false
    assert.equal(element().hasAttribute("activity-indicator"), true, "the value assigned is a copy: Swift's struct")
    assert.notEqual(pay.configuration, assigned)
    pay.configuration = null
    assert.equal(pay.configuration, null)
    assert.equal(element().hasAttribute("activity-indicator"), false)
    assert.equal(element().querySelectorAll(".uibutton-activity-indicator").length, 0)
    assert.throws(() => { pay.configuration = {title: "x"} }, (error) => error instanceof TypeError && /UIButton\.configuration/.test(error.message))
})

test("the image is drawn beside the title at the placement, and removed with null", function() {
    var pay = button()
    pay.configuration.image = new UIImage({systemName: "fas fa-lock"})
    var image = element().querySelector(".uibutton-image")
    assert.ok(image)
    assert.equal(image.querySelector("i").className, "fas fa-lock")
    assert.equal(element().firstChild, image, "leading is before the title")
    assert.equal(element().getAttribute("image-placement"), "leading")
    pay.configuration.imagePlacement = NSDirectionalRectEdge.trailing
    assert.equal(element().lastChild, element().querySelector(".uibutton-image"))
    assert.equal(element().getAttribute("image-placement"), "trailing")
    pay.configuration.imagePlacement = NSDirectionalRectEdge.top
    assert.equal(element().getAttribute("image-placement"), "top")
    pay.configuration.image = new UIImage({named: "/lock.png"})
    assert.equal(element().querySelector(".uibutton-image img").getAttribute("src"), "/lock.png")
    assert.equal(element().querySelectorAll(".uibutton-image").length, 1)
    pay.configuration.image = null
    assert.equal(element().querySelector(".uibutton-image"), null)
    assert.equal(element().hasAttribute("image-placement"), false)
    assert.equal(element().textContent, "Pay now")
})

test("each property refuses a value of the wrong type, naming the Swift property", function() {
    var configuration = Configuration.plain()
    assert.throws(() => { configuration.title = 5 }, (error) => error instanceof TypeError && /UIButton\.Configuration\.title/.test(error.message))
    assert.throws(() => { configuration.image = "x.png" }, (error) => error instanceof TypeError && /UIButton\.Configuration\.image/.test(error.message))
    assert.throws(() => { configuration.showsActivityIndicator = "yes" }, (error) => error instanceof TypeError && /showsActivityIndicator/.test(error.message))
    assert.throws(() => { configuration.imagePlacement = "leading" }, (error) => error instanceof TypeError && /imagePlacement/.test(error.message))
    assert.equal(configuration.showsActivityIndicator, false)
})

test("NSDirectionalRectEdge is exported by UIKit, the one a configuration's imagePlacement takes", function() {
    assert.equal(uikit.NSDirectionalRectEdge, declared)
    assert.deepEqual(Object.keys(NSDirectionalRectEdge).sort(), ["bottom", "leading", "top", "trailing"])
    var pay = button()
    pay.configuration.imagePlacement = NSDirectionalRectEdge.bottom
    assert.equal(pay.configuration.imagePlacement, NSDirectionalRectEdge.bottom)
})

test("a configuration copied from another button's own carries its title", function() {
    page("<button id=\"b\">Pay now</button><button id=\"c\">Cancel</button>")
    var pay = new UIButton("#b")
    var cancel = new UIButton("#c")
    pay.configuration = cancel.configuration
    assert.equal(pay.configuration.title, "Cancel")
    assert.equal(pay.currentTitle, "Cancel")
    assert.equal(element().textContent, "Cancel")
    cancel.setTitle("Abort", {for: UIControlState.normal})
    pay.configuration = cancel.configuration
    assert.equal(element().textContent, "Abort")
})

test("a configuration copied from a free value keeps its title as before, and a title-less one leaves the button's", function() {
    var pay = button()
    var free = Configuration.plain()
    free.title = "Paying"
    pay.configuration = free
    assert.equal(pay.currentTitle, "Paying")
    pay.configuration = Configuration.plain()
    assert.equal(pay.currentTitle, "Paying")
})

test("assigning a button's own configuration back leaves its markup, icon content included, as it was", function() {
    page("<button id=\"b\"><i class=\"icon\"></i> Pay now</button>")
    var pay = new UIButton("#b")
    var before = element().innerHTML
    pay.configuration = pay.configuration
    assert.equal(element().innerHTML, before)
    assert.equal(pay.currentTitle, " Pay now")
})

test("a configuration copied from a button whose markup has no text leaves the title alone", function() {
    page("<button id=\"b\">Pay now</button><button id=\"c\"><i class=\"icon\"></i></button>")
    var pay = new UIButton("#b")
    var icon = new UIButton("#c")
    pay.configuration = icon.configuration
    assert.equal(element().textContent, "Pay now")
    assert.equal(pay.currentTitle, "Pay now")
})

test("a configuration copied from a whitespace-wrapped icon button leaves the receiver's children alone", function() {
    page("<button id=\"b\"><i class=\"keep\"></i> Pay now</button><button id=\"c\">\n    <i class=\"icon\"></i>\n</button>")
    var pay = new UIButton("#b")
    var icon = new UIButton("#c")
    var before = element().innerHTML
    pay.configuration = icon.configuration
    assert.equal(element().innerHTML, before)
})
