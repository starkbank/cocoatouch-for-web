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


// UIButton.Configuration.showsActivityIndicator draws the spinner over the
// button, which keeps its intrinsic size: the title stays where it is and the
// spinner is out of flow. jsdom has no layout, so these pin the structure; the
// stylesheet decides whether the title is hidden, from the activity-indicator
// attribute the framework draws, and the sizes are measured in a real browser.
function drawn(id) {
    var element = document.getElementById(id)
    return {
        element: element,
        spinner: element.querySelector(".uibutton-activity-indicator"),
        icon: element.querySelector(".uibutton-activity-indicator > .fa-spin"),
    }
}

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
    assert.equal(held.element.hasAttribute("activity-indicator"), true)
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
    assert.equal(spinning.style.transform, "")
    assert.equal(spinning.style.translate, "")
    assert.equal(spinning.style.top, "")
    assert.equal(spinning.style.left, "")
    assert.equal(spinning.style.position, "")
    assert.equal(spinning.getAttribute("style"), null)
})

test("turning the indicator off removes the overlay, the icon and the attribute with it", function() {
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

test("the title's markup is never moved: a markup title with an icon is the same nodes before, during and after the indicator", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    var markup = "<svg class=\"icon\" viewBox=\"0 0 1 1\"></svg><span>Save</span>"
    button.setAttributedTitle(new NSAttributedString({data: markup, options: {documentType: NSAttributedStringDocumentType.html}}), {for: UIControlState.normal})
    var svg = document.querySelector("#b svg")
    var span = document.querySelector("#b span")
    button.configuration.showsActivityIndicator = true
    assert.equal(document.querySelector("#b svg"), svg)
    assert.equal(document.querySelector("#b span"), span)
    assert.equal(span.parentNode, document.getElementById("b"))
    button.isHighlighted = true
    assert.equal(document.querySelector("#b span"), span, "a highlight while it spins keeps the nodes a click needs")
    button.isHighlighted = false
    button.configuration.showsActivityIndicator = false
    assert.equal(document.querySelector("#b svg"), svg)
    assert.equal(document.querySelector("#b span"), span)
})

test("a title set while the indicator shows is drawn at once, and the cache matches the screen", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setTitle("Save", {for: UIControlState.normal})
    button.configuration.showsActivityIndicator = true
    button.setTitle("Send", {for: UIControlState.normal})
    var element = document.getElementById("b")
    assert.equal(element.textContent, "Send")
    button.configuration.showsActivityIndicator = false
    assert.equal(element.textContent, "Send")
    assert.equal(element.children.length, 0)
    assert.equal(button.currentTitle, "Send")
    var text = element.firstChild
    button.isHighlighted = true
    assert.equal(element.firstChild, text, "the cache holds Send: the highlight does not redraw it")
    button.setTitle("Saved", {for: UIControlState.normal})
    assert.equal(element.textContent, "Saved")
})

test("an empty button turns the indicator on and off without leaving anything behind", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.configuration.showsActivityIndicator = true
    assert.equal(document.querySelectorAll("#b .uibutton-activity-indicator").length, 1)
    button.configuration.showsActivityIndicator = false
    assert.equal(document.getElementById("b").innerHTML, "")
})

// A button whose title is only its markup, as a nib's is, still has that title.
test("title(for:) falls back to the markup's text on a button nobody set a title on, and to null when the markup has none", function() {
    page("<button id=\"nib\">Save</button><button id=\"icon\"></button>")
    var nib = new UIButton("#nib")
    assert.equal(nib.title({for: UIControlState.normal}), "Save")
    assert.equal(nib.title({for: UIControlState.selected}), "Save")
    assert.equal(new UIButton("#icon").title({for: UIControlState.normal}), null)
    nib.setTitle("Send", {for: UIControlState.normal})
    assert.equal(nib.title({for: UIControlState.normal}), "Send")
})
