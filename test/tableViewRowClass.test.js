import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIButton, UITableView, UITableViewCell, UIControlEvent, IndexPath } from "../src/index.js"
import { registerNibClass } from "../src/utils/nibclasses.js"


var log = []

class CellA extends UITableViewCell {
    prepareForReuse() { log.push("reuse A") }
}
CellA.nib = "<tr><td class=\"kind-a\"><span id=\"title\"></span></td></tr>"
IBOutlet("#title", UILabel)(CellA.prototype, "titleLabel", {})

class CellB extends UITableViewCell {
    prepareForReuse() { log.push("reuse B") }
}
CellB.nib = "<tr><td class=\"kind-b\"><span id=\"name\"></span><button id=\"press\">go</button></td></tr>"
IBOutlet("#name", UILabel)(CellB.prototype, "nameLabel", {})
IBOutlet("#press", UIButton)(CellB.prototype, "pressButton", {})

// The class a loader-written registration names: an identifier nobody registered on the table finds it by name.
class NamedA extends UITableViewCell {}
NamedA.nib = "<tr><td class=\"kind-named\"></td></tr>"
registerNibClass("NamedA", NamedA)

// rows[n] is the identifier the data source dequeues for row n on the next reload.
function table(rows) {
    log = []
    page("<table id=\"table\"><tbody></tbody></table>")
    var view = new UITableView("#table")
    view.register(CellA, {forCellReuseIdentifier: "a"})
    view.register(CellB, {forCellReuseIdentifier: "b"})
    var setup = {view, rows, dequeues: 0, pressed: [], selected: []}
    view.dataSource = {
        tableViewNumberOfRowsInSection: () => setup.rows.length,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            setup.dequeues += 1
            var identifier = setup.rows[indexPath.row]
            var cell = tableView.dequeueReusableCell({withIdentifier: identifier, for: indexPath})
            if (identifier === "a") { cell.titleLabel.text = "row " + indexPath.row }
            if (identifier === "b") {
                cell.nameLabel.text = "row " + indexPath.row
                if (!cell.wired) {
                    cell.wired = true
                    cell.pressButton.addTarget(cell, {action() { setup.pressed.push(indexPath.row) }, for: UIControlEvent.touchUpInside})
                }
            }
            return cell
        },
    }
    view.delegate = {tableViewDidSelectRowAtIndexPath(tableView, indexPath) { setup.selected.push(indexPath.row) }}
    view.reloadData()
    return setup
}

function kinds() {
    return $("#table tbody > tr").map(function() { return this.id + ":" + ($(this).find("td").attr("class") || "") }).get()
}

function cellAt(setup, row) {
    return setup.view.cellForRow({at: new IndexPath({row})})
}

test("a row that switches from class A to class B and back has the right class, nib and outlets each time", function() {
    var setup = table(["a", "a", "a"])
    assert.deepEqual(kinds(), ["cell-0:kind-a", "cell-1:kind-a", "cell-2:kind-a"])
    setup.rows[0] = "b"
    setup.view.reloadData()
    assert.deepEqual(kinds(), ["cell-0:kind-b", "cell-1:kind-a", "cell-2:kind-a"])
    assert.ok(cellAt(setup, 0) instanceof CellB)
    assert.equal(cellAt(setup, 0).nameLabel.$el.text(), "row 0")
    assert.equal($("#cell-0 #title").length, 0, "nothing of A's nib is left")
    setup.rows[0] = "a"
    setup.view.reloadData()
    assert.deepEqual(kinds(), ["cell-0:kind-a", "cell-1:kind-a", "cell-2:kind-a"])
    assert.ok(cellAt(setup, 0) instanceof CellA)
    assert.equal(cellAt(setup, 0).titleLabel.$el.text(), "row 0")
    assert.equal($("#cell-0 #name, #cell-0 #press").length, 0)
})

test("the rows stay in order when a row in the middle, the first or the last changes class", function() {
    var setup = table(["a", "a", "a", "a"])
    for (var change of [[1, "b"], [0, "b"], [3, "b"], [1, "a"], [2, "b"]]) {
        setup.rows[change[0]] = change[1]
        setup.view.reloadData()
        assert.deepEqual($("#table tbody > tr").map(function() { return this.id }).get(), ["cell-0", "cell-1", "cell-2", "cell-3"], JSON.stringify(change))
        assert.deepEqual(kinds().map((entry) => entry.split(":")[1]), setup.rows.map((identifier) => "kind-" + identifier))
    }
})

