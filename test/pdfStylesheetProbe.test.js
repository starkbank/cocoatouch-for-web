import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { assertTextLayerStylesheet } from "../src/pdfkit/pdfjs.js"


function withSheet(text, run) {
    var style = document.createElement("style")
    style.textContent = text
    document.head.appendChild(style)
    try { return run() } finally { style.remove() }
}

test("the probe passes when the scoped rule positions a .textLayer inside a .ct-pdfview", function() {
    withSheet(".ct-pdfview .textLayer { position: absolute; }", function() {
        assert.doesNotThrow(() => assertTextLayerStylesheet())
    })
})

test("the probe fails loudly, naming the scoped file and pdfjsLib.version, when no rule reaches it", function() {
    assert.throws(() => assertTextLayerStylesheet(), (error) => error instanceof TypeError && /pdf_viewer\.scoped\.css/.test(error.message) && /6\.4\.299/.test(error.message))
})

test("every cocoatouch/ path the failure names is one package.json exports, so a consumer can resolve it", function() {
    var exported = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).exports
    var message = ""
    try { assertTextLayerStylesheet() } catch (error) { message = error.message }
    var named = message.match(/cocoatouch\/[\w./-]+/g) || []
    assert.notEqual(named.length, 0, "the message points at something the consumer can import")
    for (var path of named) {
        assert.ok(Object.hasOwn(exported, "./" + path.slice("cocoatouch/".length)), `${path} is not an export of package.json`)
    }
})

test("a rule that cannot reach a .textLayer inside the wrapper does not satisfy the probe, and one that can does", function() {
    withSheet(".elsewhere .textLayer { position: absolute; }", function() {
        assert.throws(() => assertTextLayerStylesheet(), TypeError)
    })
    withSheet(".textLayer { position: absolute; }", function() {
        assert.doesNotThrow(() => assertTextLayerStylesheet())
    })
})

test("the probe measures inside an attached wrapper and leaves nothing behind, pass or fail", function() {
    document.body.innerHTML = "<p id=\"kept\">app</p>"
    var before = document.body.innerHTML
    assert.throws(() => assertTextLayerStylesheet(), TypeError)
    assert.equal(document.body.innerHTML, before)
    withSheet(".ct-pdfview .textLayer { position: absolute; }", function() {
        assertTextLayerStylesheet()
    })
    assert.equal(document.body.innerHTML, before)
    document.body.innerHTML = ""
})

test("a page that already holds a .ct-pdfview with a .textLayer does not make the probe pass: the probe builds its own wrapper", function() {
    document.body.innerHTML = "<div class=\"ct-pdfview\"><div class=\"textLayer\"></div></div>"
    withSheet(".page .textLayer { position: absolute; }", function() {
        assert.throws(() => assertTextLayerStylesheet(), TypeError)
    })
    document.body.innerHTML = ""
})
