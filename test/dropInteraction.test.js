import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import {
    UIView, UIDropInteraction, UIDropProposal, UIDropOperation, UIDropSession, UIDragItem, NSItemProvider,
    UTType, FileManager,
} from "../src/index.js"
import { registeredCount } from "../src/foundation/fileregistry.js"


var manager = FileManager.default

// A DataTransfer as a browser exposes it: kinds and MIME types while the drag
// is over the page, files and entries only at the drop.
function transfer(items) {
    var dataTransfer = {
        dropEffect: "none",
        types: ["Files"],
        items: items.map((item) => ({
            kind: item.kind || "file",
            type: item.type === undefined ? "" : item.type,
            getAsFile: () => item.file || null,
            webkitGetAsEntry: () => item.entry || null,
        })),
    }
    return dataTransfer
}

function dragEvent(name, items) {
    var event = new window.Event(name, {bubbles: true, cancelable: true})
    event.dataTransfer = transfer(items || [])
    return event
}

function file(name, bytes, type) {
    return new File([new Uint8Array(bytes)], name, {type: type || ""})
}

function fileEntry(name, bytes) {
    return {isFile: true, isDirectory: false, name: name, file: (done) => done(file(name, bytes))}
}

function directoryEntry(name, children) {
    return {isDirectory: true, isFile: false, name: name, createReader: function() {
        var rest = children.slice()
        return {readEntries: (done) => done(rest.splice(0, 100))}
    }}
}

var pdf = {type: "application/pdf"}

function setup(delegate) {
    page("<div id=\"zone\"><span id=\"child\">x</span></div><div id=\"other\"></div>")
    var view = new UIView("#zone")
    var interaction = new UIDropInteraction({delegate: delegate})
    view.addInteraction(interaction)
    return {view, interaction, zone: document.getElementById("zone"), child: document.getElementById("child")}
}

function recorder(overrides) {
    var calls = []
    var delegate = {
        calls: calls,
        dropInteractionCanHandle: function(interaction, session) { calls.push("canHandle"); return true },
        dropInteractionSessionDidEnter: function() { calls.push("enter") },
        dropInteractionSessionDidUpdate: function() { calls.push("update"); return new UIDropProposal({operation: UIDropOperation.copy}) },
        dropInteractionPerformDrop: function() { calls.push("perform") },
        dropInteractionSessionDidExit: function() { calls.push("exit") },
        dropInteractionSessionDidEnd: function() { calls.push("end") },
    }
    return Object.assign(delegate, overrides)
}

test("UIDropOperation and UIDropProposal are Apple's: cancel, forbidden and copy, and the operation is required", function() {
    assert.deepEqual(Object.keys(UIDropOperation).sort(), ["cancel", "copy", "forbidden"])
    assert.equal(new UIDropProposal({operation: UIDropOperation.copy}).operation, UIDropOperation.copy)
    assert.throws(() => new UIDropProposal(), (error) => error instanceof TypeError && /UIDropProposal\(operation:\)/.test(error.message))
    assert.throws(() => new UIDropProposal({operation: "move"}), TypeError)
})

test("the initializer requires a delegate", function() {
    assert.throws(() => new UIDropInteraction(), (error) => error instanceof TypeError && /UIDropInteraction\(delegate:\)/.test(error.message))
    assert.throws(() => new UIDropInteraction({delegate: null}), TypeError)
    assert.throws(() => new UIDropInteraction({delegate: "x"}), TypeError)
})

test("a drag over the view is canHandle, enter, update per dragover, exit on leaving and, after a drop, perform then end", function() {
    var delegate = recorder()
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "update", "update", "canHandle", "perform", "end"])
})

test("leaving the view is exit, and the end comes with the next drop or drag end anywhere on the page", function() {
    var delegate = recorder()
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragleave", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "exit"])
    document.getElementById("other").dispatchEvent(dragEvent("drop", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "exit", "end"])
    document.dispatchEvent(dragEvent("dragend"))
    assert.equal(delegate.calls.filter((call) => call === "end").length, 1)
})

test("entering another drag after an exit ends the stale session first", function() {
    var delegate = recorder()
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragleave", [pdf]))
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "exit", "end", "canHandle", "enter"])
})

test("exit fires once for a drag that crosses the view's children", function() {
    var delegate = recorder()
    var {zone, child} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    child.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragleave", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter"], "still inside through the child")
    child.dispatchEvent(dragEvent("dragleave", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "exit"])
})

