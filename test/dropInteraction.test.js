import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import {
    UIView, UIDropInteraction, UIDropProposal, UIDropOperation, UIDropSession, UIDragItem, NSItemProvider,
    UTType, FileManager, FileAttributeKey,
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
        dropInteractionCanHandleSession: function(interaction, session) { calls.push("canHandle"); return true },
        dropInteractionSessionDidEnter: function() { calls.push("enter") },
        dropInteractionSessionDidUpdate: function() { calls.push("update"); return new UIDropProposal({operation: UIDropOperation.copy}) },
        dropInteractionPerformDrop: function() { calls.push("perform") },
        dropInteractionConcludeDrop: function() { calls.push("conclude") },
        dropInteractionSessionDidExit: function() { calls.push("exit") },
        dropInteractionSessionDidEnd: function() { calls.push("end") },
    }
    return Object.assign(delegate, overrides)
}

test("UIDropOperation and UIDropProposal are Apple's: cancel, forbidden, copy and move, and the operation is required", function() {
    assert.deepEqual(Object.keys(UIDropOperation).sort(), ["cancel", "copy", "forbidden", "move"])
    assert.equal(new UIDropProposal({operation: UIDropOperation.copy}).operation, UIDropOperation.copy)
    assert.equal(new UIDropProposal({operation: UIDropOperation.move}).operation, UIDropOperation.move)
    assert.throws(() => new UIDropProposal(), (error) => error instanceof TypeError && /UIDropProposal\(operation:\)/.test(error.message))
    assert.throws(() => new UIDropProposal({operation: "link"}), TypeError)
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
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "update", "update", "perform", "conclude", "end"])
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

test("a copy or move proposal prevents the dragover and sets dropEffect copy or move; forbidden and cancel prevent it and set none; no proposal is cancel, as Apple's default", function() {
    var proposal = null
    var delegate = recorder({dropInteractionSessionDidUpdate: () => proposal})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    var results = []
    for (var operation of [UIDropOperation.copy, UIDropOperation.move, UIDropOperation.forbidden, UIDropOperation.cancel, null]) {
        proposal = operation === null ? undefined : new UIDropProposal({operation: operation})
        var event = dragEvent("dragover", [pdf])
        event.dataTransfer.dropEffect = "link"
        zone.dispatchEvent(event)
        results.push([event.defaultPrevented, event.dataTransfer.dropEffect])
    }
    assert.deepEqual(results, [[true, "copy"], [true, "move"], [true, "none"], [true, "none"], [true, "none"]])
})

test("a view the delegate cannot handle gets only canHandle, and its dragover and drop are swallowed, never left to the browser", function() {
    var delegate = recorder({dropInteractionCanHandleSession: function() { delegate.calls.push("canHandle"); return false }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    var over = dragEvent("dragover", [pdf])
    over.dataTransfer.dropEffect = "copy"
    var overReachedBrowser = zone.dispatchEvent(over)
    var drop = dragEvent("drop", [pdf])
    drop.dataTransfer.dropEffect = "copy"
    var dropReachedBrowser = zone.dispatchEvent(drop)
    assert.deepEqual(delegate.calls, ["canHandle"])
    assert.equal(overReachedBrowser, false, "the browser's dragover default never runs")
    assert.equal(over.dataTransfer.dropEffect, "none")
    assert.equal(dropReachedBrowser, false, "the browser never opens the dropped file")
    assert.equal(drop.dataTransfer.dropEffect, "none")
})

test("a delegate without canHandle handles everything, and without a proposal the drop is cancelled: swallowed, and performDrop never runs", function() {
    var performed = []
    var {zone} = setup({dropInteractionPerformDrop: () => performed.push(1)})
    var enter = dragEvent("dragenter", [pdf])
    zone.dispatchEvent(enter)
    var over = dragEvent("dragover", [pdf])
    over.dataTransfer.dropEffect = "copy"
    var overReachedBrowser = zone.dispatchEvent(over)
    var drop = dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)])
    drop.dataTransfer.dropEffect = "copy"
    var dropReachedBrowser = zone.dispatchEvent(drop)
    assert.equal(enter.defaultPrevented, true, "a drag the delegate handles is let in")
    assert.equal(overReachedBrowser, false)
    assert.equal(over.dataTransfer.dropEffect, "none")
    assert.equal(dropReachedBrowser, false, "the browser never opens the dropped file")
    assert.equal(drop.dataTransfer.dropEffect, "none")
    assert.deepEqual(performed, [], "Apple's default proposal is .cancel")
})

