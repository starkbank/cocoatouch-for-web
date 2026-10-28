import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIView, UITableViewCell, UITableViewRowAnimation } from "../src/index.js"
import { offsetOf, totalHeight } from "../src/utils/rowheights.js"
import { counters, setup, rowsBody, renderedIds, renderedRows, spacers, scrollTo, at } from "./tableReuseHelpers.js"


var animation = UITableViewRowAnimation.none

// Three cells of which the second is a view of its own, so a row can hide it the way a page does.
class Switchable extends UITableViewCell {}
Switchable.nib = "<tr data-height=\"95\"><td id=\"title\"></td><td id=\"second\"></td><td id=\"third\"></td></tr>"
IBOutlet("#title", UILabel)(Switchable.prototype, "titleLabel", {})
IBOutlet("#second", UIView)(Switchable.prototype, "secondView", {})

// What each row's three cells ask of their columns, as the fake layout reads them from data-min and data-max. Column 1 is wide
// when it can be (max well over twice its min), column 2 never asks for a min.
function widths(row) {
    return [[10 + (row % 5), 30 + (row % 7) * 5], [20, 40 + (row % 11) * 10], [0, 15]]
}

function withTable(options, body) {
    var context = setup(Object.assign({widthsOf: widths}, options))
    try { body(context) } finally { context.layout.restore() }
}

// Every frame, until two in a row have nothing to run: the measuring chunks and the passes they schedule, and the passes a report
// of the table's width schedules one frame after it is delivered.
function settle(layout) {
    for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
}

function allRows(count, of = widths) {
    var all = {min: [], max: []}
    for (var row = 0; row < count; row++) {
        of(row).forEach(function(entry, index) {
            all.min[index] = Math.max(all.min[index] || 0, entry[0])
            all.max[index] = Math.max(all.max[index] || 0, entry[1])
        })
    }
    return all
}

function tableElement() {
    return document.getElementById("table")
}

function spansOf(spacer, column) {
    return Array.from(spacer.children[column].querySelectorAll("span")).map((span) => parseFloat(span.style.width))
}

function sum(numbers) {
    return numbers.reduce((total, number) => total + number, 0)
}

function reads(layout, action) {
    layout.clearLog()
    action()
    return layout.readWriteLog().filter((kind) => kind === "read").length
}

function pendingFonts() {
    var listeners = new Set()
    var ready = new Promise((resolve) => { this.resolve = resolve })
    var fonts = {
        status: "loading",
        ready: ready,
        added: 0,
        removed: 0,
        addEventListener(name, listener) { if (name === "loadingdone") { listeners.add(listener); this.added++ } },
        removeEventListener(name, listener) { if (name === "loadingdone") { listeners.delete(listener); this.removed++ } },
        fire() { for (var listener of Array.from(listeners)) { listener() } },
        listeners: listeners,
    }
    fonts.resolve = this.resolve
    return fonts
}

function withFonts(body) {
    var original = Object.getOwnPropertyDescriptor(document, "fonts")
    var fonts = pendingFonts.call({})
    Object.defineProperty(document, "fonts", {configurable: true, value: fonts})
    try { return body(fonts) } finally {
        if (original) { Object.defineProperty(document, "fonts", original) } else { delete document.fonts }
    }
}


test("1. a 100-row append below the area asks each new row once, only to measure it: no row enters the rows, nothing is displayed", function() {
    withTable({}, function({table, model, layout, events}) {
        settle(layout)
        model.asked.length = 0
        model.measured.length = 0
        events.length = 0
        var before = table.visibleCells.slice()
        var ids = renderedIds()
        var queued = document.querySelectorAll("tr[id^=reusable-]").length
        model.count = 1100
        table.insertRows({at: at(...Array.from({length: 100}, (_, i) => 1000 + i)), with: animation})
        assert.deepEqual(model.asked, [], "no row is displayed")
        assert.deepEqual(model.measured.slice().sort((a, b) => a - b), Array.from({length: 100}, (_, i) => 1000 + i), "each new row is asked once, to be measured")
        assert.deepEqual(events.filter((event) => event[0] === "will" && event[1] >= 1000), [])
        assert.deepEqual(table.visibleCells, before)
        assert.deepEqual(renderedIds(), ids)
        assert.equal(document.querySelectorAll("tr[id^=cell-]").length, ids.length, "no cell-<row> id is created for a measured row")
        assert.ok(document.querySelectorAll("tr[id^=reusable-]").length <= Math.max(queued, 100) + 0, "the queue is the pool, at its cap")
    })
})

test("2. after a reload, an append and a scroll, the column widths the browser sees are every row's, rendered or not", function() {
    var data = (row) => row === 700 ? [[20, 400], [20, 400], [0, 15]] : widths(row)
    withTable({widthsOf: data}, function({table, model, layout}) {
        settle(layout)
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(1000, data))
        model.count = 1100
        var grown = (row) => row === 1050 ? [[60, 700], [20, 40], [0, 15]] : data(row)
        model.widthsOf = grown
        table.insertRows({at: at(...Array.from({length: 100}, (_, i) => 1000 + i)), with: animation})
        settle(layout)
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(1100, grown))
        scrollTo(layout, 40000)
        settle(layout)
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(1100, grown))
    })
})

