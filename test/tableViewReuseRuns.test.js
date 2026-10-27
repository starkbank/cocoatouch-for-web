import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { setup, rowsBody, renderedRows, scrollTo, Row } from "./tableReuseHelpers.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

function observeRows() {
    var observer = new window.MutationObserver(() => {})
    observer.observe(rowsBody(), {childList: true})
    return observer
}

function enteringRuns(observer) {
    return observer.takeRecords()
        .map((record) => Array.from(record.addedNodes).filter((node) => /^cell-/.test(node.id)).map((node) => node.id))
        .filter((ids) => ids.length > 0)
}

test("a scroll pass that brings rows into view writes them with one record per run", function() {
    withTable({}, function({layout}) {
        var observer = observeRows()
        scrollTo(layout, 1900)
        var runs = enteringRuns(observer)
        observer.disconnect()
        assert.equal(runs.length, 1, "one run of rows: " + JSON.stringify(runs))
        assert.ok(runs[0].length > 5, "the rows that entered: " + runs[0].length)
        var rows = runs[0].map((id) => Number(id.slice(5)))
        assert.deepEqual(rows, rows.slice().sort((a, b) => a - b))
        assert.equal(rows[rows.length - 1] - rows[0], rows.length - 1, "contiguous")
    })
})

test("the rows a reload brings into an emptied table join it as one run", function() {
    withTable({count: 0}, function({table, model}) {
        var observer = observeRows()
        model.count = 500
        table.reloadData()
        var runs = enteringRuns(observer)
        observer.disconnect()
        assert.equal(runs.length, 1, JSON.stringify(runs))
        assert.equal(runs[0].length, renderedRows().length)
    })
})

test("a queued cell is configured where it waits, in the document and outside the rows", function() {
    var seen = []
    class Probe extends Row {
        prepareForReuse() {
            super.prepareForReuse()
            var element = this._$el[0]
            seen.push({id: element.id, connected: element.isConnected, inRows: element.parentNode === rowsBody()})
        }
    }
    withTable({}, function({table, layout}) {
        table.register(Probe, {forCellReuseIdentifier: "row"})
        table.reloadData()
        layout.flushFrames()
        seen.length = 0
        scrollTo(layout, 1900)
        seen = seen.filter((entry) => !/^reusable-/.test(entry.id))
        assert.ok(seen.length > 5, "cells were reused: " + seen.length)
        assert.ok(seen.every((entry) => entry.connected), "connected: " + JSON.stringify(seen[0]))
        assert.ok(seen.every((entry) => !entry.inRows), "not yet in the rows: " + JSON.stringify(seen[0]))
        assert.ok(seen.every((entry) => /^cell-\d+$/.test(entry.id)), "renumbered to its row before prepareForReuse: " + seen[0].id)
        assert.ok(renderedRows().length > 0)
    })
})

test("a pass that changes nothing writes nothing, and a window moved by a scroll step inside the rows touches nothing", function() {
    withTable({}, function({layout}) {
        var observer = observeRows()
        scrollTo(layout, 20)
        assert.deepEqual(enteringRuns(observer), [])
        assert.equal(observer.takeRecords().length, 0)
        observer.disconnect()
    })
})
