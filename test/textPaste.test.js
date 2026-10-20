import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITextField, UISearchTextField, UIView, UIControlEvent, UTType, NSItemProvider, NSRange } from "../src/index.js"


const plainText = UTType.plainText.identifier
const html = UTType.html.identifier
const rtf = UTType.rtf.identifier
const cap = 256 * 1024
const encoder = new TextEncoder()
const strictDecoder = new TextDecoder("utf-8", {fatal: true})


// The clipboardData a browser hands a paste: only what the page asked for
// through getData, plus the file list a screenshot or a copied file puts there.
function clipboardOf(flavours, files = []) {
    return {
        types: Object.keys(flavours).concat(files.length > 0 ? ["Files"] : []),
        files: files,
        items: files.map((file) => ({kind: "file", type: file.type, getAsFile() { return file }})),
        getData(type) { return flavours[type] === undefined ? "" : flavours[type] },
    }
}

// jsdom has no ClipboardEvent, so a plain cancelable paste event carries the data.
function pasteInto(element, flavours, files) {
    var event = new window.Event("paste", {bubbles: true, cancelable: true})
    event.clipboardData = clipboardOf(flavours, files)
    element.dispatchEvent(event)
    return event
}

function field(value = "") {
    page(`<input id="name" value="${value}">`)
    return new UITextField("#name")
}

// A delegate that records what it was called with and sets `result` on the item.
function recording(result) {
    var delegate = {calls: []}
    delegate.textPasteConfigurationSupportingTransformPasteItem = function(textField, item) {
        delegate.calls.push({textField, item})
        if (result) { result(item) }
    }
    return delegate
}

function fileOf(name, type) {
    return new window.File(["secret bytes"], name, {type})
}

function listenerCount(element) {
    var events = $._data(element, "events")
    return events && events.paste ? events.paste.length : 0
}


test("the delegate is called once per paste with one item whose provider lists only the present flavours", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    pasteInto(textField.$el[0], {"text/plain": "a@b.com", "text/html": "<a href=\"mailto:a@b.com\">a</a>"})
    assert.equal(delegate.calls.length, 1)
    assert.equal(delegate.calls[0].textField, textField)
    var provider = delegate.calls[0].item.itemProvider
    assert.ok(provider instanceof NSItemProvider)
    assert.deepEqual(provider.registeredTypeIdentifiers, [plainText, html])
    assert.equal(provider.hasItemConformingToTypeIdentifier(html), true)
    assert.equal(provider.hasItemConformingToTypeIdentifier(rtf), false)
    assert.equal(provider.hasItemConformingToTypeIdentifier(UTType.item.identifier), true)
})

test("a flavour that is empty or not a string is not registered, and rtf registers when present", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    var event = new window.Event("paste", {bubbles: true, cancelable: true})
    event.clipboardData = {types: [], files: [], items: [], getData(type) { return type === "text/rtf" ? "{\\rtf1 hi}" : type === "text/html" ? 42 : "" }}
    textField.$el[0].dispatchEvent(event)
    assert.deepEqual(delegate.calls[0].item.itemProvider.registeredTypeIdentifiers, [rtf])
})

test("a file on the clipboard is not exposed: no file flavour, no file loading, and a file-only paste does not call the delegate", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    var file = fileOf("secret.pdf", "application/pdf")
    pasteInto(textField.$el[0], {"text/plain": "hello"}, [file])
    assert.deepEqual(delegate.calls[0].item.itemProvider.registeredTypeIdentifiers, [plainText])
    var provider = delegate.calls[0].item.itemProvider
    assert.equal(provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier), false)
    assert.equal(provider.hasItemConformingToTypeIdentifier(UTType.image.identifier), false)
    var answers = []
    for (var identifier of [UTType.pdf.identifier, "public.file-url", "public.image"]) {
        provider.loadDataRepresentation({forTypeIdentifier: identifier, completionHandler: (data, error) => answers.push([data, error])})
        provider.loadFileRepresentation({forTypeIdentifier: identifier, completionHandler() {}})
    }
    assert.ok(answers.every(([data, error]) => data === null && error instanceof Error))
    var event = pasteInto(textField.$el[0], {}, [file])
    assert.equal(delegate.calls.length, 1)
    assert.equal(event.defaultPrevented, false)
})

