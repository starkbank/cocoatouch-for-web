import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UILabel, UITableView, UITableViewCell, IBOutlet, NotificationCenter } from "../src/index.js"


class PickCell extends UITableViewCell {}
PickCell.nib = "<tr><td id=\"title\"><span id=\"inner\"></span></td></tr>"
IBOutlet("#title", UILabel)(PickCell.prototype, "titleLabel", {})

function setup({rows = 3, delegate} = {}) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(PickCell, {forCellReuseIdentifier: "pick"})
    var log = {calls: []}
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => rows,
        tableViewCellForRowAtIndexPath: (tableView, indexPath) => tableView.dequeueReusableCell({withIdentifier: "pick", for: indexPath}),
    }
    table.delegate = delegate || {
        tableViewDidSelectRowAtIndexPath(tableView, indexPath) { log.calls.push("select:" + indexPath.row) },
        tableViewDidDeselectRowAtIndexPath(tableView, indexPath) { log.calls.push("deselect:" + indexPath.row) },
    }
    table.reloadData()
    return {table, log}
}

function tap(selector) {
    document.querySelector(selector).dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

function selectedRows() {
    return Array.from(document.querySelectorAll("#table tr.selected")).map((row) => row.id)
}


test("in single selection a tap selects the row: the framework draws selected on it and the table reports it", function() {
    var {table, log} = setup()
    tap("#cell-1 #title")
    assert.deepEqual(log.calls, ["select:1"])
    assert.deepEqual(selectedRows(), ["cell-1"])
    assert.equal(table.indexPathForSelectedRow.row, 1)
})

test("a tap on another row sends didDeselect to the row selected before, then didSelect, and the selected mark moves", function() {
    var {table, log} = setup()
    tap("#cell-0 #title")
    log.calls.length = 0
    tap("#cell-2 #title")
    assert.deepEqual(log.calls, ["deselect:0", "select:2"])
    assert.deepEqual(selectedRows(), ["cell-2"])
    assert.deepEqual(table.indexPathsForSelectedRows.map((path) => path.row), [2])
})

test("the mark has moved by the time each delegate method runs", function() {
    var seen = []
    setup({delegate: {
        tableViewDidSelectRowAtIndexPath(tableView, indexPath) { seen.push(["select", indexPath.row, selectedRows()]) },
        tableViewDidDeselectRowAtIndexPath(tableView, indexPath) { seen.push(["deselect", indexPath.row, selectedRows()]) },
    }})
    tap("#cell-0 #title")
    tap("#cell-1 #title")
    assert.deepEqual(seen, [
        ["select", 0, ["cell-0"]],
        ["deselect", 0, ["cell-1"]],
        ["select", 1, ["cell-1"]],
    ])
})

test("a tap on the row already selected sends didSelect again and no didDeselect, as Apple's does", function() {
    var {log} = setup()
    tap("#cell-1 #title")
    log.calls.length = 0
    tap("#cell-1 #title")
    assert.deepEqual(log.calls, ["select:1"])
    assert.deepEqual(selectedRows(), ["cell-1"])
})

test("a delegate without didDeselect, or none, still moves the selection", function() {
    var {table} = setup({delegate: {}})
    tap("#cell-0 #title")
    tap("#cell-1 #title")
    assert.deepEqual(selectedRows(), ["cell-1"])
    table.delegate = null
    tap("#cell-2 #title")
    assert.deepEqual(selectedRows(), ["cell-2"])
})

test("allowsSelection false selects nothing and calls nothing", function() {
    var {table, log} = setup()
    table.allowsSelection = false
    tap("#cell-0 #title")
    assert.deepEqual(log.calls, [])
    assert.deepEqual(selectedRows(), [])
})

test("programmatic selectRow calls no delegate method and a later tap deselects it as any selected row", function() {
    var {table, log} = setup()
    table.selectRow({at: 0, animated: false, scrollPosition: "none"})
    assert.deepEqual(log.calls, [])
    tap("#cell-1 #title")
    assert.deepEqual(log.calls, ["deselect:0", "select:1"])
})


function scroll(element) {
    element.dispatchEvent(new window.Event("scroll"))
}

test("a table's delegate receives scrollViewDidScroll with the table, as a scroll view's does", function() {
    var received = []
    var {table} = setup({delegate: {scrollViewDidScroll(sender) { received.push(sender) }}})
    scroll(table.$el[0])
    scroll(table.$el[0])
    assert.deepEqual(received, [table, table])
    assert.equal(table.delegate.scrollViewDidScroll.length, 1)
})

test("replacing the table's delegate moves the scroll observation, and null ends it", function() {
    var first = []
    var second = []
    var {table} = setup({delegate: {scrollViewDidScroll() { first.push(1) }}})
    table.delegate = {scrollViewDidScroll() { second.push(1) }}
    scroll(table.$el[0])
    assert.deepEqual([first.length, second.length], [0, 1])
    table.delegate = null
    scroll(table.$el[0])
    assert.deepEqual([first.length, second.length], [0, 1])
    assert.equal(table.delegate, null)
})

test("a table delegate with only row methods observes no scroll, and the observer goes with the table's disposal", function() {
    var {table} = setup()
    var count = 0
    table.delegate = {scrollViewDidScroll() { count += 1 }}
    NotificationCenter.default.removeObserver(table)
    scroll(table.$el[0])
    assert.equal(count, 0)
})

test("a table delegate that still has a retired method name is refused before it is kept", function() {
    var {table} = setup()
    var kept = table.delegate
    assert.throws(() => { table.delegate = {scrollViewDidScroll() {}, tableViewCommitEditingStyleForRowAt() {}} }, TypeError)
    assert.equal(table.delegate, kept)
})
