import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UISwitch, UIAccessibility } from "../src/index.js"


function view() {
    page("<div id=\"meter\" role=\"progressbar\"></div>")
    return new UIView("#meter")
}

function meter() {
    return document.getElementById("meter")
}

test("accessibilityValue starts nil with no aria-valuetext", function() {
    var subject = view()
    assert.equal(subject.accessibilityValue, null)
    assert.equal(meter().hasAttribute("aria-valuetext"), false)
})

test("it draws aria-valuetext, round-trips, and nil removes it", function() {
    var subject = view()
    subject.accessibilityValue = "40 percent"
    assert.equal(meter().getAttribute("aria-valuetext"), "40 percent")
    assert.equal(subject.accessibilityValue, "40 percent")
    subject.accessibilityValue = "R$ 1.234,56"
    assert.equal(subject.accessibilityValue, "R$ 1.234,56")
    subject.accessibilityValue = null
    assert.equal(meter().hasAttribute("aria-valuetext"), false)
    assert.equal(subject.accessibilityValue, null)
    subject.accessibilityValue = "x"
    subject.accessibilityValue = undefined
    assert.equal(meter().hasAttribute("aria-valuetext"), false)
})

test("it is text: markup stays characters, and the empty string is a value that draws nothing", function() {
    var subject = view()
    subject.accessibilityValue = "<b>40</b>"
    assert.equal(meter().getAttribute("aria-valuetext"), "<b>40</b>")
    assert.equal(meter().querySelectorAll("b").length, 0)
    subject.accessibilityValue = ""
    assert.equal(meter().hasAttribute("aria-valuetext"), false)
    assert.equal(subject.accessibilityValue, null)
})

test("it is independent of accessibilityLabel and of the expanded status", function() {
    var subject = view()
    subject.accessibilityLabel = "Progress"
    subject.accessibilityValue = "40 percent"
    subject.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded
    assert.equal(meter().getAttribute("aria-label"), "Progress")
    assert.equal(meter().getAttribute("aria-valuetext"), "40 percent")
    subject.accessibilityLabel = null
    assert.equal(meter().getAttribute("aria-valuetext"), "40 percent")
    assert.equal(meter().getAttribute("aria-expanded"), "true")
    subject.accessibilityValue = null
    assert.equal(meter().hasAttribute("aria-expanded"), true)
})

test("a value that is not a String is refused with Apple's signature", function() {
    var subject = view()
    subject.accessibilityValue = "40"
    for (var bad of [40, true, {}, ["a"]]) {
        assert.throws(() => { subject.accessibilityValue = bad }, (error) => error instanceof TypeError && /accessibilityValue/.test(error.message), String(bad))
    }
    assert.equal(subject.accessibilityValue, "40")
})

test("a re-resolved element gets it back when the view is placed again, and a view made in code draws it when placed", function() {
    var subject = view()
    subject.accessibilityValue = "40 percent"
    page("<div id=\"meter\"></div>")
    subject.didMoveToSuperview()
    assert.equal(meter().getAttribute("aria-valuetext"), "40 percent")
    class Made extends UIView {}
    Made.nib = "<div class=\"made\"></div>"
    var host = new UIView("#meter")
    var made = new Made()
    made.accessibilityValue = "on"
    host.addSubview(made)
    assert.equal(document.querySelector(".made").getAttribute("aria-valuetext"), "on")
})

test("a control that is not enabled keeps its state: the value touches nothing else", function() {
    page("<input id=\"flag\" type=\"checkbox\">")
    var flag = new UISwitch("#flag")
    flag.isEnabled = false
    flag.accessibilityValue = "armed"
    assert.equal(flag.isEnabled, false)
    assert.equal(document.getElementById("flag").getAttribute("aria-valuetext"), "armed")
})
