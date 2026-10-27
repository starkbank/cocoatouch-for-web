import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, IBOutlet, UIView, UIControl, UIButton, UISwitch, UITextField, UIDatePicker, UIColorWell, UISegmentedControl, UIControlEvent } from "../src/index.js"


// A view placed with addSubview whose nib is `nib` and whose one action,
// declared over `selector` with `cls`, records every call with all its
// arguments; `outlet` also binds the element as an outlet.
function place({nib, selector, cls, outlet = false}) {
    class Host extends UIView {
        static nib = nib
        calls = []
    }
    Host.prototype.changed = function(...args) { this.calls.push(args) }
    if (outlet) { IBOutlet(selector, cls)(Host.prototype, "control", {}) }
    IBAction(selector, cls)(Host.prototype, "changed", {})
    page("<div id=\"root\"></div>")
    var view = new Host()
    new UIView("#root").addSubview(view)
    return view
}

function event(name) {
    return new window.Event(name, {bubbles: true, cancelable: true})
}

// Interface Builder connects an action to Touch Up Inside for a button and a
// plain control, to Value Changed for a switch, a date picker and a color well,
// and to Editing Did End for a text field.
test("an action dragged from a switch runs on Value Changed, not on a click", function() {
    var card = place({nib: "<div id=\"card\"><input id=\"toggle\" type=\"checkbox\"></div>", selector: "#toggle", cls: UISwitch})
    document.getElementById("toggle").dispatchEvent(event("click"))
    assert.equal(card.calls.length, 0, "a click that changes nothing is no Value Changed")
    document.getElementById("toggle").dispatchEvent(event("change"))
    assert.equal(card.calls.length, 1)
})

test("an action dragged from a text field runs on Editing Did End", function() {
    var card = place({nib: "<div id=\"card\"><input id=\"name\"></div>", selector: "#name", cls: UITextField})
    document.getElementById("name").dispatchEvent(event("input"))
    document.getElementById("name").dispatchEvent(event("click"))
    assert.equal(card.calls.length, 0)
    document.getElementById("name").dispatchEvent(event("blur"))
    assert.equal(card.calls.length, 1)
})

test("an action dragged from a date picker or a color well runs on Value Changed", function() {
    $.fn.datepicker = function() { return this }
    try {
        var card = place({nib: "<div id=\"card\"><div id=\"when\"><input></div></div>", selector: "#when", cls: UIDatePicker, outlet: true})
        card.control.sendActions({for: UIControlEvent.valueChanged})
        assert.equal(card.calls.length, 1)
        assert.equal(card.calls[0][0], card.control)
    } finally {
        delete $.fn.datepicker
    }
    assert.equal(UIColorWell._interfaceBuilderEvent, UIControlEvent.valueChanged)
})

test("an action dragged from a segmented control runs on Value Changed, and a tap on a segment is not one", function() {
    var card = place({nib: "<div id=\"card\"><div id=\"tabs\"><a id=\"one\">One</a><a id=\"two\">Two</a></div></div>", selector: "#tabs", cls: UISegmentedControl, outlet: true})
    document.getElementById("two").click()
    assert.equal(card.calls.length, 0)
    card.control.sendActions({for: UIControlEvent.valueChanged})
    assert.deepEqual(card.calls, [[card.control]])
})

test("an action dragged from a button or a plain control runs on Touch Up Inside, and cancels the click", function() {
    var button = place({nib: "<div id=\"card\"><a id=\"go\" href=\"/x\"></a><div id=\"row\"></div></div>", selector: "#go", cls: UIButton})
    var click = event("click")
    document.getElementById("go").dispatchEvent(click)
    assert.equal(button.calls.length, 1)
    assert.equal(click.defaultPrevented, true)
    var row = place({nib: "<div id=\"card\"><div id=\"row\"></div></div>", selector: "#row", cls: UIControl})
    document.getElementById("row").dispatchEvent(event("click"))
    assert.equal(row.calls.length, 1)
})

test("the sender of an action over an outlet's element is the outlet itself, the action's only argument", function() {
    var card = place({nib: "<div id=\"card\"><button id=\"pay\"></button></div>", selector: "#pay", cls: UIButton, outlet: true})
    document.getElementById("pay").click()
    assert.equal(card.calls.length, 1)
    assert.deepEqual(card.calls[0], [card.control])
    assert.equal(card.calls[0][0], card.control)
})

test("a disabled switch runs no Value Changed action, and sendActions still does", function() {
    var card = place({nib: "<div id=\"card\"><input id=\"toggle\" type=\"checkbox\"></div>", selector: "#toggle", cls: UISwitch, outlet: true})
    card.control.isEnabled = false
    document.getElementById("toggle").dispatchEvent(event("change"))
    assert.equal(card.calls.length, 0)
    card.control.sendActions({for: UIControlEvent.valueChanged})
    assert.equal(card.calls.length, 1)
})
