import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UIView, UITableView, UITableViewCell, IndexPath, UITableViewCellEditingStyle } from "../src/index.js"
import { addPendingUnhide, resolvePendingUnhides } from "../src/utils/pendingunhides.js"


var awakened = []

class Row extends UITableViewCell {
    awakeFromNib() { awakened.push(this) }
}
Row.nib = "<tr><td id=\"table-cell-selected\"><input type=\"checkbox\"></td><td id=\"amount\"></td><td><span class=\"flag gone\">f</span></td><td><button id=\"delete-button\"></button></td></tr>"
IBOutlet("#amount", UILabel)(Row.prototype, "amountLabel", {})
IBOutlet(".flag", UIView)(Row.prototype, "flag", {})

function at(...rows) {
    return rows.map((row) => new IndexPath({row}))
}

function tableOf(names, {onCell = () => {}} = {}) {
    page("<table id=\"table\"><tbody></tbody></table>")
    var table = new UITableView("#table")
    table.register(Row, {forCellReuseIdentifier: "row"})
    var model = {names: names.slice()}
    var events = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: () => model.names.length,
        tableViewCellForRowAtIndexPath(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            cell.amountLabel.text = model.names[indexPath.row]
            onCell({cell, tableView, indexPath})
            return cell
        },
    }
    table.delegate = {
        tableViewDidSelectRowAtIndexPath(tableView, indexPath) { events.push("select:" + indexPath.row) },
        tableViewCommitEditingStyleForRowAtIndexPath(tableView, style, indexPath) { events.push(style + ":" + indexPath.row) },
    }
    table.reloadData()
    awakened.length = 0
    return {table, model, events}
}

function names(count, from = 0) {
    return Array.from({length: count}, (unused, index) => "n" + (from + index))
}

function click(element) {
    element.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
}

function ids() {
    return Array.from(document.querySelectorAll("#table > tbody > tr")).map((row) => row.id)
}

function withStyle(css, body) {
    var style = document.createElement("style")
    style.textContent = css
    document.head.appendChild(style)
    return Promise.resolve(body()).finally(() => style.remove())
}

test("one insertRows of 100 rows is one childList record on the tbody with 100 added nodes", function() {
    var {table, model} = tableOf(names(3))
    var tbody = document.querySelector("#table > tbody")
    var observer = new window.MutationObserver(() => {})
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true})
    model.names.push(...names(100, 3))
    table.insertRows({at: at(...Array.from({length: 100}, (unused, index) => 3 + index)), with: UITableView.RowAnimation.none})
    var records = observer.takeRecords()
    observer.disconnect()
    assert.equal(records.length, 1)
    assert.equal(records[0].type, "childList")
    assert.equal(records[0].target, tbody)
    assert.equal(records[0].addedNodes.length, 100)
})

test("rows inserted in two separate runs land as one record per run, in order", function() {
    var {table, model} = tableOf(names(4))
    var observer = new window.MutationObserver(() => {})
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true})
    model.names.splice(1, 0, "x")
    model.names.splice(4, 0, "y", "z")
    table.insertRows({at: at(1, 4, 5), with: UITableView.RowAnimation.none})
    var records = observer.takeRecords().filter((record) => record.type === "childList")
    observer.disconnect()
    assert.deepEqual(records.map((record) => record.addedNodes.length), [2, 1])
    assert.deepEqual(ids(), ["cell-0", "cell-1", "cell-2", "cell-3", "cell-4", "cell-5", "cell-6"])
    assert.deepEqual(Array.from(document.querySelectorAll("#amount")).map((element) => element.textContent), ["n0", "x", "n1", "n2", "y", "z", "n3"])
})

test("inserted rows end in order with working outlets, actions and handlers, and awaken once each", function() {
    var {table, model, events} = tableOf(names(2))
    table.setEditing(true, {animated: false})
    model.names.push("a", "b", "c")
    table.insertRows({at: at(2, 3, 4), with: UITableView.RowAnimation.none})
    assert.deepEqual(ids(), ["cell-0", "cell-1", "cell-2", "cell-3", "cell-4"])
    assert.deepEqual(Array.from(document.querySelectorAll("#amount")).map((element) => element.textContent), ["n0", "n1", "a", "b", "c"])
    assert.equal(awakened.length, 3)
    assert.equal(new Set(awakened).size, 3)
    assert.equal(table.cellForRow({at: 4}).amountLabel.text, "c")
    click(document.getElementById("cell-3").children[1])
    assert.equal(table.indexPathForSelectedRow.row, 3)
    click(document.getElementById("cell-4").querySelector("button"))
    var checkbox = document.getElementById("cell-2").querySelector("input[type=checkbox]")
    checkbox.checked = true
    checkbox.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.deepEqual(events, ["select:3", UITableViewCellEditingStyle.delete + ":4", "select:2"])
})

test("a stylesheet-hidden view unhidden while its row is detached shows its natural display after the insert", async function() {
    await withStyle(".gone { display: none; }", async function() {
        var {table, model} = tableOf(names(1), {onCell: ({cell}) => { cell.flag.isHidden = false }})
        model.names.push("a", "b")
        table.insertRows({at: at(1, 2), with: UITableView.RowAnimation.none})
        await Promise.resolve()
        for (var flag of document.querySelectorAll("#table .flag")) {
            assert.equal(getComputedStyle(flag).display, "inline")
        }
    })
})

test("a resolve forced by a contentOffset read while the row is detached does not drop the pending unhide", async function() {
    await withStyle(".gone { display: none; }", async function() {
        var offsets = []
        var {table, model} = tableOf(names(1), {onCell: ({cell, tableView}) => {
            if (tableView.numberOfRows({inSection: 0}) === 1) { return }
            cell.flag.isHidden = false
            offsets.push(tableView.contentOffset)
        }})
        model.names.push("a", "b")
        table.insertRows({at: at(1, 2), with: UITableView.RowAnimation.none})
        assert.equal(offsets.length, 2)
        await Promise.resolve()
        for (var flag of document.querySelectorAll("#cell-1 .flag, #cell-2 .flag")) {
            assert.equal(getComputedStyle(flag).display, "inline")
        }
    })
})

test("resolvePendingUnhides writes the connected element, keeps the detached one pending and resolves it once attached", async function() {
    await withStyle(".gone { display: none; }", async function() {
        page("<div id=\"here\" class=\"gone\"></div>")
        var here = document.getElementById("here")
        var away = document.createElement("div")
        away.className = "gone"
        addPendingUnhide(here)
        addPendingUnhide(away)
        resolvePendingUnhides()
        assert.equal(here.style.display, "block")
        assert.equal(away.style.display, "")
        document.body.appendChild(away)
        resolvePendingUnhides()
        assert.equal(away.style.display, "block")
    })
})

test("a view unhidden while detached and then disposed leaves nothing pending to resolve", async function() {
    await withStyle(".gone { display: none; }", async function() {
        page("")
        var element = document.createElement("div")
        element.className = "gone"
        var view = new UIView()
        view._$el = $(element)
        view.isHidden = false
        view._dispose()
        document.body.appendChild(element)
        resolvePendingUnhides()
        assert.equal(element.style.display, "")
    })
})
