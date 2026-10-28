import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { setup, renderedRows, scrollTo, at } from "./tableReuseHelpers.js"
import { UITableViewRowAnimation } from "../src/index.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

// A table in a scroller that starts below the viewport: the viewport and the scroller have nothing in common, so the clip is empty,
// but the rows one clip height below the viewport are in the area.
var below = {top: 1000, box: {top: 1000, height: 600}}

test("F13. a table that starts below the fold, within one clip height of it, has its first rows after load", function() {
    withTable(below, function({table}) {
        var rows = renderedRows()
        assert.ok(rows.length > 0, "rows at load")
        assert.equal(rows[0], 0)
        assert.equal(table.visibleCells.length, rows.length)
    })
})

test("F13. a forced pass with an empty clip does not empty the window it has just filled, and a later one keeps it", function() {
    withTable(below, function({table, layout}) {
        var before = renderedRows()
        assert.ok(before.length > 0)
        table.reconfigureRows({at: at(0)})
        assert.deepEqual(renderedRows(), before)
        table.insertRows({at: [], with: UITableViewRowAnimation.none})
        layout.flushFrames()
        assert.deepEqual(renderedRows(), before)
    })
})
