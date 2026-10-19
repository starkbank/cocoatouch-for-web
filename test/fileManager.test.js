import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { FileManager, FileAttributeKey } from "../src/index.js"
import { registerFile, registerDirectory, registeredCount } from "../src/foundation/fileregistry.js"


var manager = FileManager.default

function file(name, bytes) {
    return new File([new Uint8Array(bytes)], name, {type: "application/pdf"})
}

// A FileSystemDirectoryEntry stand-in: readEntries hands out its children in
// batches, as the real reader does, and an empty batch ends the listing.
function directory(name, children, batchSize = 2) {
    return {
        isDirectory: true,
        isFile: false,
        name: name,
        createReader: function() {
            var rest = children.slice()
            return {readEntries: function(done) { done(rest.splice(0, batchSize)) }}
        },
    }
}

function fileEntry(name, bytes) {
    return {isFile: true, isDirectory: false, name: name, file: function(done) { done(file(name, bytes)) }}
}

test("FileManager.default is one instance", function() {
    assert.ok(manager instanceof FileManager)
    assert.equal(FileManager.default, manager)
})

test("a registered file has a file: URL minted by the framework, and its name, size and bytes read back", async function() {
    var before = registeredCount()
    var url = registerFile(file("Contract final.pdf", [37, 80, 68, 70, 0, 255]))
    assert.ok(url instanceof URL)
    assert.equal(url.protocol, "file:")
    assert.match(url.href, /^file:\/\/\/[^/]+\/Contract%20final\.pdf$/)
    assert.equal(manager.displayName({atPath: url.href}), "Contract final.pdf")
    assert.deepEqual(manager.attributesOfItem({atPath: url.href}), {[FileAttributeKey.size]: 6})
    var bytes = await manager.contents({atPath: url.href})
    assert.ok(bytes instanceof Uint8Array)
    assert.deepEqual([...bytes], [37, 80, 68, 70, 0, 255])
    manager.removeItem({at: url})
    assert.equal(registeredCount(), before)
})

test("two files with the same name get different URLs", function() {
    var first = registerFile(file("a.pdf", [1]))
    var second = registerFile(file("a.pdf", [2]))
    assert.notEqual(first.href, second.href)
    manager.removeItem({at: first})
    manager.removeItem({at: second})
})

test("removeItem releases the file: the registry shrinks and the path reads empty after", async function() {
    var before = registeredCount()
    var url = registerFile(file("a.pdf", [1, 2, 3]))
    assert.equal(registeredCount(), before + 1)
    manager.removeItem({at: url})
    assert.equal(registeredCount(), before)
    assert.equal(manager.displayName({atPath: url.href}), "")
    assert.equal(manager.attributesOfItem({atPath: url.href}), null)
    assert.equal(await manager.contents({atPath: url.href}), null)
    manager.removeItem({at: url})
    assert.equal(registeredCount(), before, "removing twice is harmless")
})

test("a path the framework did not mint reads empty and makes no request", async function() {
    var requests = []
    var originalFetch = globalThis.fetch
    var originalXhr = globalThis.XMLHttpRequest
    globalThis.fetch = function() { requests.push("fetch"); return Promise.reject(new Error("no")) }
    globalThis.XMLHttpRequest = function() { requests.push("xhr") }
    try {
        for (var path of ["file:///etc/passwd", "file:///abc/x.pdf", "blob:http://localhost/1234", "http://example.com/a.pdf", "https://example.com/a.pdf", "/a.pdf", "data:application/pdf;base64,AAAA", "javascript:alert(1)", ""]) {
            assert.equal(manager.displayName({atPath: path}), "", path)
            assert.equal(manager.attributesOfItem({atPath: path}), null, path)
            assert.equal(await manager.contents({atPath: path}), null, path)
            assert.deepEqual(await manager.contentsOfDirectory({atPath: path}), [], path)
        }
    } finally {
        globalThis.fetch = originalFetch
        globalThis.XMLHttpRequest = originalXhr
    }
    assert.deepEqual(requests, [])
})

