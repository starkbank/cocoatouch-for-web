import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableViewCell } from "../src/index.js"
import { setup, rowsBody, spacers, scrollTo } from "./tableReuseHelpers.js"


// Rows the page lays out as flex boxes, which the browser wraps in one anonymous row and cell: the rows are `tr[id]`, the spacers
// have no id, and the header row is still a table row.
const boxStyle = "#table tr[id] { display: flex }"

// A row of two classed cells, so a spacer's structure can be told from a single bare cell.
class Classed extends UITableViewCell {}
Classed.nib = "<tr data-height=\"95\"><td class=\"a first\" id=\"title\"></td><td class=\"b\"></td></tr>"
IBOutlet("#title", UILabel)(Classed.prototype, "titleLabel", {})

function withStyle(text, body) {
    var style = document.createElement("style")
    style.textContent = text
    document.head.appendChild(style)
    try { body(style) } finally { style.remove() }
}

function withTable(options, body) {
    var context = null
    try {
        context = setup(options)
        body(context)
    } finally {
        if (context) { context.layout.restore() }
    }
}

function withBoxTable(options, body) {
    withStyle(boxStyle, function() { withTable(options, body) })
}

// Every frame, until two in a row have nothing to run.
function settle(layout) {
    for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
}

// What a row asks of the one column a box row is, from its own data-min and data-max: the minima run 10 to 14 and the maxima 30 to 60.
function askRow(row, cell) {
    var element = cell.$el[0]
    element.setAttribute("data-min", String(10 + (row % 5)))
    element.setAttribute("data-max", String(30 + (row % 7) * 5))
}

function tableElement() {
    return document.getElementById("table")
}

function spanWidths(spacer) {
    return Array.from(spacer.querySelectorAll("span")).map((span) => parseFloat(span.style.width))
}

function sum(numbers) {
    return numbers.reduce((total, number) => total + number, 0)
}

function propertyNames(text) {
    return (text || "").split(";").map((declaration) => declaration.split(":")[0].trim()).filter((name) => name !== "")
}


test("1. rows the page lays out as flex boxes get spacers that are blocks with no cells, whatever the cells they stand for", function() {
    withBoxTable({}, function({layout}) {
        scrollTo(layout, 40000)
        settle(layout)
        assert.equal(spacers().length, 2, "both spacers are present mid-list")
        for (var spacer of spacers()) {
            assert.equal(spacer.style.getPropertyValue("display"), "block")
            assert.equal(spacer.style.getPropertyPriority("display"), "important")
            assert.equal(spacer.getAttribute("aria-hidden"), "true")
            assert.equal(spacer.children.length, 0)
            assert.equal(spacer.querySelector("td, th"), null)
            assert.equal(spacer.id, "")
            for (var property of ["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]) {
                assert.equal(spacer.style.getPropertyValue(property), "0px", property)
                assert.equal(spacer.style.getPropertyPriority(property), "important", property)
            }
        }
    })
})

test("2. a box row's replay: the widest span is the aggregate row min and the spans add up to its max; under fixed layout one 1 px span of the min", function() {
    withBoxTable({}, function({table, model, layout}) {
        model.onAsk = askRow
        table.reloadData()
        settle(layout)
        scrollTo(layout, 40000)
        settle(layout)
        var bottom = rowsBody().lastElementChild
        assert.equal(bottom.id, "")
        assert.equal(bottom.children.length, 1, "the wrapper goes straight into the spacer")
        var widths = spanWidths(bottom)
        assert.equal(Math.max(...widths), 14, "the widest row min")
        assert.equal(sum(widths), 60, "the widest row max")
        assert.equal(bottom.querySelector("span").style.height, "0px")
        tableElement().style.setProperty("table-layout", "fixed")
        table._dirtyAndSchedule()
        settle(layout)
        bottom = rowsBody().lastElementChild
        assert.deepEqual(spanWidths(bottom), [14], "one span as wide as the narrowest row")
        assert.equal(bottom.querySelector("span").style.height, "1px")
    })
})

test("3. measuring box rows writes width, min-width and max-width on the rows only, and leaves every style attribute as it was", function() {
    withBoxTable({}, function({table, model, layout}) {
        model.onAsk = askRow
        var observer = new window.MutationObserver(function() {})
        observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ["style"], attributeOldValue: true})
        table.reloadData()
        settle(layout)
        scrollTo(layout, 40000)
        settle(layout)
        var records = observer.takeRecords()
        observer.disconnect()
        var rowProperties = new Set()
        var cellProperties = new Set()
        var targets = new Set()
        for (var record of records) {
            targets.add(record.target)
            var names = propertyNames(record.oldValue)
            if (record.target.tagName === "TR" && record.target.id !== "") { names.forEach((name) => rowProperties.add(name)) }
            if (record.target.parentElement && record.target.parentElement.tagName === "TR" && record.target.parentElement.id !== "") { names.forEach((name) => cellProperties.add(name)) }
        }
        for (var target of targets) {
            var final = propertyNames(target.getAttribute("style"))
            if (target.tagName === "TR" && target.id !== "") { final.forEach((name) => rowProperties.add(name)) }
        }
        assert.deepEqual(Array.from(rowProperties).sort(), ["max-width", "min-width", "width"])
        assert.equal(cellProperties.size, 0, "no cell is written")
        assert.equal(document.querySelectorAll("tr[id][style], tr[id] > [style]").length, 0, "no style attribute is left")
    })
})

