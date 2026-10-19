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
    button.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    button.showsActivityIndicator = false
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
// structure that holds the size (the title in flow, only hidden) and the spinner
// out of flow; the width and height themselves are measured in a real browser.
function drawn(id) {
    var element = document.getElementById(id)
    return {
        element: element,
        title: element.querySelector(".uibutton-activity-title"),
        spinner: element.querySelector(".uibutton-activity-indicator"),
        icon: element.querySelector(".uibutton-activity-indicator > .fa-spin"),
    }
}

test("the activity indicator keeps the title in flow, hidden from sight, the tab order and assistive technology", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    var held = drawn("b")
    assert.equal(held.title.textContent, "Save")
    assert.equal(held.title.style.visibility, "hidden")
    assert.notEqual(held.title.style.display, "none")
    assert.equal(held.title.style.opacity, "")
    assert.equal(held.title.style.position, "")
    assert.equal(held.element.textContent, "Save")
})

test("the hidden title's controls are not focusable while the indicator shows", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setAttributedTitle(new NSAttributedString({data: "<a id=\"inner\" href=\"/x\">Go</a>", options: {documentType: NSAttributedStringDocumentType.html}}), {for: UIControlState.normal})
    button.showsActivityIndicator = true
    var inner = document.getElementById("inner")
    var hidden = inner.closest("[style*=\"visibility: hidden\"]")
    assert.ok(hidden, "the anchor sits under a visibility:hidden ancestor, which drops it from the tab order and the accessibility tree")
    assert.equal(hidden.parentNode, document.getElementById("b"))
})

test("the spinner is an overlay, absolutely filling the button and centring the icon with flex, taking no room in the flow", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
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
    button.showsActivityIndicator = true
    var held = drawn("b")
    var spinning = held.element.querySelector(".fa-spin")
    assert.ok(spinning)
    assert.notEqual(spinning, held.spinner, "the overlay that centres is not the element that spins")
    assert.equal(spinning.style.transform, "")
    assert.equal(spinning.style.translate, "")
    assert.equal(spinning.style.top, "")
    assert.equal(spinning.style.left, "")
    assert.equal(spinning.style.position, "")
    assert.equal(spinning.getAttribute("style"), null)
})

test("turning the indicator off removes the overlay and the icon with it", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator, #b .fa-spin").length, 0)
})

test("a button already positioned keeps its own positioning while the indicator shows", function() {
    page("<button id=\"b\" style=\"position: absolute; top: 4px\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    assert.equal(document.getElementById("b").style.position, "absolute")
    button.showsActivityIndicator = false
    assert.equal(document.getElementById("b").style.position, "absolute")
    assert.equal(document.getElementById("b").style.top, "4px")
})

test("turning the indicator off restores the title exactly, the spinner and the containing block go, and a second on is idempotent", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Send & <go>", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    var first = document.getElementById("b").innerHTML
    button.showsActivityIndicator = true
    assert.equal(document.getElementById("b").innerHTML, first)
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1)
    assert.equal(document.querySelectorAll("#b .uibutton-activity-title").length, 1)
    button.showsActivityIndicator = false
    var element = document.getElementById("b")
    assert.equal(element.children.length, 0)
    assert.equal(element.textContent, "Send & <go>")
    assert.equal(element.getAttribute("style") || "", "")
    assert.equal(button.currentTitle, "Send & <go>")
    button.showsActivityIndicator = false
    assert.equal(element.textContent, "Send & <go>")
    assert.ok(!button.showsActivityIndicator)
})

test("a markup title with an icon is held under the spinner and restored node for node", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var markup = "<svg class=\"icon\" viewBox=\"0 0 1 1\"></svg><span>Save</span>"
    button.setAttributedTitle(new NSAttributedString({data: markup, options: {documentType: NSAttributedStringDocumentType.html}}), {for: UIControlState.normal})
    var before = document.getElementById("b").innerHTML
    button.showsActivityIndicator = true
    var held = drawn("b")
    assert.equal(held.title.innerHTML, before)
    assert.equal(held.title.querySelectorAll("svg.icon").length, 1)
    assert.equal(held.title.querySelector("span").textContent, "Save")
    assert.equal(held.title.style.visibility, "hidden")
    button.showsActivityIndicator = false
    assert.equal(document.getElementById("b").innerHTML, before)
    assert.equal(document.querySelectorAll("#b .uibutton-activity-title").length, 0)
})

test("isEnabled is false while the indicator shows and true again after, and the title in the nib stands", function() {
    page("<button id=\"b\">Pay now</button>")
    var button = new UIButton("#b")
    button.showsActivityIndicator = true
    assert.equal(button.isEnabled, false)
    assert.equal(document.getElementById("b").hasAttribute("disabled"), true)
    assert.equal(document.getElementById("b").style.pointerEvents, "none")
    assert.equal(document.querySelector("#b .uibutton-activity-title").textContent, "Pay now")
    button.showsActivityIndicator = false
    assert.equal(button.isEnabled, true)
    assert.equal(document.getElementById("b").hasAttribute("disabled"), false)
    assert.equal(document.getElementById("b").style.pointerEvents, "")
    assert.equal(document.getElementById("b").textContent, "Pay now")
})

