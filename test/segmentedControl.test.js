import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UISegmentedControl, UIControlEvent, UIView } from "../src/index.js"


function segments(selected) {
    page("<div id=\"tabs\"><button class=\"segment\">A</button><button class=\"segment\">B</button><button class=\"segment\">C</button></div>")
    var control = new UISegmentedControl("#tabs")
    if (selected !== undefined) { control.selectedSegmentIndex = selected }
    return control
}

function activeClasses() {
    return $("#tabs").children().map(function() { return $(this).hasClass("active") }).get()
}

test("noSegment is -1, as Apple's", function() {
    assert.equal(UISegmentedControl.noSegment, -1)
})

test("a valid index selects exactly that segment", function() {
    var control = segments(1)
    assert.deepEqual(activeClasses(), [false, true, false])
    control.selectedSegmentIndex = 2
    assert.deepEqual(activeClasses(), [false, false, true])
    assert.equal(control.selectedSegmentIndex, 2)
    control.selectedSegmentIndex = 0
    assert.equal(control.selectedSegmentIndex, 0)
})

test("noSegment clears the selection, and the getter then reads -1", function() {
    var control = segments(1)
    control.selectedSegmentIndex = UISegmentedControl.noSegment
    assert.deepEqual(activeClasses(), [false, false, false])
    assert.equal(control.selectedSegmentIndex, -1)
    assert.equal(control.selectedSegmentIndex, UISegmentedControl.noSegment)
})

test("the getter reads -1 when nothing was ever selected", function() {
    assert.equal(segments().selectedSegmentIndex, -1)
})

test("any other negative index, or one past the last segment, is ignored and never wraps", function() {
    for (var index of [-2, -3, -100, 3, 4, 100, 1.5, NaN, Infinity, -Infinity]) {
        var control = segments(1)
        control.selectedSegmentIndex = index
        assert.deepEqual(activeClasses(), [false, true, false], String(index))
        assert.equal(control.selectedSegmentIndex, 1, String(index))
    }
})

test("an invalid index on a control with no selection leaves it with none", function() {
    var control = segments()
    control.selectedSegmentIndex = -2
    control.selectedSegmentIndex = 3
    assert.deepEqual(activeClasses(), [false, false, false])
    assert.equal(control.selectedSegmentIndex, -1)
})

test("an index that is not a number is ignored", function() {
    for (var value of ["1", null, undefined, {}]) {
        var control = segments(2)
        control.selectedSegmentIndex = value
        assert.equal(control.selectedSegmentIndex, 2, String(value))
    }
})

test("no invalid index reaches eq()", function() {
    var control = segments(1)
    var calls = []
    var original = $.fn.eq
    $.fn.eq = function(index) {
        calls.push(index)
        return original.call(this, index)
    }
    try {
        for (var index of [-1, -2, 3, 99]) { control.selectedSegmentIndex = index }
    } finally {
        $.fn.eq = original
    }
    assert.deepEqual(calls, [])
})


// What a tap sends: the picked index, read inside the action, one entry per valueChanged.
function listening(control) {
    var seen = []
    control.addTarget({}, {action(sender) { seen.push(sender.selectedSegmentIndex) }, for: UIControlEvent.valueChanged})
    return seen
}

function tap(selector) {
    var event = new window.MouseEvent("click", {bubbles: true, cancelable: true})
    document.querySelector(selector).dispatchEvent(event)
    return event
}

test("a tap on an unselected segment selects it, then sends valueChanged", function() {
    var control = segments(0)
    var seen = listening(control)
    tap("#tabs > :nth-child(3)")
    assert.deepEqual(activeClasses(), [false, false, true])
    assert.deepEqual(seen, [2])
})

test("a tap on the selected segment sends nothing", function() {
    var control = segments(1)
    var seen = listening(control)
    tap("#tabs > :nth-child(2)")
    assert.deepEqual(seen, [])
    assert.equal(control.selectedSegmentIndex, 1)
})

test("a tap on a segment that holds the target counts for the segment, and a tap on no segment sends nothing", function() {
    page("<div id=\"tabs\"><button><span id=\"inner\">A</span></button><button>B</button></div>")
    var control = new UISegmentedControl("#tabs")
    var seen = listening(control)
    tap("#inner")
    assert.deepEqual(seen, [0])
    page("<div id=\"tabs\"><button>A</button></div>")
    control = new UISegmentedControl("#tabs")
    seen = listening(control)
    tap("#tabs")
    assert.deepEqual(seen, [])
    assert.equal(control.selectedSegmentIndex, -1)
})

test("a tap on a disabled segment, or on a disabled control, sends nothing and selects nothing", function() {
    var control = segments(0)
    var seen = listening(control)
    $("#tabs").children().eq(1).attr("disabled", "")
    tap("#tabs > :nth-child(2)")
    assert.equal(control.selectedSegmentIndex, 0)
    control.isEnabled = false
    tap("#tabs > :nth-child(3)")
    assert.equal(control.selectedSegmentIndex, 0)
    assert.deepEqual(seen, [])
})

test("a tap neither stops the event nor cancels its default", function() {
    segments(0)
    var heard = 0
    document.body.addEventListener("click", function() { heard += 1 }, {once: true})
    var event = tap("#tabs > :nth-child(2)")
    assert.equal(event.defaultPrevented, false)
    assert.equal(heard, 1)
})

test("a per-segment action that already selected the index gets no second valueChanged", function() {
    var control = segments(0)
    var seen = listening(control)
    $("#tabs").children().eq(1).on("click", function() { control.selectedSegmentIndex = 1 })
    tap("#tabs > :nth-child(2)")
    assert.deepEqual(seen, [])
})

test("a control placed with addSubview listens for taps once placed, once per tap", function() {
    page("<div id=\"stage\"></div>")
    var stage = new UIView("#stage")
    class Tabs extends UISegmentedControl {}
    Tabs.nib = "<div><button id=\"a\">A</button><button id=\"b\">B</button></div>"
    var control = new Tabs()
    var seen = listening(control)
    stage.addSubview(control)
    tap("#b")
    assert.deepEqual(seen, [1])
})
