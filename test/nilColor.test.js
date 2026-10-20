import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UILabel, UIColor, CALayer } from "../src/index.js"


// Apple's nil is "no value of its own": the view draws what the stylesheet says.
function withRule(rule, run) {
    var style = document.createElement("style")
    style.textContent = rule
    document.head.appendChild(style)
    try { run() } finally { style.remove() }
}

test("backgroundColor = null removes the inline value so the stylesheet's returns, and reads back null", function() {
    page("<div id=\"box\"></div>")
    withRule("#box { background-color: rgb(1, 2, 3); }", function() {
        var view = new UIView("#box")
        var red = new UIColor({hex: "#ff0000"})
        assert.equal(view.backgroundColor, null)
        view.backgroundColor = red
        assert.ok(view.backgroundColor instanceof UIColor)
        assert.equal(view.backgroundColor.cgColor, document.getElementById("box").style.backgroundColor)
        assert.equal(getComputedStyle(document.getElementById("box")).backgroundColor, "rgb(255, 0, 0)")
        view.backgroundColor = null
        assert.equal(view.backgroundColor, null)
        assert.equal(document.getElementById("box").style.backgroundColor, "")
        assert.equal(getComputedStyle(document.getElementById("box")).backgroundColor, "rgb(1, 2, 3)")
    })
})

test("backgroundColor still refuses undefined", function() {
    page("<div id=\"box\"></div>")
    var view = new UIView("#box")
    assert.throws(() => { view.backgroundColor = undefined }, TypeError)
})

test("layer.borderColor = null removes the inline value so the stylesheet's returns, and reads back null", function() {
    page("<div id=\"box\"></div>")
    withRule("#box { border: 1px solid; border-color: rgb(1, 2, 3); }", function() {
        var view = new UIView("#box")
        var red = new UIColor({hex: "#ff0000"})
        assert.equal(view.layer.borderColor, null)
        view.layer.borderColor = red
        assert.ok(view.layer.borderColor instanceof UIColor)
        assert.equal(view.layer.borderColor.cgColor, document.getElementById("box").style.borderColor)
        assert.equal(getComputedStyle(document.getElementById("box")).borderTopColor, "rgb(255, 0, 0)")
        view.layer.borderColor = null
        assert.equal(view.layer.borderColor, null)
        assert.equal(document.getElementById("box").style.borderColor, "")
        assert.equal(getComputedStyle(document.getElementById("box")).borderTopColor, "rgb(1, 2, 3)")
    })
})

test("layer.borderColor still refuses undefined", function() {
    page("<div id=\"box\"></div>")
    var layer = new UIView("#box").layer
    assert.throws(() => { layer.borderColor = undefined }, TypeError)
})

// What reads back is the element's own inline value, so a hex is the browser's
// normalised rgb() and a named token is the var() it was written as.
test("backgroundColor reads back a hex as its normalised rgb and a named token as written", function() {
    page("<div id=\"box\"></div>")
    var view = new UIView("#box")
    view.backgroundColor = new UIColor({hex: "#ff0000"})
    assert.equal(view.backgroundColor.cgColor, "rgb(255, 0, 0)")
    view.backgroundColor = new UIColor({named: "border-primary-default"})
    assert.equal(view.backgroundColor.cgColor, "var(--border-primary-default)")
    assert.ok(view.backgroundColor instanceof UIColor)
})

test("layer.borderColor reads back a hex as its normalised rgb and a named token as written", function() {
    page("<div id=\"box\"></div>")
    var layer = new UIView("#box").layer
    layer.borderColor = new UIColor({hex: "#ff0000"})
    assert.equal(layer.borderColor.cgColor, "rgb(255, 0, 0)")
    layer.borderColor = new UIColor({named: "border-primary-default"})
    assert.equal(layer.borderColor.cgColor, "var(--border-primary-default)")
    assert.ok(layer.borderColor instanceof UIColor)
})

test("UILabel.textColor = null removes the inline colour so the stylesheet's returns, and reads back null", function() {
    page("<p id=\"title\">Hello</p>")
    withRule("#title { color: rgb(1, 2, 3); }", function() {
        var label = new UILabel("#title")
        assert.equal(label.textColor, null)
        label.textColor = new UIColor({hex: "#ff0000"})
        assert.ok(label.textColor instanceof UIColor)
        assert.equal(getComputedStyle(document.getElementById("title")).color, "rgb(255, 0, 0)")
        label.textColor = null
        assert.equal(label.textColor, null)
        assert.equal(document.getElementById("title").style.color, "")
        assert.equal(getComputedStyle(document.getElementById("title")).color, "rgb(1, 2, 3)")
    })
})

test("UILabel.textColor still refuses undefined, and reads a hex as its normalised rgb and a named token as written", function() {
    page("<p id=\"title\">Hello</p>")
    var label = new UILabel("#title")
    assert.throws(() => { label.textColor = undefined }, TypeError)
    label.textColor = new UIColor({hex: "#ff0000"})
    assert.equal(label.textColor.cgColor, "rgb(255, 0, 0)")
    label.textColor = new UIColor({named: "title-color"})
    assert.equal(label.textColor.cgColor, "var(--title-color)")
})
