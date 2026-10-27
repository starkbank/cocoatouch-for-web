import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableView, UITableViewCell, UITableViewRowAnimation, UITableViewScrollPosition, IndexPath } from "../src/index.js"


class ItemCell extends UITableViewCell {
    prepared = 0
    prepareForReuse() { this.prepared += 1 }
}
ItemCell.nib = "<tr><td class=\"title\"></td></tr>"
IBOutlet(".title", UILabel)(ItemCell.prototype, "titleLabel", {})

// A table over `items`, which the test changes before telling the table; `asked`
// records the rows the data source is asked for.
function tableOf(items) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(ItemCell, {forCellReuseIdentifier: "item"})
    var asked = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => items.length,
        tableViewCellForRowAtIndexPath: (tableView, indexPath) => {
            asked.push(indexPath.row)
            var cell = tableView.dequeueReusableCell({withIdentifier: "item", for: indexPath})
            cell.titleLabel.text = items[indexPath.row]
            return cell
        },
    }
    asked.length = 0
    return {table, asked}
}

function rows() {
    return Array.from(document.querySelectorAll("#table tbody > tr"))
}

function texts() {
    return rows().map((row) => row.textContent)
}

function paths(...numbers) {
    return numbers.map((row) => new IndexPath({row}))
}

// Counts the insertions into the table body: a run of rows is one write.
function countBodyWrites(work) {
    var body = document.querySelector("#table tbody")
    var writes = 0
    var append = body.appendChild
    var insert = body.insertBefore
    body.appendChild = function(...args) { writes += 1; return append.apply(this, args) }
    body.insertBefore = function(...args) { writes += 1; return insert.apply(this, args) }
    try { work() } finally {
        body.appendChild = append
        body.insertBefore = insert
    }
    return writes
}

test("UITableView.RowAnimation has Apple's cases, frozen", function() {
    assert.equal(UITableView.RowAnimation, UITableViewRowAnimation)
    assert.deepEqual(Object.keys(UITableView.RowAnimation), ["fade", "right", "left", "top", "bottom", "none", "middle", "automatic"])
    assert.ok(Object.isFrozen(UITableView.RowAnimation))
})

test("insertRows at the end asks only for the new rows and keeps the drawn rows' elements and cells", function() {
    var items = ["a", "b"]
    var {table, asked} = tableOf(items)
    var drawn = rows()
    var cells = [0, 1].map((row) => table.cellForRow({at: new IndexPath({row})}))
    items.push("c", "d")
    table.insertRows({at: paths(2, 3), with: UITableView.RowAnimation.none})
    assert.deepEqual(asked, [2, 3])
    assert.deepEqual(texts(), ["a", "b", "c", "d"])
    assert.equal(rows()[0], drawn[0])
    assert.equal(rows()[1], drawn[1])
    assert.equal(table.cellForRow({at: new IndexPath({row: 0})}), cells[0])
    assert.deepEqual(rows().map((row) => row.id), ["cell-0", "cell-1", "cell-2", "cell-3"])
    assert.equal(table.subviews.length, 4)
})

test("insertRows in the middle moves the rows below down and renumbers them", function() {
    var items = ["a", "b", "c"]
    var {table, asked} = tableOf(items)
    var c = table.cellForRow({at: new IndexPath({row: 2})})
    items.splice(1, 0, "x")
    items.splice(3, 0, "y")
    table.insertRows({at: paths(3, 1), with: UITableView.RowAnimation.automatic})
    assert.deepEqual(asked, [1, 3])
    assert.deepEqual(texts(), ["a", "x", "b", "y", "c"])
    assert.deepEqual(rows().map((row) => row.id), ["cell-0", "cell-1", "cell-2", "cell-3", "cell-4"])
    assert.equal(table.cellForRow({at: new IndexPath({row: 4})}), c)
    assert.deepEqual(table.indexPath({for: c}), new IndexPath({row: 4}))
})

test("each run of consecutive new rows is put in with one write", function() {
    var items = ["a", "b"]
    var {table} = tableOf(items)
    items.push("c", "d", "e", "f")
    assert.equal(countBodyWrites(() => table.insertRows({at: paths(2, 3, 4, 5), with: UITableView.RowAnimation.none})), 1)
    items.splice(0, 0, "y")
    items.splice(2, 0, "z")
    assert.equal(countBodyWrites(() => table.insertRows({at: paths(0, 2), with: UITableView.RowAnimation.none})), 2)
    assert.deepEqual(texts(), ["y", "a", "z", "b", "c", "d", "e", "f"])
})

test("a selected row stays selected at its new position after an insertion above it", function() {
    var items = ["a", "b"]
    var {table} = tableOf(items)
    table.allowsMultipleSelection = true
    table.selectRow({at: new IndexPath({row: 1}), animated: false, scrollPosition: UITableViewScrollPosition.none})
    items.unshift("z")
    table.insertRows({at: paths(0), with: UITableView.RowAnimation.none})
    assert.deepEqual(table.indexPathsForSelectedRows, paths(2))
})

test("a row inserted after insertRows answers a tap with its new index path", function() {
    var items = ["a"]
    var {table} = tableOf(items)
    var tapped = []
    table.delegate = {tableViewDidSelectRowAtIndexPath: (tableView, indexPath) => tapped.push(indexPath.row)}
    items.unshift("z")
    table.insertRows({at: paths(0), with: UITableView.RowAnimation.none})
    rows()[1].click()
    rows()[0].click()
    assert.deepEqual(tapped, [1, 0])
})

test("reconfigureRows asks for those rows again and hands back the cell already there, without prepareForReuse", function() {
    var items = ["a", "b", "c"]
    var {table, asked} = tableOf(items)
    var b = table.cellForRow({at: new IndexPath({row: 1})})
    var element = rows()[1]
    items[1] = "b!"
    table.reconfigureRows({at: paths(1)})
    assert.deepEqual(asked, [1])
    assert.equal(table.cellForRow({at: new IndexPath({row: 1})}), b)
    assert.equal(b.prepared, 0)
    assert.equal(rows()[1], element)
    assert.deepEqual(texts(), ["a", "b!", "c"])
    assert.equal(table.subviews.length, 3)
})

test("insertRows and reconfigureRows require Apple's labels", function() {
    var {table} = tableOf(["a"])
    assert.throws(() => table.insertRows({at: paths(1)}), /UITableView\.insertRows requires a with: Apple's is insertRows\(at:with:\)/)
    assert.throws(() => table.insertRows({at: paths(1), with: "slide"}), /UITableView\.RowAnimation/)
    assert.throws(() => table.insertRows({with: UITableView.RowAnimation.none}), /requires a at/)
    assert.throws(() => table.reconfigureRows({}), /reconfigureRows\(at:\)/)
})
