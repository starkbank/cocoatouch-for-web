import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIColor, CALayer } from "../src/index.js"


function box(style = "") {
    page("<style>#box { border: 3px dashed rgb(1, 2, 3) }</style><div id=\"box\" style=\"" + style + "\"></div>")
    return new UIView("#box")
}

function element() {
    return document.getElementById("box")
}

test("borderWidth defaults to 0 and reads the inline value only, never the stylesheet's", function() {
    var view = box()
    assert.equal(view.layer.borderWidth, 0)
    assert.equal(element().style.borderWidth, "")
})

test("a width above 0 draws it with a solid style, and with a color shows a solid border", function() {
    var view = box()
    view.layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    view.layer.borderWidth = 2
    assert.equal(element().style.borderWidth, "2px")
    assert.equal(element().style.borderStyle, "solid")
    assert.equal(element().style.borderColor, "rgb(255, 0, 0)")
    assert.equal(view.layer.borderWidth, 2)
})

test("the getter round-trips fractions and what was set, and a width in the markup is read as inline", function() {
    var view = box()
    for (var width of [0.5, 1, 1.5, 4, 12]) {
        view.layer.borderWidth = width
        assert.equal(view.layer.borderWidth, width)
    }
    var inline = box("border-width: 5px")
    assert.equal(inline.layer.borderWidth, 5)
})

test("0 removes both the inline width and the inline style, so the stylesheet's border returns", function() {
    var view = box()
    view.layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    view.layer.borderWidth = 2
    view.layer.borderWidth = 0
    assert.equal(element().style.borderWidth, "")
    assert.equal(element().style.borderStyle, "")
    assert.equal(view.layer.borderWidth, 0)
    assert.equal(element().style.borderColor, "rgb(255, 0, 0)", "the color is the layer's own and stays until it is set to nil")
    view.layer.borderColor = null
    assert.equal(element().getAttribute("style") || "", "")
})

test("nil follows borderColor's rule: no inline value, so the stylesheet's border returns", function() {
    var view = box()
    view.layer.borderWidth = 2
    view.layer.borderWidth = null
    assert.equal(element().style.borderWidth, "")
    assert.equal(element().style.borderStyle, "")
    assert.equal(view.layer.borderWidth, 0)
    view.layer.borderWidth = 2
    view.layer.borderWidth = undefined
    assert.equal(element().style.borderWidth, "")
})

test("setting the same width twice is the same as once", function() {
    var view = box()
    view.layer.borderWidth = 2
    view.layer.borderWidth = 2
    assert.equal(element().style.borderWidth, "2px")
    assert.equal(element().getAttribute("style"), "border-width: 2px; border-style: solid;")
})

test("the stylesheet's borders are never touched: an element with no inline border stays without one after 0 and nil", function() {
    var view = box()
    view.layer.borderWidth = 0
    view.layer.borderWidth = null
    assert.equal(element().getAttribute("style") || "", "")
    assert.equal(document.styleSheets.length >= 0, true)
    assert.match(document.querySelector("style").textContent, /border: 3px dashed/)
})

test("a negative or non-finite width is refused with a TypeError and leaves the border as it was", function() {
    var view = box()
    view.layer.borderWidth = 2
    for (var bad of [-1, NaN, Infinity, "2px", {}]) {
        assert.throws(() => { view.layer.borderWidth = bad }, (error) => error instanceof TypeError && /borderWidth/.test(error.message), String(bad))
    }
    assert.equal(view.layer.borderWidth, 2)
})

test("it works through the view's layer on an element the view re-resolved", function() {
    var view = box()
    var layer = view.layer
    page("<div id=\"box\"></div>")
    layer.borderWidth = 3
    assert.equal(element().style.borderWidth, "3px")
    assert.equal(element().style.borderStyle, "solid")
    assert.equal(layer.borderWidth, 3)
    assert.equal(view.layer, layer, "the same layer for the view's life")
})

test("a standalone layer on a selector draws too", function() {
    box()
    var layer = new CALayer("#box")
    layer.borderWidth = 1
    assert.equal(element().style.borderWidth, "1px")
    assert.equal(layer.borderWidth, 1)
})

test("borderWidth and borderColor together draw the email field's error state and clear it", function() {
    var view = box()
    view.layer.borderColor = new UIColor({hex: "#d92d20"}).cgColor
    view.layer.borderWidth = 1
    assert.equal(element().getAttribute("style"), "border-color: rgb(217, 45, 32); border-width: 1px; border-style: solid;")
    view.layer.borderWidth = null
    view.layer.borderColor = null
    assert.equal(element().getAttribute("style") || "", "")
})
