import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITextView, UIScrollView, IBOutlet, UIViewController } from "../src/index.js"


var lineHeight = 20
var paddingHeight = 20
var twoRows = 2 * lineHeight + paddingHeight

// jsdom has no layout, so the textarea measures itself the way a browser does:
// scrollHeight is the content (one lineHeight per line, `wrap` characters to a
// line) plus the padding, and never less than the padding box when the height
// is pinned. `reads` and `writes` are what the sizing routine did to it.
function textArea({style = "box-sizing: border-box; border: 1px solid; padding: 10px", wrap = 1000, height = "44px"} = {}) {
    page(`<textarea id="note" style="${style}; height: ${height}"></textarea>`)
    var element = document.getElementById("note")
    var log = {reads: 0, writes: [], wrap}
    var inlineStyle = element.style
    var descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inlineStyle), "height")
    Object.defineProperty(inlineStyle, "height", {
        configurable: true,
        get() { return descriptor.get.call(inlineStyle) },
        set(value) {
            log.writes.push(value)
            descriptor.set.call(inlineStyle, value)
        },
    })
    Object.defineProperty(element, "scrollHeight", {configurable: true, get() {
        log.reads += 1
        var lines = element.value.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / log.wrap)), 0)
        var content = lines * lineHeight + paddingHeight
        var height = inlineStyle.height
        if (height === "auto" || height === "") { return Math.max(content, twoRows) }
        var border = 2
        return Math.max(content, parseFloat(height) - border)
    }})
    log.reset = function() {
        log.reads = 0
        log.writes = []
    }
    log.element = element
    return log
}

function type(element, value) {
    element.value = value
    element.dispatchEvent(new window.Event("input", {bubbles: true}))
}

function makeView(options) {
    var log = textArea(options)
    var view = new UITextView("#note")
    view.awakeFromNib()
    log.view = view
    return log
}

test("a UITextView is a UIScrollView, as Apple's is", function() {
    assert.ok(Object.getPrototypeOf(UITextView.prototype) === UIScrollView.prototype)
})

test("with isScrollEnabled false the height follows the typed content, up and down", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    var height = () => log.element.style.height
    assert.equal(height(), "42px", "one line: 20 content + 20 padding + 2 border")
    type(log.element, "one\ntwo\nthree\nfour")
    assert.equal(height(), "102px")
    type(log.element, "one\ntwo")
    assert.equal(height(), "62px")
    type(log.element, "")
    assert.equal(height(), "42px")
})

test("the height follows wrapped lines, which is what scrollHeight reports", function() {
    var log = makeView({wrap: 10})
    log.view.isScrollEnabled = false
    type(log.element, "a".repeat(25))
    assert.equal(log.element.style.height, "82px")
})

test("with isScrollEnabled true the height is left to the stylesheet", function() {
    var log = makeView()
    assert.equal(log.view.isScrollEnabled, true)
    log.reset()
    type(log.element, "one\ntwo\nthree")
    assert.deepEqual(log.writes, [])
    assert.equal(log.element.style.height, "44px")
})

test("isScrollEnabled reads back what was set", function() {
    var log = makeView()
    assert.doesNotThrow(function() { log.view.isScrollEnabled = false })
    assert.equal(log.view.isScrollEnabled, false)
    log.view.isScrollEnabled = true
    assert.equal(log.view.isScrollEnabled, true)
    var plain = new UIScrollView("#note")
    assert.doesNotThrow(function() { plain.isScrollEnabled = false })
    assert.equal(plain.isScrollEnabled, false)
})

test("turning isScrollEnabled back on gives the height back to the stylesheet", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    type(log.element, "one\ntwo\nthree")
    assert.equal(log.element.style.height, "82px")
    log.view.isScrollEnabled = true
    assert.equal(log.element.style.height, "")
})

test("the text setter writes the value, sizes the field and does not tell the delegate", function() {
    var log = makeView()
    var changes = 0
    log.view.delegate = {textViewDidChange() { changes += 1 }}
    log.view.isScrollEnabled = false
    log.view.text = "one\ntwo\nthree"
    assert.equal(log.element.value, "one\ntwo\nthree")
    assert.equal(log.view.text, "one\ntwo\nthree")
    assert.equal(log.element.style.height, "82px")
    assert.equal(changes, 0)
})

test("a prefilled text sizes the field before the first edit, and a nil text empties it", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    log.view.text = "a\nb\nc\nd"
    assert.equal(log.element.style.height, "102px")
    log.view.text = null
    assert.equal(log.view.text, "")
    assert.equal(log.element.style.height, "42px")
})

test("setting isScrollEnabled false sizes a field that already has text", function() {
    var log = makeView()
    log.view.text = "a\nb\nc"
    log.view.isScrollEnabled = false
    assert.equal(log.element.style.height, "82px")
})

test("a user edit tells the delegate once, with the text view", function() {
    var log = makeView()
    var received = []
    log.view.delegate = {textViewDidChange(sender) { received.push(sender) }}
    log.view.isScrollEnabled = false
    type(log.element, "hello")
    assert.deepEqual(received, [log.view])
})

test("a delegate without textViewDidChange, and no delegate at all, are fine", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    assert.doesNotThrow(function() { type(log.element, "x") })
    log.view.delegate = {}
    assert.doesNotThrow(function() { type(log.element, "xy") })
    log.view.delegate = null
    assert.doesNotThrow(function() { type(log.element, "xyz") })
    assert.equal(log.view.delegate, null)
})

