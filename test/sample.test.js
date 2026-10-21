import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = fs.readFileSync(path.join(repoRoot, "sample/src/uipages/pdf/sampleGuide.pdf"))
const text = fixture.toString("latin1")


test("the sample PDF is a small, ASCII-only PDF 1.4 file", function() {
    assert.ok(fixture.length < 4096, `${fixture.length} bytes`)
    assert.ok(text.startsWith("%PDF-1.4\n"))
    assert.ok(fixture.every((byte) => byte < 0x80), "a non-ASCII byte")
    assert.equal(text.match(/\/Type \/Page\b/g).length, 2)
})

// PDFDocument(url:) refuses data: urls, so the fixture is a committed file that
// a visitor's browser really opens; it must carry nothing that acts on its own.
test("the sample PDF has exactly one link, to starkbank.com, and no active content", function() {
    assert.equal(text.match(/\/Link\b/g).length, 1)
    assert.match(text, /\/A << \/S \/URI \/URI \(https:\/\/starkbank\.com\) >>/)
    for (const token of ["/JavaScript", "/JS", "/AA", "/OpenAction", "/Launch", "/EmbeddedFile", "/RichMedia"]) {
        assert.equal(text.includes(token), false, token)
    }
})

// pdf.js rebuilds a broken xref without a word, so a wrong offset would pass
// every test that opens the file; this one reads the table the way a strict
// reader does.
test("the sample PDF's xref offsets point at their objects", function() {
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF\n$/)[1])
    assert.equal(text.slice(startxref, startxref + 5), "xref\n")
    const entries = text.slice(startxref).split("\n").filter((line) => /^\d{10} \d{5} n/.test(line))
    assert.ok(entries.length > 0)
    entries.forEach(function(entry, index) {
        const offset = Number(entry.slice(0, 10))
        assert.equal(text.slice(offset).startsWith(`${index + 1} 0 obj\n`), true, `object ${index + 1}`)
    })
})

test("sample/ stays outside the published package", function() {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"))
    for (const entry of manifest.files) {
        assert.notEqual(path.normalize(entry).split(path.sep)[0], "sample", entry)
    }
})

// addTarget calls an action with the sender alone, so a page of the sample that
// still reads `(target, sender)` would teach, and run, the old signature.
test("the sample's addTarget actions take the sender alone", function() {
    const pages = ["textFields/textFieldsViewController.js", "buttons/buttonsViewController.js", "buttons/buttonsViewController.xib"]
    for (const page of pages) {
        const source = fs.readFileSync(path.join(repoRoot, "sample/src/uipages", page), "utf8")
        assert.equal(/\(target, sender\)/.test(source), false, page)
    }
})
