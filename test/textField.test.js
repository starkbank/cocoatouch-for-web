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
    assert.deepEqual([seen[1].range.location, seen[1].range.length], [4, 1])
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


test("a delegate reset to null or undefined stops hearing the field and nothing throws", function() {
    for (var reset of [null, undefined]) {
        var log = []
        var field = fieldWithDelegate({
            textFieldShouldReturn() { log.push("return") },
            textFieldDidBeginEditing() { log.push("begin") },
            textFieldDidEndEditing() { log.push("end") },
            textFieldDidChangeSelection() { log.push("selection") },
            textFieldShouldChangeCharactersInRangeReplacementString() { log.push("change") },
        })
        field.delegate = reset
        assert.equal(field.delegate, null)
        var input = field.$el[0]
        input.focus()
        key(input, "Enter")
        input.dispatchEvent(new window.InputEvent("beforeinput", {data: "x", inputType: "insertText", bubbles: true, cancelable: true}))
        document.dispatchEvent(new window.Event("selectionchange"))
        input.blur()
        assert.deepEqual(log, [], String(reset))
        assert.equal(NotificationCenter.default._observers.has(field), false)
    }
})

// The range the delegate is asked about for one beforeinput, or null when it is not asked.
function rangeAsked(value, selection, inputType, data = null) {
    var seen = []
    var field = fieldWithDelegate({
        textFieldShouldChangeCharactersInRangeReplacementString(textField, range, replacement) { seen.push([range.location, range.length, replacement]) },
    })
    var input = field.$el[0]
    input.value = value
    input.focus()
    input.setSelectionRange(selection[0], selection[1])
    var event = new window.InputEvent("beforeinput", {data, inputType, bubbles: true, cancelable: true})
    input.dispatchEvent(event)
    assert.ok(seen.length <= 1)
    return seen.length === 0 ? null : seen[0]
}

test("Backspace asks for the character before the caret, and Delete for the one after", function() {
    assert.deepEqual(rangeAsked("hello", [5, 5], "deleteContentBackward"), [4, 1, ""])
    assert.deepEqual(rangeAsked("hello", [2, 2], "deleteContentBackward"), [1, 1, ""])
    assert.deepEqual(rangeAsked("hello", [1, 1], "deleteContentForward"), [1, 1, ""])
})

test("a deletion at an edge deletes nothing, so the delegate is not asked", function() {
    assert.equal(rangeAsked("hello", [0, 0], "deleteContentBackward"), null)
    assert.equal(rangeAsked("hello", [5, 5], "deleteContentForward"), null)
    assert.equal(rangeAsked("", [0, 0], "deleteContentBackward"), null)
    assert.equal(rangeAsked("hello", [0, 0], "deleteWordBackward"), null)
    assert.equal(rangeAsked("hello", [0, 0], "deleteSoftLineBackward"), null)
    assert.equal(rangeAsked("hello", [5, 5], "deleteHardLineForward"), null)
})

test("a deletion of a selection asks for the selection, whatever its input type", function() {
    assert.deepEqual(rangeAsked("hello", [1, 3], "deleteContentBackward"), [1, 2, ""])
    assert.deepEqual(rangeAsked("hello", [1, 3], "deleteContentForward"), [1, 2, ""])
    assert.deepEqual(rangeAsked("hello", [0, 5], "deleteWordBackward"), [0, 5, ""])
})

test("Backspace over an emoji with a skin tone asks for the whole grapheme cluster", function() {
    var text = "a\u{1F44D}\u{1F3FD}"
    assert.equal(text.length, 5)
    assert.deepEqual(rangeAsked(text, [5, 5], "deleteContentBackward"), [1, 4, ""])
    assert.deepEqual(rangeAsked(text, [1, 1], "deleteContentForward"), [1, 4, ""])
})