test("the delegate is still a UIScrollViewDelegate: scrollViewDidScroll is delivered", function() {
    var log = makeView()
    var scrolls = 0
    log.view.delegate = {scrollViewDidScroll() { scrolls += 1 }}
    log.element.dispatchEvent(new window.Event("scroll"))
    assert.equal(scrolls, 1)
})

test("keyup alone is not an edit: the delegate hears input, not keys", function() {
    var log = makeView()
    var changes = 0
    log.view.delegate = {textViewDidChange() { changes += 1 }}
    log.element.dispatchEvent(new window.KeyboardEvent("keydown", {key: "a", bubbles: true}))
    log.element.dispatchEvent(new window.KeyboardEvent("keyup", {key: "a", bubbles: true}))
    assert.equal(changes, 0)
})

test("a repeated text or input with the same content makes no style writes", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    type(log.element, "one\ntwo")
    log.reset()
    type(log.element, "one\ntwo")
    log.view.text = "one\ntwo"
    assert.deepEqual(log.writes, [])
    assert.equal(log.reads, 0)
})

test("an edit does one pass: height 0, one scrollHeight read, the measured height", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    log.reset()
    type(log.element, "one\ntwo\nthree")
    assert.deepEqual(log.writes, ["0px", "82px"])
    assert.equal(log.reads, 1)
})

test("no event reads scrollHeight more than once, whatever the content does", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    for (var value of ["a", "a\nb", "a\nb\nc\nd", "a", "", "zz"]) {
        log.reset()
        type(log.element, value)
        assert.ok(log.reads <= 1, `${JSON.stringify(value)} read scrollHeight ${log.reads} times`)
    }
    log.reset()
    log.view.text = "q\nr"
    assert.ok(log.reads <= 1)
    log.reset()
    log.view.layoutSubviews()
    assert.ok(log.reads <= 1)
})

test("the handler never asks for computed style: the padding and border adjustment is cached once", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    var original = globalThis.getComputedStyle
    var calls = 0
    globalThis.getComputedStyle = function(...args) {
        calls += 1
        return original(...args)
    }
    try {
        type(log.element, "a\nb")
        log.view.text = "a\nb\nc"
        log.view.layoutSubviews()
    } finally {
        globalThis.getComputedStyle = original
    }
    assert.equal(calls, 0)
})

test("a content-box field is sized without its padding", function() {
    var log = makeView({style: "box-sizing: content-box; border: 1px solid; padding: 10px"})
    log.view.isScrollEnabled = false
    type(log.element, "a\nb")
    assert.equal(log.element.style.height, "40px", "scrollHeight 60 less 20 padding")
})

test("a layout pass measures again once, because the content height depends on the width", function() {
    var log = makeView({wrap: 10})
    log.view.isScrollEnabled = false
    log.view.text = "a".repeat(25)
    assert.equal(log.element.style.height, "82px")
    log.wrap = 5
    log.reset()
    log.view.layoutSubviews()
    assert.equal(log.reads, 1)
    assert.equal(log.element.style.height, "122px")
    assert.deepEqual(log.writes, ["0px", "122px"])
})

test("layoutSubviews leaves a scrolling text view alone", function() {
    var log = makeView()
    log.reset()
    log.view.layoutSubviews()
    assert.deepEqual(log.writes, [])
    assert.equal(log.reads, 0)
})

test("markup typed into the field stays literal text", function() {
    var log = makeView()
    log.view.isScrollEnabled = false
    var markup = "<b>bold</b><img src=x onerror=alert(1)>"
    type(log.element, markup)
    assert.equal(log.view.text, markup)
    assert.equal(log.element.children.length, 0)
    assert.equal(log.element.textContent, "")
    log.view.text = markup
    assert.equal(log.element.children.length, 0)
    assert.equal(log.element.textContent, "")
    assert.equal(log.element.value, markup)
})

test("a text view whose element is not in the page is not measured, and sizes once it is", function() {
    var log = textArea()
    Object.defineProperty(log.element, "isConnected", {configurable: true, get() { return false }})
    var view = new UITextView("#note")
    view.isScrollEnabled = false
    view.text = "a\nb\nc"
    assert.deepEqual(log.writes, [])
    assert.equal(log.reads, 0)
    delete log.element.isConnected
    view.layoutSubviews()
    assert.equal(log.element.style.height, "82px")
})

test("a view that never woke from a nib reads the adjustment at its first fit", function() {
    var log = textArea()
    var view = new UITextView("#note")
    view.isScrollEnabled = false
    view.text = "a\nb"
    assert.equal(log.element.style.height, "62px")
})

test("focus is the first responder, as UIView's", function() {
    var log = makeView()
    assert.equal(log.view.isFirstResponder, false)
    log.view.becomeFirstResponder()
    assert.equal(log.view.isFirstResponder, true)
    log.view.resignFirstResponder()
    assert.equal(log.view.isFirstResponder, false)
})

test("an outlet bound text view sizes and reports edits", async function() {
    class Form extends UIViewController {}
    Form.nib = "<textarea id=\"note\" style=\"box-sizing: border-box; border: 1px solid; padding: 10px\"></textarea>"
    IBOutlet("#note", UITextView)(Form.prototype, "note", {})
    page("<cocoatouch></cocoatouch>")
    var form = new Form()
    await new Promise((resolve) => form.present(form, {completion: resolve}))
    var element = form.note.$el[0]
    Object.defineProperty(element, "scrollHeight", {configurable: true, get() { return element.value.split("\n").length * lineHeight + paddingHeight }})
    var received = []
    form.note.delegate = {textViewDidChange(sender) { received.push(sender) }}
    form.note.isScrollEnabled = false
    type(element, "a\nb")
    assert.equal(element.style.height, "62px")
    assert.deepEqual(received, [form.note])
})
