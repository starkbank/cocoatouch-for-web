import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { CGAffineTransform, CGPoint, UIView, UIColor, UILabel, UIButton, UIControlState, CAGradientLayer, CALayer } from "../src/index.js"


const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`)

test("CGAffineTransform initializers build the matrices Core Graphics does", function() {
    assert.equal(CGAffineTransform.identity.isIdentity, true)
    var scale = new CGAffineTransform({scaleX: 2, y: 0.5})
    assert.deepEqual([scale.a, scale.b, scale.c, scale.d, scale.tx, scale.ty], [2, 0, 0, 0.5, 0, 0])
    var move = new CGAffineTransform({translationX: 10, y: -4})
    assert.deepEqual([move.tx, move.ty], [10, -4])
    var quarter = new CGAffineTransform({rotationAngle: Math.PI / 2})
    close(quarter.a, 0); close(quarter.b, 1); close(quarter.c, -1); close(quarter.d, 0)
    var both = scale.translatedBy({x: 3, y: 3})
    assert.deepEqual([both.tx, both.ty], [6, 1.5])
    var back = both.concatenating(both.inverted())
    close(back.a, 1); close(back.d, 1); close(back.tx, 0); close(back.ty, 0)
    assert.equal(new CGPoint({x: 1, y: 2}).y, 2)
    assert.equal(CGPoint.zero.x, 0)
})

test("UIView.transform writes the CSS matrix and reads it back, transitioning inside UIView.animate", function() {
    var css = {}
    var view = new UIView("#box")
    view._$el = {length: 1, css: function(name, value) { if (value === undefined) { return css[name] || "" } css[name] = value; return this }}
    view.transform = new CGAffineTransform({scaleX: 1, y: 0})
    assert.equal(css.transform, "matrix(1, 0, 0, 0, 0, 0)")
    assert.equal(view.transform.d, 0)
    view.transform = CGAffineTransform.identity
    assert.equal(css.transform, "none")
    assert.equal(view.transform.isIdentity, true)
    UIView.animate({withDuration: 0.3, animations: () => { view.transform = new CGAffineTransform({translationX: 5}) }})
    assert.equal(css.transition, "transform 300ms 0ms")
    assert.equal(css.transform, "matrix(1, 0, 0, 1, 5, 0)")
})

test("UIColor(named:) reads the design token, clear is transparent, and labels and buttons take colors", function() {
    assert.equal(new UIColor({named: "fail-text-color"}).cgColor, "var(--fail-text-color)")
    assert.equal(UIColor.clear.cgColor, "transparent")
    assert.equal(new UIColor({red: 1, green: 0, blue: 0, alpha: 0.5}).cgColor, "rgba(255, 0, 0, 0.5)")
    assert.equal(new UIColor({white: 1}).cgColor, "rgba(255, 255, 255, 1)")
    var css = {}
    var stub = {length: 1, css: function(name, value) { if (value === undefined) { return css[name] || "" } css[name] = value; return this }, html: function() { return this }, text: function() { return "" }}
    var label = new UILabel("#price")
    label._$el = stub
    label.textColor = new UIColor({named: "title-color"})
    assert.equal(css.color, "var(--title-color)")
    assert.equal(label.textColor.cgColor, "var(--title-color)")
    var button = new UIButton("#cta")
    button._$el = stub
    button.setTitleColor(UIColor.white)
    assert.equal(css.color, "#FFFFFF")
    button.setTitleColor(UIColor.black, {for: UIControlState.disabled})
    assert.equal(css.color, "#FFFFFF")
    assert.equal(button.titleColor({for: UIControlState.disabled}).cgColor, "#000000")
})

test("CAGradientLayer paints a linear-gradient along its points into an element its superlayer appends", function() {
    var created = null
    globalThis.document.createElement = function() { created = {style: {}}; return created }
    var layer = new CAGradientLayer()
    layer.colors = [new UIColor({white: 0.16, alpha: 0}).cgColor, new UIColor({white: 0.16, alpha: 0.5}).cgColor]
    layer.locations = [0.15, 1]
    layer.startPoint = new CGPoint({x: 0.5, y: 1})
    layer.endPoint = new CGPoint({x: 0.5, y: 0})
    var appended = []
    var host = {append: function(element) { appended.push(element); return host }}
    var previous = globalThis.$
    globalThis.$ = function() { return host }
    new CALayer("#header").addSublayer(layer)
    globalThis.$ = previous
    assert.equal(appended[0], created)
    assert.equal(created.style.position, "absolute")
    assert.equal(created.style.background, "linear-gradient(0deg, rgba(41, 41, 41, 0) 15%, rgba(41, 41, 41, 0.5) 100%)")
    layer.endPoint = new CGPoint({x: 1, y: 1})
    layer.startPoint = new CGPoint({x: 0, y: 0})
    assert.ok(created.style.background.startsWith("linear-gradient(135deg"))
    delete globalThis.document.createElement
})