test("2. a column whose max is over twice its min has spans that are all at most the min, one exactly the min, adding up to the max; a column with no min has none", function() {
    var data = (row) => row === 700 ? [[10, 100], [20, 400], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    withTable({widthsOf: data}, function({layout}) {
        settle(layout)
        var bottom = spacers().find((spacer) => spacer === rowsBody().lastElementChild)
        var column = spansOf(bottom, 1)
        assert.equal(column.length, 20)
        assert.ok(column.every((width) => width <= 20))
        assert.ok(column.includes(20))
        assert.equal(sum(column), 400)
        assert.deepEqual(spansOf(bottom, 2), [], "a column with a min of 0 gets no spans")
        assert.equal(sum(spansOf(bottom, 0)), 100)
        assert.equal(Math.max(...spansOf(bottom, 0)), 10)
    })
})

test("3. the rows rendered at a reload are measured once, when they leave the window", function() {
    withTable({count: 300}, function({layout, model}) {
        settle(layout)
        assert.ok(!model.measured.includes(3), "rendered at the reload: not measured")
        scrollTo(layout, 20000)
        settle(layout)
        assert.equal(model.measured.filter((row) => row === 3).length, 1)
        scrollTo(layout, 0)
        settle(layout)
        scrollTo(layout, 20000)
        settle(layout)
        assert.equal(model.measured.filter((row) => row === 3).length, 1, "a row is measured once per configuration")
    })
})

test("4. reconfigureRows measures an off-window row again, invalidates a rendered one, and still hands the cell back without prepareForReuse", function() {
    withTable({count: 600}, function({table, model, layout}) {
        settle(layout)
        model.measured.length = 0
        model.asked.length = 0
        table.reconfigureRows({at: at(500)})
        assert.deepEqual(model.measured, [500], "an off-window row is measured again, once")
        assert.deepEqual(model.asked, [], "and not displayed")
        scrollTo(layout, 20000)
        settle(layout)
        scrollTo(layout, 0)
        settle(layout)
        var before = table.cellForRow({at: 3})
        var prepared = counters.prepared
        model.measured.length = 0
        table.reconfigureRows({at: at(3)})
        assert.equal(table.cellForRow({at: 3}), before)
        assert.equal(counters.prepared, prepared, "a reconfigured cell is not prepared for reuse")
        assert.deepEqual(model.measured, [], "a rendered row is not measured")
        scrollTo(layout, 20000)
        settle(layout)
        assert.equal(model.measured.filter((row) => row === 3).length, 1, "it is measured when it leaves")
    })
})

test("5. a reload of 250 rows measures 100 at once, nearest the window first, the rest one chunk per frame, and the floor holds until the last", function() {
    var first = (row) => row === 240 ? [[10, 900], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    var second = (row) => row === 245 ? [[10, 500], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    withTable({count: 250, widthsOf: first}, function({table, model, layout}) {
        settle(layout)
        assert.equal(layout.columnWidths(tableElement()).max[0], 900)
        model.widthsOf = second
        model.measured.length = 0
        table.reloadData()
        assert.deepEqual(model.measured.slice().sort((a, b) => a - b), Array.from({length: 100}, (_, i) => 18 + i), "the 100 rows nearest the window")
        assert.equal(layout.columnWidths(tableElement()).max[0], 900, "the floor holds while rows are pending")
        layout.flushFrames()
        assert.equal(model.measured.length, 200, "one chunk per frame")
        assert.equal(layout.columnWidths(tableElement()).max[0], 900)
        settle(layout)
        assert.equal(model.measured.length, 232)
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(250, second), "after the last chunk the columns are exact")
    })
})

test("6. a reload of up to 100 rows is exact at once, and drops the floor", function() {
    var first = (row) => row === 70 ? [[10, 900], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    var second = (row) => [[10, 30], [20, 40], [0, 15]]
    withTable({count: 90, widthsOf: first}, function({table, model, layout}) {
        model.widthsOf = second
        table.reloadData()
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(90, second))
        assert.equal(table._columns.floor, null)
    })
})

test("7. under table-layout fixed a chunk reads once, asks each row once, and replays the narrowest content as one span 1 px tall", function() {
    withTable({count: 400}, function({table, model, layout}) {
        tableElement().style.setProperty("table-layout", "fixed")
        table._dirtyAndSchedule()
        settle(layout)
        model.measured.length = 0
        table.reloadData()
        settle(layout)
        assert.equal(new Set(model.measured).size, model.measured.length, "each row is asked once")
        var bottom = rowsBody().lastElementChild
        assert.equal(spansOf(bottom, 0).length, 1)
        assert.equal(spansOf(bottom, 0)[0], allRows(400).min[0], "as wide as the narrowest content")
        assert.equal(bottom.children[0].querySelector("span").style.height, "1px")
        assert.deepEqual(spansOf(bottom, 2), [], "a column with no min has no span")
        // a chunk of a table that does not change its aggregate: one layout read
        table.reloadData()
        var count = reads(layout, () => layout.flushFrames())
        assert.equal(count, 1, "one layout read per chunk")
    })
})

test("7. a spacer under 1 px gets no span, and crossing between fixed and auto follows the A1 rules", function() {
    withTable({count: 400}, function({table, model, layout}) {
        tableElement().style.setProperty("table-layout", "fixed")
        table._dirtyAndSchedule()
        settle(layout)
        table.reloadData()
        settle(layout)
        var bottom = rowsBody().lastElementChild
        assert.equal(spansOf(bottom, 0).length, 1)
        bottom._height = 0.5
        bottom._replay = null
        table._replay()
        assert.equal(bottom.querySelectorAll("span").length, 0, "a spacer of 0.5 px gets none")
        var generation = table._columns.generation
        model.measured.length = 0
        tableElement().style.removeProperty("table-layout")
        table._dirtyAndSchedule()
        settle(layout)
        assert.equal(table._columns.generation, generation + 1, "fixed to auto starts a new generation")
        assert.ok(model.measured.length > 0, "and measures again")
        assert.ok(spansOf(rowsBody().lastElementChild, 1).length > 1, "with the spans of an auto layout")
        generation = table._columns.generation
        model.measured.length = 0
        tableElement().style.setProperty("table-layout", "fixed")
        table._dirtyAndSchedule()
        settle(layout)
        assert.equal(table._columns.generation, generation, "auto to fixed keeps the records")
        assert.deepEqual(model.measured, [], "and measures nothing")
        assert.equal(spansOf(rowsBody().lastElementChild, 0).length, 1)
    })
})

test("8. a hidden table measures nothing until it is shown", function() {
    withTable({hidden: true, count: 300}, function({table, model, layout}) {
        settle(layout)
        assert.deepEqual(model.measured, [])
        table.isHidden = false
        layout.resize(tableElement(), {})
        settle(layout)
        assert.ok(model.measured.length > 0)
    })
})

test("9. a change of innerWidth measures every row again; a width-only report does not", function() {
    withTable({count: 300}, function({table, model, layout}) {
        settle(layout)
        var generation = table._columns.generation
        model.measured.length = 0
        layout.resize(tableElement(), {width: 900})
        settle(layout)
        assert.deepEqual(model.measured, [], "the table's own width does not change what a cell asks")
        assert.equal(table._columns.generation, generation)
        window.innerWidth = 777
        table._dirtyAndSchedule()
        settle(layout)
        assert.equal(table._columns.generation, generation + 1)
        assert.ok(model.measured.length > 200)
        assert.equal(new Set(model.measured).size, model.measured.length)
    })
})

test("10. a change of the aggregate drops the row heights and the means, and schedules exactly one pass", function() {
    var data = (row) => row === 500 ? [[10, 900], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    withTable({count: 600, widthsOf: widths}, function({table, model, layout}) {
        settle(layout)
        assert.equal(table._heights.heights[3], 95)
        model.widthsOf = data
        table.reconfigureRows({at: at(500)})
        assert.ok(Number.isNaN(table._heights.heights[3]), "the heights were reset")
        assert.equal(table._heights.estimates.size, 0, "and the means measured under the old columns")
        assert.equal(layout.flushFrames(), 1, "one pass")
        assert.equal(layout.flushFrames(), 0)
        assert.equal(layout.columnWidths(tableElement()).max[0], 900)
    })
})

// Calls of the scroller's scrollBy, which is where the anchor compensation goes.
function spyScrollBy() {
    var root = document.documentElement
    var calls = []
    var original = root.scrollBy
    root.scrollBy = function() {
        calls.push(arguments[0])
        return original.apply(this, arguments)
    }
    return {calls, restore() { delete root.scrollBy }}
}

function rectOf(row) {
    return document.getElementById("cell-" + row).getBoundingClientRect()
}

// Spans that change a column reflow the rows above the anchor, as a page whose cells wrap to the new width does: the first time the
// top spacer's first cell is written, each rendered row above the anchor grows by 20 px. Returns how many rows that was.
function reflowAbove(table, anchor) {
    var rows = renderedRows().filter((row) => row < anchor)
    var cell = table._topSpacer.children[0]
    var append = cell.appendChild
    var isReflown = false
    cell.appendChild = function(node) {
        if (!isReflown) {
            isReflown = true
            for (var row of rows) { document.getElementById("cell-" + row).setAttribute("data-height", "115") }
        }
        return append.call(this, node)
    }
    return rows.length
}

function scrolledAway(context) {
    scrollTo(context.layout, 20000)
    settle(context.layout)
    return renderedRows().find((row) => rectOf(row).bottom > 0)
}

var widerRow = (row) => row === 500 ? [[10, 900], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]

test("10. spans that change the columns keep the anchor row where it was, by one scroll taken before the next pass reads", function() {
    withTable({count: 1000, estimatedRowHeight: 95}, function(context) {
        var {table, model, layout} = context
        var anchor = scrolledAway(context)
        var topBefore = rectOf(anchor).top
        var above = reflowAbove(table, anchor)
        assert.ok(above > 0, "rows above the anchor are rendered")
        var spy = spyScrollBy()
        try {
            model.widthsOf = widerRow
            table.reconfigureRows({at: at(500)})
            assert.equal(spy.calls.length, 1, "taken back in the replay that wrote the spans")
            assert.equal(spy.calls[0].top, 20 * above)
            settle(layout)
            assert.equal(spy.calls.length, 1, "and not again by the pass that follows")
            assert.ok(Math.abs(rectOf(anchor).top - topBefore) < 0.5, "moved from " + topBefore + " to " + rectOf(anchor).top)
        } finally {
            spy.restore()
        }
    })
})

test("10. spans that change the columns are not compensated twice under native scroll anchoring", function() {
    withTable({count: 1000, estimatedRowHeight: 95}, function(context) {
        var {table, model, layout} = context
        var anchor = scrolledAway(context)
        var element = document.getElementById("cell-" + anchor)
        var topBefore = element.getBoundingClientRect().top
        var above = reflowAbove(table, anchor)
        assert.ok(above > 0)
        layout.anchorTo(element)
        var spy = spyScrollBy()
        try {
            model.widthsOf = widerRow
            table.reconfigureRows({at: at(500)})
            assert.equal(spy.calls.length, 0, "the browser moved the page; the framework added nothing")
            settle(layout)
            assert.equal(spy.calls.length, 0)
            assert.ok(Math.abs(element.getBoundingClientRect().top - topBefore) < 0.5)
        } finally {
            spy.restore()
        }
    })
})

// The page's own layout changing under rows already measured, as a web font that finishes loading after the first rows were drawn in
// the fallback font: every row is 197 px until the columns change and 125 px from then on, drawn or not.
test("10. rows measured before the columns changed are not kept: the table is as tall as its rows, and appended pages move no row", function() {
    var height = 197
    withTable({count: 100, heightOf: () => height}, function({table, model, layout}) {
        scrollTo(layout, 3000)
        settle(layout)
        assert.ok(renderedRows()[0] > 5 && table._heights.heights[0] === 197, "rows measured in the old layout have left the window")
        height = 125
        for (var element of document.querySelectorAll("tr[id^=cell-]")) { element.setAttribute("data-height", "125") }
        model.widthsOf = (row) => row === 99 ? [[10, 900], [20, 40], [0, 15]] : widths(row)
        table.reconfigureRows({at: at(99)})
        settle(layout)
        scrollTo(layout, 100 + totalHeight(table._heights) - 900)
        settle(layout)
        assert.equal(totalHeight(table._heights), 100 * 125, "page 1 is as tall as its rows")
        for (var page = 2; page <= 3; page++) {
            var anchor = renderedRows().find((row) => rectOf(row).bottom > 0)
            var offsetBefore = offsetOf(table._heights, anchor)
            var topBefore = rectOf(anchor).top
            model.count += 100
            table.reloadData()
            settle(layout)
            assert.equal(offsetOf(table._heights, anchor), offsetBefore, "page " + page + ": no row above the anchor moved in the model")
            assert.ok(renderedRows().includes(anchor) && Math.abs(rectOf(anchor).top - topBefore) < 1, "page " + page + ": the anchor moved from " + topBefore + " to " + rectOf(anchor).top)
            assert.equal(totalHeight(table._heights), model.count * 125, "page " + page + " is as tall as its rows")
            scrollTo(layout, 100 + totalHeight(table._heights) - 900)
            settle(layout)
        }
    })
})

test("11. dispose cancels the measuring frame, and no measuring write survives a pass", function() {
    withTable({count: 600}, function({table, model, layout}) {
        var queueBody = document.querySelector("#table > tbody:first-of-type")
        assert.equal(queueBody.style.display, "none")
        for (var cell of document.querySelectorAll("td, th")) {
            for (var property of ["min-width", "max-width", "width", "position", "contain"]) {
                assert.equal(cell.style.getPropertyValue(property), "", property)
            }
            assert.notEqual(cell.style.display, "inline-block")
        }
        assert.equal(queueBody.hasAttribute("style"), true)
        for (var row of queueBody.children) { assert.notEqual(row.style.display, "block") }
        table.reloadData()
        model.measured.length = 0
        table._dispose()
        assert.equal(layout.flushFrames(), 0, "the frame was cancelled")
        assert.deepEqual(model.measured, [])
    })
})

test("12. an auto layout chunk does exactly two layout reads", function() {
    withTable({count: 400, widthsOf: () => [[10, 30], [20, 40], [0, 15]]}, function({table, layout}) {
        table.reloadData()
        var count = reads(layout, () => layout.flushFrames())
        assert.equal(count, 2)
    })
})

test("13. insertRows while chunks are pending shifts the pending rows, measures the inserted ones once, and asks no row twice", function() {
    withTable({count: 500}, function({table, model, layout}) {
        // the first two chunks, rows 18 to 217 of the old data, are measured before the insert: they shift, and are not asked again
        model.measured.length = 0
        table.reloadData()
        layout.flushFrames()
        var before = model.measured.slice()
        assert.equal(before.length, 200)
        model.measured.length = 0
        model.count = 503
        table.insertRows({at: at(200, 201, 202), with: animation})
        settle(layout)
        var sorted = model.measured.slice().sort((a, b) => a - b)
        assert.deepEqual(sorted, [200, 201, 202].concat(Array.from({length: 503 - 221}, (_, i) => 221 + i)), "the inserted rows and the rows not yet measured, once each")
    })
})

test("13. reloadData mid-chunk makes the old chunk a no-op, and the new generation's floor is the one in force", function() {
    var first = (row) => row === 400 ? [[10, 900], [20, 40], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    var second = () => [[10, 30], [20, 40], [0, 15]]
    withTable({count: 500, widthsOf: first}, function({table, model, layout}) {
        settle(layout)
        table.reloadData()
        assert.ok(pendingAfter(table) > 0, "chunks are pending")
        model.widthsOf = second
        model.measured.length = 0
        table.reloadData()
        assert.equal(layout.columnWidths(tableElement()).max[0], 900, "the floor of the generation in force")
        settle(layout)
        assert.equal(new Set(model.measured).size, model.measured.length, "no row is asked twice in the new generation")
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(500, second))
    })
})

function pendingAfter(table) {
    return table._columns.pendingRows.size
}

test("13. dispose mid-chunk asks the data source for nothing more", function() {
    withTable({count: 500}, function({table, model, layout}) {
        table.reloadData()
        assert.ok(pendingAfter(table) > 0)
        var asked = model.asked.length + model.measured.length
        table._dispose()
        settle(layout)
        assert.equal(model.asked.length + model.measured.length, asked)
    })
})

test("14. fonts: loadingdone after a measurement measures once more with the current aggregate as the floor and schedules one pass; ready does the same; the listener goes with the table", async function() {
    await withFonts(async function(fonts) {
        await (async function() {
            var context = setup({widthsOf: widths, count: 60})
            try {
                var {table, model, layout} = context
                settle(layout)
                var aggregate = layout.columnWidths(tableElement())
                assert.equal(fonts.added, 1)
                model.measured.length = 0
                var floored = null
                var original = table._measureChunk
                table._measureChunk = function() {
                    floored = floored || table._columns.floor
                    return original.apply(this, arguments)
                }
                fonts.fire()
                table._measureChunk = original
                assert.equal(model.measured.length, 42, "every row outside the window, once")
                assert.deepEqual(floored.max, aggregate.max, "the aggregate at the time is the floor")
                assert.equal(layout.flushFrames(), 1, "one pass")
                assert.equal(layout.flushFrames(), 0)
                // ready, after the first chunk of this generation
                model.measured.length = 0
                table.reloadData()
                model.measured.length = 0
                fonts.resolve()
                await Promise.resolve()
                await Promise.resolve()
                assert.equal(model.measured.length, 42, "ready after the first chunk measures once more")
                table._dispose()
                assert.equal(fonts.removed, 1)
                assert.equal(fonts.listeners.size, 0)
            } finally { context.layout.restore() }
        })()
    })
})

test("FS4. a measured width that is NaN, infinite or negative leaves a finite replay", function() {
    var data = (row) => row === 700 ? [[-5, Infinity], [NaN, 400], [0, 15]] : [[10, 30], [20, 40], [0, 15]]
    withTable({widthsOf: data}, function({layout}) {
        settle(layout)
        var bottom = rowsBody().lastElementChild
        for (var span of bottom.querySelectorAll("span")) {
            var width = parseFloat(span.style.width)
            assert.ok(Number.isFinite(width) && width >= 0 && width <= 10000, span.style.width)
        }
    })
})

test("FS6. an exception from the data source while measuring leaves the queue hidden, no measuring property on any cell, and no update in progress", function() {
    withTable({count: 200}, function({table, model, layout}) {
        settle(layout)
        model.onAsk = function(row, cell) {
            if (row === 50 && /^reusable-/.test(cell.$el[0].id)) { throw new Error("boom") }
        }
        model.count = 201
        assert.throws(() => table.reloadData(), /boom/)
        var queueBody = document.querySelector("#table > tbody:first-of-type")
        assert.equal(queueBody.style.display, "none")
        for (var cell of document.querySelectorAll("td, th")) {
            for (var property of ["min-width", "max-width", "width", "position", "contain"]) { assert.equal(cell.style.getPropertyValue(property), "", property) }
            assert.notEqual(cell.style.display, "inline-block")
        }
        assert.equal(table._isLaying, false)
        assert.equal(table._measuring, false)
        model.onAsk = null
        table.reloadData()
        settle(layout)
        assert.equal(table.visibleCells.length > 0, true)
    })
})

test("FS7. an update asked from the data source while it is measuring throws, and the chunk finishes", function() {
    var calls = {
        reloadData: (table) => table.reloadData(),
        insertRows: (table, model) => { model.count++; table.insertRows({at: at(0), with: animation}) },
    }
    for (var method of Object.keys(calls)) {
        withTable({count: 200}, function({table, model, layout}) {
            settle(layout)
            var raised = []
            model.onAsk = function(row, cell) {
                if (row !== 150 || !/^reusable-/.test(cell.$el[0].id)) { return }
                try { calls[method](table, model) } catch (error) { raised.push(error) }
            }
            model.count = 200
            table.reloadData()
            settle(layout)
            assert.equal(raised.length, 1, method)
            assert.ok(raised[0].message.includes("UITableView." + method), raised[0].message)
        })
    }
})

test("FS8. a measuring frame for a table that left the document does nothing", function() {
    withTable({count: 500}, function({table, model, layout}) {
        table.reloadData()
        assert.ok(pendingAfter(table) > 0)
        var asked = model.measured.length
        tableElement().remove()
        settle(layout)
        assert.equal(model.measured.length, asked)
    })
})

test("FS9. a scroll step inside the rendered rows writes nothing and reads once, with replayed spans in the spacers", function() {
    withTable({count: 600}, function({layout}) {
        settle(layout)
        layout.clearLog()
        window.scrollTo(0, 20)
        layout.flushFrames()
        assert.deepEqual(layout.readWriteLog().filter((kind) => kind === "write"), [])
        assert.ok(layout.readWriteLog().filter((kind) => kind === "read").length <= 1)
    })
})

test("FS10. after ten 100-row appends with scrolling the rows hold the window and two spacers, and the queue is at its cap", function() {
    withTable({count: 100}, function({table, model, layout}) {
        for (var round = 1; round <= 10; round++) {
            var count = model.count
            model.count = count + 100
            table.insertRows({at: at(...Array.from({length: 100}, (_, i) => count + i)), with: animation})
            scrollTo(layout, round * 3000)
            settle(layout)
            assert.ok(rowsBody().children.length <= renderedRows().length + 2)
            assert.ok(rowsBody().children.length <= 18 * 3 + 2 + 5, "the window: " + rowsBody().children.length)
            assert.ok(document.querySelectorAll("tr[id^=reusable-]").length <= 100 + 0, "the queue: " + document.querySelectorAll("tr[id^=reusable-]").length)
        }
    })
})

test("FS10. a column with m = 1 and M = 9000 is a bounded deviation: 1000 spans of 9 px, the replayed min 9, and the hook reports k = 9000", function() {
    var data = (row) => row === 700 ? [[1, 9000], [20, 40], [0, 15]] : [[1, 30], [20, 40], [0, 15]]
    withTable({widthsOf: data}, function({table, layout}) {
        settle(layout)
        var bottom = rowsBody().lastElementChild
        var column = spansOf(bottom, 0)
        assert.equal(column.length, 1000)
        assert.ok(column.every((width) => width === 9))
        assert.equal(sum(column), 9000)
        assert.equal(layout.columnWidths(tableElement()).min[0], 9)
        assert.deepEqual(table._replayStatistics().ceiled, [{column: 0, k: 9000, w: 9, minReplayed: 9, minTrue: 1}], "one entry for the column, both spacers having replayed it")
        assert.equal(table._replayStatistics().largestK, 9000)
    })
})

test("13.1. the replay statistics are numbers only, one entry per column after repeated replays, and read nothing from the page", function() {
    var data = (row) => row === 700 ? [[1, 9000], [20, 400], [0, 15]] : [[1, 30], [20, 40], [0, 15]]
    withTable({widthsOf: data}, function({table, layout}) {
        settle(layout)
        for (var round = 0; round < 3; round++) {
            for (var spacer of [table._topSpacer, table._bottomSpacer]) { if (spacer) { spacer._replay = null } }
            table._replay()
        }
        layout.clearLog()
        var statistics = table._replayStatistics()
        assert.deepEqual(layout.readWriteLog(), [], "no getBoundingClientRect, getComputedStyle or other read, and no write")
        assert.deepEqual(Object.keys(statistics).sort(), ["ceiled", "largestK"])
        assert.equal(statistics.ceiled.length, 1)
        for (var entry of statistics.ceiled) {
            assert.deepEqual(Object.keys(entry).sort(), ["column", "k", "minReplayed", "minTrue", "w"])
            assert.ok(Object.values(entry).every((value) => typeof value === "number" && Number.isFinite(value)))
        }
        assert.equal(typeof statistics.largestK, "number")
        assert.equal(statistics.ceiled[0].w, statistics.ceiled[0].minReplayed)
        // a replay that no longer needs the ceiling takes the entry away: the latest replay wins
        table._columns.records = []
        table._columns.blocks = []
        table._columns.floor = null
        for (var spacerToClear of [table._topSpacer, table._bottomSpacer]) { if (spacerToClear) { spacerToClear._replay = null } }
        table._replay()
        assert.deepEqual(table._replayStatistics().ceiled, [])
    })
})

test("FS12. the frames and the font listener are released with the table, on reload to nothing and on dispose", async function() {
    await withFonts(async function(fonts) {
        var context = setup({widthsOf: widths, count: 500})
        try {
            var {table, model, layout} = context
            assert.equal(fonts.added, 1)
            model.count = 0
            table.reloadData()
            assert.equal(fonts.listeners.size, 0, "emptied")
            assert.equal(layout.flushFrames() <= 1, true)
            var asked = model.measured.length
            layout.flushFrames()
            assert.equal(model.measured.length, asked, "no measuring frame survives an empty table")
            model.count = 500
            table.reloadData()
            assert.equal(fonts.listeners.size, 1)
            table._dispose()
            assert.equal(fonts.listeners.size, 0)
            assert.equal(fonts.added, fonts.removed)
            assert.equal(layout.flushFrames(), 0, "dispose cancelled the frames")
        } finally { context.layout.restore() }
    })
})

test("FS15. replay spans are unpainted, and their height is 0 under auto layout and 1 px under fixed", function() {
    withTable({count: 400}, function({table, layout}) {
        settle(layout)
        var check = function(height) {
            var found = rowsBody().lastElementChild.querySelectorAll("span")
            assert.ok(found.length > 0)
            for (var span of found) {
                for (var property of ["background", "background-color", "border", "border-width", "outline", "box-shadow"]) { assert.equal(span.style.getPropertyValue(property), "", property) }
                assert.equal(span.style.height, height)
                assert.equal(span.style.display, "inline-block")
            }
            var wrapper = found[0].parentNode
            assert.equal(wrapper.style.getPropertyValue("font-size"), "0px")
            assert.equal(wrapper.style.getPropertyValue("line-height"), "0")
            assert.equal(wrapper.style.height, "0px")
            assert.equal(wrapper.style.getPropertyValue("white-space"), "normal", "the spaces between the spans stay wrap opportunities")
            for (var property of ["white-space", "word-spacing", "letter-spacing", "text-indent"]) { assert.equal(wrapper.style.getPropertyPriority(property), "important", property) }
            for (var spacing of ["word-spacing", "letter-spacing", "text-indent"]) { assert.equal(parseFloat(wrapper.style.getPropertyValue(spacing)), 0, spacing) }
        }
        check("0px")
        tableElement().style.setProperty("table-layout", "fixed")
        table._dirtyAndSchedule()
        settle(layout)
        check("1px")
    })
})

test("a scroll step inside the rows adds no data source call and no layout read beyond the clip's", function() {
    withTable({count: 600}, function({model, layout}) {
        settle(layout)
        model.asked.length = 0
        model.measured.length = 0
        window.scrollTo(0, 15)
        layout.flushFrames()
        assert.deepEqual(model.asked, [])
        assert.deepEqual(model.measured, [])
    })
})

test("the replay takes the cell's own padding and border out of the widths it writes, and the browser puts them back", function() {
    withTable({count: 400}, function({table, layout}) {
        var style = document.createElement("style")
        style.textContent = "td, th { padding: 0 6px; border: 1px solid }"
        document.head.appendChild(style)
        try {
            table.reloadData()
            settle(layout)
            var bottom = rowsBody().lastElementChild
            var all = allRows(400)
            assert.equal(sum(spansOf(bottom, 1)), all.max[1], "the spans are the aggregate less 14 px of padding and border")
            assert.equal(Math.max(...spansOf(bottom, 1)), all.min[1])
            assert.equal(layout.columnWidths(tableElement()).max[1], all.max[1] + 14)
        } finally {
            style.remove()
        }
    })
})

test("FS12. every animation frame a table asks for has run or been cancelled once it is disposed, across a reload, an empty table and a dispose", function() {
    withTable({widthsOf: widths, count: 500}, function({table, model, layout}) {
        var requested = new Map()
        var request = globalThis.requestAnimationFrame
        var cancel = globalThis.cancelAnimationFrame
        globalThis.requestAnimationFrame = function(callback) {
            var entry = {ran: false, cancelled: false}
            var id = request(function() {
                entry.ran = true
                return callback.apply(this, arguments)
            })
            requested.set(id, entry)
            return id
        }
        globalThis.cancelAnimationFrame = function(id) {
            if (requested.has(id)) { requested.get(id).cancelled = true }
            return cancel(id)
        }
        try {
            table.reloadData()
            layout.flushFrames()
            model.count = 0
            table.reloadData()
            model.count = 500
            table.reloadData()
            table.estimatedRowHeight = 70
            table._dispose()
            layout.flushFrames()
            assert.ok(requested.size > 0, "the table asked for frames")
            for (var entry of requested.values()) { assert.ok(entry.ran || entry.cancelled, "a frame was left behind") }
            assert.ok(Array.from(requested.values()).some((entry) => entry.cancelled), "dispose cancelled the ones that were waiting")
        } finally {
            globalThis.requestAnimationFrame = request
            globalThis.cancelAnimationFrame = cancel
        }
    })
})

test("a cell one row hides through isHidden records 0 for its column, and no other row does", function() {
    withTable({widthsOf: widths}, function({table, model, layout}) {
        table.register(Switchable, {forCellReuseIdentifier: "row"})
        model.onAsk = (row, cell) => { cell.secondView.isHidden = row === 7 }
        table.reloadData()
        scrollTo(layout, 40000)
        settle(layout)
        var records = table._columns.records
        assert.deepEqual([records[7].min[1], records[7].max[1]], [0, 0], "the hidden cell asks nothing of its column")
        assert.deepEqual([records[7].min[0], records[7].max[0]], [10 + (7 % 5), 30 + (7 % 7) * 5], "its neighbours still do")
        for (var row of [6, 8, 9, 20]) {
            assert.deepEqual([records[row].min[1], records[row].max[1]], [20, 40 + (row % 11) * 10], "row " + row)
        }
    })
})

test("a row whose structure is not the skeleton's is measured without reading what the rendered rows have, and every cell is written as before", function() {
    withTable({widthsOf: widths}, function({table, layout}) {
        settle(layout)
        var real = table._rowBox
        var lookups = 0
        table._rowBox = {mode: real.mode, signature: real.signature, key: real.key, get cells() { lookups++; return real.cells }}
        var queue = table._queueElement()
        var other = document.createElement("tr")
        other.innerHTML = "<td></td><td></td><td></td><td></td>"
        queue.appendChild(other)
        var observer = new window.MutationObserver(function() {})
        observer.observe(other, {subtree: true, attributes: true, attributeFilter: ["style"], attributeOldValue: true})
        var records = []
        try {
            table._readWidths([other], false)
            records = observer.takeRecords()
        } finally {
            observer.disconnect()
        }
        var written = new Map()
        for (var record of records) {
            if (!written.has(record.target)) { written.set(record.target, new Set()) }
            ;(record.oldValue || "").split(";").map((declaration) => declaration.split(":")[0].trim()).filter((name) => name !== "").forEach((name) => written.get(record.target).add(name))
        }
        for (var [target, names] of written) {
            ;(target.getAttribute("style") || "").split(";").map((declaration) => declaration.split(":")[0].trim()).filter((name) => name !== "").forEach((name) => names.add(name))
        }
        assert.deepEqual(Array.from(written.get(other)).sort(), ["display"], "the row is a block while it is measured")
        for (var cell of Array.from(other.children)) {
            assert.deepEqual(Array.from(written.get(cell)).sort(), ["display", "max-width", "min-width", "width"], "every cell is an inline-block with its width keywords")
        }
        other.remove()
        assert.equal(lookups, 0, "no lookup of the rendered row's cells")
        assert.equal(other.querySelectorAll("[style]").length, 0)
        var skeletonLike = document.querySelector("tr[id^=cell-]").cloneNode(true)
        assert.deepEqual(table._slotsOf(skeletonLike).map((slot) => slot.display), ["table-cell", "table-cell", "table-cell"])
        assert.equal(lookups, 1, "a row of the skeleton's structure is looked up")
        assert.deepEqual(table._slotsOf(other).map((slot) => slot.display), ["table-cell", "table-cell", "table-cell", "table-cell"])
        assert.equal(lookups, 1, "and one of another structure is not")
    })
})

test("a first row that hides a cell by its own state is not the row the spacers learn their cells from", function() {
    withTable({widthsOf: widths}, function({table, model, layout}) {
        table.register(Switchable, {forCellReuseIdentifier: "row"})
        model.onAsk = (row, cell) => { cell.secondView.isHidden = row === 0 }
        table.reloadData()
        settle(layout)
        assert.equal(table.cellForRow({at: 0}).secondView.$el[0].style.display, "none", "row 0 hides its second cell")
        assert.equal(spacers().length, 1)
        for (var spacer of spacers()) {
            assert.notEqual(spacer.children[1].style.getPropertyValue("display"), "none")
            assert.equal(table._rowBox.cells[1].display, "table-cell")
        }
        var records = table._columns.records
        for (var row of [100, 200, 300]) {
            assert.equal(records[row].min[1], 20, "row " + row)
        }
    })
})

// Rows past five ask a lot of their columns, so a column that took one in after a reload to five rows would show it.
function shrunk(row) {
    return row < 5 ? widths(row) : [[10, 900], [20, 900], [0, 15]]
}

function reloadToFive(count) {
    withTable({count, widthsOf: shrunk}, function({table, model, layout}) {
        settle(layout)
        var beyond = []
        model.onAsk = (row) => { if (row >= model.count) { beyond.push(row) } }
        model.count = 5
        table.reloadData()
        assert.deepEqual(beyond, [], "rows asked inside reloadData past the new count")
        settle(layout)
        assert.deepEqual(beyond, [], "rows asked by a measuring frame past the new count")
        assert.deepEqual(Array.from(table._columns.pendingRows).filter((row) => row >= 5), [], "no row past the count waits to be measured")
        assert.deepEqual(table._columns.records.slice(5).filter((record) => record !== undefined), [], "no row past the count has a record")
        assert.equal(table._columns.floor, null, "the larger table's floor is dropped")
        assert.deepEqual(layout.columnWidths(tableElement()), allRows(5, shrunk), "the columns are the five rows' only")
    })
}

test("a reload from 6 rows to 5, every row rendered, asks the data source for no row past the new count, and no column takes a width from one", function() {
    reloadToFive(6)
})

test("a reload from 1000 rows to 5 asks the data source for no row past the new count, and no column takes a width from one", function() {
    reloadToFive(1000)
})
