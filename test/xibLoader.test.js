import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const xibLoader = require("../webpack/xibLoader.cjs")
const fixtures = path.join(path.dirname(new URL(import.meta.url).pathname), "fixtures")


test("a .xib links to the class of the same name in the sibling .js", function() {
    var link = xibLoader.xibLink(path.join(fixtures, "sampleView.xib"))
    assert.equal(link.className, "SampleView")
    assert.equal(path.basename(link.sibling), "sampleView.js")
})

test("the emitted module imports the class, assigns the html as its nib and records the class under its name", function() {
    var link = xibLoader.xibLink(path.join(fixtures, "sampleView.xib"))
    var lines = xibLoader.xibModule("<p class=\"x\">hi</p>\n", link).split("\n")
    assert.equal(lines[0], 'import { SampleView } from "./sampleView.js"')
    var registry = lines[1].match(/^import \{ registerNibClass \} from (".*src\/utils\/nibclasses\.js")$/)
    assert.ok(registry, "the registry is imported from src/utils/nibclasses.js")
    assert.ok(path.isAbsolute(JSON.parse(registry[1])), "the import path is absolute, as the page's own files are not beside it")
    assert.equal(lines[2], 'SampleView.nib = "<p class=\\"x\\">hi</p>\\n"')
    assert.equal(lines[3], 'registerNibClass("SampleView", SampleView)')
    assert.equal(lines[4], "")
})

test("a .xib without a sibling class file fails the build", function() {
    assert.throws(function() { xibLoader.xibLink(path.join(fixtures, "orphanView.xib")) }, /orphanView\.js/)
})

test("a .xib whose sibling exports a differently named class fails the build", function() {
    assert.throws(function() { xibLoader.xibLink(path.join(fixtures, "mismatchView.xib")) }, /export class MismatchView/)
})

test("the loader entry point adds the sibling as a dependency and returns the module", function() {
    var dependencies = []
    var context = {resourcePath: path.join(fixtures, "sampleView.xib"), addDependency: function(file) { dependencies.push(file) }}
    var output = xibLoader.call(context, "<p></p>")
    assert.equal(path.basename(dependencies[0]), "sampleView.js")
    assert.match(output, /^import \{ SampleView \}/)
})
