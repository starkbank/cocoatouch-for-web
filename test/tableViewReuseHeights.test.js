import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IndexPath, NotificationCenter } from "../src/index.js"
import { effectiveHeight, offsetOf, totalHeight } from "../src/utils/rowheights.js"
import { counters, setup, rowsBody, renderedRows, spacers, scrollTo, rows } from "./tableReuseHelpers.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

function spacerHeight() {
    return spacers().map((element) => parseFloat(element.style.height)).reduce((sum, height) => sum + height, 0)
}

function settle(layout) {
    for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
}

// Rows of different heights, so that no mean is right for a row, and the page scrolled down in steps of less than the area, so the
// rows above the anchor are measured: the state in which a page loads its next page.
function scrolledDown(context, y) {
    for (var step = 800; step <= y; step += 800) { scrollTo(context.layout, step) }
    settle(context.layout)
}

function topSpacerHeight() {
    return parseFloat(spacers()[0].style.height)
}

function anchorRow() {
    return renderedRows().find((row) => rect(row).bottom > 0)
}

// The measured rows well above the window, which only a model that kept their heights still has after a reload.
function measuredAboveWindow(table) {
    return measuredRows(table).filter((row) => row < renderedRows()[0] - 5)
}

function measuredRows(table) {
    var found = []
    table._heights.heights.forEach((height, row) => { if (!Number.isNaN(height)) { found.push(row) } })
    return found
}

var mixedHeights = {heightOf: (row) => row % 5 ? 95 : 160}

function rect(row) {
    return document.getElementById("cell-" + row).getBoundingClientRect()
}

// Calls of the scroller's scrollBy, which is where the anchor compensation and scrollToRow's correction go.
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

test("5. the first pass has no measurement and estimates 44, then the cells' own height takes over", function() {
    withTable({}, function({model, table}) {
        assert.equal(Math.max(...model.asked), 37, "1670 px of area at 44 px a row")
        assert.equal(effectiveHeight(table._heights, 500), 95, "unseen rows estimate as the mean of the first cells")
    })
})

test("5. a row estimates as its identifier's mean, an unseen identifier as the dominant one", function() {
    withTable({identifier: (row) => row % 3 === 0 ? "other" : "row", heightOf: (row) => row % 3 === 0 ? 50 : 95}, function({table}) {
        var heights = table._heights
        assert.equal(heights.dominantIdentifier, "row")
        assert.equal(effectiveHeight(heights, 700), 95, "never dequeued: the dominant identifier")
        heights.identifiers[700] = "other"
        assert.equal(effectiveHeight(heights, 700), 50)
        heights.identifiers[700] = "never-seen"
        assert.equal(effectiveHeight(heights, 700), 95)
    })
})

test("5. an explicit estimatedRowHeight wins over the measured means", function() {
    withTable({estimatedRowHeight: 60}, function({table}) {
        assert.equal(renderedRows().length, 18)
        assert.equal(effectiveHeight(table._heights, 900), 60, "a row never drawn estimates at the explicit value")
        assert.equal(spacerHeight(), totalHeight(table._heights) - offsetOf(table._heights, 18), "the spacer is what the model says is below")
        assert.ok(spacerHeight() > (1000 - 40) * 60, "the rows the first pass drew and measured keep their height")
    })
})

test("5. the delegate's estimate wins over estimatedRowHeight for an unmeasured row, a measured height wins over it, and an answer below 0 falls through", function() {
    var delegate = {tableViewEstimatedHeightForRowAtIndexPath: (tableView, indexPath) => indexPath.row >= 100 ? 70 : -1}
    withTable({estimatedRowHeight: 60, delegate}, function({table}) {
        assert.equal(spacerHeight(), totalHeight(table._heights) - offsetOf(table._heights, 18))
        assert.equal(effectiveHeight(table._heights, 5), 95, "measured")
        assert.equal(effectiveHeight(table._heights, 50), 60, "below 0 falls through to estimatedRowHeight")
        assert.equal(effectiveHeight(table._heights, 500), 70)
    })
})

test("5. a delegate answer that is not a number throws at the delegate boundary, naming Apple's method", function() {
    withTable({count: 50}, function({table}) {
        table.delegate = {tableViewEstimatedHeightForRowAtIndexPath: () => "tall"}
        table._heights.dirtyFrom = 0
        assert.throws(() => table.reloadData(), (error) => error instanceof TypeError && /tableView\(_:estimatedHeightForRowAt:\)/.test(error.message))
    })
})

