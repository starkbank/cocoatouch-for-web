import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIView, UITableView, UITableViewCell, UICollectionView, UICollectionViewCell, IndexPath } from "../src/index.js"
import { registerNibClass, nibClassNamed } from "../src/utils/nibclasses.js"
import { counters, Row, setup, scrollTo } from "./tableReuseHelpers.js"


// What the webpack loader writes beside every .xib's nib assignment, written by hand because the loader does not run here.
var awakened = []

class NamedCell extends UITableViewCell {
    awakeFromNib() {
        awakened.push(this.titleLabel ? "bound" : "unbound")
    }
}
NamedCell.nib = "<tr><td class=\"named\"><span id=\"title\"></span></td></tr>"
IBOutlet("#title", UILabel)(NamedCell.prototype, "titleLabel", {})
registerNibClass("NamedCell", NamedCell)

class RegisteredCell extends UITableViewCell {}
RegisteredCell.nib = "<tr><td class=\"registered\"></td></tr>"

class NamedRow extends Row {}
registerNibClass("NamedRow", NamedRow)

class NamedView extends UIView {}
registerNibClass("NamedView", NamedView)

class NamedItem extends UICollectionViewCell {}
NamedItem.nib = "<div class=\"item\"></div>"
registerNibClass("NamedItem", NamedItem)

function unknownCell(identifier) {
    return "unable to dequeue a cell with identifier " + identifier + " - must register a nib or a class for the identifier or connect a prototype cell in a storyboard"
}

function unknownItem(identifier) {
    return "could not dequeue a view of kind: UICollectionElementKindCell with identifier " + identifier + " - must register a nib or a class for the identifier or connect a prototype cell in a storyboard"
}

function isError(message) {
    return function(error) { return error.constructor === Error && error.message === message }
}

function bareTable() {
    page("<table id=\"table\"><tbody></tbody></table>")
    return new UITableView("#table")
}

// One row whose cell is dequeued under `identifier`; `before` registers on the table before the data source loads it.
function table(identifier, before) {
    var view = bareTable()
    if (before) { before(view) }
    var cells = []
    view.dataSource = {
        tableViewNumberOfRowsInSection: () => 1,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: identifier, for: indexPath})
            cells.push(cell)
            return cell
        },
    }
    view.reloadData()
    return {view, cells}
}

function withNamedRows(options, body) {
    var context = setup(Object.assign({identifier: () => "NamedRow"}, options))
    try { body(context) } finally { context.layout.restore() }
}

test("1. an identifier nobody registered dequeues the class that name belongs to, built over its nib", function() {
    awakened.length = 0
    var {view, cells} = table("NamedCell")
    assert.equal(cells.length, 1)
    assert.equal(cells[0].constructor, NamedCell)
    assert.equal(cells[0].reuseIdentifier, "NamedCell")
    assert.equal(cells[0].titleLabel.$el[0].closest("td").className, "named")
    assert.equal(awakened.length, cells.length, "awakeFromNib is sent once to each cell")
    assert.ok(awakened.every((state) => state === "bound"), "the outlets are bound before awakeFromNib")
    assert.equal(view._registeredCells.get("NamedCell"), NamedCell, "the answer is kept for the next dequeue")
})

test("2. a class registered for the identifier wins over the class the name belongs to", function() {
    var {view, cells} = table("NamedCell", (tableView) => tableView.register(RegisteredCell, {forCellReuseIdentifier: "NamedCell"}))
    assert.equal(cells[0].constructor, RegisteredCell)
    assert.equal(view._registeredCells.get("NamedCell"), RegisteredCell)
    assert.equal($("#table td").attr("class"), "registered")
})

test("3. an identifier nothing names is Apple's error, and so is a name that belongs to no cell class", function() {
    var view = bareTable()
    var indexPath = new IndexPath({row: 0})
    for (var identifier of ["NobodyCell", "NamedView", "constructor", "toString", ""]) {
        assert.throws(() => view.dequeueReusableCell({withIdentifier: identifier, for: indexPath}), isError(unknownCell(identifier)))
    }
    assert.equal(view._registeredCells.size, 0, "a refused identifier is not remembered")
})

test("4. withIdentifier and for are required, and typed, as Apple's signature requires", function() {
    var view = bareTable()
    var indexPath = new IndexPath({row: 0})
    assert.throws(() => view.dequeueReusableCell({withIdentifier: "NamedCell"}), (error) => error instanceof TypeError && /requires a for/.test(error.message))
    assert.throws(() => view.dequeueReusableCell({withIdentifier: "NamedCell", for: 3}), (error) => error instanceof TypeError && /expects an IndexPath for for/.test(error.message))
    assert.throws(() => view.dequeueReusableCell({for: indexPath}), (error) => error instanceof TypeError && /requires a withIdentifier/.test(error.message))
    assert.throws(() => view.dequeueReusableCell({withIdentifier: 3, for: indexPath}), (error) => error instanceof TypeError && /expects a String for withIdentifier/.test(error.message))
})

