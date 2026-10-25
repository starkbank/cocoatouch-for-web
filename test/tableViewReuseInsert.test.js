import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UITableViewScrollPosition, UITableViewRowAnimation } from "../src/index.js"
import { counters, setup, renderedIds, renderedRows, scrollTo, at } from "./tableReuseHelpers.js"


var none = UITableViewScrollPosition.none
var animation = UITableViewRowAnimation.none

function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

test("insertRows below the area asks the data source for nothing, and above it only renumbers", function() {
    withTable({}, function({table, model, layout}) {
        model.asked.length = 0
        var before = table.visibleCells.slice()
        model.count = 1100
        table.insertRows({at: at(...Array.from({length: 100}, (_, i) => 1000 + i)), with: animation})
        assert.deepEqual(model.asked, [])
        assert.deepEqual(table.visibleCells, before)
        scrollTo(layout, 50000)
        model.asked.length = 0
        var rows = renderedRows()
        var cells = table.visibleCells.slice()
        model.count = 1101
        table.insertRows({at: at(10), with: animation})
        assert.ok(model.asked.length <= 1, "the inserted row pushes the content down, so at most one more row comes in at the top: " + model.asked)
        assert.ok(!model.asked.includes(10))
        for (var i = 0; i < cells.length - 1; i++) {
            assert.equal(table.cellForRow({at: rows[i] + 1}), cells[i], "the cell of row " + rows[i] + " is now row " + (rows[i] + 1) + "'s")
        }
    })
})

test("insertRows inside the window asks only the inserted rows and shifts the rows after them, selection included", function() {
    withTable({}, function({table, model}) {
        table.selectRow({at: 7, animated: false, scrollPosition: none})
        model.asked.length = 0
        var before = table.visibleCells.slice(0, 18)
        model.count = 1002
        table.insertRows({at: at(5, 9), with: animation})
        assert.deepEqual(model.asked.filter((row) => row === 5 || row === 9).sort(), [5, 9])
        assert.ok(model.asked.every((row) => row === 5 || row === 9 || row >= 18), "rows already drawn are not asked again: " + model.asked)
        var ids = renderedIds()
        assert.deepEqual(ids.slice(0, 12), Array.from({length: 12}, (_, row) => "cell-" + row))
        assert.equal(table.cellForRow({at: 6}), before[5], "the row that was 5 is now 6")
        assert.deepEqual(table.indexPathsForSelectedRows.map((indexPath) => indexPath.row), [8])
        assert.equal(document.querySelectorAll("tr.selected").length, 1)
        assert.equal(table.cellForRow({at: 8}).isSelected, true)
        var all = Array.from(document.querySelectorAll("tr[id]")).map((element) => element.id).filter((id) => /^(cell|reusable)-/.test(id))
        assert.equal(new Set(all).size, all.length)
    })
})

test("reconfigureRows asks again for the rows that have a cell, without prepareForReuse, and ignores the others", function() {
    withTable({}, function({table, model}) {
        model.asked.length = 0
        counters.prepared = 0
        var cell = table.cellForRow({at: 3})
        table.reconfigureRows({at: at(3, 700)})
        assert.deepEqual(model.asked, [3])
        assert.equal(table.cellForRow({at: 3}), cell)
        assert.equal(counters.prepared, 0)
    })
})

test("a view added to a cell in code is renamed with the row, so the next cell for that row never meets a duplicate id", function() {
    withTable({}, function({table, model, layout}) {
        class Badge extends UIView {}
        Badge.nib = "<span></span>"
        var made = []
        var ask = model.onAsk
        model.onAsk = function(row, cell) {
            if (row !== 3 || made.length > 0) { return }
            var badge = new Badge()
            cell.addSubview(badge)
            made.push(badge._$el[0])
        }
        table.reloadData()
        assert.equal(made[0].id, "cell-3-1")
        scrollTo(layout, 50000)
        assert.ok(made[0].id.startsWith(made[0].closest("tr").id + "-"), made[0].id + " in " + made[0].closest("tr").id)
        scrollTo(layout, 0)
        assert.ok(made[0].id.startsWith(made[0].closest("tr").id + "-"), made[0].id + " in " + made[0].closest("tr").id)
        var ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id).filter((id) => /^(cell|reusable)-/.test(id))
        assert.equal(new Set(ids).size, ids.length, "no two framework ids are the same")
        assert.ok(ask === null)
    })
})