test("5. assigning estimatedRowHeight or replacing the delegate dirties every row and schedules one pass", function() {
    withTable({}, function({table, layout}) {
        assert.equal(layout.flushFrames(), 0)
        table.estimatedRowHeight = 70
        assert.equal(table._heights.dirtyFrom, 0)
        assert.equal(layout.flushFrames(), 1)
        assert.equal(effectiveHeight(table._heights, 900), 70)
        table.estimatedRowHeight = 80
        table.estimatedRowHeight = 90
        assert.equal(layout.flushFrames(), 1, "one pass however many assignments")
        table.delegate = {tableViewEstimatedHeightForRowAtIndexPath: () => 110}
        assert.equal(table._heights.dirtyFrom, 0)
        assert.equal(layout.flushFrames(), 1)
        assert.equal(effectiveHeight(table._heights, 900), 110)
        assert.equal(spacerHeight(), totalHeight(table._heights) - offsetOf(table._heights, renderedRows().length))
    })
})

test("5. estimatedRowHeight = 0 renders batch by batch until the measured rows cover the area, never all 1000 rows", function() {
    withTable({estimatedRowHeight: 0}, function({table, model}) {
        assert.equal(renderedRows().length, 18, "1670 px of area, measured at 95 px")
        assert.ok(Math.max(...model.asked) < 100)
        assert.equal(spacerHeight(), 0, "unmeasured rows count 0, so there is nothing below")
    })
})

test("5. estimatedRowHeight = 0 stops after 3 extensions when the rows measure shorter than each batch assumed", function() {
    var heightOf = (row) => row === 0 ? 800 : 10
    withTable({estimatedRowHeight: 0, heightOf}, function({table, layout}) {
        table._measureChunk = () => {}
        layout.clearLog()
        table.reloadData()
        var visible = table.visibleCells.length
        assert.ok(visible < 200, "rendered " + visible)
        assert.ok(layout.readWriteLog().filter((kind) => kind === "write").length <= 5, layout.readWriteLog().join())
    })
})

test("5. estimatedRowHeight = 0 with a reload to fewer rows at scroll y > 0 renders from the first unmeasured row, not from row 999", function() {
    withTable({estimatedRowHeight: 0}, function({table, model, layout}) {
        scrollTo(layout, 1e9)
        model.count = 900
        table.reloadData()
        var shown = rows(table)
        assert.equal(shown[0], 0)
        assert.ok(shown.length < 100)
    })
})

test("5. estimatedRowHeight = 0 with a reload of the same rows at scroll y > 0 starts at the row it started at before", function() {
    withTable({estimatedRowHeight: 0}, function({table, layout}) {
        scrollTo(layout, 1e9)
        scrollTo(layout, 1e9)
        var before = rows(table)
        assert.ok(before[0] > 0, "the page is scrolled past the first rows")
        table.reloadData()
        var shown = rows(table)
        assert.equal(shown[0], before[0], "the heights the rows measured are kept, so the same rows are in the area")
        assert.ok(shown.length < 100)
    })
})

test("5. estimatedRowHeight = 0 with rows measured and the area past them extends from the next unmeasured row", function() {
    withTable({estimatedRowHeight: 0}, function({table, layout}) {
        var measured = renderedRows().length
        scrollTo(layout, 1e9)
        var shown = rows(table)
        assert.ok(shown[0] <= measured, "starts within or at the end of the measured rows, not at the last row")
        assert.ok(shown.length < 100)
    })
})

test("6. a row measured taller than estimated above the anchor does not move the anchor on screen, and the page is what scrolls", function() {
    withTable({container: true, estimatedRowHeight: 100, heightOf: () => 130}, function({layout}) {
        scrollTo(layout, 40000)
        var first = renderedRows()[0]
        var topBefore
        window.scrollTo(0, 40000 - 1300)
        var anchor = renderedRows().find((row) => rect(row).bottom > 0)
        topBefore = rect(anchor).top
        layout.flushFrames()
        assert.ok(renderedRows().includes(anchor))
        assert.ok(Math.abs(rect(anchor).top - topBefore) < 0.5, "moved from " + topBefore + " to " + rect(anchor).top)
        assert.equal(document.getElementById("container").scrollTop, 0, "not the .table-container")
        assert.ok(window.scrollY !== 40000 - 1300, "the page was scrolled to compensate")
        assert.ok(first >= 0)
    })
})

