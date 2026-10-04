import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITextField } from "../src/index.js"


function key(element, name) {
    var event = new window.KeyboardEvent("keydown", {key: name, bubbles: true, cancelable: true})
    element.dispatchEvent(event)
    element.dispatchEvent(new window.KeyboardEvent("keyup", {key: name, bubbles: true, cancelable: true}))
    return event
}

function fieldWithDelegate(delegate) {
    page("<input id=\"name\"><input id=\"other\">")
    var field = new UITextField("#name")
    field.delegate = delegate
    return field
}

test("typing does not end editing; blurring ends it once, after it began on focus", function() {
    var log = []
    var field = fieldWithDelegate({
        textFieldDidBeginEditing() { log.push("begin") },
        textFieldDidEndEditing() { log.push("end") },
    })
    var input = field.$el[0]
    input.focus()
    key(input, "a")
    input.dispatchEvent(new window.Event("input", {bubbles: true}))
    key(input, "b")
    assert.deepEqual(log, ["begin"])
    input.blur()
    assert.deepEqual(log, ["begin", "end"])
})

test("Return asks textFieldShouldReturn, and only an explicit false prevents the default", function() {
    var answer = undefined
    var asked = 0
    var field = fieldWithDelegate({
        textFieldShouldReturn() { asked += 1; return answer },
    })
    var input = field.$el[0]
    input.focus()
    assert.equal(key(input, "Enter").defaultPrevented, false)
    assert.equal(asked, 1)
    answer = null
    assert.equal(key(input, "Enter").defaultPrevented, false)
    answer = true
    assert.equal(key(input, "Enter").defaultPrevented, false)
    answer = false
    assert.equal(key(input, "Enter").defaultPrevented, true)
    assert.equal(asked, 4)
    assert.equal(key(input, "a").defaultPrevented, false)
    assert.equal(asked, 4)
})

test("textFieldShouldEndEditing returning false keeps the focus and skips textFieldDidEndEditing", async function() {
    var allow = false
    var log = []
    var field = fieldWithDelegate({
        textFieldDidBeginEditing() { log.push("begin") },
        textFieldShouldEndEditing() { log.push("should"); return allow },
        textFieldDidEndEditing() { log.push("end") },
    })
    var input = field.$el[0]
    input.focus()
    $("#other")[0].focus()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(document.activeElement, input)
    assert.deepEqual(log, ["begin", "should"])
    allow = undefined
    input.blur()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.notEqual(document.activeElement, input)
    assert.deepEqual(log, ["begin", "should", "should", "end"])
})
