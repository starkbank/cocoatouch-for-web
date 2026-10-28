import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIColor, CALayer, CAGradientLayer, AVPlayerLayer } from "../src/index.js"


test("view.layer is the same CALayer for the view's whole life", function() {
    page("<div id=\"box\"></div>")
    var view = new UIView("#box")
    assert.ok(view.layer instanceof CALayer)
    assert.equal(view.layer, view.layer)
})

test("two views over elements that share an id each colour their own element", function() {
    page("<div id=\"host\"><div class=\"card\" id=\"dup\"></div><div class=\"card\" id=\"dup\"></div></div>")
    var [first, second] = [...document.querySelectorAll(".card")].map(function(element) {
        var view = new UIView("#dup")
        view._$el = $(element)
        return view
    })
    first.layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    assert.equal(first.layer.borderColor, "rgb(255, 0, 0)")
    assert.equal(second.layer.borderColor, null)
    assert.equal(document.querySelectorAll(".card")[0].style.borderColor, "rgb(255, 0, 0)")
    assert.equal(document.querySelectorAll(".card")[1].style.borderColor, "")
    second.layer.borderColor = new UIColor({hex: "#0000ff"}).cgColor
    assert.equal(document.querySelectorAll(".card")[1].style.borderColor, "rgb(0, 0, 255)")
    assert.equal(first.layer.borderColor, "rgb(255, 0, 0)")
})

test("after the element is replaced under the selector, the same layer writes to the new element", function() {
    page("<div id=\"host\"><div id=\"box\"></div></div>")
    var view = new UIView("#box")
    var layer = view.layer
    layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    document.getElementById("host").innerHTML = "<div id=\"box\"></div>"
    assert.equal(layer.borderColor, null, "the new element has no colour of its own")
    layer.borderColor = new UIColor({hex: "#00ff00"}).cgColor
    assert.equal(document.getElementById("box").style.borderColor, "rgb(0, 255, 0)")
    assert.equal(view.layer, layer)
})

test("addSublayer attaches a gradient and a player layer to the view's own element", function() {
    page("<div id=\"host\"><div class=\"card\" id=\"dup\"></div><div class=\"card\" id=\"dup\"></div></div>")
    var view = new UIView("#dup")
    view._$el = $(document.querySelectorAll(".card")[1])
    var gradient = new CAGradientLayer()
    view.layer.addSublayer(gradient)
    var player = new AVPlayerLayer()
    view.layer.addSublayer(player)
    var cards = document.querySelectorAll(".card")
    assert.equal(cards[0].children.length, 0)
    assert.equal(cards[1].children.length, 2)
})

test("a standalone CALayer(selector) still works through its selector", function() {
    page("<div id=\"box\"></div>")
    var layer = new CALayer("#box")
    layer.borderColor = new UIColor({hex: "#ff0000"}).cgColor
    assert.equal(document.getElementById("box").style.borderColor, "rgb(255, 0, 0)")
    assert.equal(layer.borderColor, "rgb(255, 0, 0)")
})
