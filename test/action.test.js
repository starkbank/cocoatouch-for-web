import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, IBAction, UIView, UIButton, UIControlEvent, UIViewController, UITapGestureRecognizer, UITableView, UITableViewCell } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

test("two targets added to one control both fire, in order, and each action runs on its target", function() {
    page("<button id=\"send\"></button>")
    var button = new UIButton("#send")
    var log = []
    var first = {name: "first"}, second = {name: "second"}
    button.addTarget(first, {action: function(target, control) { log.push([this.name, target.name, control]) }, for: UIControlEvent.touchUpInside})
    button.addTarget(second, {action: function() { log.push([this.name]) }, for: UIControlEvent.touchUpInside})
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(log, [["first", "first", button], ["second"]])
})

test("removeTarget with an action removes that pair only; without one it removes all of the target's for the event", function() {
    page("<button id=\"send\"></button>")
    var button = new UIButton("#send")
    var log = []
    var target = {}, other = {}
    var a = function() { log.push("a") }
    var b = function() { log.push("b") }
    var c = function() { log.push("c") }
    button.addTarget(target, {action: a, for: UIControlEvent.touchUpInside})
    button.addTarget(target, {action: b, for: UIControlEvent.touchUpInside})
    button.addTarget(other, {action: c, for: UIControlEvent.touchUpInside})
    button.removeTarget(target, {action: a, for: UIControlEvent.touchUpInside})
    button.sendActions()
    assert.deepEqual(log, ["b", "c"])
    log.length = 0
    button.removeTarget(target, {for: UIControlEvent.touchUpInside})
    button.sendActions()
    assert.deepEqual(log, ["c"])
    log.length = 0
    button.removeTarget(other, {action: null, for: UIControlEvent.touchUpInside})
    button.sendActions()
    assert.deepEqual(log, [])
})

test("an @IBAction and an addTarget on the same element both fire", async function() {
    var log = []
    class Controller extends UIViewController {
        openTapped(sender) { log.push("ibaction:" + sender.identifier) }
        viewDidLoad() {
            this.openButton.addTarget(this, {action: function() { log.push("target") }, for: UIControlEvent.touchUpInside})
        }
    }
    Controller.nib = "<button id=\"open\"></button>"
    IBOutlet("#open", UIButton)(Controller.prototype, "openButton", {})
    IBAction("#open", UIButton)(Controller.prototype, "openTapped", {})
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    $("#open").trigger("click")
    assert.deepEqual(log.sort(), ["ibaction:open", "target"])
})

test("a class-matched @IBAction sender without an id gets one, and its $el survives the node being replaced", async function() {
    var seen = []
    class Menu extends UIView {
        optionTapped(sender) { seen.push(sender) }
    }
    IBAction(".menu-option", UIButton)(Menu.prototype, "optionTapped", {})
    class Controller extends UIViewController {}
    Controller.nib = "<nav id=\"menu\"><a class=\"menu-option\">A</a><a class=\"menu-option\">B</a></nav>"
    IBOutlet("#menu", Menu)(Controller.prototype, "menu", {})
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    var second = $(".menu-option").eq(1)
    second.trigger("click")
    assert.equal(seen.length, 1)
    var sender = seen[0]
    assert.ok(sender.selector.indexOf("undefined") === -1, sender.selector)
    assert.equal(sender.identifier, second.attr("id"))
    assert.match(sender.identifier, /^menu-option-tapped-2$/)
    var node = sender.$el[0]
    var clone = node.cloneNode(true)
    node.replaceWith(clone)
    assert.equal(sender.$el[0], clone)
    assert.equal($(".menu-option").eq(0).attr("id"), "menu-option-tapped-1")
})

test("two gesture recognizers on one view both fire", function() {
    page("<div id=\"card\"></div>")
    var view = new UIView("#card")
    var log = []
    view.addGestureRecognizer(new UITapGestureRecognizer({target: {}, action: function() { log.push("one") }}))
    view.addGestureRecognizer(new UITapGestureRecognizer({target: {}, action: function() { log.push("two") }}))
    view.$el.trigger("click")
    assert.deepEqual(log, ["one", "two"])
})

// Row elements persist across reloads, so a cell class bound to row 0 on one
// pass and a different one on the next must leave only the current cell's
// action on the row's button.
test("binding an @IBAction twice over one element leaves one handler: a replaced cell's action no longer fires", function() {
    var taps = []
    class CellA extends UITableViewCell { tapped() { taps.push("A") } }
    class CellB extends UITableViewCell { tapped() { taps.push("B") } }
    CellA.nib = CellB.nib = "<tr><td><button id=\"tap\"></button></td></tr>"
    IBAction("#tap", UIButton)(CellA.prototype, "tapped", {})
    IBAction("#tap", UIButton)(CellB.prototype, "tapped", {})
    page("<table id=\"t\"><tbody></tbody></table>")
    var table = new UITableView("#t")
    table.register(CellA, {forCellReuseIdentifier: "a"})
    table.register(CellB, {forCellReuseIdentifier: "b"})
    var which = "a"
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return 1 },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) { return tableView.dequeueReusableCell({withIdentifier: which, for: indexPath}) },
    }
    which = "b"
    table.reloadData()
    $("#t").find("#tap").trigger("click")
    assert.deepEqual(taps, ["B"])
})

// A control created in code has no element until addSubview places it, so
// the highlight tracking must bind then, and only once.
test("a control created without a selector and added with addSubview tracks the pointer in isHighlighted, with one binding", function() {
    class Go extends UIButton {}
    Go.nib = "<button class=\"go\">Go</button>"
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var button = new Go()
    host.addSubview(button)
    assert.equal(button.isHighlighted, false)
    button.$el.trigger("pointerdown")
    assert.equal(button.isHighlighted, true)
    assert.deepEqual(button.state, ["highlighted"])
    button.$el.trigger("pointerup")
    assert.equal(button.isHighlighted, false)
    var events = $._data(button.$el[0], "events")
    assert.equal(events.pointerdown.length, 1)
    assert.equal(events.pointerup.length, 1)
})
