import test from "node:test"
import assert from "node:assert/strict"
import { UIImage } from "../src/index.js"
import * as uikit from "../src/UIKit.js"


var png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

test("UIImage.RenderingMode has Apple's three cases and is exported by UIKit", function() {
    var modes = UIImage.RenderingMode
    assert.equal(uikit.UIImageRenderingMode, modes)
    assert.deepEqual(Object.getOwnPropertyNames(modes).filter((name) => !["length", "name", "prototype"].includes(name)).sort(), ["alwaysOriginal", "alwaysTemplate", "automatic"])
    assert.equal(modes.automatic, "automatic")
})

test("a symbol is a template by default, and an image of a file or of bytes is automatic", function() {
    var modes = UIImage.RenderingMode
    assert.equal(new UIImage({systemName: "fas fa-lock"}).renderingMode, modes.alwaysTemplate)
    assert.equal(new UIImage({named: "/lock.png"}).renderingMode, modes.automatic)
    assert.equal(new UIImage({data: png}).renderingMode, modes.automatic)
})

test("withRenderingMode returns a new image of the same picture and leaves the receiver as it was", function() {
    var modes = UIImage.RenderingMode
    var symbol = new UIImage({systemName: "fas fa-lock"})
    var original = symbol.withRenderingMode(modes.alwaysOriginal)
    assert.ok(original instanceof UIImage)
    assert.notEqual(original, symbol)
    assert.equal(original.systemName, "fas fa-lock")
    assert.equal(original.renderingMode, modes.alwaysOriginal)
    assert.equal(symbol.renderingMode, modes.alwaysTemplate)

    var file = new UIImage({named: "/lock.png"}).withRenderingMode(modes.alwaysTemplate)
    assert.equal(file.named, "/lock.png")
    assert.equal(file.systemName, undefined)
    assert.equal(file.renderingMode, modes.alwaysTemplate)

    var bytes = new UIImage({data: png})
    var template = bytes.withRenderingMode(modes.alwaysTemplate)
    assert.equal(template._dataURL, bytes._dataURL)
    assert.equal(template.renderingMode, modes.alwaysTemplate)
    assert.equal(bytes.renderingMode, modes.automatic)
    assert.equal(template.withRenderingMode(modes.automatic).renderingMode, modes.automatic)
})

test("withRenderingMode refuses anything but a UIImage.RenderingMode, naming Apple's signature", function() {
    var image = new UIImage({named: "/lock.png"})
    for (var wrong of ["template", undefined, null, 1]) {
        assert.throws(() => image.withRenderingMode(wrong), (error) => error instanceof TypeError && /UIImage\.withRenderingMode/.test(error.message) && /withRenderingMode\(_:\)/.test(error.message))
    }
})
