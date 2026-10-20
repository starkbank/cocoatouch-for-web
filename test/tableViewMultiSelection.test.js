import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIButton, UILabel, UITableView, UITableViewCell, UIControlEvent, IndexPath } from "../src/index.js"


class PickCell extends UITableViewCell {}
PickCell.nib = "<tr><td id=\"table-cell-selected\"><input type=\"checkbox\"></td><td id=\"title\"><span id=\"inner\"></span></td><td><button id=\"open\">open</button></td></tr>"
IBOutlet("#title", UILabel)(PickCell.prototype, "titleLabel", {})
IBOutlet("#open", UIButton)(PickCell.prototype, "openButton", {})

function setup({multiple, rows = 3} = {}) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(PickCell, {forCellReuseIdentifier: "pick"})
    var log = {calls: [], pressed: 0}
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => rows,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "pick", for: indexPath})
            if (!cell.wired) {
                cell.wired = true
                cell.openButton.addTarget(cell, {action() { log.pressed += 1 }, for: UIControlEvent.touchUpInside})
            }
            return cell
        },
    }
    table.delegate = {
        tableViewDidSelectRowAtIndexPath(tableView, indexPath) { log.calls.push("select:" + indexPath.row) },
        tableViewDidDeselectRowAtIndexPath(tableView, indexPath) { log.calls.push("deselect:" + indexPath.row) },
    }
    if (multiple !== undefined) { table.allowsMultipleSelection = multiple }
    table.reloadData()
    return {table, log}
}

function tap(selector) {
    document.querySelector(selector).dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

function selectedRows(table) {
    return (table.indexPathsForSelectedRows || []).map((indexPath) => indexPath.row)
}

function checked(row) {
    return document.querySelector("#cell-" + row + " input[type=checkbox]").checked
}

test("multiple selection: a tap on an unselected row selects it and calls didSelect once", function() {
    var {table, log} = setup({multiple: true})
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(table), [1])
    assert.deepEqual(log.calls, ["select:1"])
    assert.equal(checked(1), true, "the selection checkbox follows")
    assert.equal(document.querySelector("#cell-1").classList.contains("selected"), true)
})

test("multiple selection: a tap on a selected row deselects it and calls didDeselect once", function() {
    var {table, log} = setup({multiple: true})
    tap("#cell-1 #title")
    log.calls.length = 0
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(table), [])
    assert.deepEqual(log.calls, ["deselect:1"])
    assert.equal(checked(1), false)
    assert.equal(document.querySelector("#cell-1").classList.contains("selected"), false)
})

test("multiple selection keeps several rows, and a tap on an element nested in a row counts as a tap on the row", function() {
    var {table, log} = setup({multiple: true})
    tap("#cell-0 #title")
    tap("#cell-2 #inner")
    tap("#cell-0 #title")
    assert.deepEqual(selectedRows(table), [2])
    assert.deepEqual(log.calls, ["select:0", "select:2", "deselect:0"])
})

test("the selection checkbox behaves as before: ticking selects and calls didSelect, unticking deselects and calls didDeselect", function() {
    var {table, log} = setup({multiple: true})
    var box = document.querySelector("#cell-1 input[type=checkbox]")
    box.checked = true
    box.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(selectedRows(table), [1])
    box.checked = false
    box.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(selectedRows(table), [])
    assert.deepEqual(log.calls, ["select:1", "deselect:1"])
})

test("a tap and a tick leave the same selection: a ticked row is deselected by a tap, and a tapped row by an untick", function() {
    var {table, log} = setup({multiple: true})
    var box = document.querySelector("#cell-1 input[type=checkbox]")
    box.checked = true
    box.dispatchEvent(new window.Event("change", {bubbles: true}))
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(table), [])
    assert.equal(box.checked, false)
    tap("#cell-1 #title")
    assert.equal(box.checked, true)
    box.checked = false
    box.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(selectedRows(table), [])
    assert.deepEqual(log.calls, ["select:1", "deselect:1", "select:1", "deselect:1"])
})

test("single selection is unchanged: a tap only calls didSelect, every time, and selects nothing", function() {
    var {table, log} = setup({multiple: false})
    tap("#cell-1 #title")
    tap("#cell-1 #title")
    assert.deepEqual(log.calls, ["select:1", "select:1"])
    assert.deepEqual(selectedRows(table), [])
    var fresh = setup()
    tap("#cell-0 #title")
    assert.deepEqual(fresh.log.calls, ["select:0"])
})

test("a tap inside a nested control still does nothing, in either mode", function() {
    for (var multiple of [true, false]) {
        var {table, log} = setup({multiple})
        tap("#cell-1 #open")
        assert.deepEqual(log.calls, [], String(multiple))
        assert.deepEqual(selectedRows(table), [], String(multiple))
        assert.equal(log.pressed, 1, String(multiple))
    }
})

test("allowsSelection false stops a tap in multiple mode too", function() {
    var {table, log} = setup({multiple: true})
    table.allowsSelection = false
    tap("#cell-1 #title")
    assert.deepEqual(log.calls, [])
    assert.deepEqual(selectedRows(table), [])
})

test("programmatic selectRow and deselectRow still call no delegate method", function() {
    var {table, log} = setup({multiple: true})
    table.selectRow({at: new IndexPath({row: 0}), animated: false, scrollPosition: "none"})
    table.deselectRow({at: new IndexPath({row: 0}), animated: false})
    assert.deepEqual(log.calls, [])
})

test("a delegate with neither method, or none, lets a tap toggle the selection all the same", function() {
    var {table} = setup({multiple: true})
    table.delegate = {}
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(table), [1])
    table.delegate = null
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(table), [])
})

test("switching multiple selection off leaves the rows selected, as Apple's does, and a tap is then a plain select", function() {
    var {table, log} = setup({multiple: true})
    tap("#cell-0 #title")
    table.allowsMultipleSelection = false
    log.calls.length = 0
    tap("#cell-0 #title")
    assert.deepEqual(log.calls, ["select:0"])
    assert.deepEqual(selectedRows(table), [0])
})