test("a copy proposal prevents the dragover and sets dropEffect copy; forbidden sets none and leaves it to the browser; cancel and none touch nothing", function() {
    var proposal = null
    var delegate = recorder({dropInteractionSessionDidUpdate: () => proposal})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    var results = []
    for (var operation of [UIDropOperation.copy, UIDropOperation.forbidden, UIDropOperation.cancel, null]) {
        proposal = operation === null ? undefined : new UIDropProposal({operation: operation})
        var event = dragEvent("dragover", [pdf])
        event.dataTransfer.dropEffect = "move"
        zone.dispatchEvent(event)
        results.push([event.defaultPrevented, event.dataTransfer.dropEffect])
    }
    assert.deepEqual(results, [[true, "copy"], [false, "none"], [false, "move"], [false, "move"]])
})

test("a view the delegate cannot handle gets no callbacks and no preventDefault on any event", function() {
    var delegate = recorder({dropInteractionCanHandle: function() { delegate.calls.push("canHandle"); return false }})
    var {zone} = setup(delegate)
    var events = ["dragenter", "dragover", "dragleave"].map((name) => { var event = dragEvent(name, [pdf]); zone.dispatchEvent(event); return event })
    var drop = dragEvent("drop", [pdf])
    zone.dispatchEvent(drop)
    assert.deepEqual(delegate.calls, ["canHandle"])
    assert.ok(events.every((event) => !event.defaultPrevented))
    assert.equal(drop.defaultPrevented, false, "the browser keeps its own handling of a drop nobody handles")
})

test("a delegate without canHandle handles everything, and without a proposal accepts nothing", function() {
    var performed = []
    var {zone} = setup({dropInteractionPerformDrop: () => performed.push(1)})
    var enter = dragEvent("dragenter", [pdf])
    zone.dispatchEvent(enter)
    var over = dragEvent("dragover", [pdf])
    zone.dispatchEvent(over)
    assert.equal(enter.defaultPrevented, true, "a drag the delegate handles is let in")
    assert.equal(over.defaultPrevented, false)
    zone.dispatchEvent(dragEvent("drop", [pdf]))
    assert.equal(performed.length, 1)
})

test("canHandle and hasItemsConforming answer from the kinds and MIME types a drag shows before the drop", function() {
    var answers = []
    var delegate = recorder({dropInteractionCanHandle: function(interaction, session) {
        answers.push([
            session.hasItemsConforming({toTypeIdentifiers: [UTType.pdf.identifier]}),
            session.hasItemsConforming({toTypeIdentifiers: [UTType.image.identifier]}),
            session.hasItemsConforming({toTypeIdentifiers: [UTType.image.identifier, UTType.pdf.identifier]}),
            session.items.length,
        ])
        return true
    }})
    var {zone} = setup(delegate)
    for (var items of [[pdf], [{type: "image/png"}], [pdf, {type: "image/png"}], [{kind: "string", type: "text/plain"}], []]) {
        zone.dispatchEvent(dragEvent("dragenter", items))
        zone.dispatchEvent(dragEvent("dragleave", items))
        zone.dispatchEvent(dragEvent("drop", items))
    }
    assert.deepEqual(answers, [
        [true, false, true, 1],
        [false, true, true, 1],
        [false, false, true, 2],
        [false, false, false, 0],
        [false, false, false, 0],
    ])
})

test("a session's items carry providers; before the drop a provider answers conformance but loads nothing", function() {
    var seen = []
    var delegate = recorder({dropInteractionCanHandle: function(interaction, session) {
        var item = session.items[0]
        seen.push(item instanceof UIDragItem, item.itemProvider instanceof NSItemProvider, item.itemProvider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier), item.itemProvider.hasItemConformingToTypeIdentifier(UTType.image.identifier), item.itemProvider.hasItemConformingToTypeIdentifier(UTType.item.identifier))
        item.itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => seen.push(url, error instanceof Error)})
        return true
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    return Promise.resolve().then(() => Promise.resolve()).then(function() {
        assert.deepEqual(seen, [true, true, true, false, true, null, true])
    })
})

test("performDrop's providers load registered file: URLs with the right name and bytes", async function() {
    var before = registeredCount()
    var loaded = []
    var delegate = recorder({dropInteractionPerformDrop: function(interaction, session) {
        for (var item of session.items) {
            var provider = item.itemProvider
            loaded.push(provider.suggestedName)
            provider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => loaded.push({url, error})})
        }
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf, pdf]))
    zone.dispatchEvent(dragEvent("drop", [
        Object.assign({file: file("Contract final.pdf", [1, 2, 3])}, pdf),
        Object.assign({file: file("b.pdf", [9])}, pdf),
    ]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(loaded.slice(0, 2), ["Contract final", "b"])
    var first = loaded[2]
    var second = loaded[3]
    assert.equal(first.error, null)
    assert.equal(first.url.protocol, "file:")
    assert.equal(manager.displayName({atPath: first.url.href}), "Contract final.pdf")
    assert.deepEqual([...await manager.contents({atPath: first.url.href})], [1, 2, 3])
    assert.deepEqual([...await manager.contents({atPath: second.url.href})], [9])
    manager.removeItem({at: first.url})
    manager.removeItem({at: second.url})
    assert.equal(registeredCount(), before)
})

