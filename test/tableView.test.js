import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableView, UITableViewCell, IndexPath } from "../src/index.js"


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
