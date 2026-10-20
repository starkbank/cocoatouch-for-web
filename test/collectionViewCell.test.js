import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UILabel, UIButton, UIControlEvent, UICollectionView, UICollectionViewCell } from "../src/index.js"


var events = []

class ItemCell extends UICollectionViewCell {
    awakeFromNib() {
        events.push("awake:" + (this.titleLabel ? "bound" : "unbound"))
        if (this.openButton) { this.openButton.addTarget(this, {action: this.opened, for: UIControlEvent.touchUpInside}) }
    }

    opened() { events.push("opened") }

    prepareForReuse() {
        events.push("prepare")
        this.titleLabel.text = ""
    }
}
ItemCell.nib = "<div class=\"card\"><span class=\"title\"></span><button class=\"open\"></button></div>"
IBOutlet(".title", UILabel)(ItemCell.prototype, "titleLabel", {})
IBOutlet(".open", UIButton)(ItemCell.prototype, "openButton", {})

class OtherCell extends UICollectionViewCell {}
OtherCell.nib = "<em class=\"other\"></em>"

function gridOf(count, identifierFor) {
    page("<div id=\"grid\"></div>")
    var grid = new UICollectionView("#grid")
    grid.register(ItemCell, {forCellWithReuseIdentifier: "item"})
    grid.register(OtherCell, {forCellWithReuseIdentifier: "other"})
    var dequeued = []
    grid.dataSource = {
        collectionViewNumberOfItemsInSection: function() { return count.value },
        collectionViewCellForItemAtIndexPath: function(collectionView, indexPath) {
            var cell = collectionView.dequeueReusableCell({withReuseIdentifier: identifierFor(indexPath), for: indexPath})
            if (cell.titleLabel) { cell.titleLabel.text = "Item " + indexPath.row }
            dequeued.push(cell)
            return cell
        },
    }
    return {grid: grid, dequeued: dequeued}
}

function always(identifier) {
    return function() { return identifier }
}

test("a registered cell class is instantiated, with its outlets bound to its own item", function() {
    events.length = 0
    var setup = gridOf({value: 2}, always("item"))
    var cell = setup.dequeued[1]
    assert.ok(cell instanceof ItemCell)
    assert.equal(cell.reuseIdentifier, "item")
    assert.equal(cell.titleLabel.$el[0].textContent, "Item 1")
    assert.equal($("#cell-section-0-row-1 .title").text(), "Item 1")
    assert.equal($("#cell-section-0-row-0 .title").text(), "Item 0")
    assert.equal(cell.titleLabel.$el.closest("collection-view-cell").attr("id"), "cell-section-0-row-1")
    assert.equal($("#grid collection-view-cell").length, 2)
})

test("awakeFromNib runs once per cell, after its outlets are bound", function() {
    events.length = 0
    gridOf({value: 3}, always("item"))
    assert.deepEqual(events, ["awake:bound", "awake:bound", "awake:bound"])
})

test("the cell knows its index path and the collection view answers it back", function() {
    var setup = gridOf({value: 2}, always("item"))
    var cell = setup.dequeued[1]
    assert.equal(cell.next, setup.grid)
    assert.equal(setup.grid.indexPath({for: cell}).row, 1)
    assert.ok(setup.grid.subviews.indexOf(cell) !== -1)
})

test("a reloaded item gets the same cell back, prepareForReuse running before the data source configures it", function() {
    events.length = 0
    var setup = gridOf({value: 2}, always("item"))
    var first = setup.dequeued.slice()
    events.length = 0
    setup.grid.reloadData()
    var second = setup.dequeued.slice(2)
    assert.equal(second[0], first[0])
    assert.equal(second[1], first[1])
    assert.deepEqual(events, ["prepare", "prepare"])
    assert.equal(second[0].titleLabel.$el[0].textContent, "Item 0")
    assert.equal(setup.grid.subviews.length, 2)
    assert.equal($("#grid collection-view-cell").length, 2)
})

