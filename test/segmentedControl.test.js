import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UISegmentedControl } from "../src/index.js"


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
