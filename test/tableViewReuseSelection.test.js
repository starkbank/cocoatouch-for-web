import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITableViewScrollPosition, IndexPath } from "../src/index.js"
import { counters, setup, rowsBody, renderedIds, renderedRows, scrollTo, click } from "./tableReuseHelpers.js"


var none = UITableViewScrollPosition.none

function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

function selectedRows(table) {
    return table.indexPathsForSelectedRows.map((indexPath) => indexPath.row)
}

function checked(row) {
    return document.querySelector("#cell-" + row + " input").checked
}

test("7. a selected row's queued cell is not drawn selected, and neither is the row the cell serves next", function() {
    withTable({}, function({table, layout, model}) {
        var x = table.cellForRow({at: 3})
        table.selectRow({at: 3, animated: false, scrollPosition: none})
        assert.equal(x.isSelected, true)
        assert.equal(checked(3), true)
        var atFirstAsk = null
        model.onAsk = function(row) {
            if (atFirstAsk !== null) { return }
            atFirstAsk = {
                isSelected: x.isSelected,
                id: x._$el[0].id,
                checked: x._$el[0].querySelector("input").checked,
                selectedRows: document.querySelectorAll("tbody > tr.selected").length,
                rows: selectedRows(table),
            }
        }
        scrollTo(layout, 30000)
        assert.match(atFirstAsk.id, /^reusable-/, "X was queued when the first new row was asked")
        assert.equal(atFirstAsk.isSelected, false)
        assert.equal(atFirstAsk.checked, false)
        assert.equal(atFirstAsk.selectedRows, 0, "tbody > tr.selected counts only rendered selected rows")
        assert.deepEqual(atFirstAsk.rows, [3])
        assert.equal(document.querySelectorAll("tr.selected").length, 0, "no row it serves is drawn selected")
        assert.equal(document.querySelectorAll("tr[id^=cell-] input:checked").length, 0)
        assert.deepEqual(selectedRows(table), [3])
        model.onAsk = null
        scrollTo(layout, 0)
        assert.equal(table.cellForRow({at: 3}).isSelected, true)
        assert.equal(checked(3), true)
        assert.equal(document.querySelectorAll("tr.selected").length, 1)
        assert.deepEqual(selectedRows(table), [3])
    })
})

test("7. selectRow on an unrendered row with .top scrolls it to the top and draws it selected; with .none it only records", function() {
    withTable({}, function({table, layout}) {
        table.selectRow({at: 700, animated: false, scrollPosition: UITableViewScrollPosition.top})
        var row = document.getElementById("cell-700")
        assert.ok(row)
        assert.ok(Math.abs(row.getBoundingClientRect().top) < 0.5)
        assert.equal(row.classList.contains("selected"), true)
        assert.equal(checked(700), true)
        table.allowsMultipleSelection = true
        var scrollY = window.scrollY
        table.selectRow({at: 900, animated: false, scrollPosition: none})
        assert.equal(window.scrollY, scrollY)
        assert.equal(table.cellForRow({at: 900}), null)
        assert.deepEqual(selectedRows(table), [700, 900])
        table.scrollToRow(900, {at: UITableViewScrollPosition.top, animated: false})
        assert.equal(document.getElementById("cell-900").classList.contains("selected"), true)
        assert.equal(checked(900), true)
    })
})

test("7. selection indexes are kept as numbers, getters keep their order, and a reload drops rows that no longer exist", function() {
    withTable({}, function({table, model}) {
        table.allowsMultipleSelection = true
        table.selectRow({at: 7, animated: false, scrollPosition: none})
        table.selectRow({at: 2, animated: false, scrollPosition: none})
        assert.deepEqual(selectedRows(table), [7, 2])
        assert.equal(table.indexPathForSelectedRow.row, 7)
        model.count = 5
        table.reloadData()
        assert.deepEqual(selectedRows(table), [2])
    })
})

test("8. a click, a delete and a checkbox on a reused cell report the row it now shows", function() {
    withTable({}, function({table, layout, model}) {
        var events = []
        table.delegate.tableViewDidSelectRowAtIndexPath = (tableView, indexPath) => events.push("select:" + indexPath.row)
        table.delegate.tableViewDidDeselectRowAtIndexPath = (tableView, indexPath) => events.push("deselect:" + indexPath.row)
        table.delegate.tableViewCommitEditingStyleForRowAtIndexPath = (tableView, style, indexPath) => events.push(style + ":" + indexPath.row)
        scrollTo(layout, 30000)
        var row = renderedRows()[4]
        click(document.getElementById("cell-" + row))
        table.setEditing(true, {animated: false})
        click(document.querySelector("#cell-" + row + " [id^=delete-button]"))
        var box = document.querySelector("#cell-" + row + " input")
        box.checked = false
        box.dispatchEvent(new window.Event("change", {bubbles: true}))
        assert.deepEqual(events, ["select:" + row, "delete:" + row, "deselect:" + row])
    })
})

test("15b. a cell created while not editing sits in the queue; setEditing(true), then a reuse for row 40 reports row 40", function() {
    withTable({}, function({table, layout}) {
        var events = []
        table.delegate.tableViewCommitEditingStyleForRowAtIndexPath = (tableView, style, indexPath) => events.push(indexPath.row)
        assert.ok(document.querySelectorAll("tr[id^=reusable-]").length > 0, "cells made at the first, estimated pass wait in the queue")
        table.setEditing(true, {animated: false})
        counters.constructed = 0
        scrollTo(layout, 40 * 95 - 100)
        assert.ok(document.getElementById("cell-40"))
        click(document.querySelector("#cell-40 [id^=delete-button]"))
        assert.deepEqual(events, [40])
        assert.equal(counters.constructed, 0, "the cell came from the queue")
        for (var spacer of Array.from(rowsBody().children).filter((element) => element.id === "")) {
            click(spacer)
        }
        assert.deepEqual(events, [40], "spacers have no handlers")
    })
})
