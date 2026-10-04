import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITextField, NSRange, IBOutlet, UIViewController, NotificationCenter } from "../src/index.js"


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

test("placeholder round-trips and isEditing tracks the focus", function() {
    var field = fieldWithDelegate({})
    field.placeholder = "Your name"
    assert.equal(field.placeholder, "Your name")
    assert.equal(field.$el.attr("placeholder"), "Your name")
    assert.equal(field.isEditing, false)
    field.$el[0].focus()
    assert.equal(field.isEditing, true)
    field.$el[0].blur()
    assert.equal(field.isEditing, false)
})

test("focusin asks textFieldShouldBeginEditing, and an explicit false resigns the focus before textFieldDidBeginEditing", function() {
    var allow = false
    var log = []
    var field = fieldWithDelegate({
        textFieldShouldBeginEditing() { log.push("should"); return allow },
        textFieldDidBeginEditing() { log.push("begin") },
    })
    var input = field.$el[0]
    input.focus()
    assert.deepEqual(log, ["should"])
    assert.notEqual(document.activeElement, input)
    allow = undefined
    input.focus()
    assert.deepEqual(log, ["should", "should", "begin"])
    assert.equal(document.activeElement, input)
})

test("beforeinput asks textFieldShouldChangeCharactersInRangeReplacementString with the selection as an NSRange", function() {
    var answer = undefined
    var seen = []
    var field = fieldWithDelegate({
        textFieldShouldChangeCharactersInRangeReplacementString(textField, range, replacement) { seen.push({textField, range, replacement}); return answer },
    })
    var input = field.$el[0]
    input.value = "hello"
    input.focus()
    input.setSelectionRange(1, 3)
    var typed = new window.InputEvent("beforeinput", {data: "X", inputType: "insertText", bubbles: true, cancelable: true})
    input.dispatchEvent(typed)
    assert.equal(seen.length, 1)
    assert.equal(seen[0].textField, field)
    assert.ok(seen[0].range instanceof NSRange)
    assert.deepEqual([seen[0].range.location, seen[0].range.length], [1, 2])
    assert.equal(seen[0].replacement, "X")
    assert.equal(typed.defaultPrevented, false)
    answer = false
    input.setSelectionRange(5, 5)
    var deleted = new window.InputEvent("beforeinput", {data: null, inputType: "deleteContentBackward", bubbles: true, cancelable: true})
    input.dispatchEvent(deleted)
    assert.deepEqual([seen[1].range.location, seen[1].range.length], [5, 0])
    assert.equal(seen[1].replacement, "")
    assert.equal(deleted.defaultPrevented, true)
})

test("a document selectionchange sends textFieldDidChangeSelection only while the field is focused", function() {
    var changes = 0
    var field = fieldWithDelegate({
        textFieldDidChangeSelection() { changes += 1 },
    })
    document.dispatchEvent(new window.Event("selectionchange"))
    assert.equal(changes, 0)
    field.$el[0].focus()
    document.dispatchEvent(new window.Event("selectionchange"))
    assert.equal(changes, 1)
    field.$el[0].blur()
    document.dispatchEvent(new window.Event("selectionchange"))
    assert.equal(changes, 1)
})

// Whatever a field observes on the document is released when its controller
// is dismissed, as README §Notifications promises for every view.
test("the selectionchange observer goes through NotificationCenter and does not survive a root swap", async function() {
    var changes = 0
    class Form extends UIViewController {
        viewDidLoad() { this.nameField.delegate = {textFieldDidChangeSelection() { changes += 1 }} }
    }
    Form.nib = "<input id=\"name\">"
    IBOutlet("#name", UITextField)(Form.prototype, "nameField", {})
    page("<cocoatouch></cocoatouch>")
    var form = new Form()
    await new Promise((resolve) => form.present(form, {completion: resolve}))
    var field = form.nameField
    field.$el[0].focus()
    document.dispatchEvent(new window.Event("selectionchange"))
    assert.equal(changes, 1)
    assert.ok(NotificationCenter.default._observers.has(field), "the field observes through NotificationCenter")
    class Next extends UIViewController {}
    Next.nib = "<p></p>"
    var next = new Next()
    await new Promise((resolve) => next.present(next, {completion: resolve}))
    var documentEvents = $._data(document, "events") || {}
    assert.equal(documentEvents.selectionchange, undefined, "no jQuery handler left on the document")
    assert.equal(NotificationCenter.default._observers.has(field), false, "the observer was released on dismiss")
    document.dispatchEvent(new window.Event("selectionchange"))
    assert.equal(changes, 1)
})