test("an answer that is not a UIDropProposal is a cancel too, and the drop never reaches performDrop", function() {
    var delegate = recorder({dropInteractionSessionDidUpdate: () => UIDropOperation.copy})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    var over = dragEvent("dragover", [pdf])
    over.dataTransfer.dropEffect = "copy"
    zone.dispatchEvent(over)
    var dropReachedBrowser = zone.dispatchEvent(dragEvent("drop", [pdf]))
    assert.equal(over.defaultPrevented, true)
    assert.equal(over.dataTransfer.dropEffect, "none")
    assert.equal(dropReachedBrowser, false)
    assert.deepEqual(delegate.calls, ["canHandle", "enter", "end"])
})

test("canHandle and hasItemsConforming answer from the kinds and MIME types a drag shows before the drop", function() {
    var answers = []
    var delegate = recorder({dropInteractionCanHandleSession: function(interaction, session) {
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
        [true, true, true, 2],
        [false, false, false, 0],
        [false, false, false, 0],
    ])
})

test("hasItemsConforming is true when any item conforms, and the delegate filters per item", function() {
    var seen = []
    var delegate = recorder({dropInteractionCanHandleSession: function(interaction, session) {
        seen.push(
            session.hasItemsConforming({toTypeIdentifiers: [UTType.pdf.identifier]}),
            session.items.filter((item) => item.itemProvider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier)).length,
            session.hasItemsConforming({toTypeIdentifiers: [UTType.commaSeparatedText.identifier]}),
        )
        return true
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [{type: "text/plain"}, pdf, {type: "image/jpeg"}]))
    assert.deepEqual(seen, [true, 1, false])
})

test("a session's items carry providers; before the drop a provider answers conformance but loads nothing", function() {
    var seen = []
    var delegate = recorder({dropInteractionCanHandleSession: function(interaction, session) {
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
        dropInteractionCanHandleSession: function(interaction, session) {
            return session.hasItemsConforming({toTypeIdentifiers: [UTType.folder.identifier, UTType.pdf.identifier]})
        },
        dropInteractionPerformDrop: function(interaction, session) {
            listing.push(session.items.length, session.items[0].itemProvider.hasItemConformingToTypeIdentifier(UTType.folder.identifier), session.items[0].itemProvider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier))
            session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.folder.identifier, completionHandler: async function(url, error) {
                var children = await manager.contentsOfDirectory({at: url, includingPropertiesForKeys: null})
                listing.push(children.map((child) => manager.displayName({atPath: child.href})))
                var nested = await manager.contentsOfDirectory({at: children[1], includingPropertiesForKeys: null})
                listing.push(nested.map((child) => manager.displayName({atPath: child.href})), url)
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
    var second = recorder({dropInteractionCanHandleSession: function() { second.calls.push("canHandle"); return false }})
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

test("one session object serves enter and every dragover of a drag, and a new drag gets a new one", function() {
    var seen = []
    var delegate = recorder({
        dropInteractionSessionDidEnter: (interaction, session) => seen.push(session),
        dropInteractionSessionDidUpdate: (interaction, session) => { seen.push(session); return null },
        dropInteractionSessionDidExit: (interaction, session) => seen.push(session),
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("dragleave", [pdf]))
    assert.equal(seen.length, 4)
    assert.ok(seen.every((session) => session === seen[0]))
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.notEqual(seen[4], seen[0])
})

test("loading a provider again answers the same URL with one registry entry, and a removed one is registered anew", async function() {
    var before = registeredCount()
    var urls = []
    var delegate = recorder({dropInteractionPerformDrop: function(interaction, session) {
        var provider = session.items[0].itemProvider
        var load = () => provider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url) => urls.push(url)})
        load()
        load()
        setTimeout(() => {
            manager.removeItem({at: urls[0]})
            load()
        }, 0)
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1, 2])}, pdf)]))
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(urls.length, 3)
    assert.equal(urls[0].href, urls[1].href)
    assert.notEqual(urls[2].href, urls[0].href)
    assert.deepEqual([...await manager.contents({atPath: urls[2].href})], [1, 2])
    assert.equal(registeredCount(), before + 1)
    manager.removeItem({at: urls[2]})
    assert.equal(registeredCount(), before)
})

test("a delegate carrying the retired canHandle name is refused, naming the replacement", function() {
    assert.throws(
        () => new UIDropInteraction({delegate: {dropInteractionCanHandle: function() { return true }}}),
        (error) => error instanceof TypeError && /dropInteractionCanHandle\b/.test(error.message) && /dropInteractionCanHandleSession/.test(error.message) && /in cocoatouch 1\.9\.0;/.test(error.message),
    )
    var calls = []
    var {zone} = setup({dropInteractionCanHandleSession: function() { calls.push("canHandleSession"); return true }})
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(calls, ["canHandleSession"])
})

test("canHandle runs once per session and the same session object goes from enter to drop", function() {
    var sessions = []
    var counts = {canHandle: 0}
    var delegate = recorder({
        dropInteractionCanHandleSession: (interaction, session) => { counts.canHandle += 1; sessions.push(session); return true },
        dropInteractionSessionDidEnter: (interaction, session) => sessions.push(session),
        dropInteractionSessionDidUpdate: (interaction, session) => { sessions.push(session); return new UIDropProposal({operation: UIDropOperation.copy}) },
        dropInteractionPerformDrop: (interaction, session) => sessions.push(session),
        dropInteractionConcludeDrop: (interaction, session) => sessions.push(session),
        dropInteractionSessionDidEnd: (interaction, session) => sessions.push(session),
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    assert.equal(counts.canHandle, 1)
    assert.equal(sessions.length, 6)
    assert.ok(sessions.every((session) => session === sessions[0]))
})

test("the session at enter shows each file item's type and the count, and the same items load their files at drop", async function() {
    var seen = []
    var held = []
    var delegate = recorder({
        dropInteractionCanHandleSession: function(interaction, session) {
            seen.push(session.items.length, session.items.map((item) => item.itemProvider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier)))
            held.push(...session.items)
            session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => seen.push(["atEnter", url, error instanceof Error])})
            return true
        },
        dropInteractionPerformDrop: function(interaction, session) {
            seen.push(session.items.length, session.items.every((item, index) => item === held[index]))
            session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => seen.push(["atDrop", url.protocol, error])})
        },
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf, {type: "image/png"}, {kind: "string", type: "text/plain"}]))
    zone.dispatchEvent(dragEvent("drop", [
        Object.assign({file: file("a.pdf", [1])}, pdf),
        {type: "image/png", file: file("b.png", [2])},
        {kind: "string", type: "text/plain"},
    ]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(seen, [2, [true, false], 2, true, ["atEnter", null, true], ["atDrop", "file:", null]])
})