test("6. a native scroll anchoring that already compensated is not compensated twice", function() {
    withTable({container: true, estimatedRowHeight: 100, heightOf: () => 130}, function({layout}) {
        scrollTo(layout, 40000)
        window.scrollTo(0, 40000 - 1300)
        var anchor = renderedRows().find((row) => rect(row).bottom > 0)
        var element = document.getElementById("cell-" + anchor)
        var topBefore = element.getBoundingClientRect().top
        layout.anchorTo(element)
        var spy = spyScrollBy()
        try {
            layout.flushFrames()
            assert.ok(Math.abs(element.getBoundingClientRect().top - topBefore) < 0.5)
            assert.equal(spy.calls.length, 0, "native anchoring moved the page; the framework added nothing")
        } finally {
            spy.restore()
        }
    })
})

test("6. a jump that carries the window past the anchor row makes no compensation call", function() {
    withTable({container: true, estimatedRowHeight: 100, heightOf: () => 130}, function({layout}) {
        scrollTo(layout, 20000)
        var spy = spyScrollBy()
        try {
            scrollTo(layout, 90000)
            assert.equal(spy.calls.length, 0)
        } finally {
            spy.restore()
        }
    })
})

test("11. a table in a 400 px inner scroller renders by the scroller's clip, and a scroll of the scroller triggers a pass", function() {
    withTable({count: 1000, top: 200, box: {top: 150, height: 400}}, function({layout}) {
        assert.equal(renderedRows().length, 8, "950 px of area bottom less the 230 px before row 0 is 720 px, at 95 px a row")
        var box = document.getElementById("box")
        box.scrollTop = 3000
        layout.flushFrames()
        assert.ok(renderedRows()[0] > 15, "the pass followed the scroller: " + renderedRows()[0])
        assert.equal(window.scrollY, 0)
    })
})

test("12. a table hidden at load renders from estimates, and its width report schedules exactly one pass, never inside the callback", function() {
    withTable({hidden: true}, function({table, layout}) {
        assert.equal(renderedRows().length, 41, "1800 px of area at 44 px")
        table.isHidden = false
        layout.resize(document.getElementById("table"), {})
        assert.equal(layout.flushFrames(), 0, "the report was delivered, and only scheduled the pass")
        assert.equal(renderedRows().length, 41)
        assert.equal(layout.flushFrames(), 1, "the pass")
        assert.equal(renderedRows().length, 18)
        for (var quiet = 0, frames = 0; quiet < 2 && frames < 300; frames++) { quiet = layout.flushFrames() > 0 ? 0 : quiet + 1 }
        assert.equal(layout.flushFrames(), 0, "the frames that measure the rows that were never shown run out")
    })
})

test("12. height-only reports schedule nothing, however many spacer writes a scroll through 1000 rows makes", function() {
    withTable({}, function({layout}) {
        var table = document.getElementById("table")
        for (var y = 0; y < 95000; y += 600) {
            window.scrollTo(0, y)
            layout.resize(table, {})
            assert.equal(layout.flushFrames(), 0, "y = " + y)
        }
    })
})

test("12. the report a ResizeObserver makes as it starts observing a table with padding is not a width change", function() {
    withTable({padding: 20}, function({table, layout}) {
        assert.equal(layout.flushFrames(), 0, "the content box (980) is narrower than the border box the table was measured at (1000), and the first report only records it")
        var before = table._heights.estimates.get("row")
        layout.resize(document.getElementById("table"), {})
        layout.flushFrames()
        assert.equal(layout.flushFrames(), 0, "a report that leaves the width as it was schedules nothing")
        assert.equal(table._heights.estimates.get("row"), before, "and keeps what was measured")
        layout.resize(document.getElementById("table"), {width: 700})
        layout.flushFrames()
        assert.equal(layout.flushFrames(), 1, "a real width change still does")
    })
})

