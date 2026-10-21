import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UISearchTextField, UISearchToken, UIControlEvent, UIView } from "../src/index.js"


test("removeToken(at:) removes that token and its tag, leaving the others in order", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    field.tokens = [new UISearchToken({text: "a"}), new UISearchToken({text: "b"}), new UISearchToken({text: "c"})]
    assert.equal($("#search .tag").length, 3)
    field.removeToken({at: 1})
    assert.deepEqual(field.tokens.map((token) => token.text), ["a", "c"])
    assert.deepEqual($("#search .tag .tag-text").map(function() { return $(this).text() }).get(), ["a", "c"])
    assert.equal(field.tokens.length, 2)
})

// Every handler binds under its own namespace and removes it first, so a
// second construction on the same element leaves one of each, not two.
test("constructing a search field twice on one element leaves one click and one keydown handler", function() {
    page("<div id=\"search\"></div>")
    new UISearchTextField("#search")
    var second = new UISearchTextField("#search")
    var elementEvents = $._data($("#search")[0], "events")
    var inputEvents = $._data($("#search input")[0], "events")
    assert.equal(elementEvents.click.length, 1)
    assert.equal(inputEvents.keydown.length, 1)
    // jQuery keeps a handler of its own on focus and blur, so only ours are counted.
    for (var type of ["focus", "blur"]) {
        assert.equal(inputEvents[type].filter((handler) => handler.namespace === "uisearchtextfield").length, 1, type)
    }
    assert.equal($("#search input").length, 1)
    assert.ok(elementEvents.click.every((handler) => handler.namespace === "uisearchtextfield"))
    assert.ok(inputEvents.keydown.every((handler) => handler.namespace === "uisearchtextfield"))
    assert.equal(second.textField.length, 1)
})

// UITextField's inherited text getter reads this.$el's own tagName, which is
// never "input" here — this.$el is the tokens-and-input wrapper — so without
// an override it read the wrapper's text nodes (the tokens) and never what
// was actually typed into the inner input.
test("text reads and writes the inner input's value, not the wrapper's text content", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    field.tokens = [new UISearchToken({text: "a tag, not typed text"})]
    assert.equal(field.text, "", "a token's text must never be mistaken for the field's value")
    field.textField.val("stark")
    assert.equal(field.text, "stark")
    field.text = "bank"
    assert.equal(field.textField.val(), "bank")
    field.text = null
    assert.equal(field.text, "")
})

// UIView's inherited becomeFirstResponder/resignFirstResponder/
// isFirstResponder all act on this.$el, which here is the wrapper div, never
// focusable — the same wrapper-vs-input split the text getter above has.
test("becomeFirstResponder, resignFirstResponder and isFirstResponder act on the inner input, not the wrapper", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    assert.equal(field.isFirstResponder, false)
    field.becomeFirstResponder()
    assert.equal(field.isFirstResponder, true)
    assert.equal(field.textField.is(":focus"), true)
    field.resignFirstResponder()
    assert.equal(field.isFirstResponder, false)
})


// UISearchTextField reads the key off its own input, so the move of
// UIKeyCommand.inputDelete to the forward Delete key leaves it as it was.
function pressKey(element, key) {
    var event = new window.KeyboardEvent("keydown", {key: key, bubbles: true, cancelable: true})
    element.dispatchEvent(event)
    return event
}

test("Backspace in the empty input removes the last token, and forward Delete does not", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    field.tokens = [new UISearchToken({text: "a"}), new UISearchToken({text: "b"})]
    var input = field.textField[0]
    assert.equal(pressKey(input, "Delete").defaultPrevented, false)
    assert.equal(field.tokens.length, 2)
    assert.equal(pressKey(input, "Backspace").defaultPrevented, true)
    assert.deepEqual(field.tokens.map((token) => token.text), ["a"])
    input.value = "x"
    assert.equal(pressKey(input, "Backspace").defaultPrevented, false)
    assert.equal(field.tokens.length, 1)
    input.value = ""
    field.allowsDeletingTokens = false
    assert.equal(pressKey(input, "Backspace").defaultPrevented, false)
    assert.equal(field.tokens.length, 1)
})


// A focus or blur does not bubble, so the wrapper that holds the targets hears
// the inner input's through a relay that is no native event: nothing above the
// wrapper hears it and the focus is not moved.
function counting(field) {
    var counts = {begin: 0, end: 0}
    field.addTarget({}, {action() { counts.begin += 1 }, for: UIControlEvent.editingDidBegin})
    field.addTarget({}, {action() { counts.end += 1 }, for: UIControlEvent.editingDidEnd})
    return counts
}

function click(element) {
    element.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

test("editingDidBegin and editingDidEnd are sent once each as the inner input gains and loses the focus, a click on it included", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    var counts = counting(field)
    var delegated = 0
    field.delegate = {textFieldDidBeginEditing() { delegated += 1 }}
    var input = document.querySelector("#search input")
    input.focus()
    click(input)
    assert.deepEqual(counts, {begin: 1, end: 0})
    assert.equal(delegated, 1)
    input.blur()
    assert.deepEqual(counts, {begin: 1, end: 1})
})

test("a click on the wrapper focuses the input once, and a focused field sends no second editingDidBegin", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    var counts = counting(field)
    click(document.getElementById("search"))
    assert.equal(document.activeElement, document.querySelector("#search input"))
    click(document.getElementById("search"))
    assert.deepEqual(counts, {begin: 1, end: 0})
})

test("becomeFirstResponder twice sends editingDidBegin once", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    var counts = counting(field)
    field.becomeFirstResponder()
    field.becomeFirstResponder()
    assert.equal(field.isFirstResponder, true)
    assert.equal(counts.begin, 1)
})

test("resignFirstResponder on a field that has no focus sends nothing", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    var counts = counting(field)
    field.resignFirstResponder()
    assert.deepEqual(counts, {begin: 0, end: 0})
    field.becomeFirstResponder()
    field.resignFirstResponder()
    assert.deepEqual(counts, {begin: 1, end: 1})
})

test("the relay survives removeFromSuperview and a second addSubview", function() {
    page("<div id=\"stage\"></div>")
    var stage = new UIView("#stage")
    var field = new UISearchTextField()
    var counts = counting(field)
    stage.addSubview(field)
    field.removeFromSuperview()
    stage.addSubview(field)
    var input = field.$el[0].querySelector("input")
    input.focus()
    input.blur()
    assert.deepEqual(counts, {begin: 1, end: 1})
})

test("a second instance on the same element leaves one relay: one editingDidEnd per blur", function() {
    page("<div id=\"search\"></div>")
    var first = new UISearchTextField("#search")
    var counts = counting(first)
    new UISearchTextField("#search")
    var input = document.querySelector("#search input")
    input.focus()
    input.blur()
    assert.deepEqual(counts, {begin: 1, end: 1})
})
