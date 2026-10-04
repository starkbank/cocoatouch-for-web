import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableView, UITableViewCell, IndexPath, UITapGestureRecognizer, UITableViewScrollPosition } from "../src/index.js"


var reuses = []

class RowCell extends UITableViewCell {
    prepareForReuse() { reuses.push(this) }
}
RowCell.nib = "<tr><td id=\"title\"></td></tr>"
IBOutlet("#title", UILabel)(RowCell.prototype, "titleLabel", {})

function tableWithRows(count) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(RowCell, {forCellReuseIdentifier: "row"})
    var dequeued = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return count },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            cell.titleLabel.text = "Row " + indexPath.row
            dequeued.push(cell)
            return cell
        }
    }
    return {table: table, dequeued: dequeued}
}

test("ten reloads of five rows leave five cells in subviews, not fifty", function() {
    reuses.length = 0
    var setup = tableWithRows(5)
    for (var i = 0; i < 9; i++) { setup.table.reloadData() }
    assert.equal(setup.dequeued.length, 50)
    assert.equal(setup.table.subviews.length, 5)
    assert.equal($("#table tbody > tr").length, 5)
})

test("the cell object for a row is reused across reloads and told to prepare for it", function() {
    reuses.length = 0
    var setup = tableWithRows(5)
    var first = setup.table.cellForRow({at: new IndexPath({row: 0})})
    assert.ok(first instanceof RowCell)
    for (var i = 0; i < 9; i++) { setup.table.reloadData() }
    assert.equal(setup.table.cellForRow({at: new IndexPath({row: 0})}), first)
    assert.equal(setup.dequeued.filter((cell) => cell === first).length, 10)
    assert.equal(reuses.filter((cell) => cell === first).length, 9)
    assert.equal(first.titleLabel.$el.text(), "Row 0")
    assert.equal(first.titleLabel.$el.length, 1)
})

test("a reload with fewer rows releases the cells that left", function() {
    reuses.length = 0
    var setup = tableWithRows(5)
    var last = setup.table.cellForRow({at: new IndexPath({row: 4})})
    setup.table.dataSource.tableViewNumberOfRowsInSection = function() { return 2 }
    setup.table.reloadData()
    assert.equal(setup.table.subviews.length, 2)
    assert.equal(setup.table.subviews.indexOf(last), -1)
    assert.equal(setup.table.cellForRow({at: new IndexPath({row: 4})}), null)
    assert.equal($("#table tbody > tr").length, 2)
})

test("a tap recognizer added to a cell in cellForRowAt fires, and still fires after reloadData", function() {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(RowCell, {forCellReuseIdentifier: "row"})
    var taps = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return 2 },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            if (!cell.tap) {
                cell.tap = new UITapGestureRecognizer({target: cell, action: function() { taps.push(indexPath.row) }})
                cell.addGestureRecognizer(cell.tap)
            }
            return cell
        }
    }
    $("#cell-1").trigger("click")
    assert.deepEqual(taps, [1])
    table.reloadData()
    table.setEditing(true, {animated: false})
    $("#cell-1").trigger("click")
    $("#cell-0").trigger("click")
    assert.deepEqual(taps, [1, 1, 0])
})

// jsdom lays nothing out and has no scrollIntoView, so the row is given one
// that records how it was asked to scroll: Apple's position maps to the block.
test("scrollPosition scrolls the selected row into view, and .none does not", function() {
    var setup = tableWithRows(5)
    var asked = []
    for (var row of $("#table tbody > tr").get()) { row.scrollIntoView = function(options) { asked.push([this.id, options.block]) } }
    setup.table.selectRow({at: new IndexPath({row: 3}), animated: false, scrollPosition: UITableViewScrollPosition.top})
    assert.deepEqual(asked, [["cell-3", "start"]])
    setup.table.selectRow({at: new IndexPath({row: 4}), animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.deepEqual(asked, [["cell-3", "start"]])
    setup.table.selectRow({at: new IndexPath({row: 1}), animated: false, scrollPosition: UITableViewScrollPosition.middle})
    setup.table.selectRow({at: new IndexPath({row: 2}), animated: false, scrollPosition: UITableViewScrollPosition.bottom})
    assert.deepEqual(asked.slice(1), [["cell-1", "center"], ["cell-2", "end"]])
})

test("selectRow(at: null) clears the selection", function() {
    var setup = tableWithRows(3)
    setup.table.selectRow({at: new IndexPath({row: 2}), animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.equal(setup.table.indexPathForSelectedRow.row, 2)
    setup.table.selectRow({at: null, animated: false, scrollPosition: UITableViewScrollPosition.none})
    assert.equal(setup.table.indexPathForSelectedRow, null)
    assert.equal($("#table tbody > tr.selected").length, 0)
})
