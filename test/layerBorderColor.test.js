import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIColor } from "../src/index.js"


function box() {
    page("<div id=\"box\"></div>")
    return new UIView("#box")
}

function element() {
    return document.getElementById("box")
}

// Apple's CALayer.borderColor is a CGColor, UIColor.cgColor, never the UIColor.
test("borderColor takes a CGColor, which here is the string UIColor.cgColor returns", function() {
    var layer = box().layer
    layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    assert.equal(element().style.borderColor, "rgb(255, 0, 0)")
    layer.borderColor = new UIColor({named: "border-primary-default"}).cgColor
    assert.equal(element().style.borderColor, "var(--border-primary-default)")
})

test("a UIColor is refused with a TypeError that names the Swift signature and the cgColor to write", function() {
    var layer = box().layer
    assert.throws(
        () => { layer.borderColor = new UIColor({hex: "#ff0000"}) },
        (error) => error instanceof TypeError
            && /CALayer\.borderColor/.test(error.message)
            && /var borderColor: CGColor\?/.test(error.message)
            && /\.cgColor/.test(error.message)
            && /UIColor/.test(error.message)
    )
    assert.equal(element().style.borderColor, "")
})

test("what is neither a CGColor nor nil is refused, and undefined still is", function() {
    var layer = box().layer
    for (var value of [undefined, 5, {}, true, ["red"]]) {
        assert.throws(() => { layer.borderColor = value }, TypeError, String(value))
    }
    assert.equal(element().style.borderColor, "")
})

test("nil clears the inline color, so the stylesheet's returns, and a color set reads back as the string", function() {
    var layer = box().layer
    assert.equal(layer.borderColor, null)
    layer.borderColor = new UIColor({hex: "#00ff00"}).cgColor
    assert.equal(layer.borderColor, "rgb(0, 255, 0)")
    assert.equal(typeof layer.borderColor, "string")
    layer.borderColor = null
    assert.equal(layer.borderColor, null)
    assert.equal(element().style.borderColor, "")
})

test("the string a read gives is one a write accepts back", function() {
    var layer = box().layer
    layer.borderColor = new UIColor({hex: "#0070e0"}).cgColor
    var read = layer.borderColor
    layer.borderColor = null
    layer.borderColor = read
    assert.equal(layer.borderColor, read)
})