test("without Intl.Segmenter a surrogate pair is one character and any other is one unit", function() {
    var original = Intl.Segmenter
    Intl.Segmenter = undefined
    try {
        assert.deepEqual(rangeAsked("a\u{1F600}", [3, 3], "deleteContentBackward"), [1, 2, ""])
        assert.deepEqual(rangeAsked("\u{1F600}a", [0, 0], "deleteContentForward"), [0, 2, ""])
        assert.deepEqual(rangeAsked("ab", [2, 2], "deleteContentBackward"), [1, 1, ""])
        assert.deepEqual(rangeAsked("ab", [0, 0], "deleteContentForward"), [0, 1, ""])
        assert.deepEqual(rangeAsked("hello world ", [12, 12], "deleteWordBackward"), [6, 6, ""])
        assert.deepEqual(rangeAsked("hello world", [0, 0], "deleteWordForward"), [0, 5, ""])
    } finally {
        Intl.Segmenter = original
    }
})

test("a word deletion asks up to the word boundary", function() {
    assert.deepEqual(rangeAsked("hello world", [11, 11], "deleteWordBackward"), [6, 5, ""])
    assert.deepEqual(rangeAsked("hello world ", [12, 12], "deleteWordBackward"), [6, 6, ""])
    assert.deepEqual(rangeAsked("hello world", [0, 0], "deleteWordForward"), [0, 5, ""])
    assert.deepEqual(rangeAsked("hello world", [5, 5], "deleteWordForward"), [5, 6, ""])
    assert.deepEqual(rangeAsked("say don't", [9, 9], "deleteWordBackward"), [4, 5, ""])
})

test("a line deletion asks up to the start or the end of the line", function() {
    assert.deepEqual(rangeAsked("hello", [3, 3], "deleteSoftLineBackward"), [0, 3, ""])
    assert.deepEqual(rangeAsked("hello", [3, 3], "deleteHardLineBackward"), [0, 3, ""])
    assert.deepEqual(rangeAsked("hello", [2, 2], "deleteSoftLineForward"), [2, 3, ""])
    assert.deepEqual(rangeAsked("hello", [2, 2], "deleteHardLineForward"), [2, 3, ""])
})

test("typing at a caret asks for an empty range at the caret with the typed text", function() {
    assert.deepEqual(rangeAsked("hello", [2, 2], "insertText", "X"), [2, 0, "X"])
})

// A line is as far as the nearest newline, which only a textarea can hold.
function rangeAskedInTextarea(value, caret, inputType) {
    page("<textarea id=\"notes\"></textarea>")
    var seen = []
    var field = new UITextField("#notes")
    field.delegate = {
        textFieldShouldChangeCharactersInRangeReplacementString(textField, range) { seen.push([range.location, range.length]) },
    }
    var input = field.$el[0]
    input.value = value
    input.focus()
    input.setSelectionRange(caret, caret)
    input.dispatchEvent(new window.InputEvent("beforeinput", {data: null, inputType, bubbles: true, cancelable: true}))
    return seen.length === 0 ? null : seen[0]
}

test("a line deletion in a textarea stops at the newline", function() {
    var text = "ab\ncde\nfg"
    assert.deepEqual(rangeAskedInTextarea(text, 5, "deleteSoftLineBackward"), [3, 2])
    assert.deepEqual(rangeAskedInTextarea(text, 5, "deleteHardLineBackward"), [3, 2])
    assert.deepEqual(rangeAskedInTextarea(text, 4, "deleteHardLineForward"), [4, 2])
    assert.deepEqual(rangeAskedInTextarea(text, 4, "deleteSoftLineForward"), [4, 2])
    assert.deepEqual(rangeAskedInTextarea(text, 1, "deleteHardLineForward"), [1, 1])
    assert.deepEqual(rangeAskedInTextarea(text, 8, "deleteHardLineBackward"), [7, 1])
})

test("a line deletion at the edge of a line reaches the newline beyond it, as Backspace and Delete do", function() {
    var text = "ab\ncde\nfg"
    assert.deepEqual(rangeAskedInTextarea(text, 3, "deleteSoftLineBackward"), [2, 1])
    assert.deepEqual(rangeAskedInTextarea(text, 6, "deleteHardLineForward"), [6, 1])
    assert.equal(rangeAskedInTextarea(text, 0, "deleteSoftLineBackward"), null)
    assert.equal(rangeAskedInTextarea(text, 9, "deleteHardLineForward"), null)
})
