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
    ;["index", "UIKit", "Foundation", "CoreAnimation", "AVKit", "PDFKit", "UniformTypeIdentifiers", "globals", "uikit/index", "foundation/index", "pdfkit/index"].forEach(function(name) {
        assert.ok(fs.existsSync(path.join(root, "types", name + ".d.ts")), name + ".d.ts is missing")
    })
})

test("globals.d.ts and the eslint globals cover every export of the eight frameworks", async function() {
    var expected = []
    for (var directory of ["uikit", "foundation", "coregraphics", "coreanimation", "coremedia", "avkit", "pdfkit", "uniformtypeidentifiers"]) {
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


// The declarations are the framework's interface for an editor: every labelled
// argument appears by Apple's label, required ones without ?, optional ones
// with it, and no member takes an undifferentiated options bag. UIView.transition's
// `options` is Apple's own label and lives inside the destructured object, so the
// walk looks at parameters, not at the word.
function declarations() {
    var found = []
    var walk = function(directory) {
        for (var entry of fs.readdirSync(directory, {withFileTypes: true})) {
            var full = path.join(directory, entry.name)
            if (entry.isDirectory()) { walk(full); continue }
            if (!entry.name.endsWith(".d.ts")) { continue }
            var source = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.ES2022, true)
            var visit = function(node) {
                if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isMethodSignature(node)) {
                    var member = node.name ? node.name.getText(source) : "constructor"
                    var owner = node.parent && node.parent.name ? node.parent.name.getText(source) : path.basename(entry.name, ".d.ts")
                    found.push({file: path.relative(root, full), owner: owner, member: member, parameters: node.parameters.map(function(parameter) { return {name: parameter.name.getText(source), type: parameter.type ? parameter.type.getText(source) : ""} })})
                }
                ts.forEachChild(node, visit)
            }
            visit(source)
        }
    }
    walk(path.join(root, "types"))
    return found
}

test("no declaration takes an undifferentiated options bag", function() {
    var bags = declarations().filter(function(d) { return d.parameters.some(function(p) { return p.name === "options" }) })
    assert.deepEqual(bags.map(function(d) { return d.owner + "." + d.member }), [])
})

test("every labelled member names its labels and marks optionality", function() {
    var expected = [
        ["UIButton", "setTitle", ["for"], []], ["UIButton", "title", ["for"], []], ["UIButton", "setTitleColor", ["for"], []], ["UIButton", "titleColor", ["for"], []],
        ["UIControl", "addTarget", ["action", "for"], []], ["UIControl", "removeTarget", ["for"], ["action"]], ["UIControl", "sendActions", ["for"], []],
        ["UIPickerView", "numberOfRows", ["inComponent"], []], ["UIPickerView", "selectRow", ["inComponent", "animated"], []], ["UIPickerView", "selectedRow", ["inComponent"], []],
        ["UITableView", "setEditing", ["animated"], []], ["UITableView", "numberOfRows", ["inSection"], []], ["UITableView", "selectRow", ["at", "animated", "scrollPosition"], []], ["UITableView", "deselectRow", ["at", "animated"], []],
        ["UIDatePicker", "setDate", ["animated"], []], ["UIScrollView", "setContentOffset", ["animated"], []], ["UIProgressView", "setProgress", ["animated"], []], ["UISwitch", "setOn", ["animated"], []],
        ["UIView", "insertSubview", [], ["at", "belowSubview"]], ["UIColor", "resolvedColor", ["with"], []], ["UISearchTextField", "insertToken", ["at"], []], ["UICollectionView", "register", ["forCellWithReuseIdentifier"], []],
        ["UIApplication", "open", [], ["options", "completionHandler"]], ["PDFDocument", "page", ["at"], []], ["PDFDocument", "index", ["for"], []], ["PDFView", "go", ["to"], []], ["PDFView", "setCurrentSelection", ["animate"], []],
    ]
    var all = declarations()
    expected.forEach(function([owner, member, required, optional]) {
        var declaration = all.find(function(d) { return d.owner === owner && d.member === member })
        assert.ok(declaration, owner + "." + member + " is not declared")
        var labelled = declaration.parameters.find(function(p) { return p.name.indexOf("{") === 0 })
        assert.ok(labelled, owner + "." + member + " has no destructured parameter: " + JSON.stringify(declaration.parameters))
        required.forEach(function(label) {
            assert.match(labelled.type, new RegExp("(^|[{;\\s])" + label + "\\s*:"), owner + "." + member + " must require " + label + ": " + labelled.type)
        })
        optional.forEach(function(label) {
            assert.match(labelled.type, new RegExp("(^|[{;\\s])" + label + "\\?\\s*:"), owner + "." + member + " must mark " + label + " optional: " + labelled.type)
        })
    })
})


// tsc leaves out a subclass accessor whose type equals the base's, so a
// declaration that must say something of its own has to have a type of its own:
// UITextView's delegate is a UITextViewDelegate, and its isScrollEnabled, which
// is read-write at runtime unlike UIScrollView's, is the inherited boolean pair.
test("UITextView's declaration types its delegate, and isScrollEnabled is a boolean pair on it", function() {
    var declaration = fs.readFileSync(path.join(root, "types/uikit/uitextview.d.ts"), "utf8")
    assert.match(declaration, /set delegate\(delegate: UITextViewDelegate \| null\)/)
    assert.match(declaration, /get delegate\(\): UITextViewDelegate \| null/)
    assert.match(declaration, /UITextViewDelegate = \{/)
    assert.match(declaration, /textViewDidChange\?:/)
    var scrollView = fs.readFileSync(path.join(root, "types/uikit/uiscrollview.d.ts"), "utf8")
    assert.match(scrollView, /set isScrollEnabled\(enabled: boolean\)/)
    assert.match(scrollView, /get isScrollEnabled\(\): boolean/)
})

test("a UITextView's delegate and isScrollEnabled type check as Apple's do", function() {
    assert.deepEqual(diagnose("textView.js"), [])
    var problems = diagnose("textViewWrong.js")
    assert.equal(problems.length, 2)
    assert.match(problems[0], /'string' is not assignable to type 'boolean'/)
    assert.match(problems[1], /'number' is not assignable to type '\(textView: UITextView\) => void'/)
})


// UITextField's paste delegate is a UITextPasteDelegate whose type lives beside
// UITextPasteItem, so the field's declaration has to import it.
test("a text field's pasteDelegate and a paste item's results type check as Apple's do", function() {
    var declaration = fs.readFileSync(path.join(root, "types/uikit/uitextfield.d.ts"), "utf8")
    assert.match(declaration, /set pasteDelegate\(pasteDelegate: import\("\.\/uitextpasteitem\.js"\)\.UITextPasteDelegate \| null\)/)
    assert.deepEqual(diagnose("textPaste.js"), [])
    var problems = diagnose("textPasteWrong.js")
    assert.equal(problems.length, 2)
    assert.match(problems[0], /'number' is not assignable to type '\(textPasteConfigurationSupporting: UITextField, item: UITextPasteItem\) => void'/)
    assert.match(problems[1], /'number' is not assignable to parameter of type 'string'/)
})
