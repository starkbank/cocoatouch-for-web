import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { scopePdfViewerCss, generateInstalled, scope } from "../scripts/scopePdfViewerCss.mjs"

const require = createRequire(import.meta.url)
const postcss = require("postcss")
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const committedPath = path.join(root, "styles/pdf_viewer.scoped.css")


function scoped(css, javascript = "") {
    return scopePdfViewerCss({css: css, javascript: javascript})
}

// A rule is top-level when no rule encloses it: its selector is the one a
// document is matched against, where a nested rule's is relative to its parent.
function topLevelRules(source) {
    var rules = []
    postcss.parse(source).walkRules(function(rule) {
        for (var parent = rule.parent; parent; parent = parent.parent) {
            if (parent.type === "rule") { return }
            if (parent.type === "atrule" && /keyframes$/.test(parent.name)) { return }
        }
        rules.push(rule)
    })
    return rules
}

test("every top-level selector is prefixed, as a descendant of .ct-pdfview", function() {
    var out = scoped(".pdfViewer .page { a: b }\n.a, .b:hover > .c { a: b }\n:is(.x, .y) .z { a: b }\n@media (min-width: 1px) { .m { a: b } }")
    assert.deepEqual(topLevelRules(out).map((rule) => rule.selectors), [
        [".ct-pdfview .pdfViewer .page"],
        [".ct-pdfview .a", ".ct-pdfview .b:hover > .c"],
        [".ct-pdfview :is(.x, .y) .z"],
        [".ct-pdfview .m"],
    ])
    assert.match(out, /@media \(min-width: 1px\)/)
})

test("a nested rule keeps its relative selector, and so does a media block inside a rule", function() {
    var out = scoped(".a { &:hover { x: y } > img { x: y } .deep { x: y } @media (forced-colors: active) { & .f { x: y } } }")
    assert.deepEqual(topLevelRules(out).map((rule) => rule.selector), [".ct-pdfview .a"])
    assert.match(out, /&:hover/)
    assert.match(out, /> img/)
    assert.match(out, /& \.f/)
    assert.match(out, /\.deep/)
    assert.doesNotMatch(out, /\.ct-pdfview &/)
})

test(":root blocks move onto .ct-pdfview in their source order, with their media wrappers", function() {
    var out = scoped(":root { --a: 1; color-scheme: light dark }\n.x { y: z }\n@media (prefers-color-scheme: dark) { :root { --a: 2 } }\n:root { --b: 3 }\n@media screen and (forced-colors: active) { :root { --c: 4 } }")
    var order = []
    postcss.parse(out).walkDecls(function(declaration) { order.push(declaration.prop + "=" + declaration.value.trim()) })
    assert.deepEqual(order, ["--a=1", "color-scheme=light dark", "y=z", "--a=2", "--b=3", "--c=4"])
    assert.deepEqual(topLevelRules(out).map((rule) => rule.selector), [".ct-pdfview", ".ct-pdfview .x", ".ct-pdfview", ".ct-pdfview", ".ct-pdfview"])
    assert.doesNotMatch(out, /:root/)
})

test("a variable pdf.js sets from script stays out of the scoped :root, an empty block goes with it, and the rest move", function() {
    var javascript = "docStyle.setProperty(\"--viewer-container-height\", `${h}px`); el.style.setProperty('--scale-factor', 1)"
    var out = scoped(":root { --viewer-container-height: 0; --page-margin: 1px }\n@media (prefers-color-scheme: dark) { :root { --scale-factor: 2 } }", javascript)
    assert.doesNotMatch(out, /--viewer-container-height|--scale-factor/)
    assert.match(out, /--page-margin: 1px/)
    assert.doesNotMatch(out, /prefers-color-scheme/, "the media block that had only a script-set variable is gone")
})

test("html and body selectors, and print-only rules, are dropped; the rest of a list stays", function() {
    var out = scoped("html[dir=rtl] .a { x: y }\nbody .b, .keep { x: y }\n#printContainer { x: y }\nbody[data-pdfjsprinting] #viewerContainer { x: y }\n@media print { .xfa { x: y } }")
    assert.deepEqual(topLevelRules(out).map((rule) => rule.selector), [".ct-pdfview .keep", ".ct-pdfview .xfa"])
})

