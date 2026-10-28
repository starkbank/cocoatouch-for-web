import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableViewCell } from "../src/index.js"
import { Row, Other, setup, rowsBody, spacers, scrollTo, click } from "./tableReuseHelpers.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

// A row of four cells whose structure the skeleton must copy: tags, classes and a colSpan, and nothing else the app put on them.
class Wide extends UITableViewCell {}
Wide.nib = "<tr data-height=\"95\" id=\"x\" onclick=\"alert(1)\" data-x=\"1\"><td class=\"a first\" id=\"title\" style=\"width: 7px\" onclick=\"alert(2)\" data-secret=\"s\">text</td><th class=\"b\">th text</th><td class=\"c\" colspan=\"2\" href=\"/leak\" aria-label=\"l\"><button>go</button></td></tr>"
IBOutlet("#title", UILabel)(Wide.prototype, "titleLabel", {})

// Three cells whose ids the page's rules can hide, pad or lay out, none of which a spacer copies.
class Mobile extends UITableViewCell {}
Mobile.nib = "<tr data-height=\"95\"><td id=\"title\" class=\"a\">text</td><td id=\"desktop\" class=\"b\"></td><td id=\"mobile\" class=\"c\"></td></tr>"
IBOutlet("#title", UILabel)(Mobile.prototype, "titleLabel", {})

class Padded extends UITableViewCell {}
Padded.nib = "<tr data-height=\"95\"><td id=\"first\" class=\"a\"><span id=\"title\"></span></td><td class=\"b\"></td></tr>"
IBOutlet("#title", UILabel)(Padded.prototype, "titleLabel", {})

class Flexy extends UITableViewCell {}
Flexy.nib = "<tr class=\"r\" data-height=\"95\"><td id=\"title\" class=\"a\">text</td><td class=\"b\"></td></tr>"
IBOutlet("#title", UILabel)(Flexy.prototype, "titleLabel", {})

// The same structure with nothing inline, so the columns come from the page's rules alone.
class Plain extends UITableViewCell {}
Plain.nib = "<tr data-height=\"95\"><td class=\"a first\" id=\"title\">text</td><th class=\"b\">th text</th><td class=\"c\" colspan=\"2\"></td></tr>"
IBOutlet("#title", UILabel)(Plain.prototype, "titleLabel", {})

// Every frame, until two in a row have nothing to run: the measuring chunks and the passes they schedule.
function settle(layout) {
    for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
}

// A rule of the page that is in force after the page's own style, which setup puts in the body, and is gone when the test ends.
function withRule(text, body) {
    var style = document.createElement("style")
    style.textContent = text
    document.body.appendChild(style)
    try { body() } finally { style.remove() }
}

function spanWidths(cell) {
    return Array.from(cell.querySelectorAll("span")).map((span) => parseFloat(span.style.width))
}

// The properties each element's style attribute held at any time while `action` ran, from the mutation records: the values the
// attribute had before each change, and the one it ends with.
function writtenProperties(action) {
    var observer = new window.MutationObserver(function() {})
    observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ["style"], attributeOldValue: true})
    action()
    var records = observer.takeRecords()
    observer.disconnect()
    var written = new Map()
    for (var record of records) {
        if (!written.has(record.target)) { written.set(record.target, new Set()) }
        propertyNames(record.oldValue).forEach((name) => written.get(record.target).add(name))
    }
    for (var [target, names] of written) { propertyNames(target.getAttribute("style")).forEach((name) => names.add(name)) }
    return written
}

function propertyNames(text) {
    return (text || "").split(";").map((declaration) => declaration.split(":")[0].trim()).filter((name) => name !== "")
}

function scrolledWithSpacers(context) {
    scrollTo(context.layout, 40000)
    assert.equal(spacers().length, 2, "both spacers are present mid-list")
}

test("the spacer's cells are the majority signature's: tag, class and colSpan, in order", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            var cells = Array.from(spacer.children)
            assert.deepEqual(cells.map((cell) => cell.tagName), ["TD", "TH", "TD"])
            assert.deepEqual(cells.map((cell) => cell.className), ["a first", "b", "c"])
            assert.deepEqual(cells.map((cell) => cell.colSpan), [1, 1, 2])
        }
    })
})