test("loadDataRepresentation hands the exact UTF-8 bytes, before the call returns", function() {
    var textField = field()
    var markup = "<a href=\"mailto:jú@b.com\">Jú € 😀</a>"
    var delegate = recording()
    textField.pasteDelegate = delegate
    pasteInto(textField.$el[0], {"text/html": markup})
    var provider = delegate.calls[0].item.itemProvider
    var answers = []
    provider.loadDataRepresentation({forTypeIdentifier: html, completionHandler: (data, error) => answers.push({data, error})})
    assert.equal(answers.length, 1, "the handler runs before loadDataRepresentation returns")
    assert.ok(answers[0].data instanceof Uint8Array)
    assert.equal(answers[0].error, null)
    assert.deepEqual(Array.from(answers[0].data), Array.from(encoder.encode(markup)))
    answers[0].data[0] = 0
    provider.loadDataRepresentation({forTypeIdentifier: html, completionHandler: (data) => answers.push({data})})
    assert.deepEqual(Array.from(answers[1].data), Array.from(encoder.encode(markup)), "each load is a copy")
})

test("a flavour the paste does not carry calls back with a null data and an error", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    pasteInto(textField.$el[0], {"text/plain": "x"})
    var provider = delegate.calls[0].item.itemProvider
    var answers = []
    provider.loadDataRepresentation({forTypeIdentifier: html, completionHandler: (data, error) => answers.push({data, error})})
    assert.equal(answers.length, 1)
    assert.equal(answers[0].data, null)
    assert.ok(answers[0].error instanceof Error)
    assert.throws(() => provider.loadDataRepresentation({completionHandler() {}}), (error) => error instanceof TypeError && /loadDataRepresentation\(forTypeIdentifier:completionHandler:\)/.test(error.message))
    assert.throws(() => provider.loadDataRepresentation({forTypeIdentifier: html}), TypeError)
})

function loaded(delegate, identifier) {
    var result = null
    delegate.calls[0].item.itemProvider.loadDataRepresentation({forTypeIdentifier: identifier, completionHandler: (data) => { result = data }})
    return result
}

test("a 300 KiB flavour arrives capped at 256 KiB, cut at a code-point boundary", function() {
    var cases = [
        ["ab" + "€".repeat(100000), "three-byte characters"],
        ["a" + "😀".repeat(80000), "four-byte characters"],
        ["a" + "é".repeat(150000), "two-byte characters"],
        ["x".repeat(300 * 1024), "ascii"],
    ]
    for (var [markup, label] of cases) {
        var textField = field()
        var delegate = recording()
        textField.pasteDelegate = delegate
        pasteInto(textField.$el[0], {"text/html": markup})
        var bytes = loaded(delegate, html)
        assert.ok(bytes.length <= cap, label)
        assert.ok(bytes.length > cap - 4, label)
        var text = strictDecoder.decode(bytes)
        assert.ok(markup.startsWith(text), label + ": a prefix of the original, whole characters only")
    }
})

test("a flavour at the cap is whole, and one byte over loses only the last character that does not fit", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    pasteInto(textField.$el[0], {"text/plain": "y".repeat(cap), "text/html": "y".repeat(cap - 1) + "€"})
    assert.equal(loaded(delegate, plainText).length, cap)
    assert.equal(loaded(delegate, html).length, cap - 1)
})

test("a huge flavour is cut before it is encoded in full", function() {
    var textField = field()
    var delegate = recording()
    textField.pasteDelegate = delegate
    var started = Date.now()
    pasteInto(textField.$el[0], {"text/html": "z".repeat(50 * 1024 * 1024)})
    assert.equal(loaded(delegate, html).length, cap)
    assert.ok(Date.now() - started < 2000)
})

test("setNoResult consumes the paste: default prevented, value unchanged", function() {
    var textField = field("keep")
    textField.pasteDelegate = recording((item) => item.setNoResult())
    var event = pasteInto(textField.$el[0], {"text/plain": "dropped"})
    assert.equal(event.defaultPrevented, true)
    assert.equal(textField.text, "keep")
})

