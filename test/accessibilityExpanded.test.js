import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIControl, UIAccessibility } from "../src/index.js"


function view() {
    page("<div id=\"toggle\"><span id=\"inner\"></span></div>")
    return new UIView("#toggle")
}

function toggle() {
    return document.getElementById("toggle")
}

test("UIAccessibility.ExpandedStatus has Apple's three cases and raw values, frozen", function() {
    assert.deepEqual({...UIAccessibility.ExpandedStatus}, {unsupported: 0, expanded: 1, collapsed: 2})
    assert.ok(Object.isFrozen(UIAccessibility.ExpandedStatus))
    assert.equal(UIAccessibility.ExpandedStatus, UIAccessibility.ExpandedStatus)
})

test("the default is unsupported and the element has no aria-expanded", function() {
    var subject = view()
    assert.equal(subject.accessibilityExpandedStatus, UIAccessibility.ExpandedStatus.unsupported)
    assert.equal(toggle().hasAttribute("aria-expanded"), false)
})

test("each case draws its value, and unsupported removes it", function() {
    var subject = view()
    var status = UIAccessibility.ExpandedStatus
    subject.accessibilityExpandedStatus = status.expanded
    assert.equal(toggle().getAttribute("aria-expanded"), "true")
    subject.accessibilityExpandedStatus = status.collapsed
    assert.equal(toggle().getAttribute("aria-expanded"), "false")
    subject.accessibilityExpandedStatus = status.unsupported
    assert.equal(toggle().hasAttribute("aria-expanded"), false)
})

test("the getter round-trips each case", function() {
    var subject = view()
    for (var status of Object.values(UIAccessibility.ExpandedStatus)) {
        subject.accessibilityExpandedStatus = status
        assert.equal(subject.accessibilityExpandedStatus, status)
    }
})

test("it is drawn on the view's own element, not on its children or its siblings", function() {
    var subject = view()
    subject.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded
    assert.equal(document.getElementById("inner").hasAttribute("aria-expanded"), false)
    assert.equal(document.querySelectorAll("[aria-expanded]").length, 1)
})

test("a value that is not a case is refused with Apple's signature and changes nothing", function() {
    var subject = view()
    subject.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded
    for (var bad of [3, -1, "expanded", true, null, undefined, {}]) {
        assert.throws(() => { subject.accessibilityExpandedStatus = bad }, (error) => error instanceof TypeError && /accessibilityExpandedStatus/.test(error.message), String(bad))
    }
    assert.equal(toggle().getAttribute("aria-expanded"), "true")
})

test("a re-resolved element keeps it once the view is placed again", function() {
    var subject = view()
    subject.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.collapsed
    page("<div id=\"toggle\"></div>")
    assert.equal(toggle().hasAttribute("aria-expanded"), false)
    subject.didMoveToSuperview()
    assert.equal(toggle().getAttribute("aria-expanded"), "false")
})

test("a view created in code draws it when it is placed, and a control draws it too", function() {
    class Made extends UIView {}
    Made.nib = "<div class=\"made\"></div>"
    class MadeControl extends UIControl {}
    MadeControl.nib = "<div class=\"made-control\"></div>"
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var made = new Made()
    made.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded
    host.addSubview(made)
    assert.equal(document.querySelector(".made").getAttribute("aria-expanded"), "true")
    var control = new MadeControl()
    control.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.collapsed
    host.addSubview(control)
    assert.equal(document.querySelector(".made-control").getAttribute("aria-expanded"), "false")
})

test("it does not touch the label, the identifier or an enabled control", function() {
    var subject = view()
    subject.accessibilityLabel = "Open menu"
    subject.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded
    assert.equal(subject.accessibilityLabel, "Open menu")
    assert.equal(subject.accessibilityIdentifier, "toggle")
})