test("a spacer copies no id, attribute, content or handler of the app's cells", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            assert.equal(spacer.id, "")
            assert.deepEqual(Array.from(spacer.attributes).map((attribute) => attribute.name).sort(), ["aria-hidden", "style"])
            assert.equal(spacer.textContent, "")
            for (var cell of Array.from(spacer.children)) {
                assert.ok(Array.from(cell.attributes).every((attribute) => ["class", "colspan", "style"].includes(attribute.name)), Array.from(cell.attributes).map((attribute) => attribute.name).join())
                assert.equal(cell.childNodes.length, 0)
                assert.equal(cell.getAttribute("style").includes("7px"), false)
            }
        }
    })
})

test("the vertical box is zeroed by important CSSOM on the spacer row and its cells, and the horizontal box is the rendered skeleton row's", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        var real = Array.from(rowsBody().children).find((element) => /^cell-/.test(element.id))
        for (var spacer of spacers()) {
            for (var element of [spacer, ...Array.from(spacer.children)]) {
                for (var property of ["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]) {
                    assert.equal(element.style.getPropertyValue(property), "0px", property)
                    assert.equal(element.style.getPropertyPriority(property), "important", property)
                }
                assert.equal(element.style.getPropertyPriority("box-shadow"), "important")
                assert.equal(element.style.getPropertyPriority("outline"), "important")
                assert.equal(element.style.getPropertyPriority("background-color"), "important")
                assert.equal(element.style.getPropertyValue("width"), "")
            }
            for (var property of ["padding-left", "padding-right", "border-left-width", "border-right-width", "border-left-style", "border-right-style"]) {
                assert.equal(spacer.style.getPropertyValue(property), "", "the row itself has no horizontal box: " + property)
            }
            Array.from(spacer.children).forEach(function(cell, index) {
                var computed = getComputedStyle(real.children[index])
                for (var property of ["padding-left", "padding-right", "border-left-width", "border-right-width"]) {
                    assert.equal(parseFloat(cell.style.getPropertyValue(property)), parseFloat(computed.getPropertyValue(property)) || 0, property)
                    assert.equal(cell.style.getPropertyPriority(property), "important", property)
                }
                for (var property of ["border-left-style", "border-right-style"]) {
                    assert.equal(cell.style.getPropertyPriority(property), "important", property)
                }
            })
            for (var cell of Array.from(spacer.children)) { assert.equal(cell.style.getPropertyValue("height"), "0px") }
            assert.equal(spacer.style.getPropertyPriority("height"), "important")
            assert.ok(parseFloat(spacer.style.height) > 0)
        }
    })
})

test("a list whose row 0 has another structure gets the majority skeleton, and the hook counts the other row", function() {
    withTable({identifier: (row) => row === 0 ? "other" : "row"}, function(context) {
        scrolledWithSpacers(context)
        assert.equal(spacers()[0].children.length, 3, "the three-cell structure most rows have, not row 0's single cell")
        assert.equal(context.table._otherSignatureCount(), 1)
    })
})

test("the skeleton follows a reload that changes the majority signature", function() {
    withTable({}, function(context) {
        scrolledWithSpacers(context)
        assert.equal(spacers()[0].children.length, 3)
        var before = spacers()[0]
        context.model.identifier = () => "other"
        context.table.reloadData()
        assert.equal(spacers().length > 0, true)
        for (var spacer of spacers()) { assert.equal(spacer.children.length, 1, "the single cell of the new majority") }
        assert.equal(before.isConnected, false, "the old spacer is gone, not left beside the new one")
        assert.equal(context.table._otherSignatureCount(), 0)
    })
})

test("a spacer built from the skeleton has no handlers, and a click on it selects nothing", function() {
    withTable({}, function(context) {
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            for (var element of [spacer, ...Array.from(spacer.children)]) {
                assert.equal($._data(element, "events"), undefined)
            }
            click(spacer)
            click(spacer.children[0])
        }
        assert.equal(context.table.indexPathsForSelectedRows.length, 0)
    })
})