test("setStringResult inserts the string at the selection and fires editingChanged once", function() {
    var textField = field("ab")
    var changes = 0
    textField.addTarget({}, {action() { changes += 1 }, for: UIControlEvent.editingChanged})
    textField.pasteDelegate = recording((item) => item.setStringResult("a, b"))
    var input = textField.$el[0]
    input.setSelectionRange(1, 1)
    var event = pasteInto(input, {"text/plain": "clipboard text"})
    assert.equal(event.defaultPrevented, true)
    assert.equal(textField.text, "aa, bb")
    assert.equal(changes, 1)
    assert.equal(input.selectionStart, 5)
    assert.equal(input.selectionEnd, 5)
})

test("setStringResult replaces a selected range", function() {
    var textField = field("hello world")
    textField.pasteDelegate = recording((item) => item.setStringResult("there"))
    var input = textField.$el[0]
    input.setSelectionRange(6, 11)
    pasteInto(input, {"text/plain": "x"})
    assert.equal(textField.text, "hello there")
})

test("an input whose type has no selection, like email, takes the string at the end", function() {
    page("<input id=\"mail\" type=\"email\" value=\"a@b.com,\">")
    var textField = new UITextField("#mail")
    textField.pasteDelegate = recording((item) => item.setStringResult(" c@d.com"))
    var event = pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(event.defaultPrevented, true)
    assert.equal(textField.text, "a@b.com, c@d.com")
})

test("setDefaultResult, or no result, leaves the paste to the browser", function() {
    var textField = field("keep")
    var input = textField.$el[0]
    var changes = 0
    textField.addTarget({}, {action() { changes += 1 }, for: UIControlEvent.editingChanged})
    textField.pasteDelegate = recording((item) => item.setDefaultResult())
    assert.equal(pasteInto(input, {"text/plain": "native"}).defaultPrevented, false)
    textField.pasteDelegate = recording()
    assert.equal(pasteInto(input, {"text/plain": "native"}).defaultPrevented, false)
    assert.equal(textField.text, "keep")
    assert.equal(changes, 0)
})

test("the last result set in the call is the one that counts", function() {
    var textField = field("")
    textField.pasteDelegate = recording(function(item) {
        item.setNoResult()
        item.setStringResult("final")
        item.setDefaultResult()
    })
    assert.equal(pasteInto(textField.$el[0], {"text/plain": "x"}).defaultPrevented, false)
    textField.pasteDelegate = recording(function(item) {
        item.setDefaultResult()
        item.setStringResult("final")
    })
    assert.equal(pasteInto(textField.$el[0], {"text/plain": "x"}).defaultPrevented, true)
    assert.equal(textField.text, "final")
})

test("a result set after the call returns changes nothing", function() {
    var textField = field("keep")
    var kept = null
    textField.pasteDelegate = recording((item) => { kept = item })
    var event = pasteInto(textField.$el[0], {"text/plain": "x"})
    kept.setStringResult("late")
    kept.setNoResult()
    assert.equal(event.defaultPrevented, false)
    assert.equal(textField.text, "keep")
})

test("setStringResult requires a string", function() {
    var textField = field()
    var thrown = []
    textField.pasteDelegate = recording(function(item) {
        for (var value of [undefined, null, 7, {}]) {
            try { item.setStringResult(value) } catch (error) { thrown.push(error) }
        }
    })
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(thrown.length, 4)
    assert.ok(thrown.every((error) => error instanceof TypeError && /setStringResult\(_:\)/.test(error.message)))
})

test("markup in setStringResult stays literal text", function() {
    var textField = field()
    var markup = "<b>bold</b><img src=\"x\" onerror=\"alert(1)\"><script>1</script>"
    textField.pasteDelegate = recording((item) => item.setStringResult(markup))
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(textField.text, markup)
    assert.equal(document.querySelectorAll("b, img, script").length, 0)
})

test("a delegate without the method leaves the paste alone", function() {
    var textField = field("keep")
    textField.pasteDelegate = {}
    var event = pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(event.defaultPrevented, false)
    assert.equal(textField.text, "keep")
})