test("the file module reaches for no network API", function() {
    for (var name of ["filemanager.js", "fileregistry.js"]) {
        var source = fs.readFileSync(new URL("../src/foundation/" + name, import.meta.url), "utf8")
        assert.doesNotMatch(source, /\bfetch\b|XMLHttpRequest|URLSession|createObjectURL/, name)
    }
})

test("the labels are required and typed", async function() {
    assert.throws(() => manager.displayName(), (error) => error instanceof TypeError && /displayName\(atPath:\)/.test(error.message))
    assert.throws(() => manager.displayName({atPath: 7}), TypeError)
    assert.throws(() => manager.attributesOfItem({}), TypeError)
    assert.throws(() => manager.contents({atPath: null}), TypeError)
    assert.throws(() => manager.contentsOfDirectory({}), TypeError)
    assert.throws(() => manager.removeItem({at: "file:///x/y"}), (error) => error instanceof TypeError && /removeItem\(at:\)/.test(error.message))
    assert.throws(() => manager.removeItem(), TypeError)
})

test("a directory lists its children across batches, registering each, nested directories included", async function() {
    var before = registeredCount()
    var root = registerDirectory({name: "Documents", entry: directory("Documents", [
        fileEntry("a.pdf", [1]),
        directory("Sub", [fileEntry("c.pdf", [3, 3])]),
        fileEntry("b.pdf", [2, 2]),
    ])})
    assert.equal(manager.displayName({atPath: root.href}), "Documents")
    assert.deepEqual(manager.attributesOfItem({atPath: root.href}), {[FileAttributeKey.size]: 0})
    assert.equal(await manager.contents({atPath: root.href}), null, "a directory has no bytes")
    var paths = await manager.contentsOfDirectory({atPath: root.href})
    assert.deepEqual(paths.map((path) => manager.displayName({atPath: path})), ["a.pdf", "Sub", "b.pdf"])
    assert.deepEqual([...await manager.contents({atPath: paths[0]})], [1])
    assert.equal(await manager.contents({atPath: paths[1]}), null)
    var nested = await manager.contentsOfDirectory({atPath: paths[1]})
    assert.deepEqual(nested.map((path) => manager.displayName({atPath: path})), ["c.pdf"])
    assert.deepEqual([...await manager.contents({atPath: nested[0]})], [3, 3])
    assert.equal(manager.attributesOfItem({atPath: paths[2]})[FileAttributeKey.size], 2)
    assert.equal(registeredCount(), before + 1 + 4)
})

test("removing a directory releases the entries it listed, nested ones too", async function() {
    var before = registeredCount()
    var root = registerDirectory({name: "Documents", entry: directory("Documents", [fileEntry("a.pdf", [1]), directory("Sub", [fileEntry("c.pdf", [3])])])})
    var paths = await manager.contentsOfDirectory({atPath: root.href})
    await manager.contentsOfDirectory({atPath: paths[1]})
    assert.equal(registeredCount(), before + 4)
    manager.removeItem({at: root})
    assert.equal(registeredCount(), before)
})

test("listing a directory twice registers its children once", async function() {
    var before = registeredCount()
    var root = registerDirectory({name: "D", entry: directory("D", [fileEntry("a.pdf", [1])])})
    var first = await manager.contentsOfDirectory({atPath: root.href})
    var second = await manager.contentsOfDirectory({atPath: root.href})
    assert.deepEqual(first, second)
    assert.equal(registeredCount(), before + 2)
    manager.removeItem({at: root})
    assert.equal(registeredCount(), before)
})

test("a listing that fails rejects with the reader's error and registers nothing", async function() {
    var before = registeredCount()
    var failure = new Error("denied")
    var root = registerDirectory({name: "D", entry: {isDirectory: true, name: "D", createReader: () => ({readEntries: (done, fail) => fail(failure)})}})
    await assert.rejects(manager.contentsOfDirectory({atPath: root.href}), failure)
    assert.equal(registeredCount(), before + 1)
    manager.removeItem({at: root})
})
