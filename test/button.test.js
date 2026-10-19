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