test("under table-layout fixed the first row, which is the top spacer mid-list, gives the columns row 0 would give", function() {
    var style = document.createElement("style")
    style.textContent = "td.a{width:40px} th.b{width:70px} td.c{width:90px} tbody > tr > :nth-child(1){min-width:5px}"
    document.head.appendChild(style)
    try {
        withTable({}, function(context) {
            context.table.register(Plain, {forCellReuseIdentifier: "row"})
            context.table.reloadData()
            var widths = (row) => Array.from(row.children).map((cell) => [getComputedStyle(cell).width, getComputedStyle(cell).minWidth])
            var withoutSpacer = widths(rowsBody().firstElementChild)
            scrolledWithSpacers(context)
            var withSpacer = widths(rowsBody().firstElementChild)
            assert.deepEqual(withSpacer, withoutSpacer)
            assert.deepEqual(withSpacer.map((entry) => entry[0]), ["40px", "70px", "90px"])
        })
    } finally {
        style.remove()
    }
})

test("a table whose rows share one structure has a spacer of that structure, and Other's single cell stays a single cell", function() {
    withTable({identifier: () => "other"}, function(context) {
        scrollTo(context.layout, 20000)
        for (var spacer of spacers()) {
            assert.equal(spacer.children.length, Array.from(rowsBody().querySelector("tr[id]").children).length)
        }
        assert.ok(Other.nib.includes("<td"))
    })
})

test("a cell the page hides in the rows is a hidden cell in the spacers, is not written when measured, and records 0", function() {
    withTable({widthsOf: () => [[10, 30], [20, 40], [15, 25]]}, function(context) {
        withRule("#table #mobile { display: none }", function() {
            context.table.register(Mobile, {forCellReuseIdentifier: "row"})
            var written = writtenProperties(function() {
                context.table.reloadData()
                scrollTo(context.layout, 40000)
                settle(context.layout)
            })
            assert.equal(spacers().length, 2)
            for (var spacer of spacers()) {
                assert.equal(spacer.children[2].style.getPropertyValue("display"), "none")
                assert.equal(spacer.children[2].style.getPropertyPriority("display"), "important")
                assert.equal(spacer.children[0].style.getPropertyValue("display"), "", "a table cell is the default and is not written")
                assert.equal(spacer.children[1].style.getPropertyValue("display"), "")
                assert.deepEqual(spanWidths(spacer.children[2]), [], "a hidden column asks for nothing")
                assert.ok(spanWidths(spacer.children[1]).length > 0)
            }
            var cells = Array.from(written.keys()).filter((target) => target.tagName === "TD")
            assert.equal(cells.filter((cell) => cell.id === "mobile").length, 0, "the hidden cell is never written")
            assert.ok(cells.filter((cell) => cell.id === "desktop").length > 0, "its neighbours are")
            var record = context.table._columns.records[0]
            assert.deepEqual([record.min[2], record.max[2]], [0, 0])
            assert.deepEqual([record.min[1], record.max[1]], [20, 40])
        })
    })
})

test("a cell the page lays out as a flex box in a table row is a block in the spacers, and keeps its display when measured", function() {
    withTable({widthsOf: () => [[10, 30], [20, 40]]}, function(context) {
        withRule("#table tr.r td { display: flex }", function() {
            context.table.register(Flexy, {forCellReuseIdentifier: "row"})
            var written = writtenProperties(function() {
                context.table.reloadData()
                scrollTo(context.layout, 40000)
                settle(context.layout)
            })
            assert.equal(spacers().length, 2)
            assert.equal(context.table._rowBox.mode, "table", "the row is a table row, so the spacer is a row")
            for (var spacer of spacers()) {
                assert.deepEqual(Array.from(spacer.children).map((cell) => cell.style.getPropertyValue("display")), ["block", "block"])
                assert.deepEqual(Array.from(spacer.children).map((cell) => cell.style.getPropertyPriority("display")), ["important", "important"])
            }
            var cells = Array.from(written.keys()).filter((target) => target.tagName === "TD" && target.parentElement && target.parentElement.id !== "")
            assert.ok(cells.length > 0)
            for (var cell of cells) {
                assert.deepEqual(Array.from(written.get(cell)).sort(), ["max-width", "min-width", "width"], "the width keywords only, and never the display")
            }
        })
    })
})

