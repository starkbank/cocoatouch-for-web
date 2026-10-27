import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIControlState, NSAttributedString, NSAttributedStringDocumentType } from "../src/index.js"


// Swift lets a subclass hold `var title` beside `title(for:)`; JavaScript has
// one namespace, so the field shadows the method on the instance, and the
// framework's own drawing must not go through it.
test("a UIButton subclass that declares its own title member still draws, redraws and reports its title", function() {
    class MenuItem extends UIButton {
        title = ""
    }
    page("<button id=\"item\"></button><button id=\"plain-title\"></button>")
    var item = new MenuItem("#item")
    item.title = "Overview"
    item.setTitle(item.title, {for: UIControlState.normal})
    assert.equal(item.$el.text(), "Overview")
    assert.equal(item.currentTitle, "Overview")
    item.isSelected = true
    item.isEnabled = false
    assert.equal(item.$el.text(), "Overview")
    assert.equal(item.currentTitle, "Overview")
    assert.equal(item.title, "Overview")
    var plain = new UIButton("#plain-title")
    plain.setTitle("Save", {for: UIControlState.normal})
    assert.equal(plain.title({for: UIControlState.normal}), "Save")
    assert.equal(plain.title({for: UIControlState.selected}), "Save")
})

// A browser fires click on the common ancestor of the mousedown and mouseup
// targets; the highlight that mousedown causes redrew the title, replacing the
// nodes under the pointer, so no common ancestor was left and the click was lost.
test("a highlight change keeps the drawn markup title's nodes, and a changed title still redraws", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var html = {documentType: NSAttributedStringDocumentType.html}
    button.setAttributedTitle(new NSAttributedString({data: "<svg></svg><span>Save</span>", options: html}), {for: UIControlState.normal})
    var svg = document.querySelector("#b svg")
    var span = document.querySelector("#b span")
    button.isHighlighted = true
    assert.equal(document.querySelector("#b svg"), svg)
    assert.equal(document.querySelector("#b span"), span)
    button.isHighlighted = false
    assert.equal(document.querySelector("#b svg"), svg)
    button.setAttributedTitle(new NSAttributedString({data: "<svg></svg><span>Save</span>", options: html}), {for: UIControlState.normal})
    assert.equal(document.querySelector("#b svg"), svg, "the same markup set again is not redrawn")
    button.setAttributedTitle(new NSAttributedString({data: "<span>Saved</span>", options: html}), {for: UIControlState.normal})
    assert.equal(document.querySelector("#b span").textContent, "Saved")
    assert.notEqual(document.querySelector("#b span"), span)
})

test("a highlight change keeps a text title's node, and a changed title still redraws", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    var text = document.getElementById("b").firstChild
    button.isHighlighted = true
    assert.equal(document.getElementById("b").firstChild, text)
    button.setTitle("Saved", {for: UIControlState.normal})
    assert.equal(document.getElementById("b").textContent, "Saved")
})

test("a state with its own title redraws when the drawn state changes, and back", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.setTitle("Saving", {for: UIControlState.disabled})
    button.isEnabled = false
    assert.equal(document.getElementById("b").textContent, "Saving")
    button.isEnabled = true
    assert.equal(document.getElementById("b").textContent, "Save")
})

test("a title the activity indicator hid is drawn again when it is turned off, even after a changed title", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = false
    assert.equal(document.getElementById("b").textContent, "Send")
})

test("a button whose element was replaced under its selector draws its unchanged title on the new element", function() {
    page("<div id=\"host\"><button id=\"b\"></button></div>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    assert.equal(document.getElementById("b").textContent, "Save")
    document.getElementById("host").innerHTML = "<button id=\"b\"></button>"
    assert.equal(document.getElementById("b").textContent, "")
    button.setTitle("Save", {for: UIControlState.normal})
    assert.equal(document.getElementById("b").textContent, "Save")
})


// UIButton.Configuration.showsActivityIndicator draws the indicator over the
// button, which keeps its intrinsic size. jsdom has no layout, so these pin the
// structure that holds the size (the title's nodes in place, for the stylesheet
// to hide by the attribute) and the spinner out of flow; the width and height
// themselves are measured in a real browser.
function drawn(id) {
    var element = document.getElementById(id)
    return {
        element: element,
        spinner: element.querySelector(".uibutton-activity-indicator"),
        icon: element.querySelector(".uibutton-activity-indicator > .fa-spin"),
    }
}

test("a button bound to a nib has Interface Builder's plain configuration, without the indicator", function() {
    page("<button id=\"b\">Pay</button>")
    var button = new UIButton("#b")
    assert.ok(button.configuration instanceof UIButton.Configuration)
    assert.equal(button.configuration, button.configuration)
    assert.equal(button.configuration.showsActivityIndicator, false)
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), false)
})