test("13. a width change drops the measured heights and the estimates and measures the rendered rows again", function() {
    withTable({}, function({table, layout}) {
        var tableElement = document.getElementById("table")
        assert.equal(effectiveHeight(table._heights, 500), 95)
        for (var id of document.querySelectorAll("tr[id^=cell-]")) { id.setAttribute("data-height", "120") }
        layout.resize(tableElement, {width: 600})
        layout.flushFrames()
        layout.flushFrames()
        assert.equal(effectiveHeight(table._heights, 500), 120)
        assert.equal(effectiveHeight(table._heights, 3), 120)
        var measured = table._heights.heights.filter((height) => !Number.isNaN(height))
        assert.ok(measured.length >= renderedRows().length)
        assert.ok(measured.every((height) => height === 120), "nothing measured at the old width survived")
    })
})

test("14. a pass reads in one batch, writes, and reads once more to measure: no read comes between its writes", function() {
    withTable({estimatedRowHeight: 95}, function({table, layout}) {
        table._measureChunk = () => {}
        layout.clearLog()
        table.reloadData()
        assert.deepEqual(layout.readWriteLog(), ["read", "write", "read"])
    })
})

test("14. views unhidden while configuring are resolved before the measuring reads", function() {
    var order = []
    withTable({estimatedRowHeight: 95}, function({table, layout, model}) {
        var rectOriginal = window.Element.prototype.getBoundingClientRect
        var styleOriginal = globalThis.getComputedStyle
        window.Element.prototype.getBoundingClientRect = function() { order.push("rect"); return rectOriginal.apply(this, arguments) }
        globalThis.getComputedStyle = function() { order.push("style"); return styleOriginal.apply(this, arguments) }
        try {
            var dataSource = table.dataSource
            var ask = dataSource.tableViewCellForRowAtIndexPath
            dataSource.tableViewCellForRowAtIndexPath = function(tableView, indexPath) {
                var cell = ask.call(this, tableView, indexPath)
                cell.titleLabel.isHidden = true
                cell.titleLabel.isHidden = false
                return cell
            }
            order.length = 0
            table.reloadData()
            var firstStyle = order.indexOf("style")
            assert.ok(firstStyle > order.indexOf("rect"), "the first batch of reads came before the writes")
            assert.ok(order.indexOf("rect", firstStyle) > firstStyle, "and the measuring reads came after the unhides were resolved")
        } finally {
            window.Element.prototype.getBoundingClientRect = rectOriginal
            globalThis.getComputedStyle = styleOriginal
        }
    })
})

test("15. disposing the table releases its scroll observers on the document and the ancestor, disconnects the ResizeObserver, cancels a pending pass and removes the queue", function() {
    withTable({container: true}, function({table, layout, model}) {
        var container = document.getElementById("container")
        var reads = function(target) {
            layout.clearLog()
            target.dispatchEvent(new window.Event("scroll", {bubbles: target === document}))
            return layout.readWriteLog().filter((kind) => kind === "read").length
        }
        var observers = NotificationCenter.default._observers
        assert.equal(observers.has(table._scrollObserver), true, "the scroll listeners are registered under the table's own token")
        assert.ok(reads(document) > 0, "the table follows the document's scroll")
        assert.ok(reads(container) > 0, "and its scrolling ancestor's")
        model.count = 5
        table.reloadData()
        assert.ok(document.getElementById("table").tBodies.length > 1, "a queue exists")
        table.estimatedRowHeight = 70
        table._dispose()
        assert.equal(observers.has(table._scrollObserver), false, "NSObject's disposal only knows observers registered under the table itself, so the token is removed by the table")
        assert.equal(layout.flushFrames(), 0, "the scheduled pass was cancelled")
        assert.equal(document.getElementById("table").tBodies.length, 1, "the queue's tbody is gone")
        assert.equal(document.querySelectorAll("tr[id^=reusable-]").length, 0)
        assert.equal(reads(document), 0)
        assert.equal(reads(container), 0)
        layout.resize(document.getElementById("table"), {width: 10})
        layout.clearLog()
        layout.flushFrames()
        assert.deepEqual(layout.readWriteLog(), [], "the ResizeObserver is disconnected")
    })
})

test("a scroll step that stays inside the rendered rows reads the clip and touches no DOM", function() {
    withTable({}, function({layout}) {
        layout.clearLog()
        window.scrollTo(0, 120)
        layout.flushFrames()
        var log = layout.readWriteLog()
        assert.ok(log.length > 0, "the scroll was seen")
        assert.ok(!log.includes("write"), log.join())
        window.scrollTo(0, 4000)
        layout.clearLog()
        layout.flushFrames()
        assert.ok(layout.readWriteLog().includes("write"), "a step that leaves the rendered rows redraws the window")
    })
})

