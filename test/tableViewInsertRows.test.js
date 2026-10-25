import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIView, UITableView, UITableViewCell, IndexPath, UITableViewCellEditingStyle } from "../src/index.js"
import * as framework from "../src/index.js"


var reuses = []

class Row extends UITableViewCell {
    prepareForReuse() { reuses.push(this) }
}
Row.nib = "<tr><td id=\"table-cell-selected\"><input type=\"checkbox\"></td><td id=\"amount\"></td><td><span class=\"item\"></span><span class=\"item\"></span></td><td><button id=\"delete-button\"></button></td></tr>"
IBOutlet("#amount", UILabel)(Row.prototype, "amountLabel", {})
IBOutlet(".item", [UIView])(Row.prototype, "items", {})

class NestedRow extends UITableViewCell {}
NestedRow.nib = "<tr><td><table><tbody><tr><td class=\"inner\"></td></tr></tbody></table></td></tr>"

function at(...rows) {
    return rows.map((row) => new IndexPath({row}))
}

function tableOf(names, {cellClass = Row, identifier = "row"} = {}) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(cellClass, {forCellReuseIdentifier: identifier})
    var model = {names: names.slice()}
    var asked = []
    var events = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => model.names.length,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            asked.push(indexPath.row)
            var cell = tableView.dequeueReusableCell({withIdentifier: identifier, for: indexPath})
            if (cell.amountLabel) { cell.amountLabel.text = model.names[indexPath.row] }
            return cell
        },
    }
    table.delegate = {
        tableViewDidSelectRowAtIndexPath(tableView, indexPath) { events.push("select:" + indexPath.row) },
        tableViewDidDeselectRowAtIndexPath(tableView, indexPath) { events.push("deselect:" + indexPath.row) },
        tableViewCommitEditingStyleForRowAtIndexPath(tableView, style, indexPath) { events.push(style + ":" + indexPath.row) },
    }
    asked.length = 0
    reuses.length = 0
    return {table, model, asked, events}
}

function rowIds() {
    return Array.from(document.querySelectorAll("#table > tbody > tr")).map((row) => row.id)
}

function rowTexts() {
    return Array.from(document.querySelectorAll("#table > tbody > tr")).map((row) => row.children[1].textContent)
}