test("the indicator draws the activity-indicator attribute and leaves the title's nodes where they are", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    var text = document.getElementById("b").firstChild
    button.configuration.showsActivityIndicator = true
    var held = drawn("b")
    assert.equal(held.element.getAttribute("activity-indicator"), "")
    assert.equal(held.element.firstChild, text)
    assert.equal(held.element.textContent, "Save")
    assert.equal(held.element.querySelectorAll(".uibutton-activity-title").length, 0)
    assert.equal(button.configuration.showsActivityIndicator, true)
})

test("an assigned configuration is copied, so two buttons given one configuration draw apart", function() {
    page("<button id=\"b\"></button><button id=\"c\"></button>")
    var first = new UIButton("#b")
    var second = new UIButton("#c")
    var configuration = UIButton.Configuration.plain()
    configuration.showsActivityIndicator = true
    first.configuration = configuration
    second.configuration = configuration
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), true)
    assert.equal(document.getElementById("c").hasAttribute("activity-indicator"), true)
    second.configuration.showsActivityIndicator = false
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), true)
    assert.equal(document.getElementById("c").hasAttribute("activity-indicator"), false)
    assert.equal(configuration.showsActivityIndicator, true)
    assert.notEqual(first.configuration, configuration)
})

test("a configuration replaced on a button no longer draws on it", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var previous = button.configuration
    button.configuration = UIButton.Configuration.plain()
    previous.showsActivityIndicator = true
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), false)
})

test("a nil configuration removes the indicator and reads back null", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.configuration.showsActivityIndicator = true
    button.configuration = null
    assert.equal(button.configuration, null)
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), false)
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 0)
})

test("configuration and showsActivityIndicator refuse values of another type", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    assert.throws(function() { button.configuration = {showsActivityIndicator: true} }, /UIButton\.configuration expects an? UIButton\.Configuration/)
    assert.throws(function() { button.configuration.showsActivityIndicator = "yes" }, /showsActivityIndicator expects a Bool/)
})

test("the spinner is an overlay, absolutely filling the button and centring the icon with flex, taking no room in the flow", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    var held = drawn("b")
    assert.ok(held.spinner)
    assert.equal(held.spinner.parentNode, held.element)
    assert.equal(held.spinner.tagName, "SPAN")
    assert.equal(held.spinner.style.position, "absolute")
    assert.match(held.spinner.getAttribute("style"), /inset: 0/)
    assert.equal(held.spinner.style.display, "flex")
    assert.equal(held.spinner.style.alignItems, "center")
    assert.equal(held.spinner.style.justifyContent, "center")
    assert.equal(held.spinner.style.pointerEvents, "none")
    assert.equal(held.spinner.style.visibility, "")
    assert.equal(held.element.style.position, "relative", "a static button becomes the spinner's containing block")
    assert.equal(held.spinner.children.length, 1)
    assert.equal(held.spinner.firstChild, held.icon)
    assert.ok(held.icon.classList.contains("fas"))
    assert.ok(held.icon.classList.contains("fa-circle-notch"))
})

// Font Awesome's fa-spin animates transform on the element that carries it, and
// a running animation overrides that element's own transform, so a translate
// there leaves the spinner off centre. The centring belongs to a box that does
// not spin.
test("the spinning icon is not the element that centres it, and carries no transform or offsets", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    var held = drawn("b")
    var spinning = held.element.querySelector(".fa-spin")
    assert.ok(spinning)
    assert.notEqual(spinning, held.spinner, "the overlay that centres is not the element that spins")
    assert.equal(spinning.getAttribute("style"), null)
})

test("turning the indicator off removes the overlay, the icon and the attribute", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    button.configuration.showsActivityIndicator = false
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator, #b .fa-spin").length, 0)
    assert.equal(document.getElementById("b").hasAttribute("activity-indicator"), false)
})

