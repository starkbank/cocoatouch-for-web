import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UITextField, UISearchTextField, UIColor } from "../src/index.js"


function field(style = "") {
    page("<style>#name { color: rgb(1, 2, 3) } #name::placeholder { color: rgb(9, 9, 9) }</style><input id=\"name\" placeholder=\"Name\" style=\"" + style + "\">")
    return new UITextField("#name")
}

function input() {
    return document.getElementById("name")
}

test("setting a color draws it as the input's inline color", function() {
    var textField = field()
    textField.textColor = new UIColor({hex: "#ff0000"})
    assert.equal(input().style.color, "rgb(255, 0, 0)")
    textField.textColor = new UIColor({red: 0, green: 0.5, blue: 1, alpha: 0.5})
    assert.equal(input().style.color, "rgba(0, 128, 255, 0.5)")
})

test("the getter returns the inline color only, never the computed one, and null when there is none", function() {
    var textField = field()
    assert.equal(textField.textColor, null, "the stylesheet's rgb(1, 2, 3) is not the field's own color")
    textField.textColor = new UIColor({hex: "#00ff00"})
    assert.ok(textField.textColor instanceof UIColor)
    assert.equal(textField.textColor.cgColor, "rgb(0, 255, 0)")
    assert.equal(field("color: blue").textColor.cgColor, "blue")
})

test("nil removes the inline color, so the stylesheet's returns, and reads back as null", function() {
    var textField = field()
    textField.textColor = new UIColor({hex: "#ff0000"})
    textField.textColor = null
    assert.equal(input().style.color, "")
    assert.equal(textField.textColor, null)
    assert.equal(input().getAttribute("style") || "", "")
    assert.equal(getComputedStyle(input()).color, "rgb(1, 2, 3)")
    textField.textColor = undefined
    assert.equal(textField.textColor, null)
})

test("setting the same value twice is the same as once", function() {
    var textField = field()
    var red = new UIColor({hex: "#ff0000"})
    textField.textColor = red
    textField.textColor = red
    assert.equal(input().getAttribute("style"), "color: rgb(255, 0, 0);")
    textField.textColor = null
    textField.textColor = null
    assert.equal(input().getAttribute("style") || "", "")
})

test("an invalid-then-valid round trip leaves no inline color behind", function() {
    var textField = field()
    for (var round = 0; round < 3; round++) {
        textField.textColor = new UIColor({hex: "#d92d20"})
        assert.equal(textField.textColor.cgColor, "rgb(217, 45, 32)")
        textField.textColor = null
        assert.equal(textField.textColor, null)
        assert.equal(input().style.color, "")
    }
})

test("the placeholder's color and the text are untouched", function() {
    var textField = field()
    textField.text = "Ana"
    textField.textColor = new UIColor({hex: "#ff0000"})
    assert.equal(input().getAttribute("placeholder"), "Name")
    assert.equal(input().value, "Ana")
    assert.equal(input().getAttribute("style"), "color: rgb(255, 0, 0);")
    assert.match(document.querySelector("style").textContent, /#name::placeholder \{ color: rgb\(9, 9, 9\) \}/)
})

test("it works on an outlet bound by a nib", function() {
    class Owner extends UIView {}
    Owner.nib = "<input id=\"owner-name\">"
    IBOutlet("#owner-name", UITextField)(Owner.prototype, "nameField", {})
    page("<div id=\"owner\"></div>")
    var owner = new Owner("#owner")
    owner.nameField.textColor = new UIColor({hex: "#123456"})
    assert.equal(document.getElementById("owner-name").style.color, "rgb(18, 52, 86)")
    owner.nameField.textColor = null
    assert.equal(owner.nameField.textColor, null)
})

test("a search field colors its own input, where the typed text is, not the tokens' wrapper", function() {
    page("<div id=\"search\"></div>")
    var search = new UISearchTextField("#search")
    search.textColor = new UIColor({hex: "#ff0000"})
    assert.equal(document.querySelector("#search input").style.color, "rgb(255, 0, 0)")
    assert.equal(document.getElementById("search").style.color, "")
    assert.equal(search.textColor.cgColor, "rgb(255, 0, 0)")
    search.textColor = null
    assert.equal(document.querySelector("#search input").style.color, "")
    assert.equal(search.textColor, null)
})
