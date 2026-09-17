import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..")


function diagnose(fixture) {
    var options = {
        allowJs: true,
        checkJs: true,
        noEmit: true,
        strict: false,
        experimentalDecorators: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        paths: {
            UIKit: [path.join(root, "types/UIKit.d.ts")],
            Foundation: [path.join(root, "types/Foundation.d.ts")]
        }
    }
    var program = ts.createProgram([path.join(root, "test/fixtures/typed", fixture), path.join(root, "types/globals.d.ts")], options)
    return ts.getPreEmitDiagnostics(program).map(function(d) { return ts.flattenDiagnosticMessageText(d.messageText, "\n") })
}

test("the build emits a declaration for every framework entry", function() {
    ;["index", "UIKit", "Foundation", "CoreAnimation", "AVKit", "globals", "uikit/index", "foundation/index"].forEach(function(name) {
        assert.ok(fs.existsSync(path.join(root, "types", name + ".d.ts")), name + ".d.ts is missing")
    })
})

test("globals.d.ts and the eslint globals cover every export of the four frameworks", async function() {
    var expected = []
    for (var directory of ["uikit", "foundation", "coreanimation", "avkit"]) {
        expected = expected.concat(Object.keys(await import("../src/" + directory + "/index.js")))
    }
    var dts = fs.readFileSync(path.join(root, "types/globals.d.ts"), "utf8")
    var eslintGlobals = require("../eslint/globals.cjs")
    expected.forEach(function(name) {
        assert.ok(dts.indexOf("    const " + name + ":") !== -1, name + " is not declared as a global")
        assert.equal(eslintGlobals[name], "readonly", name + " is not an eslint global")
    })
    assert.equal(Object.keys(eslintGlobals).length, expected.length)
})

test("a file that only says import \"UIKit\" type checks against the ambient names", function() {
    assert.deepEqual(diagnose("ok.js"), [])
})

test("a misspelled framework class is caught before the build", function() {
    var problems = diagnose("typo.js")
    assert.equal(problems.length, 1)
    assert.match(problems[0], /Cannot find name 'UIViewControler'/)
})
