import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IndexPath, UITableView, UIView, UITableViewRowAnimation, UITableViewScrollPosition } from "../src/index.js"
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

test("2. cost does not grow with the rows: the cells built stay within a window and the measuring pool for 1000 and for 10000 rows", function() {
    var constructed = []
    for (var count of [1000, 10000]) {
        withTable({count}, function({layout, model}) {
            var settled = counters.constructed
            model.asked.length = 0
            model.measured.length = 0
            counters.prepared = 0
            for (var y = 0; y < count * 95; y += 450) { scrollTo(layout, y) }
            constructed.push(counters.constructed)
            assert.ok(counters.constructed <= settled + 1, "scrolling built " + (counters.constructed - settled) + " more cells")
            assert.equal(counters.prepared, model.asked.length + model.measured.length - (counters.constructed - settled), "one prepareForReuse per reuse, for the rows displayed and for the rows measured")
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
        model.measured.length = 0
        counters.prepared = 0
        counters.constructed = 0
        table.reloadData()
        assert.deepEqual(model.asked, renderedRows())
        assert.ok(model.asked.length <= 18)
        assert.deepEqual(table.visibleCells, before.slice(0, model.asked.length))
        assert.equal(counters.prepared, model.asked.length + model.measured.length, "each row displayed or measured is prepared once")
        assert.equal(counters.constructed, 0)
    })
})

test("10. the queue stays within the measuring pool after reloads from 1000 rows to 10 and back", function() {
    withTable({}, function({table, model}) {
        var largest = 0
        for (var step = 0; step < 6; step++) {
            model.count = step % 2 === 0 ? 10 : 1000
            table.reloadData()
            largest = Math.max(largest, table.visibleCells.length)
            assert.ok(document.querySelectorAll("tr[id^=reusable-]").length <= 100)
        }
        assert.equal(document.querySelectorAll("tr[id^=cell-]").length, table.visibleCells.length)
    })
})

test("10. a queue holds at most the largest window or the measuring pool, and the oldest cell that would exceed it is disposed while still connected", function() {
    withTable({count: 150, estimatedRowHeight: 95}, function({table, model}) {
        assert.equal(document.querySelectorAll("tr[id^=reusable-]").length, 100, "the rows measured at the reload fill the pool")
        counters.disposed.length = 0
        model.count = 2
        table.reloadData()
        var queued = document.querySelectorAll("tr[id^=reusable-]").length
        assert.equal(queued, 100, "queued " + queued)
        assert.equal(counters.disposed.length, 16, "the rows 2 to 17 left, and each pushed the oldest waiting cell out")
        assert.ok(counters.disposed.every((entry) => entry.connected))
    })
})

test("10b. reading the outlet of a queued cell changes its own node and leaves the row that took its id alone, and dequeue renumbers where the cell waits, then prepares", function() {
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
        assert.ok(order.every((entry) => /^cell-\d+$/.test(entry.id) && entry.connected), JSON.stringify(order))
        assert.ok(order.filter((entry) => Number(entry.id.slice(5)) < 3).every((entry) => entry.parent), "a cell handed back to its row is in the rows")
        assert.ok(order.filter((entry) => Number(entry.id.slice(5)) >= 3).every((entry) => !entry.parent), "a cell from the queue is prepared where it waits and joins the rows with its run: " + JSON.stringify(order))
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
        assert.equal(counters.constructed, table.visibleCells.length + 100, "one window, and the pool the other rows are measured in")
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

test("a view a cell added in code is renamed with its row when the cell is reused, so the fresh cell for row 3 never meets a duplicate id", function() {
    class Badge extends UIView {}
    Badge.nib = "<span></span>"
    withTable({count: 4, estimatedRowHeight: 20, heightOf: () => 20}, function({table, model}) {
        var badges = []
        model.onAsk = function(row, cell) {
            if (row !== 3 || cell.constructor === Row && badges.length > 0) { return }
            var badge = new Badge()
            cell.addSubview(badge)
            badges.push(badge)
        }
        table.reloadData()
        var x = table.cellForRow({at: 3})
        var xBadge = badges[0]
        assert.equal(xBadge._$el[0].id, "cell-3-1")
        model.count = 3
        table.reloadData()
        assert.match(x._$el[0].id, /^reusable-/)
        assert.equal(xBadge._$el[0].id.startsWith(x._$el[0].id + "-"), true, "renamed with the queued cell: " + xBadge._$el[0].id)
        model.identifier = (row) => row < 3 ? "row" : row === 40 ? "row" : "other"
        model.count = 41
        table.reloadData()
        assert.equal(table.cellForRow({at: 40}), x, "the queued cell serves row 40")
        assert.equal(xBadge._$el[0].id, "cell-40-1")
        assert.equal(xBadge.selector, "#cell-40-1")
        var fresh = table.cellForRow({at: 3})
        assert.notEqual(fresh, x)
        assert.equal(badges[1]._$el[0].id, "cell-3-1")
        assert.equal(document.querySelectorAll("#cell-3-1").length, 1)
    })
})

test("a reload never has two rows with one id: the row's previous cell of another identifier is gone before a queued cell takes the id", function() {
    withTable({count: 4, estimatedRowHeight: 20, heightOf: () => 20, identifier: (row) => row < 2 ? "other" : "row"}, function({table, model}) {
        model.count = 2
        table.reloadData()
        assert.equal(document.querySelectorAll("tr[id^=reusable-]").length, 2, "the two Row cells of rows 2 and 3 wait in the queue")
        model.identifier = (row) => row < 2 ? "row" : "other"
        model.count = 4
        var seen = []
        model.onAsk = function(row) {
            seen.push([row, document.querySelectorAll("tr[id=\"cell-" + row + "\"]").length])
        }
        counters.constructed = 0
        table.reloadData()
        assert.deepEqual(seen, [[0, 1], [1, 1], [2, 0], [3, 0]], "a cell taken from the queue is renumbered in the page; a new row is built beside it and joins when the pass ends")
        for (var row of [0, 1, 2, 3]) { assert.equal(document.querySelectorAll("tr[id=\"cell-" + row + "\"]").length, 1, "row " + row + " is in the page once") }
        assert.equal(table.cellForRow({at: 0}).constructor, Row)
        assert.equal(table.cellForRow({at: 3}).constructor, Other)
        assert.equal(counters.constructed, 0, "rows 0 and 1 took the queued Row cells; the Other cells were handed back or are plain")
    })
})

test("an update asked for from inside the data source throws an Error that names the method, as UIKit raises, and leaves the pass to finish", function() {
    var calls = {
        reloadData: (table) => table.reloadData(),
        insertRows: (table, model) => { model.count++; table.insertRows({at: at(0), with: UITableViewRowAnimation.none}) },
        reconfigureRows: (table) => table.reconfigureRows({at: at(0)}),
        scrollToRow: (table) => table.scrollToRow(0, {at: UITableViewScrollPosition.top, animated: false}),
        selectRow: (table) => table.selectRow({at: 1, animated: false, scrollPosition: UITableViewScrollPosition.top}),
    }
    for (var method of Object.keys(calls)) {
        withTable({count: 5}, function({table, model}) {
            var raised = []
            model.onAsk = function(row) {
                if (row !== 2) { return }
                try { calls[method](table, model) } catch (error) { raised.push(error) }
            }
            table.reloadData()
            assert.equal(raised.length, 1, method)
            assert.ok(raised[0] instanceof Error && raised[0].message.includes("UITableView." + method), method + ": " + raised[0].message)
            assert.equal(table.visibleCells.length, 5, "the outer reload finished")
        })
    }
    withTable({count: 5}, function({table}) {
        table.selectRow({at: 1, animated: false, scrollPosition: UITableViewScrollPosition.none})
        assert.equal(table.indexPathsForSelectedRows.length, 1, "outside an update, none still only records")
    })
})
