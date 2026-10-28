import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const postcss = require("postcss")
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const scopedCss = fs.readFileSync(path.join(root, "styles/pdf_viewer.scoped.css"), "utf8")
const unscopedCss = fs.readFileSync(path.join(root, "node_modules/pdfjs-dist/web/pdf_viewer.css"), "utf8")

// The names pdf.js's stylesheet claims, as an app might use them for its own elements.
const appHtml = [
    "<div id=\"sidebar\" class=\"sidebar\"><button id=\"toggle\" class=\"toggle-button\">t</button></div>",
    "<section id=\"page\" class=\"page\"><div id=\"inner\" class=\"textLayer\"></div><span id=\"highlight\" class=\"highlight\">h</span></section>",
    "<dialog id=\"dialog\" class=\"dialog\" open><p id=\"para\" class=\"dialog-body\">d</p></dialog>",
    "<div id=\"viewer\" class=\"pdfViewer\"><div id=\"inViewerPage\" class=\"page\"></div></div>",
    "<div id=\"progress\" class=\"progressBar\"></div>",
].join("")

function computed(ids) {
    var snapshot = {}
    for (var id of ids) {
        var style = getComputedStyle(document.getElementById(id))
        var values = {}
        for (var index = 0; index < style.length; index++) { values[style[index]] = style.getPropertyValue(style[index]) }
        snapshot[id] = values
    }
    return snapshot
}

function withSheet(text, run) {
    var style = document.createElement("style")
    style.textContent = text
    document.head.appendChild(style)
    try { return run() } finally { style.remove() }
}

const appIds = ["sidebar", "toggle", "page", "inner", "highlight", "dialog", "para", "viewer", "inViewerPage", "progress"]

test("app elements named like pdf.js's keep their computed styles with the scoped sheet loaded", function() {
    page(appHtml)
    var before = computed(appIds)
    var beforeRoot = getComputedStyle(document.documentElement).cssText
    var beforeScheme = getComputedStyle(document.documentElement).getPropertyValue("color-scheme")
    withSheet(scopedCss, function() {
        assert.deepEqual(computed(appIds), before)
        assert.equal(getComputedStyle(document.documentElement).cssText, beforeRoot)
        assert.equal(getComputedStyle(document.documentElement).getPropertyValue("--page-margin"), "")
        assert.equal(getComputedStyle(document.documentElement).getPropertyValue("color-scheme"), beforeScheme)
    })
})

test("the unscoped sheet does restyle them, which is what the scoped one fixes", function() {
    page(appHtml)
    var before = computed(appIds)
    withSheet(unscopedCss, function() {
        assert.notDeepEqual(computed(appIds), before)
        assert.notEqual(getComputedStyle(document.documentElement).getPropertyValue("--page-margin"), "")
    })
})

test("no rule of the scoped sheet matches an element outside a .ct-pdfview", function() {
    page(appHtml)
    var elements = [...document.body.querySelectorAll("*")]
    var matched = []
    postcss.parse(scopedCss).walkRules(function(rule) {
        for (var parent = rule.parent; parent; parent = parent.parent) { if (parent.type === "rule") { return } }
        for (var selector of rule.selectors) {
            var simple = selector.replace(/::?[\w-]+(\([^)]*\))?$/g, "")
            var query = simple.trim() === ".ct-pdfview" ? ".ct-pdfview" : simple
            try {
                if (elements.some((element) => element.matches(query))) { matched.push(selector) }
            } catch (error) {
                continue
            }
        }
    })
    assert.deepEqual(matched, [])
})

test("inside a .ct-pdfview the same rules apply: a page is positioned and the view carries pdf.js's variables", function() {
    page("<div id=\"host\" class=\"ct-pdfview\"><div id=\"viewer\" class=\"pdfViewer\"><div id=\"viewerPage\" class=\"page\"></div></div></div>" + appHtml.replace(/id="([^"]+)"/g, "id=\"app-$1\""))
    withSheet(scopedCss, function() {
        assert.equal(getComputedStyle(document.getElementById("viewerPage")).position, "relative")
        assert.notEqual(getComputedStyle(document.getElementById("host")).getPropertyValue("--page-margin"), "")
        assert.equal(getComputedStyle(document.getElementById("app-page")).position, "static", "an app .page stays static")
    })
})

test("with the scoped sheet loaded, a .ct-pdfview has a computed color-scheme of normal, as the old reset kept it", function() {
    page("<div id=\"host\" class=\"ct-pdfview\"><div class=\"pdfViewer\"><div class=\"page\"></div></div></div>")
    withSheet(scopedCss, function() {
        assert.equal(getComputedStyle(document.getElementById("host")).getPropertyValue("color-scheme"), "normal")
        assert.equal(getComputedStyle(document.documentElement).getPropertyValue("color-scheme"), "normal")
    })
})