function click(element) {
    element.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

test("appending rows asks the data source for the new rows only and leaves the drawn cells alone", function() {
    var {table, model, asked} = tableOf(["a", "b", "c"])
    var before = [0, 1, 2].map((row) => table.cellForRow({at: row}))
    model.names.push("d", "e")
    table.insertRows({at: at(3, 4), with: UITableView.RowAnimation.none})
    assert.deepEqual(asked, [3, 4])
    assert.deepEqual([0, 1, 2].map((row) => table.cellForRow({at: row})), before)
    assert.deepEqual(reuses, [])
    assert.deepEqual(rowIds(), ["cell-0", "cell-1", "cell-2", "cell-3", "cell-4"])
    assert.deepEqual(rowTexts(), ["a", "b", "c", "d", "e"])
    assert.equal(table.cellForRow({at: 4}).amountLabel.text, "e")
    assert.equal(table.indexPath({for: table.cellForRow({at: 4})}).row, 4)
    click(document.getElementById("cell-4").children[1])
    assert.equal(table.indexPathForSelectedRow.row, 4)
})

test("inserting in the middle renumbers the rows after it and carries the selection, the editing handlers and the checkboxes along", function() {
    var {table, model, asked, events} = tableOf(["a", "b", "c", "d"])
    table.selectRow({at: 2, animated: false, scrollPosition: UITableView.ScrollPosition.none})
    table.setEditing(true, {animated: false})
    var oldB = table.cellForRow({at: 1})
    var oldC = document.querySelector("#cell-2")
    model.names.splice(1, 0, "x")
    table.insertRows({at: at(1), with: UITableView.RowAnimation.none})
    assert.deepEqual(asked, [1])
    assert.deepEqual(rowIds(), ["cell-0", "cell-1", "cell-2", "cell-3", "cell-4"])
    assert.deepEqual(rowTexts(), ["a", "x", "b", "c", "d"])
    assert.equal(table.cellForRow({at: 2}), oldB)
    assert.equal(oldB.selector, "#table #cell-2")
    assert.equal(oldB.identifier, "cell-2")
    assert.deepEqual(table.indexPathsForSelectedRows.map((indexPath) => indexPath.row), [3])
    assert.equal(document.querySelector("#cell-3"), oldC)
    assert.equal(oldC.classList.contains("selected"), true)
    assert.equal(document.querySelectorAll("#table tr.selected").length, 1)
    click(document.getElementById("cell-4").querySelector("button"))
    assert.deepEqual(events, [UITableViewCellEditingStyle.delete + ":4"])
    events.length = 0
    var checkbox = document.getElementById("cell-2").querySelector("input[type=checkbox]")
    checkbox.checked = true
    checkbox.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(events, ["select:2"])
    click(document.getElementById("cell-1").querySelector("button"))
    assert.deepEqual(events, ["select:2", UITableViewCellEditingStyle.delete + ":1"])
})

test("insertRows refuses a missing or wrong label naming insertRows(at:with:)", function() {
    var {table, model} = tableOf(["a", "b"])
    model.names.push("c")
    var refusal = (error) => error instanceof TypeError && /insertRows\(at:with:\)/.test(error.message)
    assert.throws(() => table.insertRows({at: at(2)}), refusal)
    assert.throws(() => table.insertRows({at: at(2), with: "spin"}), refusal)
    assert.throws(() => table.insertRows({at: [2], with: UITableView.RowAnimation.none}), refusal)
    assert.throws(() => table.insertRows({at: "2", with: UITableView.RowAnimation.none}), refusal)
    assert.throws(() => table.insertRows({with: UITableView.RowAnimation.none}), refusal)
    assert.throws(() => table.insertRows(), refusal)
})

test("insertRows throws before touching anything when the rows or the counts do not add up", function() {
    var {table, model, asked} = tableOf(["a", "b", "c"])
    var cells = [0, 1, 2].map((row) => table.cellForRow({at: row}))
    var ids = rowIds()
    var expectUntouched = function() {
        assert.deepEqual(asked, [])
        assert.deepEqual(rowIds(), ids)
        assert.deepEqual([0, 1, 2].map((row) => table.cellForRow({at: row})), cells)
        assert.equal(table.cellForRow({at: 3}), null)
    }
    var none = UITableView.RowAnimation.none
    assert.throws(() => table.insertRows({at: at(2), with: none}), /Invalid update: invalid number of rows in section 0.*\(3\).*\(3\).*1 inserted, 0 deleted/)
    expectUntouched()
    model.names.push("d", "e")
    assert.throws(() => table.insertRows({at: at(3, 3), with: none}), /unique|duplicate/i)
    expectUntouched()
    assert.throws(() => table.insertRows({at: at(3, 5), with: none}), /row 5.*0\.\.\.4|out of range/i)
    expectUntouched()
    assert.throws(() => table.insertRows({at: at(-1, 3), with: none}), /row -1.*0\.\.\.4|out of range/i)
    expectUntouched()
    assert.throws(() => table.insertRows({at: [new IndexPath({row: 3, section: 1}), new IndexPath({row: 4})], with: none}), /one section/)
    expectUntouched()
    assert.throws(() => table.insertRows({at: at(3), with: none}), /Invalid update: invalid number of rows in section 0.*\(5\).*\(3\).*1 inserted, 0 deleted/)
    expectUntouched()
})

test("reconfigureRows asks only the given rows and hands their cells back without prepareForReuse", function() {
    var {table, model, asked} = tableOf(["a", "b", "c", "d"])
    var cells = [0, 1, 2, 3].map((row) => table.cellForRow({at: row}))
    var elements = Array.from(document.querySelectorAll("#table > tbody > tr"))
    model.names[1] = "B"
    table.reconfigureRows({at: at(1)})
    assert.deepEqual(asked, [1])
    assert.deepEqual([0, 1, 2, 3].map((row) => table.cellForRow({at: row})), cells)
    assert.deepEqual(Array.from(document.querySelectorAll("#table > tbody > tr")), elements)
    assert.deepEqual(reuses, [])
    assert.deepEqual(rowTexts(), ["a", "B", "c", "d"])
    table.reconfigureRows({at: at(1)})
    assert.equal(table.subviews.filter((view) => view === cells[1]).length, 1)
    assert.equal(table.subviews.length, 4)
    assert.equal(cells[1].superview, table)
    assert.equal(cells[1].next, table)
    var refusal = (error) => error instanceof TypeError && /reconfigureRows\(at:\)/.test(error.message)
    assert.throws(() => table.reconfigureRows(), refusal)
    assert.throws(() => table.reconfigureRows({at: [1]}), refusal)
    assert.throws(() => table.reconfigureRows({at: at(4)}), /out of range|0\.\.\.3/)
    assert.throws(() => table.reconfigureRows({at: at(1, 1)}), /unique|duplicate/i)
    assert.throws(() => table.reconfigureRows({at: [new IndexPath({row: 1, section: 1})]}), /one section/)
    assert.deepEqual(asked, [1, 1])
})

test("prepareForReuse still runs for a row the reload hands back", function() {
    var {table} = tableOf(["a", "b"])
    table.reloadData()
    assert.equal(reuses.length, 2)
})

test("UITableView.RowAnimation is Apple's enumeration, exported from the UIKit entry", function() {
    assert.equal(UITableView.RowAnimation, framework.UITableViewRowAnimation)
    assert.equal(UITableView.RowAnimation.none, framework.UITableViewRowAnimation.none)
    assert.deepEqual(Object.keys(framework.UITableViewRowAnimation).sort(), ["automatic", "bottom", "fade", "left", "middle", "none", "right", "top"])
    assert.ok(Object.isFrozen(framework.UITableViewRowAnimation))
})

test("rows go into the table's own tbody, not into one nested in a row", function() {
    var {table, model} = tableOf(["a", "b"], {cellClass: NestedRow, identifier: "nested"})
    model.names.push("c", "d")
    table.reloadData()
    assert.equal(document.querySelectorAll("#table > tbody > tr[id^=cell-]").length, 4)
    model.names.push("e")
    table.insertRows({at: at(4), with: UITableView.RowAnimation.none})
    assert.equal(document.querySelectorAll("#table > tbody > tr[id^=cell-]").length, 5)
    assert.equal(document.querySelectorAll(".inner").length, 5)
    assert.equal(document.querySelectorAll("#table > tbody .inner").length, 5)
    assert.equal(document.querySelectorAll("#table > tbody > tr > td > table > tbody > tr[id^=cell-]").length, 0)
})

test("an append never scans the tbody or the table for the rows it adds", function() {
    var {table, model} = tableOf(Array.from({length: 20}, (unused, row) => "r" + row))
    var tableElement = document.getElementById("table")
    var tbody = tableElement.tBodies[0]
    var scans = []
    for (var element of [tableElement, tbody]) {
        for (var name of ["getElementsByTagName", "querySelectorAll"]) {
            var original = element[name]
            element[name] = function(original, label) {
                return function() {
                    scans.push(label)
                    return original.apply(this, arguments)
                }
            }(original, element.tagName + "." + name)
        }
    }
    model.names.push("n0", "n1", "n2", "n3", "n4")
    table.insertRows({at: at(20, 21, 22, 23, 24), with: UITableView.RowAnimation.none})
    assert.deepEqual(scans, [])
    assert.equal(document.querySelectorAll("#table > tbody > tr").length, 25)
})

test("a table that is not in the document still finds the row it already drew", function() {
    var detached = document.createElement("table")
    detached.id = "detached"
    detached.innerHTML = "<tbody></tbody>"
    var table = new UITableView("#detached")
    table.$el
    table._$el = $(detached)
    table.register(Row, {forCellReuseIdentifier: "row"})
    var first = table.dequeueReusableCell({withIdentifier: "row", for: new IndexPath({row: 0})})
    var second = table.dequeueReusableCell({withIdentifier: "row", for: new IndexPath({row: 0})})
    assert.equal(detached.tBodies[0].children.length, 1)
    assert.equal(second.$el[0], first.$el[0])
})

test("the outlets of a shifted row follow it, and the inserted row's outlets resolve inside the inserted row", function() {
    var {table, model} = tableOf(["a", "b", "c"])
    model.names.unshift("x")
    table.insertRows({at: at(0), with: UITableView.RowAnimation.none})
    var shifted = table.cellForRow({at: 1})
    var inserted = table.cellForRow({at: 0})
    assert.equal(shifted.amountLabel.text, "a")
    assert.ok(shifted.amountLabel.selector.startsWith("#table #cell-1 "), shifted.amountLabel.selector)
    for (var item of shifted.items) { assert.ok(item.selector.startsWith("#table #cell-1 "), item.selector) }
    var oldNode = shifted.amountLabel.$el[0]
    var freshNode = document.createElement("td")
    freshNode.id = "amount"
    oldNode.replaceWith(freshNode)
    assert.equal(shifted.amountLabel.$el[0], freshNode)
    assert.equal(shifted.amountLabel.$el[0].closest("tr").id, "cell-1")
    var insertedNode = inserted.amountLabel.$el[0]
    var freshInserted = document.createElement("td")
    freshInserted.id = "amount"
    insertedNode.replaceWith(freshInserted)
    assert.equal(inserted.amountLabel.$el[0], freshInserted)
    assert.equal(inserted.amountLabel.$el[0].closest("tr").id, "cell-0")
})

test("after a reload the delete button and the checkbox of every row report that row's index path", function() {
    var {table, model, events} = tableOf(["a", "b", "c"])
    table.setEditing(true, {animated: false})
    model.names.push("d")
    table.reloadData()
    click(document.getElementById("cell-3").querySelector("button"))
    click(document.getElementById("cell-0").querySelector("button"))
    assert.deepEqual(events, [UITableViewCellEditingStyle.delete + ":3", UITableViewCellEditingStyle.delete + ":0"])
    events.length = 0
    var checkbox = document.getElementById("cell-3").querySelector("input[type=checkbox]")
    checkbox.checked = true
    checkbox.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(events, ["select:3"])
})