test("a title set while the indicator shows is drawn when it turns off", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    assert.equal(drawn("b").title.textContent, "Save")
    button.showsActivityIndicator = false
    assert.equal(document.getElementById("b").textContent, "Send")
    assert.equal(document.getElementById("b").children.length, 0)
})


// The activity indicator moves the title's nodes under a wrapper and back, so
// nothing that holds a reference to one of them (an outlet, a handler bound
// to it) is lost, and the button's enabled state is the app's, not the spinner's.
test("a button disabled before the indicator stays disabled after it turns off", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.isEnabled = false
    button.showsActivityIndicator = true
    assert.equal(button.isEnabled, false)
    button.showsActivityIndicator = false
    assert.equal(button.isEnabled, false)
    assert.equal(document.getElementById("b").hasAttribute("disabled"), true)
    assert.equal(document.getElementById("b").style.pointerEvents, "none")
})

test("an isEnabled the app assigns while the indicator shows wins when it turns off, and the button stays disabled meanwhile", function() {
    page("<button id=\"b\"></button><button id=\"c\"></button>")
    var enabled = new UIButton("#b")
    enabled.showsActivityIndicator = true
    enabled.isEnabled = false
    assert.equal(enabled.isEnabled, false)
    enabled.showsActivityIndicator = false
    assert.equal(enabled.isEnabled, false)
    assert.equal(document.getElementById("b").hasAttribute("disabled"), true)
    var disabled = new UIButton("#c")
    disabled.isEnabled = false
    disabled.showsActivityIndicator = true
    disabled.isEnabled = true
    assert.equal(disabled.isEnabled, false, "still disabled while the indicator shows")
    assert.equal(document.getElementById("c").hasAttribute("disabled"), true)
    disabled.showsActivityIndicator = false
    assert.equal(disabled.isEnabled, true)
    assert.equal(document.getElementById("c").hasAttribute("disabled"), false)
    assert.equal(document.getElementById("c").style.pointerEvents, "")
})

test("a node inside the title is the same node, and still attached, after the indicator turns on and off", function() {
    page("<button id=\"b\"><svg id=\"icon\"></svg><span id=\"label\">Save</span></button>")
    var button = new UIButton("#b")
    var icon = document.getElementById("icon")
    var label = document.getElementById("label")
    var text = label.firstChild
    button.showsActivityIndicator = true
    assert.equal(document.getElementById("icon"), icon)
    assert.equal(document.getElementById("label"), label)
    assert.ok(icon.isConnected)
    assert.equal(label.firstChild, text)
    button.showsActivityIndicator = false
    assert.equal(document.getElementById("icon"), icon)
    assert.equal(document.getElementById("label"), label)
    assert.ok(icon.isConnected)
    assert.ok(label.isConnected)
    assert.equal(label.parentNode, document.getElementById("b"))
    assert.equal(label.firstChild, text)
})

test("turning the indicator off restores the button's children by identity, not only its markup", function() {
    page("<button id=\"b\"><svg id=\"icon\"></svg> <span>Save</span></button>")
    var button = new UIButton("#b")
    var element = document.getElementById("b")
    var before = Array.from(element.childNodes)
    button.showsActivityIndicator = true
    assert.equal(button.$el.children().length, 2, "the wrapper and the spinner")
    button.showsActivityIndicator = false
    var after = Array.from(element.childNodes)
    assert.equal(after.length, before.length)
    after.forEach(function(node, index) { assert.equal(node, before[index]) })
    assert.equal(button.$el.children().length, 2)
    assert.equal(button.$el.children()[0], before[0])
    assert.equal(element.querySelectorAll(".uibutton-activity-title, .uibutton-activity-indicator").length, 0)
})

test("a title the indicator did not change is not redrawn when it turns off", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var html = {documentType: NSAttributedStringDocumentType.html}
    button.setAttributedTitle(new NSAttributedString({data: "<svg></svg><span>Save</span>", options: html}), {for: UIControlState.normal})
    var svg = document.querySelector("#b svg")
    var span = document.querySelector("#b span")
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(document.querySelector("#b svg"), svg)
    assert.equal(document.querySelector("#b span"), span)
    button.isHighlighted = true
    assert.equal(document.querySelector("#b svg"), svg, "a highlight after the spin still keeps the nodes the click needs")
    assert.equal(document.querySelector("#b span"), span)
    button.isHighlighted = false
})

test("a title set while the indicator shows is drawn when it turns off, and the drawn cache matches the screen", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    button.showsActivityIndicator = false
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

test("an empty button turns the indicator on and off without leaving a wrapper behind", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.showsActivityIndicator = true
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1)
    button.showsActivityIndicator = false
    assert.equal(document.getElementById("b").innerHTML, "")
})