test("keyframes are renamed and every animation reference is rewritten", function() {
    var css = "@keyframes spin { from { a: b } to { a: c } }\n@keyframes fade-in { 0% { a: b } }\n.a { animation: spin 1s linear infinite, fade-in .2s ease 1 }\n.b { animation-name: fade-in; }\n.c { animation: none }\n.d { &:hover { animation: 1s spin } }"
    var out = scoped(css)
    assert.match(out, /@keyframes ct-pdfview-spin/)
    assert.match(out, /@keyframes ct-pdfview-fade-in/)
    var references = []
    postcss.parse(out).walkDecls(/^animation(-name)?$/, function(declaration) { references.push(declaration.value) })
    assert.deepEqual(references, ["ct-pdfview-spin 1s linear infinite, ct-pdfview-fade-in .2s ease 1", "ct-pdfview-fade-in", "none", "1s ct-pdfview-spin"])
    var names = []
    postcss.parse(out).walkAtRules(/keyframes$/, (rule) => names.push(rule.params))
    assert.ok(references.join(" ").split(/[\s,]+/).filter((token) => /^ct-pdfview-/.test(token)).every((token) => names.includes(token)))
    assert.deepEqual(topLevelRules(out).map((rule) => rule.selector), [".ct-pdfview .a", ".ct-pdfview .b", ".ct-pdfview .c", ".ct-pdfview .d"], "keyframe steps are not selectors")
})

test("relative url()s become pdfjs-dist module paths, and data and absolute ones stay", function() {
    var out = scoped(".a { background: url(images/x.svg) } .b { mask: url(\"images/y.svg\") } .c { c: url('./images/z.svg') } .d { d: url(\"data:image/svg+xml,%3Csvg%3E\") } .e { e: url(https://x/y.png) url(#frag) url(/abs.png) }")
    assert.match(out, /url\(pdfjs-dist\/web\/images\/x\.svg\)/)
    assert.match(out, /url\("pdfjs-dist\/web\/images\/y\.svg"\)/)
    assert.match(out, /url\('pdfjs-dist\/web\/images\/z\.svg'\)/)
    assert.match(out, /url\("data:image\/svg\+xml,%3Csvg%3E"\)/)
    assert.match(out, /url\(https:\/\/x\/y\.png\) url\(#frag\) url\(\/abs\.png\)/)
})

test("the committed scoped file is exactly what the generator makes from the installed pdfjs-dist", function() {
    assert.ok(fs.existsSync(committedPath), "run `npm run styles:pdfviewer`")
    assert.equal(fs.readFileSync(committedPath, "utf8"), generateInstalled(), "pdfjs-dist changed: run `npm run styles:pdfviewer`")
})

const committed = fs.existsSync(committedPath) ? fs.readFileSync(committedPath, "utf8") : ""

test("in the committed file every top-level rule starts with .ct-pdfview and none targets :root, html or body", function() {
    var rules = topLevelRules(committed)
    assert.ok(rules.length > 100)
    for (var rule of rules) {
        for (var selector of rule.selectors) {
            assert.ok(selector.trim() === scope || selector.trim().startsWith(scope + " "), selector)
            assert.doesNotMatch(selector, /:root|(^|[\s>+~(])(html|body)(?![\w-])/, selector)
        }
    }
    assert.doesNotMatch(committed, /#printContainer|data-pdfjsprinting/)
})

test("the committed file keeps the :root blocks, scoped, and not the variable pdf.js sets on the document", function() {
    var blocks = topLevelRules(committed).filter((rule) => rule.selector.trim() === scope)
    assert.equal(blocks.length, 8)
    assert.doesNotMatch(committed, /--viewer-container-height\s*:/)
    assert.match(committed, /color-scheme: light dark/)
})

test("the committed file references no keyframe by an unprefixed name and no relative image", function() {
    var names = new Set()
    postcss.parse(committed).walkAtRules(/keyframes$/, (rule) => names.add(rule.params))
    assert.ok([...names].every((name) => name.startsWith("ct-pdfview-")))
    postcss.parse(committed).walkDecls(/^animation(-name)?$/, function(declaration) {
        for (var token of declaration.value.split(/[\s,]+/)) {
            assert.ok(!/^[a-z][\w-]*$/i.test(token) || token.startsWith("ct-pdfview-") || /^(none|infinite|linear|ease|ease-in|ease-out|ease-in-out|alternate|forwards|backwards|both|normal|reverse|running|paused)$/.test(token), declaration.value)
        }
    })
    for (var match of committed.matchAll(/url\(\s*["']?([^)"']{0,16})/g)) {
        assert.match(match[1], /^(data:|https?:|\/|#|var\(|pdfjs-dist\/web\/)/, "a relative url survived: " + match[1])
    }
    assert.match(committed, /url\(pdfjs-dist\/web\/images\/[\w-]+\.svg\)/)
})

test("every image the committed file names exists in the installed pdfjs-dist", function() {
    var images = new Set(Array.from(committed.matchAll(/url\(["']?(pdfjs-dist\/web\/images\/[^)"']+)/g), (match) => match[1]))
    assert.ok(images.size > 5)
    for (var image of images) {
        assert.ok(fs.existsSync(path.join(root, "node_modules", image)), image)
    }
})
