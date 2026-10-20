import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIDocumentPickerViewController, UIViewController, UTType, FileManager } from "../src/index.js"


var manager = FileManager.default

function file(name, bytes) {
    return new File([new Uint8Array(bytes)], name)
}

// The browser's file input, as far as a page can see it: click() opens it, and
// the user's choice arrives as `files` and a change event, a dismissal as a
// cancel event. Whichever input opens is captured. `activation` stands in for
// navigator.userActivation: undefined is a browser that does not report it.
function withPicker(run, {activation = {isActive: true}} = {}) {
    var proto = window.HTMLInputElement.prototype
    var originalClick = proto.click
    var originalShowPicker = proto.showPicker
    var opened = []
    var showPickerCalls = []
    proto.showPicker = function() { showPickerCalls.push(this) }
    proto.click = function() { opened.push({input: this, attached: this.isConnected}) }
    var originalCreateObjectURL = URL.createObjectURL
    var objectURLs = []
    URL.createObjectURL = function() { objectURLs.push(1); return "blob:x" }
    var originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {value: {userActivation: activation}, configurable: true, writable: true})
    try { run({opened, objectURLs, showPickerCalls}) } finally {
        proto.click = originalClick
        if (originalShowPicker) { proto.showPicker = originalShowPicker } else { delete proto.showPicker }
        URL.createObjectURL = originalCreateObjectURL
        if (originalNavigator) { Object.defineProperty(globalThis, "navigator", originalNavigator) } else { delete globalThis.navigator }
    }
}

function pick(input, files) {
    Object.defineProperty(input, "files", {value: files, configurable: true})
    input.dispatchEvent(new window.Event("change", {bubbles: true}))
}

function recorder() {
    var calls = []
    return {
        calls: calls,
        documentPickerDidPickDocumentsAt: function(controller, urls) { calls.push(["pick", controller, urls]) },
        documentPickerWasCancelled: function(controller) { calls.push(["cancel", controller]) },
    }
}

function presenter() {
    return new UIViewController()
}

test("the content types become the input's accept: extension and MIME type, image/*, nothing for item", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var cases = [
            [[UTType.pdf], [".pdf", "application/pdf"]],
            [[UTType.image], ["image/*"]],
            [[UTType.image, UTType.pdf], ["image/*", ".pdf", "application/pdf"]],
            [[UTType.png, UTType.jpeg], [".png", "image/png", ".jpeg", ".jpg", "image/jpeg"]],
            [[UTType.commaSeparatedText], [".csv", "text/csv"]],
            [[new UTType({filenameExtension: "pem"})], [".pem"]],
            [[new UTType({mimeType: "application/x-pkcs12"})], ["application/x-pkcs12"]],
        ]
        for (var [types, tokens] of cases) {
            var picker = new UIDocumentPickerViewController({forOpeningContentTypes: types, asCopy: true})
            presenter().present(picker, {animated: true})
            assert.deepEqual(opened[opened.length - 1].input.accept.split(","), tokens)
        }
        var any = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.item], asCopy: true})
        presenter().present(any, {animated: true})
        assert.equal(opened[opened.length - 1].input.hasAttribute("accept"), false)
        var mixed = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf, UTType.item], asCopy: true})
        presenter().present(mixed, {animated: true})
        assert.equal(opened[opened.length - 1].input.hasAttribute("accept"), false, "item allows every type")
    })
})

test("allowsMultipleSelection is the input's multiple, false by default", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        assert.equal(picker.allowsMultipleSelection, false)
        presenter().present(picker, {animated: true})
        assert.equal(opened[0].input.multiple, false)
        picker.allowsMultipleSelection = true
        assert.equal(picker.allowsMultipleSelection, true)
        presenter().present(picker, {animated: true})
        assert.equal(opened[1].input.multiple, true)
        assert.equal(opened[1].input.type, "file")
    })
})

test("the initializer requires both labels, refuses asCopy: false, and types the content types", function() {
    var types = [UTType.pdf]
    assert.throws(() => new UIDocumentPickerViewController(), (error) => error instanceof TypeError && /forOpeningContentTypes:asCopy:/.test(error.message))
    assert.throws(() => new UIDocumentPickerViewController({asCopy: true}), TypeError)
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: types}), TypeError)
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: types, asCopy: false}), (error) => error instanceof TypeError && /copy/.test(error.message))
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: ["pdf"], asCopy: true}), TypeError)
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: UTType.pdf, asCopy: true}), TypeError)
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: [], asCopy: true}), TypeError)
    assert.throws(() => new UIDocumentPickerViewController({forOpeningContentTypes: types, asCopy: "yes"}), TypeError)
})

test("present opens a hidden input with click, attached for the duration, and calls completion after", function() {
    page("<div></div>")
    withPicker(function({opened, showPickerCalls}) {
        var order = []
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = recorder()
        presenter().present(picker, {animated: true, completion: () => order.push("completion:" + opened.length)})
        assert.equal(opened.length, 1)
        assert.equal(opened[0].attached, true)
        assert.equal(opened[0].input.hidden, true)
        assert.deepEqual(order, ["completion:1"])
        assert.equal(document.body.contains(opened[0].input), true)
        assert.deepEqual(showPickerCalls, [], "showPicker is not used: WebKit accepts it on a file input and opens nothing")
    })
})