test("loading a type the item does not conform to fails with an error and registers nothing", async function() {
    var before = registeredCount()
    var results = []
    var delegate = recorder({dropInteractionPerformDrop: function(interaction, session) {
        session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.image.identifier, completionHandler: (url, error) => results.push([url, error instanceof Error])})
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(results, [[null, true]])
    assert.equal(registeredCount(), before)
})

test("a dropped folder is one UTType.folder item whose URL lists its entries, nested folders included", async function() {
    var before = registeredCount()
    var folder = directoryEntry("Docs", [fileEntry("a.pdf", [1]), directoryEntry("Sub", [fileEntry("c.pdf", [3])])])
    var listing = []
    var delegate = recorder({
        dropInteractionCanHandle: function(interaction, session) {
            return session.hasItemsConforming({toTypeIdentifiers: [UTType.folder.identifier, UTType.pdf.identifier]})
        },
        dropInteractionPerformDrop: function(interaction, session) {
            listing.push(session.items.length, session.items[0].itemProvider.hasItemConformingToTypeIdentifier(UTType.folder.identifier), session.items[0].itemProvider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier))
            session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.folder.identifier, completionHandler: async function(url, error) {
                var paths = await manager.contentsOfDirectory({atPath: url.href})
                listing.push(paths.map((path) => manager.displayName({atPath: path})))
                var nested = await manager.contentsOfDirectory({atPath: paths[1]})
                listing.push(nested.map((path) => manager.displayName({atPath: path})), url)
            }})
        },
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [{type: "", entry: folder, file: file("Docs", [])}]))
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(listing.slice(0, 5), [1, true, false, ["a.pdf", "Sub"], ["c.pdf"]])
    manager.removeItem({at: listing[5]})
    assert.equal(registeredCount(), before, "dropping the folder releases what it listed")
})

test("removeInteraction unbinds every listener, and the document's too", function() {
    var delegate = recorder()
    var {view, interaction, zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    view.removeInteraction(interaction)
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "end"], "a session in flight ends with the interaction")
    delegate.calls.length = 0
    for (var name of ["dragenter", "dragover", "dragleave", "drop"]) { zone.dispatchEvent(dragEvent(name, [pdf])) }
    document.dispatchEvent(dragEvent("dragend"))
    document.dispatchEvent(dragEvent("drop"))
    assert.deepEqual(delegate.calls, [])
})

test("the document carries listeners only while a session lives", function() {
    var added = []
    var removed = []
    var addEventListener = document.addEventListener.bind(document)
    var removeEventListener = document.removeEventListener.bind(document)
    document.addEventListener = (name, callback, options) => { added.push(name); addEventListener(name, callback, options) }
    document.removeEventListener = (name, callback, options) => { removed.push(name); removeEventListener(name, callback, options) }
    try {
        var {zone} = setup(recorder())
        assert.deepEqual(added, [])
        zone.dispatchEvent(dragEvent("dragenter", [pdf]))
        assert.deepEqual(added.slice().sort(), ["dragend", "drop"])
        zone.dispatchEvent(dragEvent("drop", [pdf]))
        assert.deepEqual(removed.slice().sort(), ["dragend", "drop"])
    } finally {
        document.addEventListener = addEventListener
        document.removeEventListener = removeEventListener
    }
})

test("two interactions on two views stay independent", function() {
    page("<div id=\"a\"></div><div id=\"b\"></div>")
    var first = recorder()
    var second = recorder({dropInteractionCanHandle: function() { second.calls.push("canHandle"); return false }})
    new UIView("#a").addInteraction(new UIDropInteraction({delegate: first}))
    new UIView("#b").addInteraction(new UIDropInteraction({delegate: second}))
    document.getElementById("a").dispatchEvent(dragEvent("dragenter", [pdf]))
    document.getElementById("b").dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(first.calls, ["canHandle", "enter"])
    assert.deepEqual(second.calls, ["canHandle"])
})

test("disposing the view removes its drop interactions", function() {
    var delegate = recorder()
    var {view, zone} = setup(delegate)
    view._dispose()
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(delegate.calls, [])
    assert.deepEqual(view.interactions, [])
})

test("UIDropSession, UIDragItem and NSItemProvider are exported", function() {
    assert.equal(typeof UIDropSession, "function")
    assert.equal(typeof UIDragItem, "function")
    assert.equal(typeof NSItemProvider, "function")
})