test("a padding the page gives a cell by its id is the padding of the spacer's cell, and the replayed spans leave it out", function() {
    withTable({widthsOf: () => [[60, 120], [20, 40]]}, function(context) {
        withRule("#table #first { padding-left: 50px }", function() {
            context.table.register(Padded, {forCellReuseIdentifier: "row"})
            context.table.reloadData()
            scrollTo(context.layout, 40000)
            settle(context.layout)
            assert.equal(spacers().length, 2)
            for (var spacer of spacers()) {
                assert.equal(spacer.children[0].style.getPropertyValue("padding-left"), "50px")
                assert.equal(spacer.children[0].style.getPropertyPriority("padding-left"), "important")
                assert.equal(spacer.children[1].style.getPropertyValue("padding-left"), "0px")
                var widths = spanWidths(spacer.children[0])
                assert.equal(Math.max(...widths), 60, "the measured min, 110, less the 50 the cell has itself")
                assert.equal(widths.reduce((total, width) => total + width, 0), 120, "the measured max, 170, less the 50")
            }
        })
    })
})

test("FS4. what is copied from the page into a spacer's cell is validated: a width is a plain px number, a style and a display are keywords", function() {
    withTable({}, function(context) {
        context.table.register(Plain, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        settle(context.layout)
        var injected = [
            {"display": "weird", "padding-left": "NaN", "padding-right": "-5px", "border-left-width": "calc(1px + 2px)", "border-right-width": "20000px", "border-left-style": "wavy", "border-right-style": "solid"},
            {"display": "inline-flex", "padding-left": "12.5px", "padding-right": "3", "border-left-width": "1.5px", "border-right-width": "3px", "border-left-style": "dotted", "border-right-style": "dashed"},
            {"display": "grid", "padding-left": "", "padding-right": "10001px", "border-left-width": "10000px", "border-right-width": "0px", "border-left-style": "inset", "border-right-style": "url(x)"},
        ]
        var original = globalThis.getComputedStyle
        globalThis.getComputedStyle = function(element) {
            var computed = original.apply(this, arguments)
            var row = element.parentElement
            if (!row || !/^cell-/.test(row.id)) { return computed }
            var values = injected[Array.from(row.children).indexOf(element)]
            return {getPropertyValue: (name) => name in values ? values[name] : computed.getPropertyValue(name)}
        }
        try {
            context.table._rowBoxFor = null
            context.table._dirtyAndSchedule()
            scrollTo(context.layout, 40000)
            settle(context.layout)
        } finally {
            globalThis.getComputedStyle = original
        }
        assert.equal(spacers().length, 2)
        var read = (cell, property) => cell.style.getPropertyValue(property)
        for (var spacer of spacers()) {
            var [first, second, third] = Array.from(spacer.children)
            assert.equal(read(first, "display"), "", "an unknown display is a table cell, which is not written")
            assert.deepEqual(["padding-left", "padding-right", "border-left-width", "border-right-width"].map((property) => read(first, property)), ["0px", "0px", "0px", "0px"])
            assert.deepEqual(["border-left-style", "border-right-style"].map((property) => read(first, property)), ["none", "solid"])
            assert.equal(read(second, "display"), "inline-block")
            assert.deepEqual(["padding-left", "padding-right", "border-left-width", "border-right-width"].map((property) => read(second, property)), ["12.5px", "3px", "1.5px", "3px"])
            assert.deepEqual(["border-left-style", "border-right-style"].map((property) => read(second, property)), ["dotted", "dashed"])
            assert.equal(read(third, "display"), "block")
            assert.deepEqual(["padding-left", "padding-right", "border-left-width", "border-right-width"].map((property) => read(third, property)), ["0px", "0px", "10000px", "0px"])
            assert.deepEqual(["border-left-style", "border-right-style"].map((property) => read(third, property)), ["inset", "none"])
        }
    })
})