test("a browser that does not report user activation is asked with click", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        presenter().present(picker, {animated: true})
        assert.equal(opened.length, 1)
    }, {activation: undefined})
})

test("a pick delivers file: URLs in order to the delegate, through FileManager, and drops the input", async function() {
    page("<div></div>")
    await withPickerAsync(async function({opened, objectURLs}) {
        var delegate = recorder()
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = delegate
        picker.allowsMultipleSelection = true
        presenter().present(picker, {animated: true})
        var input = opened[0].input
        pick(input, [file("b second.pdf", [2, 2]), file("a.pdf", [1])])
        assert.equal(delegate.calls.length, 1)
        var [kind, controller, urls] = delegate.calls[0]
        assert.equal(kind, "pick")
        assert.equal(controller, picker)
        assert.equal(urls.length, 2)
        assert.ok(urls.every((url) => url instanceof URL && url.protocol === "file:"))
        assert.deepEqual(urls.map((url) => manager.displayName({atPath: url.href})), ["b second.pdf", "a.pdf"])
        assert.deepEqual([...await manager.contents({atPath: urls[0].href})], [2, 2])
        assert.equal(document.body.contains(input), false)
        assert.deepEqual(objectURLs, [], "no object URL was made")
        urls.forEach((url) => manager.removeItem({at: url}))
    })
})

test("a cancel event is documentPickerWasCancelled, and drops the input", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var delegate = recorder()
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = delegate
        presenter().present(picker, {animated: true})
        opened[0].input.dispatchEvent(new window.Event("cancel"))
        assert.deepEqual(delegate.calls, [["cancel", picker]])
        assert.equal(document.body.contains(opened[0].input), false)
        opened[0].input.dispatchEvent(new window.Event("cancel"))
        assert.equal(delegate.calls.length, 1, "the input is gone and answers nothing more")
    })
})

test("a present with no user activation is reported as a cancel at once and opens nothing", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var delegate = recorder()
        var order = []
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = delegate
        presenter().present(picker, {animated: true, completion: () => order.push("completion")})
        assert.deepEqual(delegate.calls, [["cancel", picker]])
        assert.deepEqual(opened, [])
        assert.deepEqual(order, [], "nothing was presented")
        assert.equal(document.querySelectorAll("input[type=file]").length, 0, "no input is left behind")
    }, {activation: {isActive: false}})
})

test("a delegate without the methods, or none, is fine", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        assert.equal(picker.delegate, null)
        presenter().present(picker, {animated: true})
        assert.doesNotThrow(() => pick(opened[0].input, [file("a.pdf", [1])]))
        picker.delegate = {}
        presenter().present(picker, {animated: true})
        assert.doesNotThrow(() => opened[1].input.dispatchEvent(new window.Event("cancel")))
    })
})

test("presenting again drops the first input without a callback, and a stale change does nothing", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var delegate = recorder()
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = delegate
        presenter().present(picker, {animated: true})
        presenter().present(picker, {animated: true})
        assert.equal(document.body.contains(opened[0].input), false)
        assert.equal(document.querySelectorAll("input[type=file]").length, 1)
        pick(opened[0].input, [file("stale.pdf", [1])])
        assert.deepEqual(delegate.calls, [])
    })
})

test("present on a picker leaves the page's root controller alone", function() {
    page("<cocoatouch><p id=\"kept\">page</p></cocoatouch>")
    withPicker(function() {
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        presenter().present(picker, {animated: true})
        assert.equal(document.getElementById("kept").textContent, "page")
    })
})

test("disposing a presented picker removes its input and its listeners", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var delegate = recorder()
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = delegate
        presenter().present(picker, {animated: true})
        picker._dispose()
        assert.equal(document.body.contains(opened[0].input), false)
        pick(opened[0].input, [file("a.pdf", [1])])
        assert.deepEqual(delegate.calls, [])
    })
})

async function withPickerAsync(run) {
    var result
    withPicker(function(state) { result = run(state) })
    return result
}

test("the whole sequence of a present that ends in a pick: open, completion, delegate, input gone", function() {
    page("<div></div>")
    withPicker(function({opened}) {
        var order = []
        var picker = new UIDocumentPickerViewController({forOpeningContentTypes: [UTType.pdf], asCopy: true})
        picker.delegate = {documentPickerDidPickDocumentsAt: function(controller, urls) { order.push("delegate:" + urls.length + ":attached=" + opened[0].input.isConnected) }}
        presenter().present(picker, {animated: true, completion: () => order.push("completion")})
        order.push("presented:attached=" + opened[0].input.isConnected)
        pick(opened[0].input, [file("a.pdf", [1])])
        order.push("picked:attached=" + opened[0].input.isConnected)
        assert.deepEqual(order, ["completion", "presented:attached=true", "delegate:1:attached=false", "picked:attached=false"])
    })
})