test("16. a reloadData that appends a page keeps the top spacer and the anchor row where they were, and the page is not scrolled", function() {
    withTable(mixedHeights, function(context) {
        var {table, model, layout} = context
        scrolledDown(context, 20000)
        var anchor = anchorRow()
        var topBefore = rect(anchor).top
        var spacerBefore = topSpacerHeight()
        var spy = spyScrollBy()
        try {
            model.count += 100
            table.reloadData()
            layout.flushFrames()
            layout.flushFrames()
            assert.ok(renderedRows().includes(anchor))
            assert.ok(Math.abs(rect(anchor).top - topBefore) < 0.5, "moved from " + topBefore + " to " + rect(anchor).top)
            assert.ok(Math.abs(topSpacerHeight() - spacerBefore) < 0.5, "the top spacer went from " + spacerBefore + " to " + topSpacerHeight())
            assert.equal(spy.calls.length, 0)
        } finally {
            spy.restore()
        }
    })
})

test("16. a reloadData that appends a page under native scroll anchoring leaves the page where it was and compensates nothing", function() {
    withTable(mixedHeights, function(context) {
        var {table, model, layout} = context
        scrolledDown(context, 20000)
        var anchor = anchorRow()
        var element = document.getElementById("cell-" + anchor)
        var topBefore = element.getBoundingClientRect().top
        var scrollBefore = window.scrollY
        layout.anchorTo(element)
        var spy = spyScrollBy()
        try {
            model.count += 100
            table.reloadData()
            layout.flushFrames()
            layout.flushFrames()
            assert.equal(window.scrollY, scrollBefore, "the reload wrote nothing above the anchor for the browser to take back")
            assert.ok(Math.abs(rect(anchor).top - topBefore) < 0.5)
            assert.equal(spy.calls.length, 0)
        } finally {
            spy.restore()
        }
    })
})

test("16. a reloadData of the same rows keeps the heights array and the top spacer", function() {
    withTable(mixedHeights, function(context) {
        var {table, layout} = context
        scrolledDown(context, 20000)
        var array = table._heights.heights
        var measuredBefore = measuredRows(table).length
        var spacerBefore = topSpacerHeight()
        table.reloadData()
        layout.flushFrames()
        layout.flushFrames()
        assert.equal(table._heights.heights, array, "the model was kept, not rebuilt")
        assert.ok(measuredRows(table).length >= measuredBefore)
        assert.ok(Math.abs(topSpacerHeight() - spacerBefore) < 0.5, "the top spacer went from " + spacerBefore + " to " + topSpacerHeight())
    })
})

test("16. a reloadData to fewer rows starts from the estimates again", function() {
    withTable(mixedHeights, function(context) {
        var {table, model} = context
        scrolledDown(context, 20000)
        var above = measuredAboveWindow(table)
        assert.ok(above.length > 0, "rows above the window were measured")
        model.count = 500
        table.reloadData()
        assert.equal(table._heights.count, 500)
        assert.ok(above.every((row) => Number.isNaN(table._heights.heights[row])), "none of them survived the reload")
    })
})

test("16. a new data source keeps nothing, whatever its row count", function() {
    withTable(mixedHeights, function(context) {
        var {table} = context
        scrolledDown(context, 20000)
        var above = measuredAboveWindow(table)
        assert.ok(above.length > 0, "rows above the window were measured")
        var source = table.dataSource
        table.dataSource = {
            tableViewNumberOfRowsInSection: source.tableViewNumberOfRowsInSection,
            tableViewCellForRowAtIndexPath: source.tableViewCellForRowAtIndexPath,
        }
        assert.equal(table._heights.count, 1000)
        assert.ok(above.every((row) => Number.isNaN(table._heights.heights[row])), "none of them survived the new data source")
    })
})

test("16. the rows before the old end keep their offset when a page is appended", function() {
    withTable(mixedHeights, function(context) {
        var {table, model, layout} = context
        scrolledDown(context, 20000)
        var oldCount = model.count
        var before = offsetOf(table._heights, oldCount)
        model.count += 100
        table.reloadData()
        settle(layout)
        assert.equal(table._heights.count, oldCount + 100)
        assert.equal(offsetOf(table._heights, oldCount), before, "the document's height up to the appended page is what it was")
    })
})
