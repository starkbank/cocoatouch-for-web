import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIButton, UISwitch, UITextField, UIControlEvent, UITableView, UITableViewCell, IndexPath, UITapGestureRecognizer, UITableViewScrollPosition, UITableViewCellEditingStyle } from "../src/index.js"


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

test("a table view delegate carrying the retired commit name is refused, and the new name receives the editing style", function() {
    var setup = tableWithRows(2)
    assert.throws(() => { setup.table.delegate = {tableViewCommitEditingStyleForRowAt: function() {}} }, (error) => error instanceof TypeError && /tableViewCommitEditingStyleForRowAtIndexPath/.test(error.message) && /in cocoatouch 1\.6\.0;/.test(error.message))
    var committed = []
    setup.table.delegate = {tableViewCommitEditingStyleForRowAtIndexPath: function(tableView, editingStyle, indexPath) { committed.push([editingStyle, indexPath.row]) }}
    $("#cell-1").append("<button id=\"delete-button-1\"></button>")
    setup.table.setEditing(true, {animated: false})
    $("#delete-button-1").trigger("click")
    assert.deepEqual(committed, [["delete", 1]])
})

test("the commit hook receives UITableViewCellEditingStyle.delete, also spelled UITableViewCell.EditingStyle.delete", function() {
    var setup = tableWithRows(1)
    var committed = []
    setup.table.delegate = {tableViewCommitEditingStyleForRowAtIndexPath: function(tableView, editingStyle, indexPath) { committed.push(editingStyle) }}
    $("#cell-0").append("<button id=\"delete-button-0\"></button>")
    setup.table.setEditing(true, {animated: false})
    $("#delete-button-0").trigger("click")
    assert.deepEqual(committed, [UITableViewCellEditingStyle.delete])
    assert.equal(UITableViewCell.EditingStyle, UITableViewCellEditingStyle)
    assert.deepEqual(Object.keys(UITableViewCellEditingStyle).sort(), ["delete", "insert", "none"])
    assert.ok(Object.isFrozen(UITableViewCellEditingStyle))
})


class ControlCell extends UITableViewCell {}
ControlCell.nib = "<tr><td id=\"title\"></td><td><button id=\"save\"><svg id=\"icon\"><path id=\"glyph\"></path></svg><span id=\"caption\">Save</span></button><button id=\"bare\"><svg id=\"bareIcon\"><path id=\"bareGlyph\"></path></svg><span id=\"bareCaption\">Open</span></button><input id=\"toggle\" type=\"checkbox\"><input id=\"field\" type=\"text\"></td></tr>"
IBOutlet("#title", UILabel)(ControlCell.prototype, "titleLabel", {})
IBOutlet("#save", UIButton)(ControlCell.prototype, "saveButton", {})
IBOutlet("#bare", UIButton)(ControlCell.prototype, "bareButton", {})
IBOutlet("#toggle", UISwitch)(ControlCell.prototype, "toggleSwitch", {})
IBOutlet("#field", UITextField)(ControlCell.prototype, "nameField", {})

function tableWithControlCells() {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(ControlCell, {forCellReuseIdentifier: "control"})
    var log = {selected: [], pressed: []}
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return 1 },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "control", for: indexPath})
            if (!cell.wired) {
                cell.wired = true
                cell.saveButton.addTarget(cell, {action: function() { log.pressed.push(indexPath.row) }, for: UIControlEvent.touchUpInside})
            }
            return cell
        }
    }
    table.delegate = {tableViewDidSelectRowAtIndexPath: function(tableView, indexPath) { log.selected.push(indexPath.row) }}
    return {table: table, log: log}
}

function click(selector) {
    document.querySelector(selector).dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

test("a click on a UIButton in a cell fires the button's action and does not select the row", function() {
    var setup = tableWithControlCells()
    click("#save")
    assert.deepEqual(setup.log.pressed, [0])
    assert.deepEqual(setup.log.selected, [])
})

test("a click on a UISwitch or a UITextField in a cell does not select the row", function() {
    var setup = tableWithControlCells()
    click("#toggle")
    click("#field")
    assert.deepEqual(setup.log.selected, [])
})

test("a click on a UIButton with no touchUpInside target does not select the row", function() {
    var setup = tableWithControlCells()
    click("#bare")
    assert.deepEqual(setup.log.selected, [])
})

test("a click on an element nested in a UIButton counts as inside the control", function() {
    var setup = tableWithControlCells()
    click("#bareCaption")
    click("#bareIcon")
    click("#bareGlyph")
    click("#caption")
    click("#icon")
    click("#glyph")
    assert.deepEqual(setup.log.pressed, [0, 0, 0])
    assert.deepEqual(setup.log.selected, [])
})

test("a click elsewhere in the cell still selects the row", function() {
    var setup = tableWithControlCells()
    click("#title")
    click("#cell-0")
    assert.deepEqual(setup.log.selected, [0, 0])
})

test("a control click leaves the row unhighlighted and a label click still selects it with allowsSelection", function() {
    var setup = tableWithControlCells()
    click("#save")
    assert.equal(setup.table.indexPathForSelectedRow, null)
    setup.table.allowsSelection = false
    click("#title")
    assert.deepEqual(setup.log.selected, [])
})

test("a plain button no view owns still selects the row, as it is not a UIControl", function() {
    var setup = tableWithControlCells()
    $("#cell-0 td").first().append("<button id=\"plain\"></button>")
    click("#plain")
    assert.deepEqual(setup.log.selected, [0])
})
