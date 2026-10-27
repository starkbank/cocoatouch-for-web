import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITableViewScrollPosition, UITableViewRowAnimation } from "../src/index.js"
import { counters, setup, renderedIds, renderedRows, scrollTo, at } from "./tableReuseHelpers.js"


var none = UITableViewScrollPosition.none
var animation = UITableViewRowAnimation.none

function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

test("insertRows above the window only renumbers: the cells keep their elements and at most one row comes in at the top", function() {
    withTable({}, function({table, model, layout}) {
        scrollTo(layout, 50000)
        model.asked.length = 0
        var rows = renderedRows()
        var cells = table.visibleCells.slice()
        model.count = 1001
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

test("reconfigureRows hands the row's cell back without prepareForReuse", function() {
    withTable({}, function({table, model}) {
        counters.prepared = 0
        var cell = table.cellForRow({at: 3})
        table.reconfigureRows({at: at(3)})
        assert.equal(table.cellForRow({at: 3}), cell)
        assert.equal(counters.prepared, 0)
    })
})

test("reconfigureRows asks again for the rows that have a cell and ignores the rows that have none", function() {
    withTable({}, function({table, model}) {
        model.asked.length = 0
        table.reconfigureRows({at: at(3, 700)})
        assert.deepEqual(model.asked, [3])
    })
})
