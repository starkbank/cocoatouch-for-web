import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IndexPath, UITableView } from "../src/index.js"
import { counters, Row, Other, at, setup, rowsBody, renderedIds, renderedRows, spacers, scrollTo, rows, click } from "./tableReuseHelpers.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

// 1000 rows of 95 px, a 900 px viewport, the table at 100 px with a 30 px header: the area is the clip and one clip above and below,
// so rows up to (1800 - 130) / 95 = 17.6 are in it.
test("1. only the rows in the clip and one clip either side exist, and the bottom spacer stands in for the rest", function() {
    withTable({}, function({table, model}) {
        assert.deepEqual(renderedRows(), Array.from({length: 18}, (_, row) => row))
        assert.ok(model.asked.every((row) => row < 38), "the first pass, estimated at 44 px, asked at most 38 rows")
        assert.equal(table.visibleCells.length, 18)
        var spacerList = spacers()
        assert.equal(spacerList.length, 1)
        assert.equal(spacerList[0].style.height, (1000 - 18) * 95 + "px")
        assert.equal(spacerList[0], rowsBody().lastElementChild)
        assert.equal(document.getElementById("cell-18"), null)
    })
})

test("2. cost does not grow with the rows: the same cells serve a full scroll of 1000 or of 10000 rows", function() {
    var constructed = []
    for (var count of [1000, 10000]) {
        withTable({count}, function({layout, model}) {
            var settled = counters.constructed
            model.asked.length = 0
            counters.prepared = 0
            for (var y = 0; y < count * 95; y += 450) { scrollTo(layout, y) }
            constructed.push(counters.constructed)
            assert.ok(counters.constructed <= settled + 1, "scrolling built " + (counters.constructed - settled) + " more cells")
            assert.equal(counters.prepared, model.asked.length - (counters.constructed - settled), "one prepareForReuse per reuse")
        })
    }
    assert.equal(constructed[0], constructed[1])
})

test("3. cellForRow is null off screen, visibleCells and indexPathsForVisibleRows are the rendered rows, and a queued cell has no index path", function() {
    withTable({}, function({table, model}) {
        var first = table.cellForRow({at: 0})
        assert.ok(first)
        assert.equal(table.cellForRow({at: new IndexPath({row: 500})}), null)
        assert.deepEqual(rows(table), renderedRows())
        assert.deepEqual(table.visibleCells.map((cell) => cell._$el[0].id), renderedIds())
        assert.equal(table.indexPath({for: first}).row, 0)
        var last = table.cellForRow({at: 17})
        model.count = 5
        table.reloadData()
        assert.equal(table.cellForRow({at: 17}), null)
        assert.match(last._$el[0].id, /^reusable-/)
        assert.equal(table.indexPath({for: last}), null)
        assert.equal(table.visibleCells.includes(last), false)
    })
})

test("4. willDisplay follows configure for each new row and didEndDisplaying each row that leaves, never a spacer", function() {
    withTable({}, function({table, layout, events}) {
        var wills = events.filter((event) => event[0] === "will")
        assert.ok(wills.every((event) => event[2] === "Row " + event[1]), "the cell was configured before willDisplay")
        var firstEnd = events.findIndex((event) => event[0] === "end")
        assert.ok(firstEnd > events.findIndex((event) => event[0] === "will"))
        events.length = 0
        scrollTo(layout, 30000)
        var ended = events.filter((event) => event[0] === "end").map((event) => event[1])
        var shown = events.filter((event) => event[0] === "will").map((event) => event[1])
        assert.deepEqual(ended, Array.from({length: 18}, (_, row) => row))
        assert.deepEqual(shown, renderedRows())
        assert.ok(events.every((event) => Number.isInteger(event[1])))
    })
})

test("4b. didEndDisplaying also reaches the cells a reload does not reuse", function() {
    withTable({}, function({table, model, events}) {
        events.length = 0
        model.count = 5
        table.reloadData()
        var ended = events.filter((event) => event[0] === "end").map((event) => event[1]).sort((a, b) => a - b)
        assert.deepEqual(ended, Array.from({length: 13}, (_, row) => row + 5))
    })
})