test("a provider captured at enter gains its file in place at drop, so performDrop loads it through the captured object", async function() {
    var captured = []
    var seen = []
    var delegate = recorder({
        dropInteractionCanHandleSession: function(interaction, session) {
            captured.push(session.items[0].itemProvider)
            seen.push(["atEnter", captured[0].suggestedName, captured[0].hasItemConformingToTypeIdentifier(UTType.pdf.identifier)])
            return true
        },
        dropInteractionPerformDrop: function(interaction, session) {
            seen.push(["sameProvider", session.items[0].itemProvider === captured[0], captured[0].suggestedName])
            captured[0].loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url, error) => {
                seen.push(["loaded", url && url.protocol, error])
                if (url) { manager.removeItem({at: url}) }
            }})
        },
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragover", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(seen, [["atEnter", null, true], ["sameProvider", true, "a"], ["loaded", "file:", null]])
})

test("a folder dropped over a provider captured at enter makes that provider conform to the folder type", function() {
    var captured = []
    var seen = []
    var delegate = recorder({
        dropInteractionCanHandleSession: function(interaction, session) {
            captured.push(session.items[0].itemProvider)
            return true
        },
        dropInteractionPerformDrop: function() {
            seen.push(captured[0].hasItemConformingToTypeIdentifier(UTType.folder.identifier))
        },
    })
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [{type: ""}]))
    zone.dispatchEvent(dragEvent("dragover", [{type: ""}]))
    zone.dispatchEvent(dragEvent("drop", [{type: "", entry: directoryEntry("pictures", [])}]))
    assert.deepEqual(seen, [true])
})