test("a paste without clipboardData is left to the browser", function() {
    var textField = field()
    var delegate = recording((item) => item.setNoResult())
    textField.pasteDelegate = delegate
    var event = new window.Event("paste", {bubbles: true, cancelable: true})
    textField.$el[0].dispatchEvent(event)
    assert.equal(delegate.calls.length, 0)
    assert.equal(event.defaultPrevented, false)
})

test("no delegate, no listener; pasteDelegate reads back what was set, or null", function() {
    var textField = field()
    var input = textField.$el[0]
    assert.equal(textField.pasteDelegate, null)
    assert.equal(listenerCount(input), 0)
    var delegate = recording()
    textField.pasteDelegate = delegate
    assert.equal(textField.pasteDelegate, delegate)
    assert.equal(listenerCount(input), 1)
})

test("reassigning, nulling or disposing leaves no paste listener", function() {
    var textField = field()
    var input = textField.$el[0]
    var first = recording((item) => item.setNoResult())
    var second = recording((item) => item.setNoResult())
    textField.pasteDelegate = first
    textField.pasteDelegate = second
    assert.equal(listenerCount(input), 1)
    pasteInto(input, {"text/plain": "x"})
    assert.equal(first.calls.length, 0)
    assert.equal(second.calls.length, 1)
    textField.pasteDelegate = null
    assert.equal(listenerCount(input), 0)
    assert.equal(pasteInto(input, {"text/plain": "x"}).defaultPrevented, false)
    assert.equal(second.calls.length, 1)
    textField.pasteDelegate = first
    assert.equal(listenerCount(input), 1)
    textField._dispose()
    assert.equal(listenerCount(input), 0)
    pasteInto(input, {"text/plain": "x"})
    assert.equal(first.calls.length, 0)
})

test("the delegate setter does not disturb the other delegate handlers, and they do not disturb paste", function() {
    var textField = field()
    var input = textField.$el[0]
    var edits = 0
    textField.pasteDelegate = recording((item) => item.setNoResult())
    textField.delegate = {textFieldDidBeginEditing() { edits += 1 }}
    assert.equal(listenerCount(input), 1)
    input.focus()
    assert.equal(edits, 1)
    textField.delegate = {}
    assert.equal(listenerCount(input), 1)
    assert.equal(pasteInto(input, {"text/plain": "x"}).defaultPrevented, true)
})

// Everything the delegate can reach from its arguments, by own property names,
// symbols and the prototype chain's accessors' values: none may be the event,
// the clipboardData, or one of their parts.
function reachable(root, limit = 5000) {
    var seen = new Set()
    var queue = [root]
    while (queue.length > 0 && seen.size < limit) {
        var value = queue.pop()
        if (value === null || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) { continue }
        seen.add(value)
        for (var name of Reflect.ownKeys(value)) {
            var descriptor = Object.getOwnPropertyDescriptor(value, name)
            if ("value" in descriptor) { queue.push(descriptor.value) }
        }
        queue.push(Object.getPrototypeOf(value))
    }
    return seen
}

test("the event and clipboardData never reach the delegate's arguments", function() {
    var textField = field()
    var delegate = recording()
    var captured = []
    delegate.textPasteConfigurationSupportingTransformPasteItem = function(sender, item) {
        captured.push(sender, item, item.itemProvider)
    }
    textField.pasteDelegate = delegate
    var event = new window.Event("paste", {bubbles: true, cancelable: true})
    var clipboard = clipboardOf({"text/plain": "a@b.com", "text/html": "<b>x</b>"}, [fileOf("a.png", "image/png")])
    event.clipboardData = clipboard
    textField.$el[0].dispatchEvent(event)
    assert.equal(captured.length, 3)
    var forbidden = new Set([event, clipboard, clipboard.files, clipboard.items, clipboard.files[0], clipboard.items[0], clipboard.getData])
    var item = captured[1]
    for (var node of reachable(item)) {
        assert.ok(!forbidden.has(node), "reachable from the item")
        assert.ok(!(node instanceof window.Event), "an event is reachable from the item")
        assert.ok(!(node instanceof window.File), "a file is reachable from the item")
        assert.ok(!(node instanceof window.Node), "a DOM node is reachable from the item")
    }
    assert.equal(captured[2], item.itemProvider)
    assert.equal(captured[0], textField)
    for (var key of ["event", "clipboardData", "_event", "_clipboardData"]) {
        assert.equal(key in item, false, key)
        assert.equal(key in item.itemProvider, false, key)
    }
})