test("a button already positioned keeps its own positioning while the indicator shows", function() {
    page("<button id=\"b\" style=\"position: absolute; top: 4px\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    assert.equal(document.getElementById("b").style.position, "absolute")
    button.configuration.showsActivityIndicator = false
    assert.equal(document.getElementById("b").style.position, "absolute")
    assert.equal(document.getElementById("b").style.top, "4px")
})

test("turning the indicator off restores the button exactly, and a second on or off changes nothing", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Send & <go>", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    var first = document.getElementById("b").innerHTML
    button.configuration.showsActivityIndicator = true
    assert.equal(document.getElementById("b").innerHTML, first)
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1)
    button.configuration.showsActivityIndicator = false
    var element = document.getElementById("b")
    assert.equal(element.children.length, 0)
    assert.equal(element.textContent, "Send & <go>")
    assert.equal(element.getAttribute("style") || "", "")
    assert.equal(button.currentTitle, "Send & <go>")
    button.configuration.showsActivityIndicator = false
    assert.equal(element.textContent, "Send & <go>")
    assert.ok(!button.configuration.showsActivityIndicator)
})

// Apple's showsActivityIndicator draws and does not disable: a button that
// must not be pressed while it spins is disabled by the app, as on iOS.
test("the indicator leaves isEnabled to the app, before, during and after it shows", function() {
    page("<button id=\"b\">Pay now</button><button id=\"c\"></button>")
    var button = new UIButton("#b")
    button.configuration.showsActivityIndicator = true
    assert.equal(button.isEnabled, true)
    assert.equal(document.getElementById("b").hasAttribute("disabled"), false)
    button.isEnabled = false
    assert.equal(document.getElementById("b").hasAttribute("disabled"), true)
    button.configuration.showsActivityIndicator = false
    assert.equal(button.isEnabled, false)
    var disabled = new UIButton("#c")
    disabled.isEnabled = false
    disabled.configuration.showsActivityIndicator = true
    disabled.isEnabled = true
    assert.equal(disabled.isEnabled, true)
    assert.equal(document.getElementById("c").hasAttribute("disabled"), false)
})

test("a title set while the indicator shows is drawn when it turns off, and the drawn cache matches the screen", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1, "the overlay stays while the title waits")
    button.configuration.showsActivityIndicator = false
    var element = document.getElementById("b")
    assert.equal(element.textContent, "Send")
    assert.equal(element.children.length, 0)
    assert.equal(button.currentTitle, "Send")
    var text = element.firstChild
    button.isHighlighted = true
    assert.equal(element.firstChild, text, "the cache holds Send: the highlight does not redraw it")
    button.setTitle("Send", {for: UIControlState.normal})
    assert.equal(element.firstChild, text)
    button.setTitle("Saved", {for: UIControlState.normal})
    assert.equal(element.textContent, "Saved")
})

test("a node inside the title is the same node, and still attached, after the indicator turns on and off", function() {
    page("<button id=\"b\"><svg id=\"icon\"></svg> <span id=\"label\">Save</span></button>")
    var button = new UIButton("#b")
    var element = document.getElementById("b")
    var before = Array.from(element.childNodes)
    button.configuration.showsActivityIndicator = true
    assert.equal(document.getElementById("icon"), before[0])
    assert.equal(document.getElementById("label").parentNode, element)
    button.configuration.showsActivityIndicator = false
    var after = Array.from(element.childNodes)
    assert.equal(after.length, before.length)
    after.forEach(function(node, index) { assert.equal(node, before[index]) })
})

test("a title the indicator did not change is not redrawn when it turns off", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var html = {documentType: NSAttributedStringDocumentType.html}
    button.setAttributedTitle(new NSAttributedString({data: "<svg></svg><span>Save</span>", options: html}), {for: UIControlState.normal})
    var svg = document.querySelector("#b svg")
    var span = document.querySelector("#b span")
    button.configuration.showsActivityIndicator = true
    button.configuration.showsActivityIndicator = false
    assert.equal(document.querySelector("#b svg"), svg)
    assert.equal(document.querySelector("#b span"), span)
    button.isHighlighted = true
    assert.equal(document.querySelector("#b svg"), svg, "a highlight after the spin still keeps the nodes the click needs")
    button.isHighlighted = false
})

test("an empty button turns the indicator on and off without leaving anything behind", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.configuration.showsActivityIndicator = true
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1)
    button.configuration.showsActivityIndicator = false
    assert.equal(document.getElementById("b").innerHTML, "")
})
