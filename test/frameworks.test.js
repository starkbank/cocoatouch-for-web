import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))


test("importing UIKit makes its classes ambient, like Swift's import UIKit", async function() {
    assert.equal(globalThis.UIViewController, undefined)
    const UIKit = await import("../src/UIKit.js")
    assert.equal(globalThis.UIViewController, UIKit.UIViewController)
    assert.equal(typeof globalThis.IBOutlet, "function")
    assert.equal(globalThis.UIKeyCommand.inputEscape, "keyboard:Escape")
})

test("importing Foundation makes NotificationCenter ambient and still exports it", async function() {
    const Foundation = await import("../src/Foundation.js")
    assert.equal(globalThis.NotificationCenter, Foundation.NotificationCenter)
    assert.equal(globalThis.NSObject, Foundation.NSObject)
})

test("CoreAnimation and AVKit follow the same shape", async function() {
    const CoreAnimation = await import("../src/CoreAnimation.js")
    const AVKit = await import("../src/AVKit.js")
    assert.equal(globalThis.CALayer, CoreAnimation.CALayer)
    assert.equal(globalThis.AVPlayer, AVKit.AVPlayer)
    assert.equal(globalThis.CMTime, AVKit.CMTime)
    const CoreMedia = await import("../src/CoreMedia.js")
    assert.equal(globalThis.CMTime, CoreMedia.CMTime)
})

test("the webpack aliases point every framework name at an existing entry", function() {
    const aliases = require("../webpack/aliases.cjs")
    assert.deepEqual(Object.keys(aliases).sort(), ["AVKit", "CoreAnimation", "CoreGraphics", "CoreMedia", "Foundation", "PDFKit", "UIKit"])
    for (const file of Object.values(aliases)) {
        assert.ok(fs.existsSync(file), file + " does not exist")
        assert.equal(path.basename(path.dirname(file)), "src")
    }
})

test("a framework publishes its NSNotification.Name constants by being imported: Foundation alone leaves PDFKit's unpublished", async function() {
    const Foundation = await import("../src/Foundation.js")
    assert.equal(Foundation.NSNotification.Name.PDFViewDocumentChanged, undefined)
    assert.equal(Foundation.NSNotification.Name.PDFDocumentDidEndFind, undefined)

    await import("../src/PDFKit.js")
    for (const name of ["PDFViewDocumentChanged", "PDFViewPageChanged", "PDFViewScaleChanged", "PDFViewSelectionChanged", "PDFViewDisplayModeChanged", "PDFDocumentDidBeginFind", "PDFDocumentDidFindMatch", "PDFDocumentDidEndFind"]) {
        assert.equal(Foundation.NSNotification.Name[name], name)
    }
})

test("PDFKit's entry imports pdf_viewer.css and the subpath entry does not, so only a bundler ever meets the stylesheet", function() {
    const entry = fs.readFileSync(path.join(here, "../src/PDFKit.js"), "utf8")
    const subpath = fs.readFileSync(path.join(here, "../src/pdfkit/index.js"), "utf8")
    assert.match(entry, /^import "pdfjs-dist\/web\/pdf_viewer\.css"$/m)
    assert.doesNotMatch(subpath, /\.css/)
})
