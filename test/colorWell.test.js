import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UIColorWell, UIControl, UIColor, UIControlEvent } from "../src/index.js"


function well() {
    page("<div id=\"swatch\"></div>")
    return new UIColorWell("#swatch")
}

function input() {
    return document.querySelector("#swatch input")
}

// What a browser does for a pick: the value, then the change event.
function pick(value) {
    var field = input()
    field.value = value
    field.dispatchEvent(new window.Event("change", {bubbles: true}))
}

function counting(colorWell) {
    var calls = []
    colorWell.addTarget({}, {action(sender) { calls.push(sender.selectedColor && sender.selectedColor.cgColor) }, for: UIControlEvent.valueChanged})
    return calls
}

test("a UIColorWell is a control that draws one native color input of its own", function() {
    var colorWell = well()
    assert.ok(colorWell instanceof UIControl)
    assert.equal(document.querySelectorAll("#swatch input").length, 1)
    assert.equal(input().type, "color")
    new UIColorWell("#swatch")
    assert.equal(document.querySelectorAll("#swatch input").length, 1, "a second view over the element adds none")
})

test("a pick sets selectedColor and fires valueChanged once, with the new color already in place", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    pick("#ff8800")
    assert.equal(colorWell.selectedColor.cgColor, "#ff8800")
    assert.deepEqual(calls, ["#ff8800"])
    pick("#00ff10")
    assert.deepEqual(calls, ["#ff8800", "#00ff10"])
    assert.ok(colorWell.selectedColor instanceof UIColor)
})

test("a pick at full alpha is a hex color, so an app reads its six digits from hex, and one with alpha is rgba", function() {
    var colorWell = well()
    pick("#AA0Bcc")
    assert.equal(colorWell.selectedColor.hex, "#aa0bcc")
    colorWell.selectedColor = new UIColor({red: 0, green: 0, blue: 0, alpha: 0.25})
    pick("#aa0bcc")
    assert.equal(colorWell.selectedColor.hex, "rgba(170, 11, 204, 0.25)")
})

test("selectedColor starts nil", function() {
    assert.equal(well().selectedColor, null)
})

test("setting selectedColor from code updates the input and fires nothing, as on Apple", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    colorWell.selectedColor = new UIColor({red: 1, green: 0.5, blue: 0})
    assert.equal(input().value, "#ff8000")
    assert.equal(colorWell.selectedColor.cgColor, "rgba(255, 128, 0, 1)")
    colorWell.selectedColor = new UIColor({hex: "#102030"})
    assert.equal(input().value, "#102030")
    colorWell.selectedColor = new UIColor({white: 1})
    assert.equal(input().value, "#ffffff")
    assert.deepEqual(calls, [])
})

test("nil clears the selection without firing", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    colorWell.selectedColor = new UIColor({hex: "#102030"})
    colorWell.selectedColor = null
    assert.equal(colorWell.selectedColor, null)
    assert.equal(input().value, "#000000")
    colorWell.selectedColor = undefined
    assert.equal(colorWell.selectedColor, null)
    assert.deepEqual(calls, [])
})

test("a pick keeps the alpha of the previous color, under either supportsAlpha, and is 1 when there was none", function() {
    for (var supportsAlpha of [true, false]) {
        var colorWell = well()
        colorWell.supportsAlpha = supportsAlpha
        colorWell.selectedColor = new UIColor({red: 0, green: 0, blue: 0, alpha: 0.5})
        pick("#336699")
        assert.equal(colorWell.selectedColor.cgColor, "rgba(51, 102, 153, 0.5)", String(supportsAlpha))
        pick("#112233")
        assert.equal(colorWell.selectedColor.cgColor, "rgba(17, 34, 51, 0.5)", "alpha 0.5 stays 0.5 after a second pick")
        var fresh = well()
        fresh.supportsAlpha = supportsAlpha
        pick("#112233")
        assert.equal(fresh.selectedColor.cgColor, "#112233", "no previous color")
    }
})

test("the alpha of a hex color with alpha, a clear color and a nil-then-pick follow the same rule", function() {
    var colorWell = well()
    colorWell.selectedColor = new UIColor({hex: "#11223380"})
    assert.equal(input().value, "#112233")
    pick("#445566")
    assert.match(colorWell.selectedColor.cgColor, /^rgba\(68, 85, 102, 0\.50\d*\)$/)
    colorWell.selectedColor = UIColor.clear
    pick("#445566")
    assert.equal(colorWell.selectedColor.cgColor, "rgba(68, 85, 102, 0)")
    colorWell.selectedColor = null
    pick("#445566")
    assert.equal(colorWell.selectedColor.cgColor, "#445566", "nil forgets the alpha")
})

test("supportsAlpha defaults to true and reads back what was set; a non-Bool is refused", function() {
    var colorWell = well()
    assert.equal(colorWell.supportsAlpha, true)
    colorWell.supportsAlpha = false
    assert.equal(colorWell.supportsAlpha, false)
    colorWell.supportsAlpha = true
    assert.equal(colorWell.supportsAlpha, true)
    assert.throws(() => { colorWell.supportsAlpha = "no" }, (error) => error instanceof TypeError && /supportsAlpha/.test(error.message))
})

test("title is drawn as the input's accessible label, as text, and nil removes it", function() {
    var colorWell = well()
    assert.equal(colorWell.title, null)
    colorWell.title = "Brand <b>colour</b>"
    assert.equal(input().getAttribute("aria-label"), "Brand <b>colour</b>")
    assert.equal(colorWell.title, "Brand <b>colour</b>")
    assert.equal(document.querySelectorAll("#swatch b").length, 0)
    colorWell.title = null
    assert.equal(input().hasAttribute("aria-label"), false)
    assert.equal(colorWell.title, null)
})

