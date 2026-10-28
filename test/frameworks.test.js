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
    assert.deepEqual(Object.keys(aliases).sort(), ["AVKit", "CoreAnimation", "CoreGraphics", "CoreMedia", "Foundation", "PDFKit", "UIKit", "UniformTypeIdentifiers"])
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

test("PDFKit's entry imports the scoped viewer stylesheet and the subpath entry imports no css, so only a bundler ever meets it", function() {
    const entry = fs.readFileSync(path.join(here, "../src/PDFKit.js"), "utf8")
    const subpath = fs.readFileSync(path.join(here, "../src/pdfkit/index.js"), "utf8")
    assert.match(entry, /^import "\.\.\/styles\/pdf_viewer\.scoped\.css"$/m)
    assert.doesNotMatch(subpath, /\.css/)
})

// pdf_viewer.css is unscoped: it restyles .sidebar, .page, .dialog and :root,
// color-scheme included, on every page that imports PDFKit. The framework
// imports its own copy, confined to .ct-pdfview, and no :root reset is left to
// win a fight with the vendored sheet.
test("PDFKit's entry no longer imports pdfjs-dist's pdf_viewer.css or a :root reset", function() {
    const entry = fs.readFileSync(path.join(here, "../src/PDFKit.js"), "utf8")
    assert.doesNotMatch(entry, /pdfjs-dist\/web\/pdf_viewer\.css/)
    assert.doesNotMatch(entry, /pdfkit\.css/)
    assert.equal(fs.existsSync(path.join(here, "../styles/pdfkit.css")), false)
})


// PDFKit is the only framework with a third-party dependency behind it (35 MB
// installed, about 1.9 MB bundled), so no other entry point may reach it,
// directly or through a chain: a site that imports UIKit must never bundle
// pdf.js. The roots are read from the package's own exports and aliases, so a
// new entry point is covered the day it is added rather than the day someone
// remembers.
const repoRoot = path.join(here, "..")
const pdfkitEntries = ["./PDFKit", "./pdfkit"]
const codeFile = /\.(?:js|mjs|cjs)$/

function withoutComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

// import … from, bare import "…", export … from and export * from, plus
// literal import("…"). `dynamic` counts every import( so a caller can tell
// when one of them is not a literal.
function specifiersOf(source) {
    const code = withoutComments(source)
    const names = []
    const fromForm = /^\s*(?:import|export)\s+(?:[\w$*\s,]|\{[^}]*\})+?\s*from\s*["']([^"']+)["']/gm
    const bareForm = /^\s*import\s*["']([^"']+)["']/gm
    const dynamicForm = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
    for (const form of [fromForm, bareForm, dynamicForm]) {
        for (const match of code.matchAll(form)) { names.push(match[1]) }
    }
    const dynamic = [...code.matchAll(/\bimport\s*\(/g)].length
    const literalDynamic = [...code.matchAll(dynamicForm)].length
    return {names: names, nonLiteralDynamic: dynamic - literalDynamic}
}

// Every module reachable from `root`, keyed by repo-relative path (or the bare
// specifier for a package), each with the chain of files that led to it.
function reachableFrom(root) {
    const reached = new Map()
    const problems = []
    const queue = [{key: path.relative(repoRoot, root), file: root, chain: [path.relative(repoRoot, root)]}]
    reached.set(queue[0].key, queue[0].chain)
    while (queue.length > 0) {
        const {file, chain} = queue.shift()
        if (!codeFile.test(file)) { continue }
        const {names, nonLiteralDynamic} = specifiersOf(fs.readFileSync(file, "utf8"))
        if (nonLiteralDynamic > 0) {
            problems.push(`${chain.join(" -> ")} has ${nonLiteralDynamic} dynamic import(s) with a non-literal argument, which this guard cannot follow`)
        }
        for (const name of names) {
            const isRelative = name.startsWith(".")
            const target = isRelative ? path.resolve(path.dirname(file), name) : null
            const key = isRelative ? path.relative(repoRoot, target) : name
            if (reached.has(key)) { continue }
            reached.set(key, [...chain, key])
            if (!isRelative) { continue }
            assert.ok(fs.existsSync(target), `${chain.join(" -> ")} imports ${name}, which does not exist`)
            queue.push({key: key, file: target, chain: [...chain, key]})
        }
    }
    return {reached: reached, problems: problems}
}

function reachesPdfkit(root) {
    const {reached, problems} = reachableFrom(root)
    const found = [...reached].filter(([key]) => key.startsWith(`src${path.sep}pdfkit${path.sep}`) || key.startsWith("pdfjs-dist"))
    return {problems: problems, chains: found.map(([key, chain]) => chain.join(" -> "))}
}

test("the guard can see PDFKit: walking from its own entry reaches src/pdfkit/index.js and pdfjs-dist", function() {
    const {reached} = reachableFrom(path.join(repoRoot, "src/PDFKit.js"))
    assert.ok(reached.has(path.join("src", "pdfkit", "index.js")), "src/pdfkit/index.js not reached: the import regexes match nothing")
    assert.ok(reached.has("pdfjs-dist/build/pdf.min.mjs"), "pdfjs-dist not reached: the import regexes match nothing")
})

test("no entry point other than PDFKit's reaches src/pdfkit/ or pdfjs-dist", function() {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"))
    const aliases = require("../webpack/aliases.cjs")
    const roots = new Set()
    for (const [key, value] of Object.entries(manifest.exports)) {
        if (pdfkitEntries.includes(key) || typeof value !== "object" || !value.default) { continue }
        roots.add(path.join(repoRoot, value.default))
    }
    for (const [name, file] of Object.entries(aliases)) {
        if (name !== "PDFKit") { roots.add(file) }
    }
    assert.ok(roots.has(path.join(repoRoot, "src/index.js")), "the root entry is not among the roots")
    assert.ok(roots.size >= 13, `only ${roots.size} roots found`)
    for (const root of roots) {
        const {problems, chains} = reachesPdfkit(root)
        assert.deepEqual(problems, [], `${path.relative(repoRoot, root)}`)
        assert.deepEqual(chains, [], `${path.relative(repoRoot, root)} reaches PDFKit`)
    }
})

test("importing UniformTypeIdentifiers makes UTType ambient and still exports it", async function() {
    const UniformTypeIdentifiers = await import("../src/UniformTypeIdentifiers.js")
    assert.equal(globalThis.UTType, UniformTypeIdentifiers.UTType)
})
