import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIPasteboard } from "../src/index.js"


// Node 22 defines navigator as a getter on globalThis, so a stand-in replaces it by descriptor.
async function withNavigator(stand, run) {
    var original = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {value: stand, configurable: true, writable: true})
    try { return await run() } finally {
        if (original) { Object.defineProperty(globalThis, "navigator", original) }
        if (!original) { delete globalThis.navigator }
    }
}

async function withExecCommand(stand, run) {
    var original = document.execCommand
    document.execCommand = stand
    try { return await run() } finally { document.execCommand = original }
}

test("UIPasteboard.general is one object for the page", function() {
    assert.ok(UIPasteboard.general instanceof UIPasteboard)
    assert.equal(UIPasteboard.general, UIPasteboard.general)
})

test("string is null and hasStrings false before anything is written", function() {
    var pasteboard = new UIPasteboard()
    assert.equal(pasteboard.string, null)
    assert.equal(pasteboard.hasStrings, false)
})

test("setting string writes through navigator.clipboard.writeText and the getter returns the last string written", async function() {
    var written = []
    var stand = {clipboard: {writeText: (text) => { written.push(text); return Promise.resolve() }}}
    await withNavigator(stand, function() {
        var pasteboard = new UIPasteboard()
        pasteboard.string = "PIX-123"
        assert.deepEqual(written, ["PIX-123"])
        assert.equal(pasteboard.string, "PIX-123")
        assert.equal(pasteboard.hasStrings, true)
        pasteboard.string = "second"
        assert.equal(pasteboard.string, "second")
    })
})

test("a hidden textarea and execCommand copy stand in when navigator.clipboard is absent", async function() {
    page("<button id=\"copy\">copy</button>")
    var seen = null
    var stand = function(command) {
        var area = document.querySelector("textarea")
        seen = {command: command, value: area.value, selected: area.value.slice(area.selectionStart, area.selectionEnd), isReadOnly: area.readOnly}
        return true
    }
    await withNavigator({}, async function() {
        await withExecCommand(stand, function() {
            var pasteboard = new UIPasteboard()
            pasteboard.string = "agency 0001"
            assert.deepEqual(seen, {command: "copy", value: "agency 0001", selected: "agency 0001", isReadOnly: true})
            assert.equal(document.querySelector("textarea"), null)
            assert.equal(pasteboard.string, "agency 0001")
        })
    })
})

test("the fallback gives the focus back to the element that held it", async function() {
    page("<input id=\"field\">")
    var field = document.getElementById("field")
    field.focus()
    await withNavigator({}, async function() {
        await withExecCommand(() => true, function() {
            new UIPasteboard().string = "text"
        })
    })
    assert.equal(document.activeElement, field)
})

test("a rejected writeText falls back to the textarea copy", async function() {
    var commands = []
    var stand = {clipboard: {writeText: () => Promise.reject(new Error("denied"))}}
    await withNavigator(stand, async function() {
        await withExecCommand((command) => { commands.push(command); return true }, async function() {
            new UIPasteboard().string = "late"
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    })
    assert.deepEqual(commands, ["copy"])
    assert.equal(document.querySelector("textarea"), null)
})

test("setting null forgets the string and writes nothing", async function() {
    var written = []
    var stand = {clipboard: {writeText: (text) => { written.push(text); return Promise.resolve() }}}
    await withNavigator(stand, function() {
        var pasteboard = new UIPasteboard()
        pasteboard.string = "once"
        pasteboard.string = null
        assert.equal(pasteboard.string, null)
        assert.equal(pasteboard.hasStrings, false)
        assert.deepEqual(written, ["once"])
    })
})

test("a value that is not a String or nil is refused with a TypeError", function() {
    var pasteboard = new UIPasteboard()
    assert.throws(() => { pasteboard.string = 42 }, (error) => error instanceof TypeError && /UIPasteboard\.string/.test(error.message))
})