test("count and size checks run in performDrop, which can refuse without reading a byte", async function() {
    var reads = []
    var verdicts = []
    var big = file("big.pdf", new Array(2048).fill(1))
    big.arrayBuffer = function() { reads.push("big"); return Promise.resolve(new ArrayBuffer(0)) }
    var delegate = recorder({dropInteractionPerformDrop: function(interaction, session) {
        verdicts.push(session.items.length)
        session.items[0].itemProvider.loadFileRepresentation({forTypeIdentifier: UTType.pdf.identifier, completionHandler: (url) => {
            verdicts.push(manager.attributesOfItem({atPath: url.href})[FileAttributeKey.size] > 1024 ? "tooBig" : "ok")
            manager.removeItem({at: url})
        }})
    }})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("drop", [Object.assign({file: big}, pdf)]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(verdicts, [1, "tooBig"])
    assert.deepEqual(reads, [])
})

test("a forbidden or cancel proposal is swallowed on dragover and on drop, and performDrop never runs", function() {
    for (var operation of [UIDropOperation.forbidden, UIDropOperation.cancel]) {
        var delegate = recorder({dropInteractionSessionDidUpdate: () => new UIDropProposal({operation: operation})})
        var {zone} = setup(delegate)
        zone.dispatchEvent(dragEvent("dragenter", [pdf]))
        var over = dragEvent("dragover", [pdf])
        over.dataTransfer.dropEffect = "move"
        assert.equal(zone.dispatchEvent(over), false, `${operation}: dragover default prevented`)
        assert.equal(over.dataTransfer.dropEffect, "none")
        var drop = dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)])
        drop.dataTransfer.dropEffect = "copy"
        assert.equal(zone.dispatchEvent(drop), false, `${operation}: the browser never opens the file`)
        assert.equal(drop.dataTransfer.dropEffect, "none")
        assert.ok(!delegate.calls.includes("perform"))
        assert.ok(delegate.calls.includes("end"))
    }
})

test("a drop refused at enter and made over a child of the view is swallowed too, and the next drag is judged afresh", function() {
    var verdict = false
    var delegate = recorder({dropInteractionCanHandleSession: function() { delegate.calls.push("canHandle"); return verdict }})
    var {zone, child} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    child.dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.equal(child.dispatchEvent(dragEvent("dragover", [pdf])), false)
    assert.equal(child.dispatchEvent(dragEvent("drop", [pdf])), false)
    verdict = true
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    var over = dragEvent("dragover", [pdf])
    zone.dispatchEvent(over)
    assert.deepEqual(delegate.calls, ["canHandle", "canHandle", "enter", "update"])
    assert.equal(over.defaultPrevented, true, "the accepted drag is a copy now")
})

test("a drag that left a refusing view is no longer swallowed there", function() {
    var delegate = recorder({dropInteractionCanHandleSession: () => false})
    var {zone} = setup(delegate)
    zone.dispatchEvent(dragEvent("dragenter", [pdf]))
    zone.dispatchEvent(dragEvent("dragleave", [pdf]))
    assert.equal(zone.dispatchEvent(dragEvent("dragover", [pdf])), true)
})

function nested(innerDelegate, outerDelegate) {
    page("<div id=\"outer\"><div id=\"inner\"><span id=\"leaf\">x</span></div></div>")
    var outer = new UIView("#outer")
    var inner = new UIView("#inner")
    outer.addInteraction(new UIDropInteraction({delegate: outerDelegate}))
    inner.addInteraction(new UIDropInteraction({delegate: innerDelegate}))
    return {outer: document.getElementById("outer"), inner: document.getElementById("inner"), leaf: document.getElementById("leaf")}
}