test("nothing from the clipboard is logged", function() {
    var textField = field()
    var logged = []
    var methods = ["log", "info", "warn", "error", "debug", "trace"]
    var originals = methods.map((name) => console[name])
    methods.forEach((name) => { console[name] = (...args) => logged.push(args) })
    try {
        textField.pasteDelegate = recording((item) => item.setStringResult("inserted"))
        pasteInto(textField.$el[0], {"text/plain": "SECRET-A", "text/html": "SECRET-B", "text/rtf": "SECRET-C"})
        textField.pasteDelegate = null
    } finally {
        methods.forEach((name, index) => { console[name] = originals[index] })
    }
    assert.deepEqual(logged, [])
})

test("a search field forwards the paste of its inner input, with the search field as the sender", function() {
    page("<div id=\"search\"></div>")
    var search = new UISearchTextField("#search")
    var delegate = recording((item) => item.setStringResult("x, y"))
    search.pasteDelegate = delegate
    var input = search.textField[0]
    input.value = "12"
    input.setSelectionRange(1, 1)
    var event = pasteInto(input, {"text/plain": "clip"})
    assert.equal(delegate.calls[0].textField, search)
    assert.equal(event.defaultPrevented, true)
    assert.equal(search.text, "1x, y2")
    search.pasteDelegate = null
    assert.equal(listenerCount(search.$el[0]), 0)
})

class MadeField extends UITextField {}
MadeField.nib = "<input class=\"made\">"

test("a field created in code binds the paste when it is placed, releases it on removal, and binds again on a second placement", function() {
    page("<div id=\"box\"></div>")
    var box = new UIView("#box")
    var textField = new MadeField()
    var delegate = recording((item) => item.setNoResult())
    textField.pasteDelegate = delegate
    assert.equal(textField.pasteDelegate, delegate)
    box.addSubview(textField)
    var input = textField.$el[0]
    assert.equal(listenerCount(input), 1)
    assert.equal(pasteInto(input, {"text/plain": "x"}).defaultPrevented, true)
    textField.removeFromSuperview()
    assert.equal(listenerCount(input), 0)
    box.addSubview(textField)
    assert.equal(listenerCount(textField.$el[0]), 1)
    assert.equal(pasteInto(textField.$el[0], {"text/plain": "x"}).defaultPrevented, true)
    assert.equal(delegate.calls.length, 2)
})


// The paste order: the UITextPasteDelegate transform runs first, then
// textField(_:shouldChangeCharactersIn:replacementString:) receives the string
// the paste will insert, and false cancels the insertion.
function changing(log, answer) {
    return {
        textFieldShouldChangeCharactersInRangeReplacementString(textField, range, replacement) {
            log.push({range, replacement})
            return typeof answer === "function" ? answer(replacement) : answer
        },
    }
}

test("the old textPasteConfigurationSupportingTransform is refused at assignment, naming the Apple method", function() {
    var textField = field()
    var retired = {textPasteConfigurationSupportingTransform(sender, item) { item.setNoResult() }}
    assert.throws(() => { textField.pasteDelegate = retired }, (error) => error instanceof TypeError && /textPasteConfigurationSupportingTransformPasteItem/.test(error.message) && /UITextField\.pasteDelegate/.test(error.message))
    assert.equal(textField.pasteDelegate, null)
    assert.equal(listenerCount(textField.$el[0]), 0)
})