test("5. a table of named cells reuses and measures them like registered ones, and its cost does not grow with scrolling", function() {
    withNamedRows({count: 300}, function({table: view, layout, model}) {
        assert.ok(model.asked.length > 0)
        assert.ok(model.measured.length > 0)
        assert.ok(view.visibleCells.length > 0)
        assert.ok(view.visibleCells.every((cell) => cell.constructor === NamedRow))
        var queued = Array.from(view._queues.get("NamedRow"))
        assert.ok(queued.length > 0)
        assert.ok(queued.every((cell) => cell.constructor === NamedRow))
        var settled = counters.constructed
        for (var y = 0; y < 300 * 95; y += 450) { scrollTo(layout, y) }
        assert.ok(counters.constructed <= settled + 1, "scrolling built " + (counters.constructed - settled) + " more cells")
    })
})

test("6. registering after a named dequeue keeps the queue for the same class and retires it for another", function() {
    withNamedRows({count: 300}, function({table: view}) {
        var queued = Array.from(view._queues.get("NamedRow"))
        assert.ok(queued.length > 0)
        view.register(NamedRow, {forCellReuseIdentifier: "NamedRow"})
        var kept = Array.from(view._queues.get("NamedRow"))
        assert.equal(kept.length, queued.length)
        assert.ok(kept.every((cell, index) => cell === queued[index]), "the same cells wait")
        assert.ok(queued.every((cell) => cell._disposed !== true))
        class Replacement extends Row {}
        view.register(Replacement, {forCellReuseIdentifier: "NamedRow"})
        assert.equal(view._queues.has("NamedRow"), false)
        assert.ok(queued.every((cell) => cell._disposed === true))
    })
})

test("7. two classes under one name cannot be told apart by it, until one is registered for the identifier", function() {
    class TwinCell extends UITableViewCell {}
    class OtherTwinCell extends UITableViewCell {}
    registerNibClass("AmbiguousTwinCell", TwinCell)
    registerNibClass("AmbiguousTwinCell", TwinCell)
    assert.equal(nibClassNamed("AmbiguousTwinCell"), TwinCell, "the same class again is not a second class")
    registerNibClass("AmbiguousTwinCell", OtherTwinCell)
    var view = bareTable()
    var indexPath = new IndexPath({row: 0})
    var message = "two classes carry a .xib named AmbiguousTwinCell, so the identifier AmbiguousTwinCell cannot tell them apart: register the one it means for the identifier"
    assert.throws(() => nibClassNamed("AmbiguousTwinCell"), isError(message))
    assert.throws(() => view.dequeueReusableCell({withIdentifier: "AmbiguousTwinCell", for: indexPath}), isError(message))
    view.register(OtherTwinCell, {forCellReuseIdentifier: "AmbiguousTwinCell"})
    assert.equal(view.dequeueReusableCell({withIdentifier: "AmbiguousTwinCell", for: indexPath}).constructor, OtherTwinCell)
})

function grid(identifier, before) {
    page("<div id=\"grid\"></div>")
    var collection = new UICollectionView("#grid")
    if (before) { before(collection) }
    var cells = []
    collection.dataSource = {
        collectionViewNumberOfItemsInSection: () => 1,
        collectionViewCellForItemAtIndexPath(collectionView, indexPath) {
            var cell = collectionView.dequeueReusableCell({withReuseIdentifier: identifier, for: indexPath})
            cells.push(cell)
            return cell
        },
    }
    return {collection, cells}
}

test("8. a collection view builds a named cell as a registered one, keeps a registered nib string plain, and refuses what nothing names", function() {
    var named = grid("NamedItem")
    assert.equal(named.cells[0].constructor, NamedItem)
    assert.equal(named.cells[0].reuseIdentifier, "NamedItem")
    assert.equal($("#grid #cell-section-0-row-0 .item").length, 1)
    assert.equal(named.collection._registeredClasses.get("NamedItem"), NamedItem)
    assert.equal(named.collection._registeredNibs.get("NamedItem"), NamedItem.nib)

    var plain = grid("NamedItem", (collection) => collection.register("<span class=\"plain\"></span>", {forCellWithReuseIdentifier: "NamedItem"}))
    assert.equal(plain.cells[0].constructor, UICollectionViewCell)
    assert.equal($("#grid .plain").length, 1)

    var bare = grid("NamedItem").collection
    var indexPath = new IndexPath({row: 0, section: 0})
    for (var identifier of ["NobodyItem", "NamedView", "constructor", "toString"]) {
        assert.throws(() => bare.dequeueReusableCell({withReuseIdentifier: identifier, for: indexPath}), isError(unknownItem(identifier)))
    }
    assert.throws(() => bare.dequeueReusableCell({withReuseIdentifier: "NamedItem"}), (error) => error instanceof TypeError && /requires a for/.test(error.message))
    assert.throws(() => bare.dequeueReusableCell({withReuseIdentifier: "NamedItem", for: 3}), (error) => error instanceof TypeError && /expects an IndexPath for for/.test(error.message))
})