test("4. a change of the page's rules and of innerWidth rebuilds the spacers, starts a generation with no floor and measures every row again, both ways", function() {
    withStyle("", function(style) {
        withTable({}, function({table, model, layout}) {
            table.register(Classed, {forCellReuseIdentifier: "row"})
            table.reloadData()
            scrollTo(layout, 40000)
            settle(layout)
            assert.equal(spacers().length, 2)
            for (var spacer of spacers()) {
                assert.deepEqual(Array.from(spacer.children).map((cell) => cell.className), ["a first", "b"])
            }
            var generation = table._columns.generation
            model.measured.length = 0
            style.textContent = boxStyle
            window.innerWidth = 777
            table._dirtyAndSchedule()
            settle(layout)
            assert.equal(table._rowBox.mode, "box")
            assert.ok(table._columns.generation > generation, "a new generation")
            assert.equal(table._columns.floor, null, "no floor")
            assert.ok(new Set(model.measured).size > 900, "every row outside the window is measured again")
            assert.equal(spacers().length, 2)
            for (spacer of spacers()) {
                assert.equal(spacer.children.length, 0, "no cells in box mode")
                assert.equal(spacer.style.getPropertyValue("display"), "block")
            }
            generation = table._columns.generation
            style.textContent = ""
            window.innerWidth = 888
            table._dirtyAndSchedule()
            settle(layout)
            assert.equal(table._rowBox.mode, "table")
            assert.ok(table._columns.generation > generation)
            for (spacer of spacers()) {
                assert.deepEqual(Array.from(spacer.children).map((cell) => cell.className), ["a first", "b"], "the skeleton's classes again, because the rendered rows were noted after the reset")
            }
        })
    })
})

test("5. the row box is read once per structure, innerWidth and table layout, in the pass's read batch, and a scroll pass reads none", function() {
    withBoxTable({}, function({table, layout}) {
        var calls = []
        var original = globalThis.getComputedStyle
        globalThis.getComputedStyle = function(element) {
            if (element.tagName === "TR") { calls.push(layout.readWriteLog().at(-1)) }
            return original.apply(this, arguments)
        }
        try {
            for (var step = 0; step < 10; step++) {
                scrollTo(layout, 20000 + step * 2000)
                settle(layout)
            }
            assert.deepEqual(calls, [], "ten scroll passes read no row")
            window.innerWidth = 777
            table._dirtyAndSchedule()
            settle(layout)
            assert.deepEqual(calls, ["read"], "one read for the new width, with no write since the pass's last read")
            tableElement().style.setProperty("table-layout", "fixed")
            table._dirtyAndSchedule()
            settle(layout)
            assert.deepEqual(calls, ["read", "read"], "one read for the new layout")
        } finally {
            globalThis.getComputedStyle = original
        }
    })
})

test("6. dispose and a reload to no rows clear what was read of the rows", function() {
    withBoxTable({}, function({table, model, layout}) {
        assert.equal(table._rowBox.mode, "box")
        assert.notEqual(table._rowBoxFor, null)
        model.count = 0
        table.reloadData()
        assert.equal(table._rowBox.mode, "table")
        assert.equal(table._rowBoxFor, null)
        model.count = 1000
        table.reloadData()
        settle(layout)
        assert.equal(table._rowBox.mode, "box")
        table._dispose()
        assert.equal(table._rowBox.mode, "table")
        assert.equal(table._rowBoxFor, null)
    })
})