test("the transform runs first, then shouldChange receives the transformed string and the selection as an NSRange", function() {
    var textField = field("ab")
    var order = []
    var seen = []
    textField.pasteDelegate = recording((item) => { order.push("transform"); item.setStringResult("a, b") })
    textField.delegate = {
        textFieldShouldChangeCharactersInRangeReplacementString(sender, range, replacement) {
            order.push("shouldChange")
            seen.push({sender, range, replacement})
        },
    }
    var input = textField.$el[0]
    input.setSelectionRange(1, 2)
    pasteInto(input, {"text/plain": "clipboard text"})
    assert.deepEqual(order, ["transform", "shouldChange"])
    assert.equal(seen[0].sender, textField)
    assert.ok(seen[0].range instanceof NSRange)
    assert.deepEqual([seen[0].range.location, seen[0].range.length], [1, 1])
    assert.equal(seen[0].replacement, "a, b", "the transformed string, not the clipboard's")
    assert.equal(textField.text, "aa, b")
})

test("false from shouldChange cancels the insertion: nothing inserted, no input event, the paste still consumed", function() {
    var textField = field("12")
    var log = []
    var changes = 0
    textField.addTarget({}, {action() { changes += 1 }, for: UIControlEvent.editingChanged})
    textField.pasteDelegate = recording((item) => item.setStringResult("999999"))
    textField.delegate = changing(log, false)
    var event = pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(log.length, 1)
    assert.equal(event.defaultPrevented, true, "the browser must not paste the clipboard's text instead")
    assert.equal(textField.text, "12")
    assert.equal(changes, 0)
})

test("true, and a return that is not exactly false, let the insertion through", function() {
    var textField = field("")
    var log = []
    textField.pasteDelegate = recording((item) => item.setStringResult("7"))
    for (var answer of [true, undefined, null, 0]) {
        textField.text = ""
        textField.delegate = changing(log, answer)
        pasteInto(textField.$el[0], {"text/plain": "x"})
        assert.equal(textField.text, "7", String(answer))
    }
})

test("a delegate that rules on digits and length stops an amount paste that breaks the rule, and takes one that keeps it", function() {
    var textField = field("")
    var rule = (replacement) => /^\d*$/.test(replacement) && replacement.length <= 6
    textField.delegate = changing([], rule)
    textField.pasteDelegate = recording((item) => item.setStringResult("12a45"))
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(textField.text, "")
    textField.pasteDelegate = recording((item) => item.setStringResult("1234567"))
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(textField.text, "")
    textField.pasteDelegate = recording((item) => item.setStringResult("12345"))
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(textField.text, "12345")
})

test("a mask on editingChanged still applies to an accepted paste", function() {
    class AmountField extends UITextField {
        init() {
            super.init()
            this.addTarget(this, {action() { this.$el[0].value = this.$el[0].value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") }, for: UIControlEvent.editingChanged})
        }
    }
    page("<input id=\"amount\">")
    var amount = new AmountField("#amount")
    amount.delegate = changing([], true)
    amount.pasteDelegate = recording((item) => item.setStringResult("R$ 0012"))
    pasteInto(amount.$el[0], {"text/plain": "x"})
    assert.equal(amount.text, "12")
})

test("setNoResult asks shouldChange nothing, and setDefaultResult leaves the browser's own beforeinput to ask it, once", function() {
    var textField = field("keep")
    var log = []
    textField.delegate = changing(log, false)
    textField.pasteDelegate = recording((item) => item.setNoResult())
    pasteInto(textField.$el[0], {"text/plain": "x"})
    assert.equal(log.length, 0)
    textField.pasteDelegate = recording((item) => item.setDefaultResult())
    var event = pasteInto(textField.$el[0], {"text/plain": "native"})
    assert.equal(event.defaultPrevented, false)
    assert.equal(log.length, 0, "the paste event does not ask: the beforeinput that follows it does")
    var input = textField.$el[0]
    input.setSelectionRange(0, 0)
    var beforeinput = new window.InputEvent("beforeinput", {data: "native", inputType: "insertFromPaste", bubbles: true, cancelable: true})
    input.dispatchEvent(beforeinput)
    assert.equal(log.length, 1)
    assert.equal(log[0].replacement, "native")
    assert.equal(beforeinput.defaultPrevented, true)
})

test("a field with a shouldChange delegate and no pasteDelegate pastes through beforeinput alone", function() {
    var textField = field("")
    var log = []
    textField.delegate = changing(log, false)
    var event = pasteInto(textField.$el[0], {"text/plain": "native"})
    assert.equal(event.defaultPrevented, false)
    assert.equal(log.length, 0)
})