test("a nested drop is performed once, by the innermost interaction, and the outer one only ends its session", function() {
    var inner = recorder()
    var outer = recorder()
    var {leaf} = nested(inner, outer)
    leaf.dispatchEvent(dragEvent("dragenter", [pdf]))
    leaf.dispatchEvent(dragEvent("dragover", [pdf]))
    leaf.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    assert.deepEqual(inner.calls, ["canHandle", "enter", "update", "perform", "conclude", "end"])
    assert.ok(!outer.calls.includes("perform"), "an ancestor never runs performDrop")
    assert.ok(!outer.calls.includes("conclude"))
    assert.equal(outer.calls[outer.calls.length - 1], "end")
    assert.equal(inner.calls.concat(outer.calls).filter((call) => call === "perform").length, 1)
})

test("over a nested view the innermost interaction's proposal decides the drop effect", function() {
    var inner = recorder()
    var outer = recorder({dropInteractionSessionDidUpdate: function() { outer.calls.push("update"); return new UIDropProposal({operation: UIDropOperation.forbidden}) }})
    var {leaf} = nested(inner, outer)
    leaf.dispatchEvent(dragEvent("dragenter", [pdf]))
    var over = dragEvent("dragover", [pdf])
    over.dataTransfer.dropEffect = "move"
    leaf.dispatchEvent(over)
    assert.equal(over.dataTransfer.dropEffect, "copy")
    assert.equal(over.defaultPrevented, true)
    assert.ok(!outer.calls.includes("update"))
})

test("an outer interaction handles a drop over an inner view that refused it", function() {
    var inner = recorder({dropInteractionCanHandleSession: () => false})
    var outer = recorder()
    var {leaf} = nested(inner, outer)
    leaf.dispatchEvent(dragEvent("dragenter", [pdf]))
    var over = dragEvent("dragover", [pdf])
    leaf.dispatchEvent(over)
    assert.equal(over.dataTransfer.dropEffect, "copy")
    leaf.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    assert.deepEqual(outer.calls, ["canHandle", "enter", "update", "perform", "conclude", "end"])
    assert.ok(!inner.calls.includes("perform"))
})

test("a nested drop still reaches the document, so a stale session elsewhere ends with it", function() {
    var stale = recorder()
    page("<div id=\"stale\"></div><div id=\"outer\"><div id=\"inner\"></div></div>")
    new UIView("#stale").addInteraction(new UIDropInteraction({delegate: stale}))
    new UIView("#outer").addInteraction(new UIDropInteraction({delegate: recorder()}))
    new UIView("#inner").addInteraction(new UIDropInteraction({delegate: recorder()}))
    var staleZone = document.getElementById("stale")
    staleZone.dispatchEvent(dragEvent("dragenter", [pdf]))
    staleZone.dispatchEvent(dragEvent("dragleave", [pdf]))
    var inner = document.getElementById("inner")
    inner.dispatchEvent(dragEvent("dragenter", [pdf]))
    inner.dispatchEvent(dragEvent("drop", [Object.assign({file: file("a.pdf", [1])}, pdf)]))
    assert.deepEqual(stale.calls, ["canHandle", "enter", "exit", "end"])
})

test("UIDragItem requires its itemProvider label, and the provider itself", function() {
    var provider = new NSItemProvider()
    assert.equal(new UIDragItem({itemProvider: provider}).itemProvider, provider)
    assert.throws(() => new UIDragItem(), (error) => error instanceof TypeError && /UIDragItem\(itemProvider:\)/.test(error.message))
    assert.throws(() => new UIDragItem({}), TypeError)
    assert.throws(() => new UIDragItem(provider), TypeError, "the bare provider has no label")
    assert.throws(() => new UIDragItem({itemProvider: "x"}), TypeError)
})

test("an interaction added to a second view leaves the first", function() {
    page("<div id=\"a\"></div><div id=\"b\"></div>")
    var first = new UIView("#a")
    var second = new UIView("#b")
    var delegate = recorder()
    var interaction = new UIDropInteraction({delegate: delegate})
    first.addInteraction(interaction)
    second.addInteraction(interaction)
    assert.deepEqual(first.interactions, [])
    assert.deepEqual(second.interactions, [interaction])
    assert.equal(interaction.view, second)
    document.getElementById("a").dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(delegate.calls, [], "the first view no longer drives it")
    document.getElementById("b").dispatchEvent(dragEvent("dragenter", [pdf]))
    assert.deepEqual(delegate.calls, ["canHandle", "enter"])
})