test("a disabled well opens nothing and sends no action: the input is disabled and a pick that gets through is ignored", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    colorWell.selectedColor = new UIColor({hex: "#102030"})
    colorWell.isEnabled = false
    assert.equal(input().disabled, true)
    input().dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    pick("#ff0000")
    assert.deepEqual(calls, [])
    assert.equal(colorWell.selectedColor.cgColor, "#102030", "the color the app set, untouched")
    assert.equal(input().value, "#102030", "the field goes back to what was selected")
    colorWell.isEnabled = true
    assert.equal(input().disabled, false)
    pick("#ff0000")
    assert.deepEqual(calls, ["#ff0000"])
})

test("sendActions still fires on a disabled well, as on any control", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    colorWell.isEnabled = false
    colorWell.sendActions({for: UIControlEvent.valueChanged})
    assert.equal(calls.length, 1)
})

test("a value that is not #rrggbb is ignored: no color, no event", function() {
    var colorWell = well()
    var calls = counting(colorWell)
    colorWell.selectedColor = new UIColor({hex: "#102030"})
    var field = input()
    var original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")
    var current = "javascript:alert(1)"
    Object.defineProperty(field, "value", {configurable: true, get() { return current }, set(value) { original.set.call(field, value) }})
    for (current of ["javascript:alert(1)", "#12345", "#1234567", "red", "rgb(1,2,3)", "#gggggg", "", "#ff00ff;x", "url(x)", " #ff00ff"]) {
        field.dispatchEvent(new window.Event("change", {bubbles: true}))
    }
    assert.deepEqual(calls, [])
    assert.equal(colorWell.selectedColor.cgColor, "#102030", "the color the app set, untouched")
    current = "#FF00FF"
    field.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(calls, ["#ff00ff"], "upper case is a valid six-digit hex")
})

test("a color named after a token is drawn by its resolved value, and one that cannot be drawn leaves the input black", function() {
    var colorWell = well()
    document.documentElement.style.setProperty("--brand-swatch", "#0070E0")
    try {
        colorWell.selectedColor = new UIColor({named: "brand-swatch"})
        assert.equal(input().value, "#0070e0")
        colorWell.selectedColor = new UIColor({named: "no-such-token-here"})
        assert.equal(input().value, "#000000")
        assert.equal(colorWell.selectedColor.cgColor, "var(--no-such-token-here)")
    } finally {
        document.documentElement.style.removeProperty("--brand-swatch")
    }
})

test("a color well bound as an outlet works, and the app never holds the input", function() {
    class Owner extends UIView {}
    Owner.nib = "<div id=\"owner-swatch\"></div>"
    IBOutlet("#owner-swatch", UIColorWell)(Owner.prototype, "swatch", {})
    page("<div id=\"owner\"></div>")
    var owner = new Owner("#owner")
    var calls = counting(owner.swatch)
    var field = document.querySelector("#owner-swatch input")
    field.value = "#0a0b0c"
    field.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(calls, ["#0a0b0c"])
    assert.equal("input" in owner.swatch, false)
    assert.equal(Object.keys(owner.swatch).some((key) => owner.swatch[key] === field), false)
})

test("a well created in code draws its input when it is placed", function() {
    page("<div id=\"host\"></div>")
    var colorWell = new UIColorWell()
    new UIView("#host").addSubview(colorWell)
    assert.equal(document.querySelectorAll("#host input[type=color]").length, 1)
})

// The framework ships the input's layout, so no app stylesheet has to name it: the
// input fills the well, and is invisible when the app paints its own swatch there.
test("the input fills the well by default, and the well is positioned for it", function() {
    page("<div id=\"swatch\"></div>")
    new UIColorWell("#swatch")
    var style = input().style
    assert.equal(style.position, "absolute")
    assert.equal(style.width, "100%")
    assert.equal(style.height, "100%")
    assert.equal(style.top, "0px")
    assert.equal(style.left, "0px")
    assert.equal(style.margin, "0px")
    assert.equal(style.border === "0px" || style.borderWidth === "0px", true)
    assert.equal(style.cursor, "pointer")
    assert.equal(document.getElementById("swatch").style.position, "relative")
})

test("a well that is already positioned keeps its own position", function() {
    page("<div id=\"swatch\" style=\"position: absolute\"></div>")
    new UIColorWell("#swatch")
    assert.equal(document.getElementById("swatch").style.position, "absolute")
})

test("an unpainted well shows the native swatch, and one the app paints leaves the input transparent", function() {
    var colorWell = well()
    assert.equal(input().style.opacity, "", "nothing painted: the native swatch is the well")
    colorWell.backgroundColor = new UIColor({hex: "#ff0000"})
    assert.equal(input().style.opacity, "0")
    colorWell.backgroundColor = null
    assert.equal(input().style.opacity, "")
})

test("a well painted by the stylesheet is transparent at once", function() {
    page("<style>#swatch { background-color: rgb(0, 112, 224) }</style><div id=\"swatch\"></div>")
    new UIColorWell("#swatch")
    assert.equal(input().style.opacity, "0")
    page("<style>#swatch { background-image: linear-gradient(red, blue) }</style><div id=\"swatch\"></div>")
    new UIColorWell("#swatch")
    assert.equal(input().style.opacity, "0")
})