test("prepareForReuse sees what the last item drew and clears it before the next one", function() {
    var drawn = []
    var setup = gridOf({value: 1}, always("item"))
    var cell = setup.dequeued[0]
    var original = cell.prepareForReuse
    cell.prepareForReuse = function() { original.call(this); drawn.push(this.titleLabel.$el[0].textContent) }
    setup.grid.reloadData()
    assert.deepEqual(drawn, [""])
})

test("a target added in awakeFromNib keeps firing once after the cell is reused", function() {
    events.length = 0
    var setup = gridOf({value: 1}, always("item"))
    setup.grid.reloadData()
    setup.grid.reloadData()
    events.length = 0
    $("#cell-section-0-row-0 .open").trigger("click")
    assert.deepEqual(events, ["opened"])
})

test("a cell is handed back only for the identifier and class it was made for", function() {
    var identifier = {value: "item"}
    var setup = gridOf({value: 1}, function() { return identifier.value })
    var first = setup.dequeued[0]
    identifier.value = "other"
    setup.grid.reloadData()
    var swapped = setup.dequeued[1]
    assert.ok(swapped instanceof OtherCell)
    assert.notEqual(swapped, first)
    assert.equal($("#cell-section-0-row-0 .title").length, 0)
    assert.equal($("#cell-section-0-row-0 .other").length, 1)
    assert.ok(first._disposed)
    assert.equal(setup.grid.subviews.length, 1)
})

test("cells beyond the new count are disposed and their elements removed", function() {
    var count = {value: 3}
    var setup = gridOf(count, always("item"))
    var cells = setup.dequeued.slice()
    count.value = 1
    setup.grid.reloadData()
    assert.equal($("#grid collection-view-cell").length, 1)
    assert.ok(!cells[0]._disposed)
    assert.ok(cells[1]._disposed)
    assert.ok(cells[2]._disposed)
    assert.equal(setup.grid.subviews.length, 1)
    count.value = 3
    setup.grid.reloadData()
    assert.deepEqual($("#grid collection-view-cell").map(function() { return this.id }).get(), ["cell-section-0-row-0", "cell-section-0-row-1", "cell-section-0-row-2"])
    assert.equal(setup.dequeued[setup.dequeued.length - 3], cells[0])
    assert.notEqual(setup.dequeued[setup.dequeued.length - 2], cells[1])
})

test("a cell the data source stops dequeuing is disposed with its element", function() {
    var setup = gridOf({value: 1}, always("item"))
    var first = setup.dequeued[0]
    var oldTitle = first.titleLabel.$el[0]
    setup.grid.dataSource = {
        collectionViewNumberOfItemsInSection: function() { return 1 },
        collectionViewCellForItemAtIndexPath: function(collectionView, indexPath) { return new UICollectionViewCell("item", indexPath) },
    }
    assert.ok(first._disposed)
    assert.equal($("#grid collection-view-cell").length, 1)
    assert.ok(!oldTitle.isConnected)
    assert.equal(setup.grid.subviews.length, 0)
})

test("a string-registered nib still renders and a cell without a registered class is the plain cell", function() {
    page("<div id=\"grid\"></div>")
    var grid = new UICollectionView("#grid")
    grid.register("<span class=\"plain\"></span>", {forCellWithReuseIdentifier: "plain"})
    var cells = []
    grid.dataSource = {
        collectionViewNumberOfItemsInSection: function() { return 2 },
        collectionViewCellForItemAtIndexPath: function(collectionView, indexPath) {
            var cell = collectionView.dequeueReusableCell({withReuseIdentifier: "plain", for: indexPath})
            cells.push(cell)
            return cell
        },
    }
    assert.equal($("#grid .plain").length, 2)
    assert.ok(cells[0] instanceof UICollectionViewCell)
    assert.equal(cells[0].constructor, UICollectionViewCell)
})
