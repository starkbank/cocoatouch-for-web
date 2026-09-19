import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIView, UIControl, UITextField, UIImageView, UIImage, UITapGestureRecognizer, UITableView, UITableViewCell, UIDevice, UIControlEvent, UIControlState } from "../src/index.js"
import { datePickerDateFormat, datePickerRegional } from "../src/uikit/datepickerlocale.js"
import { Bind } from "../src/utils/bind.js"
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

test("Locale exposes its language and region; the date picker keeps the formats", function() {
    var brazil = new Locale("pt-BR")
    assert.equal(brazil.languageCode, "pt")
    assert.equal(brazil.regionCode, "BR")
    assert.equal(datePickerDateFormat(brazil), "dd/mm/yy")
    assert.equal(datePickerRegional(brazil).monthNames[0], "Janeiro")
    assert.equal(datePickerDateFormat(new Locale("fr")), "mm/dd/yy")
})

test("UIDevice.current tells the interface idiom from the user agent", function() {
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, "phone")
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, "pad")
    Object.defineProperty(globalThis, "navigator", {value: {userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"}, configurable: true})
    UIDevice._current = undefined
    assert.equal(UIDevice.current.userInterfaceIdiom, "unspecified")
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
    button.setTitle("Send", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    assert.ok(button.showsActivityIndicator)
    assert.match(button.$el.html(), /fa-spin/)
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(button.$el.html(), "Send")
    assert.ok(!button.showsActivityIndicator)
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
    assert.equal(setup.table.indexPath({for: setup.dequeued[2]}).row, 2)
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
    table.deselectRow({at: 0})
    assert.equal(table.indexPathForSelectedRow, null)
})

test("editing state is a property with an iOS-style setter", function() {
    var table = tableWithRows(1).table
    assert.equal(table.isEditing, false)
    table.setEditing(true, {animated: false})
    assert.equal(table.isEditing, true)
})

test("an image view asks a lottie player on the page to load the animation", function() {
    var view = new UIImageView("#animation")
    var loaded = []
    view._$el = $("<lottie-player></lottie-player>")
    view._$el[0] = {load: function(src) { loaded.push(src) }}
    view.image = new UIImage({named: "/static/intro.json"})
    assert.deepEqual(loaded, ["/static/intro.json"])
})

test("a view class with a nib fills the empty element it is created on", function() {
    class Field extends UIView {}
    Field.nib = "<input class=\"inner\">"
    var originalJQuery = globalThis.$
    var el = originalJQuery("#password")
    el.children = function() { return {length: 0} }
    globalThis.$ = function(selector) { return selector === "#password" ? el : originalJQuery(selector) }
    var field = new Field("#password")
    globalThis.$ = originalJQuery
    assert.equal(el.html(), "<input class=\"inner\">")
    assert.equal(field.selector, "#password")
})

test("alpha and isHidden set inside UIView.animate fade instead of switching", function() {
    var view = new UIView("#fading")
    var el = view.$el
    var calls = []
    el.stop = function() { return el }
    el.delay = function() { return el }
    el.fadeTo = function(duration, value) { calls.push(["fadeTo", duration, value]); return el }
    el.fadeOut = function(duration) { calls.push(["fadeOut", duration]); return el }
    UIView.animate({withDuration: 0.5, animations: function() {
        view.alpha = 1
        view.isHidden = true
    }})
    view.alpha = 0.5
    assert.deepEqual(calls, [["fadeTo", 500, 1], ["fadeOut", 500]])
})

test("tag lives on the element and sendActions fires the mapped event", function() {
    var control = new UIControl("#control")
    var el = control.$el
    var attrs = {}, fired = []
    el.attr = function(name, value) { if (value === undefined) { return attrs[name] } attrs[name] = String(value); return el }
    el.trigger = function(event) { fired.push(event); return el }
    assert.equal(control.tag, 0)
    control.tag = 3
    assert.equal(control.tag, 3)
    control.sendActions({for: UIControlEvent.editingChanged})
    control.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(fired, ["input", "click"])
})

test("insertSubview places a view's nib without restyling it and links it", function() {
    var parent = new UIView("#parent")
    var child = UIView.loadFromNib("<span>hi</span>")
    var appended = []
    var el = parent.$el
    el.children = function() { return {length: 0} }
    el.append = function(inserted) { appended.push(inserted.html()); return el }
    parent.insertSubview(child)
    assert.equal(appended.length, 1)
    assert.ok(appended[0].indexOf("<span>hi</span>") !== -1)
    assert.deepEqual(parent.subviews, [child])
    assert.equal(child.superview, parent)
    child.removeFromSuperview()
    assert.deepEqual(parent.subviews, [])
})

test("views answer first responder and text fields expose their selection", function() {
    var field = new UITextField("#field")
    var el = field.$el
    var focused = []
    el.trigger = function(event) { focused.push(event); return el }
    el.is = function(selector) { return selector === ":focus" && focused[focused.length - 1] === "focus" }
    el[0] = {selectionStart: 2, selectionEnd: 4, setSelectionRange: function(s, e) { this.selectionStart = s; this.selectionEnd = e }}
    field.becomeFirstResponder()
    assert.ok(field.isFirstResponder)
    assert.deepEqual(field.selectedTextRange, {start: 2, end: 4})
    field.selectedTextRange = {start: 1, end: 1}
    assert.deepEqual(field.selectedTextRange, {start: 1, end: 1})
    field.resignFirstResponder()
    assert.ok(!field.isFirstResponder)
})

test("accessibilityIdentifier renames a view's element and re-targets the view", function() {
    var view = new UIView("#outer .inner")
    var el = view.$el
    var attrs = {}
    el.attr = function(name, value) { if (arguments.length > 1) { attrs[name] = value; return el } return attrs[name] }
    view.accessibilityIdentifier = "outer-inner"
    assert.equal(view.accessibilityIdentifier, "outer-inner")
    assert.equal(view.identifier, "outer-inner")
    assert.equal(view.selector, "#outer-inner")
    assert.equal(view.$el.attr("id"), "outer-inner")
})