test("9. spacers are absent at height 0, row 0 is :first-child and the real last row :last-child, a window-edge row is neither", function() {
    withTable({count: 5}, function({table}) {
        assert.equal(spacers().length, 0)
        assert.equal(rowsBody().firstElementChild.id, "cell-0")
        assert.equal(rowsBody().lastElementChild.id, "cell-4")
    })
    withTable({}, function({table, layout}) {
        assert.equal(rowsBody().firstElementChild.id, "cell-0")
        assert.equal(rowsBody().lastElementChild.id, "", "the bottom spacer is last while rows remain")
        scrollTo(layout, 30000)
        var first = rowsBody().firstElementChild
        assert.equal(first.id, "", "the top spacer")
        assert.equal(first.getAttribute("aria-hidden"), "true")
        var edge = renderedIds()
        assert.notEqual(rowsBody().firstElementChild.nextElementSibling.id, "cell-0")
        scrollTo(layout, 1e9)
        assert.equal(rowsBody().lastElementChild.id, "cell-999")
        assert.equal(spacers().length, 1)
        assert.equal(edge.length > 0, true)
    })
})

test("9b. a click on a spacer selects nothing and a spacer has no handlers", function() {
    withTable({}, function({table, layout}) {
        scrollTo(layout, 30000)
        var events = []
        table.delegate.tableViewDidSelectRowAtIndexPath = (tableView, indexPath) => events.push(indexPath.row)
        click(spacers()[0])
        click(spacers()[1])
        assert.deepEqual(events, [])
        assert.equal(table.indexPathsForSelectedRows.length, 0)
        click(document.getElementById(renderedIds()[3]))
        assert.equal(events.length, 1)
    })
})

test("10. a reload asks only the area's rows and hands each row its own cell back with prepareForReuse", function() {
    withTable({}, function({table, model}) {
        var before = table.visibleCells.slice()
        model.asked.length = 0
        counters.prepared = 0
        counters.constructed = 0
        table.reloadData()
        assert.deepEqual(model.asked, renderedRows())
        assert.ok(model.asked.length <= 18)
        assert.deepEqual(table.visibleCells, before.slice(0, model.asked.length))
        assert.equal(counters.prepared, model.asked.length)
        assert.equal(counters.constructed, 0)
    })
})

test("10. the queue stays within the largest window after reloads from 1000 rows to 10 and back", function() {
    withTable({}, function({table, model}) {
        var largest = 0
        for (var step = 0; step < 6; step++) {
            model.count = step % 2 === 0 ? 10 : 1000
            table.reloadData()
            largest = Math.max(largest, table.visibleCells.length)
            assert.ok(document.querySelectorAll("tr[id^=reusable-]").length <= 38)
        }
        assert.equal(document.querySelectorAll("tr[id^=cell-]").length, table.visibleCells.length)
    })
})

test("10. a queue holds at most the largest window, and the cell that would exceed it is disposed while still connected", function() {
    withTable({count: 10, estimatedRowHeight: 95}, function({table, model}) {
        model.count = 0
        table.reloadData()
        model.count = 10
        table.reloadData()
        table._maxWindow = 3
        counters.disposed.length = 0
        model.count = 2
        table.reloadData()
        var queued = document.querySelectorAll("tr[id^=reusable-]").length
        assert.ok(queued <= 3, "queued " + queued)
        assert.equal(counters.disposed.length, 8 - queued)
        assert.ok(counters.disposed.every((entry) => entry.connected))
    })
})

test("10b. reading the outlet of a queued cell changes its own node and leaves the row that took its id alone, and dequeue places, renumbers, then prepares", function() {
    var order = []
    class Spy extends Row {
        prepareForReuse() {
            var element = this._$el[0]
            order.push({id: element.id, parent: element.parentNode === rowsBody(), connected: element.isConnected})
            this.optionsView.isHidden = true
            super.prepareForReuse()
        }
    }
    withTable({count: 10, estimatedRowHeight: 95}, function({table, model}) {
        table.register(Spy, {forCellReuseIdentifier: "row"})
        model.count = 0
        table.reloadData()
        model.count = 10
        table.reloadData()
        var cells = table.visibleCells.slice()
        model.count = 3
        table.reloadData()
        var queued = cells.slice(3)
        var x = queued[queued.length - 1]
        var node = x._$el[0]
        assert.match(node.id, /^reusable-/)
        assert.equal(node.isConnected, true)
        assert.equal(x.$el[0], node)
        var y = table.cellForRow({at: 2})
        assert.notEqual(y, x)
        var yText = y.titleLabel.$el[0].textContent
        x.titleLabel.text = "read through the queued cell"
        assert.equal(x.titleLabel.$el[0].closest("tr"), node, "the outlet resolved to the queued cell's own row")
        assert.equal(node.children[1].textContent, "read through the queued cell")
        assert.equal(y.titleLabel.$el[0].textContent, yText, "the row that took its id is untouched")
        order.length = 0
        model.count = 10
        table.reloadData()
        assert.ok(order.length > 0)
        assert.ok(order.every((entry) => /^cell-\d+$/.test(entry.id) && entry.parent && entry.connected), JSON.stringify(order))
        var reused = table.visibleCells.find((cell) => cell === x)
        assert.ok(reused, "the queued cell served a row again")
        assert.equal(reused.optionsView.$el[0].style.display, "none", "prepareForReuse hid the outlet on the cell's own node")
        assert.equal(document.querySelectorAll("tr[id^=cell-]").length, document.querySelectorAll("#table > tbody:last-of-type > tr[id^=cell-]").length)
    })
})

