import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIView, UITapGestureRecognizer, UITableView, UITableViewCell, UIDevice, UIControlEvent } from "../src/index.js"
import { DispatchGroup, IndexPath, Locale } from "../src/index.js"
import { NSString } from "../src/utils/nsstring.js"


test("DispatchGroup notifies once every entered task has left, even when notify comes last", function() {
    var group = new DispatchGroup()
    var done = 0
    group.enter()
    group.enter()
    group.notify(function() { done += 1 })
    group.leave()
    assert.equal(done, 0)
    group.leave()
    assert.equal(done, 1)
    var late = new DispatchGroup()
    late.enter()
    late.leave()
    late.notify(function() { done += 1 })
    assert.equal(done, 2)
})

test("IndexPath carries row and section, item aliases row", function() {
    var indexPath = new IndexPath({row: 3, section: 1})
    assert.equal(indexPath.item, 3)
    assert.equal(new IndexPath({item: 2}).row, 2)
    assert.equal(new IndexPath({row: 0}).section, 0)
    assert.ok(indexPath.isEqual(new IndexPath({row: 3, section: 1})))
    assert.ok(!indexPath.isEqual(new IndexPath({row: 3})))
})

test("Locale knows the date formats and regional strings of its identifier", function() {
    var brazil = new Locale("pt-BR")
    assert.equal(brazil.dateFormat, "dd/mm/yy")
    assert.equal(brazil.momentDateFormat, "DD/MM/YYYY")
    assert.equal(brazil.regional.monthNames[0], "Janeiro")
    assert.equal(brazil.languageCode, "pt")
    assert.equal(brazil.regionCode, "BR")
    assert.equal(new Locale("en").dateFormat, "mm/dd/yy")
    assert.equal(new Locale("fr").dateFormat, "mm/dd/yy")
})

test("UIDevice.current reports the mobile browser family from the user agent", function() {
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.platform, "iPhone")
    assert.equal(UIDevice.current.userInterfaceIdiom, "phone")
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.platform, undefined)
    assert.equal(UIDevice.current.userInterfaceIdiom, "desktop")
    assert.equal(UIDevice.current, UIDevice.current)
})

test("NSString.cleanScript defers to DOMPurify when the page loads it", function() {
    assert.equal(NSString.cleanScript("a<script>x</script>b"), "ab")
    globalThis.DOMPurify = {sanitize: function(text) { return "purified:" + text }}
    assert.equal(NSString.cleanScript("hi"), "purified:hi")
    delete globalThis.DOMPurify
})

test("UIButton.showsActivityIndicator swaps the title for a spinner and restores it", function() {
    var button = new UIButton("#send")
    button.text = "Send"
    button.showsActivityIndicator = true
    assert.ok(button.showsActivityIndicator)
    assert.match(button.$el.html(), /fa-spin/)
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(button.$el.html(), "Send")
    assert.ok(!button.showsActivityIndicator)
})

test("UIButton.icon places the icon left, center or right of the title", function() {
    var button = new UIButton("#b")
    button.icon = {position: "right", icon: "<i></i>", text: "Pay"}
    assert.match(button.$el.html(), /<div>Pay<\/div><div class="btn-content-icon-container"><i><\/i><\/div>/)
})

test("addTarget calls the action with the target and the control", function() {
    var button = new UIButton("#b")
    var seen = null
    var target = {}
    button.addTarget(target, {action: function(t, control) { seen = {t: t, control: control} }, for: UIControlEvent.touchUpInside})
    button.sendActions()
    assert.equal(seen.t, target)
    assert.equal(seen.control, button)
})

test("a tap gesture recognizer runs its action on the target with itself as argument", function() {
    var view = new UIView("#card")
    var seen = null
    var target = {name: "controller"}
    var tap = new UITapGestureRecognizer({target: target, action: function(recognizer) { seen = {self: this, recognizer: recognizer} }})
    view.addGestureRecognizer(tap)
    view.$el.trigger("click")
    assert.equal(seen.self, target)
    assert.equal(seen.recognizer, tap)
    assert.equal(tap.view, view)
})

test("a view's init hook runs when it is constructed", function() {
    class Ready extends UIView { init() { this.ready = true } }
    assert.equal(new Ready("#r").ready, true)
})

class RowCell extends UITableViewCell {}
RowCell.nib = "<tr><td id=\"title\"></td></tr>"

function tableWithRows(count) {
    var table = new UITableView("#table")
    table.register(RowCell, {forCellReuseIdentifier: "row"})
    var dequeued = []
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return count },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
            var cell = tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            dequeued.push(cell)
            return cell
        }
    }
    return {table: table, dequeued: dequeued}
}

test("reloadData dequeues one registered cell per row, bound to its row", function() {
    var setup = tableWithRows(3)
    assert.equal(setup.dequeued.length, 3)
    assert.ok(setup.dequeued[0] instanceof RowCell)
    assert.equal(setup.dequeued[1].reuseIdentifier, "row")
    assert.equal(setup.dequeued[2].indexPath.row, 2)
    assert.equal(setup.table.cellForRow({at: new IndexPath({row: 1})}), setup.dequeued[1])
    assert.equal(setup.table.numberOfRows(), 3)
    assert.equal(setup.dequeued[0].next, setup.table)
})

test("selection follows allowsMultipleSelection and reports through indexPathsForSelectedRows", function() {
    var table = tableWithRows(3).table
    table.selectRow({at: 0})
    table.selectRow({at: new IndexPath({row: 2})})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [2])
    assert.equal(table.indexPathForSelectedRow.row, 2)
    table.allowsMultipleSelection = true
    table.selectRow({at: 0})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [2, 0])
    table.deselectRow({at: 2})
    assert.deepEqual(table.indexPathsForSelectedRows.map(function(p) { return p.row }), [0])
    table.selectAllRows()
    assert.equal(table.indexPathsForSelectedRows.length, 3)
    table.deselectAllRows()
    assert.equal(table.indexPathForSelectedRow, null)
})

test("editing state is a property with an iOS-style setter", function() {
    var table = tableWithRows(1).table
    assert.equal(table.isEditing, false)
    table.setEditing(true, {animated: false})
    assert.equal(table.isEditing, true)
})