test("prepareForReuse runs only for a cell of the same class, and a replaced cell is never told", function() {
    var setup = table(["a", "a"])
    log.length = 0
    setup.view.reloadData()
    assert.deepEqual(log, ["reuse A", "reuse A"])
    log.length = 0
    setup.rows[0] = "b"
    setup.view.reloadData()
    assert.deepEqual(log, ["reuse A"], "row 1 reused, row 0 replaced")
    log.length = 0
    setup.view.reloadData()
    assert.deepEqual(log, ["reuse B", "reuse A"])
})

test("a same-class reload keeps the cell object and its element", function() {
    var setup = table(["a", "b"])
    var first = [cellAt(setup, 0), cellAt(setup, 1)]
    var elements = [first[0].$el[0], first[1].$el[0]]
    setup.view.reloadData()
    assert.equal(cellAt(setup, 0), first[0])
    assert.equal(cellAt(setup, 1), first[1])
    assert.equal(cellAt(setup, 0).$el[0], elements[0])
    assert.equal(cellAt(setup, 1).$el[0], elements[1])
})

test("a replaced cell is disposed: its element, targets, handlers and subviews go with it", function() {
    var setup = table(["b", "a"])
    var old = cellAt(setup, 0)
    var element = old.$el[0]
    var button = old.pressButton.$el[0]
    var disposed = []
    var original = old._dispose.bind(old)
    old._dispose = function() { disposed.push("disposed"); original() }
    setup.rows[0] = "a"
    setup.view.reloadData()
    assert.deepEqual(disposed, ["disposed"])
    assert.equal(old._disposed, true)
    assert.equal(element.isConnected, false)
    assert.equal($._data(button, "events"), undefined, "the button's handlers are gone")
    assert.equal(setup.view.subviews.includes(old), false)
    assert.equal(setup.view.subviews.length, 2)
    button.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
    assert.deepEqual(setup.pressed, [])
})

test("each reload dequeues once per row", function() {
    var setup = table(["a", "b", "a"])
    setup.dequeues = 0
    setup.rows = ["b", "a", "a"]
    setup.view.reloadData()
    assert.equal(setup.dequeues, 3)
})

test("a reload of rows that all change class costs queries in proportion to the rows, not their square", function() {
    var queriesFor = function(count) {
        var setup = table(Array(count).fill("a"))
        setup.rows = Array(count).fill("b")
        var queries = 0
        var original = window.Element.prototype.querySelectorAll
        var documentOriginal = window.Document.prototype.querySelectorAll
        window.Element.prototype.querySelectorAll = function(...args) { queries += 1; return original.apply(this, args) }
        window.Document.prototype.querySelectorAll = function(...args) { queries += 1; return documentOriginal.apply(this, args) }
        try { setup.view.reloadData() } finally {
            window.Element.prototype.querySelectorAll = original
            window.Document.prototype.querySelectorAll = documentOriginal
        }
        return queries
    }
    var small = queriesFor(40)
    var large = queriesFor(160)
    assert.ok(large <= small * 4 * 1.25, `${small} queries for 40 rows, ${large} for 160`)
})

test("the nested-control exclusion still holds on a cell that replaced another class", function() {
    var setup = table(["a", "a"])
    setup.rows[0] = "b"
    setup.view.reloadData()
    document.querySelector("#cell-0 #press").dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    assert.deepEqual(setup.pressed, [0])
    assert.deepEqual(setup.selected, [])
    document.querySelector("#cell-0 #name").dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    assert.deepEqual(setup.selected, [0])
})

test("an identifier nobody registered gives the class its name belongs to, and a row can go from that to a registered one", function() {
    var setup = table(["a"])
    setup.rows[0] = "NamedA"
    setup.view.reloadData()
    assert.equal(cellAt(setup, 0).constructor, NamedA)
    assert.deepEqual(kinds(), ["cell-0:kind-named"])
    setup.rows[0] = "a"
    setup.view.reloadData()
    assert.ok(cellAt(setup, 0) instanceof CellA)
    assert.deepEqual(kinds(), ["cell-0:kind-a"])
})

test("a row whose identifier changes but whose class is the same is replaced too, since a reuse identifier maps to one class", function() {
    var setup = table(["a"])
    setup.view.register(CellA, {forCellReuseIdentifier: "a2"})
    var before = cellAt(setup, 0)
    setup.rows[0] = "a2"
    setup.view.reloadData()
    assert.notEqual(cellAt(setup, 0), before)
    assert.equal(before._disposed, true)
    assert.deepEqual(kinds(), ["cell-0:kind-a"])
})