test("10c. an empty table has an empty queue: no tbody > tr, no row class, outlets released on their own nodes, and the next load builds one window", function() {
    withTable({}, function({table, model, layout}) {
        scrollTo(layout, 20000)
        counters.disposed.length = 0
        var before = document.getElementById("table").tBodies.length
        model.count = 0
        table.reloadData()
        window.scrollTo(0, 0)
        assert.equal(document.querySelectorAll("#table tbody > tr").length, 0)
        assert.equal(document.querySelectorAll("#table tr[id^=reusable-], #table tr[id^=cell-]").length, 0)
        assert.equal(table.visibleCells.length, 0)
        assert.ok(counters.disposed.length >= 18)
        assert.ok(counters.disposed.every((entry) => entry.connected))
        assert.equal(document.getElementById("table").tBodies.length, 1, "the queue's tbody went with it (" + before + " before)")
        counters.constructed = 0
        model.count = 300
        table.reloadData()
        assert.equal(counters.constructed, table.visibleCells.length)
        assert.deepEqual(renderedRows(), Array.from({length: table.visibleCells.length}, (_, row) => row))
    })
})

test("16. without a layout the window is the rows covering the area at 44 px from row 0, and a table of 35 rows or fewer renders fully", function() {
    for (var count of [1000, 35, 12]) {
        page("<table id=\"table\"><tbody></tbody></table>")
        var table = new UITableView("#table")
        table.register(Row, {forCellReuseIdentifier: "row"})
        table.dataSource = {
            tableViewNumberOfRowsInSection: () => count,
            tableViewCellForRowAtIndexPath(tableView, indexPath) {
                var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
                cell.titleLabel.text = "Row " + indexPath.row
                return cell
            },
        }
        var expected = Math.min(count, 35)
        assert.equal(table.visibleCells.length, expected, "rows " + count)
        assert.equal(document.querySelectorAll("#table tbody > tr[id^=cell-]").length, expected)
        assert.deepEqual(rows(table), Array.from({length: expected}, (_, row) => row))
    }
})

test("17. automaticDimension is -1, estimatedRowHeight defaults to it, rowHeight reads it and cannot be set", function() {
    assert.equal(UITableView.automaticDimension, -1)
    withTable({count: 3}, function({table}) {
        assert.equal(table.estimatedRowHeight, UITableView.automaticDimension)
        assert.equal(table.rowHeight, UITableView.automaticDimension)
        assert.throws(() => { table.rowHeight = 50 }, TypeError)
        table.estimatedRowHeight = 60
        assert.equal(table.estimatedRowHeight, 60)
    })
})

test("a table with a registered class that changed drops that identifier's queue while connected", function() {
    withTable({count: 10, estimatedRowHeight: 95}, function({table, model}) {
        model.count = 3
        table.reloadData()
        assert.ok(document.querySelectorAll("tr[id^=reusable-]").length > 0)
        counters.disposed.length = 0
        table.register(Other, {forCellReuseIdentifier: "row"})
        assert.equal(document.querySelectorAll("tr[id^=reusable-]").length, 0)
        assert.ok(counters.disposed.length > 0)
        assert.ok(counters.disposed.every((entry) => entry.connected))
    })
})

test("a renumbered view whose selector is not a string is left alone", function() {
    withTable({count: 3}, function({table, layout}) {
        var cell = table.cellForRow({at: 1})
        cell.subviews.push({selector: undefined, subviews: []})
        assert.doesNotThrow(() => table._renumber(cell, "cell-1", "reusable-99"))
        assert.equal(cell._$el[0].id, "reusable-99")
        table._renumber(cell, "reusable-99", "cell-1")
    })
})
