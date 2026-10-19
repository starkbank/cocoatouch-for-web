import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIControl, UIButton, UIControlEvent } from "../src/index.js"


class TapControl extends UIControl {}
TapControl.nib = "<button class=\"tap\">tap</button>"

function stage() {
    page("<div id=\"box\"></div>")
    return new UIView("#box")
}

function counter() {
    var target = {calls: 0}
    target.action = function() { target.calls += 1 }
    return target
}

test("a target added before the control is placed fires once after addSubview", function() {
    var box = stage()
    var control = new TapControl()
    var target = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    box.addSubview(control)
    control.$el.trigger("click")
    assert.equal(target.calls, 1)
})

test("a target added before placement fires once after removeFromSuperview and addSubview", function() {
    var box = stage()
    var control = new TapControl()
    var target = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    box.addSubview(control)
    control.removeFromSuperview()
    box.addSubview(control)
    control.$el.trigger("click")
    assert.equal(target.calls, 1)
})

test("a target added before placement fires once after insertSubview", function() {
    var box = stage()
    box.$el.append("<i></i><i></i>")
    var control = new TapControl()
    var target = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    box.insertSubview(control, {at: 1})
    control.$el.trigger("click")
    assert.equal(target.calls, 1)
    assert.equal($("#box").children().eq(1)[0], control.$el[0])
})

test("a target added after placement still fires once, and again once after a second placement", function() {
    var box = stage()
    var control = new TapControl()
    box.addSubview(control)
    var target = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    control.$el.trigger("click")
    assert.equal(target.calls, 1)
    control.removeFromSuperview()
    box.addSubview(control)
    control.$el.trigger("click")
    assert.equal(target.calls, 2)
})

test("removeTarget after re-placement removes the action", function() {
    var box = stage()
    var control = new TapControl()
    var target = counter()
    var other = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    control.addTarget(other, {action: other.action, for: UIControlEvent.touchUpInside})
    box.addSubview(control)
    control.removeFromSuperview()
    box.addSubview(control)
    control.removeTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    control.$el.trigger("click")
    assert.equal(target.calls, 0)
    assert.equal(other.calls, 1)
})

test("targets of other events survive placement under their own event", function() {
    var box = stage()
    var control = new TapControl()
    var tapped = counter()
    var changed = counter()
    control.addTarget(tapped, {action: tapped.action, for: UIControlEvent.touchUpInside})
    control.addTarget(changed, {action: changed.action, for: UIControlEvent.valueChanged})
    box.addSubview(control)
    control.sendActions({for: UIControlEvent.valueChanged})
    assert.equal(tapped.calls, 0)
    assert.equal(changed.calls, 1)
})

test("a button placed in code keeps its target and stops the click at the control", function() {
    var box = stage()
    var button = new UIButton()
    var target = counter()
    var outside = 0
    box.$el.on("click", function() { outside += 1 })
    button.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    box.addSubview(button)
    button.$el.trigger("click")
    assert.equal(target.calls, 1)
    assert.equal(outside, 0)
})

test("a control placed in a superview that is not in the page yet keeps its node and its target", function() {
    var box = stage()
    var holder = new UIView("#holder")
    holder._$el = $("<div id=\"holder\"></div>")
    var control = new TapControl()
    var target = counter()
    control.addTarget(target, {action: target.action, for: UIControlEvent.touchUpInside})
    holder.addSubview(control)
    var node = control.$el[0]
    assert.equal(control.$el[0], node)
    assert.equal(holder.$el.children()[0], node)
    box.$el.append(holder.$el)
    control.$el.trigger("click")
    assert.equal(target.calls, 1)
})

test("a view looks its element up again only after the cached one was in the page and left it", function() {
    page("<div id=\"host\"><b id=\"icon\"></b></div>")
    var view = new UIView("#icon")
    var first = view.$el[0]
    assert.equal(view.$el[0], first)
    document.getElementById("host").innerHTML = "<b id=\"icon\"></b>"
    var second = view.$el[0]
    assert.notEqual(second, first)
    assert.equal(second, document.getElementById("icon"))
    assert.equal(view.$el[0], second)
})

test("a detached element lent to a view that was never in the page is not replaced by a lookup", function() {
    page("<b id=\"icon\"></b>")
    var view = new UIView("#icon")
    var lent = $("<b id=\"icon\"></b>")
    view._$el = lent
    assert.equal(view.$el, lent)
    assert.equal(view.$el, lent)
    document.body.appendChild(lent[0])
    assert.equal(view.$el, lent)
})

test("a node that was in the page when the view adopted it is looked up again when replaced before the first read", function() {
    page("<div id=\"host\"><b id=\"icon\"></b></div>")
    var view = new UIView("#icon")
    view._$el = $("#icon")
    document.getElementById("host").innerHTML = "<b id=\"icon\"></b>"
    assert.equal(view.$el[0], document.getElementById("icon"))
})
