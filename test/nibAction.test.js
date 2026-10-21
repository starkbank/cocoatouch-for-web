import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, IBOutlet, UIView, UIControl, UIButton, UITextField, UIKeyCommand, UIControlEvent, UIViewController, UITableView, UITableViewCell, UITapGestureRecognizer } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { _controlsOverElement } from "../src/uikit/uicontrol.js"


// A host with one @IBAction per [selector, class, method] and one @IBOutlet per
// [selector, class, property]; every handler records its name and its sender.
function hostOf(actions, outlets = []) {
    class Host extends UIView {
        log = []
        senders = []
    }
    for (var [selector, cls, method] of actions) {
        Host.prototype[method] = (function(name) { return function(sender) { this.log.push(name); this.senders.push(sender) } })(method)
        IBAction(selector, cls)(Host.prototype, method, {})
    }
    for (var [outletSelector, outletClass, property] of outlets) {
        IBOutlet(outletSelector, outletClass)(Host.prototype, property, {})
    }
    return Host
}

function mount(markup, actions, outlets = []) {
    page("<div id=\"host\">" + markup + "</div>")
    var view = new (hostOf(actions, outlets))("#host")
    Bind.ibOutlet(view)
    Bind.ibAction(view)
    return view
}

function click(selector) {
    var event = new window.MouseEvent("click", {bubbles: true, cancelable: true})
    document.querySelector(selector).dispatchEvent(event)
    return event
}

test("an @IBAction on a UIButton runs on a click, cancels an anchor's default and leaves a checkbox its own toggle", function() {
    var view = mount("<a id=\"link\" href=\"#next\">a</a><input id=\"box\" type=\"checkbox\">", [["#link", UIButton, "linkTapped"], ["#box", UIControl, "boxChanged"]])
    assert.equal(click("#link").defaultPrevented, true)
    assert.equal(click("#box").defaultPrevented, false)
    assert.equal(document.querySelector("#box").checked, true)
    assert.deepEqual(view.log, ["linkTapped", "boxChanged"])
})

test("an @IBAction on a plain UIView still runs on a click", function() {
    var view = mount("<div id=\"card\"></div>", [["#card", UIView, "cardTapped"]])
    click("#card")
    assert.deepEqual(view.log, ["cardTapped"])
})

test("an @IBAction of a disabled sender runs nothing", function() {
    var view = mount("<button id=\"save\" disabled>save</button>", [["#save", UIButton, "saveTapped"]])
    click("#save")
    assert.deepEqual(view.log, [])
})

test("the sender of an @IBAction is the outlet that owns the element, as Apple's sender is the outlet object", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]], [["#save", UIButton, "saveButton"]])
    click("#save")
    assert.equal(view.senders.length, 1)
    assert.equal(view.senders[0], view.saveButton)
})

test("the sender is a view of the declared class when no outlet owns the element", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]])
    click("#save")
    assert.ok(view.senders[0] instanceof UIButton)
})

test("an @IBAction connection is the touchUpInside default of UIControl", function() {
    assert.equal(UIControl._nibEvent, UIControlEvent.touchUpInside)
})

test("removeTarget of the owner removes its @IBAction connection for the event", function() {
    var view = mount("<button id=\"save\">save</button><button id=\"other\">o</button>", [["#save", UIButton, "saveTapped"], ["#other", UIButton, "otherTapped"]], [["#save", UIButton, "saveButton"]])
    view.saveButton.removeTarget(view, {for: UIControlEvent.touchUpInside})
    click("#save")
    click("#other")
    assert.deepEqual(view.log, ["otherTapped"])
})

test("removeTarget of the owner with an action removes only that method's connection", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "firstTapped"], ["#save", UIButton, "secondTapped"]], [["#save", UIButton, "saveButton"]])
    view.saveButton.removeTarget(view, {action: view.firstTapped, for: UIControlEvent.touchUpInside})
    click("#save")
    assert.deepEqual(view.log, ["secondTapped"])
})

test("one owner with two declarations on one element runs both, in order", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "firstTapped"], ["#save", UIButton, "secondTapped"]])
    click("#save")
    assert.deepEqual(view.log, ["firstTapped", "secondTapped"])
})

test("two owners declaring one element: the last to bind wins", function() {
    page("<div id=\"host\"><button id=\"go\">go</button></div>")
    var first = new (hostOf([["#go", UIButton, "goTapped"]]))("#host")
    var second = new (hostOf([["#go", UIButton, "goTapped"]]))("#host")
    Bind.ibAction(first)
    Bind.ibAction(second)
    click("#go")
    assert.deepEqual(first.log, [])
    assert.deepEqual(second.log, ["goTapped"])
})

test("binding the same owner twice leaves one connection", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]])
    Bind.ibAction(view)
    click("#save")
    assert.deepEqual(view.log, ["saveTapped"])
})

test("a view class with a nib that is loaded and then placed fires its @IBAction once", function() {
    class Card extends UIView {
        log = []
        goTapped() { this.log.push("go") }
    }
    Card.nib = "<div id=\"card\"><button id=\"go\">go</button></div>"
    IBAction("#go", UIButton)(Card.prototype, "goTapped", {})
    page("<div id=\"stage\"></div>")
    var stage = new UIView("#stage")
    var card = new Card()
    stage.addSubview(card)
    click("#go")
    assert.deepEqual(card.log, ["go"])
})

test("a reused table row keeps one connection", function() {
    var taps = []
    class Row extends UITableViewCell { tapped() { taps.push("row") } }
    Row.nib = "<tr><td><button id=\"tap\"></button></td></tr>"
    IBAction("#tap", UIButton)(Row.prototype, "tapped", {})
    page("<table id=\"t\"><tbody></tbody></table>")
    var table = new UITableView("#t")
    table.register(Row, {forCellReuseIdentifier: "row"})
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return 1 },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) { return tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath}) },
    }
    table.reloadData()
    table.reloadData()
    click("#tap")
    assert.deepEqual(taps, ["row"])
})

// Interface Builder connects actions after outlets and before awakeFromNib,
// so a view may send its own control events from awakeFromNib.
test("awakeFromNib of a placed view can sendActions and reach its @IBAction", function() {
    class Card extends UIView {
        log = []
        goTapped() { this.log.push("go") }
        awakeFromNib() { this.goButton.sendActions({for: UIControlEvent.touchUpInside}) }
    }
    Card.nib = "<div id=\"card\"><button id=\"go\">go</button></div>"
    IBOutlet("#go", UIButton)(Card.prototype, "goButton", {})
    IBAction("#go", UIButton)(Card.prototype, "goTapped", {})
    page("<div id=\"stage\"></div>")
    var card = new Card()
    new UIView("#stage").addSubview(card)
    assert.deepEqual(card.log, ["go"])
})

test("awakeFromNib of an outlet view can sendActions and reach its @IBAction", function() {
    class Inner extends UIView {
        log = []
        goTapped() { this.log.push("go") }
        awakeFromNib() { this.goButton.sendActions({for: UIControlEvent.touchUpInside}) }
    }
    IBOutlet("#go", UIButton)(Inner.prototype, "goButton", {})
    IBAction("#go", UIButton)(Inner.prototype, "goTapped", {})
    class Outer extends UIView {}
    IBOutlet("#inner", Inner)(Outer.prototype, "inner", {})
    page("<div id=\"outer\"><div id=\"inner\"><button id=\"go\">go</button></div></div>")
    var outer = new Outer("#outer")
    Bind.ibOutlet(outer)
    assert.deepEqual(outer.inner.log, ["go"])
})

test("awakeFromNib of a dequeued cell can sendActions and reach its @IBAction", function() {
    var log = []
    class Row extends UITableViewCell {
        tapped() { log.push("tapped") }
        awakeFromNib() { this.tapButton.sendActions({for: UIControlEvent.touchUpInside}) }
    }
    Row.nib = "<tr><td><button id=\"tap\"></button></td></tr>"
    IBOutlet("#tap", UIButton)(Row.prototype, "tapButton", {})
    IBAction("#tap", UIButton)(Row.prototype, "tapped", {})
    page("<table id=\"t\"><tbody></tbody></table>")
    var table = new UITableView("#t")
    table.register(Row, {forCellReuseIdentifier: "row"})
    table.dataSource = {
        tableViewNumberOfRowsInSection: function() { return 1 },
        tableViewCellForRowAtIndexPath: function(tableView, indexPath) { return tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath}) },
    }
    assert.deepEqual(log, ["tapped"])
})

test("the connection exists before inspectables and awakeFromNib, after the outlets", function() {
    var log = []
    class Card extends UIView {
        goTapped() {}
        awakeFromNib() { log.push("awakeFromNib") }
    }
    Card.nib = "<div id=\"card\"><button id=\"go\">go</button></div>"
    IBOutlet("#go", UIButton)(Card.prototype, "goButton", {})
    IBAction("#go", UIButton)(Card.prototype, "goTapped", {})
    var originals = {ibOutlet: Bind.ibOutlet, ibAction: Bind.ibAction, ibInspectable: Bind.ibInspectable}
    Bind.ibOutlet = function(view) { if (view instanceof Card) { log.push("ibOutlet") } return originals.ibOutlet.call(Bind, view) }
    Bind.ibAction = function(view, options) { if (view instanceof Card) { log.push("ibAction") } return originals.ibAction.call(Bind, view, options) }
    Bind.ibInspectable = function(view) { if (view instanceof Card) { log.push("ibInspectable") } return originals.ibInspectable.call(Bind, view) }
    try {
        page("<div id=\"stage\"></div>")
        new UIView("#stage").addSubview(new Card())
    } finally {
        Object.assign(Bind, originals)
    }
    assert.deepEqual(log, ["ibOutlet", "ibAction", "ibInspectable", "awakeFromNib"])
})

test("a control placed, removed and placed again keeps its targets and runs each once", function() {
    class Tap extends UIControl {}
    Tap.nib = "<button class=\"tap\">tap</button>"
    page("<div id=\"box\"></div>")
    var box = new UIView("#box")
    var control = new Tap()
    var calls = 0
    control.addTarget({}, {action: function() { calls += 1 }, for: UIControlEvent.touchUpInside})
    box.addSubview(control)
    control.removeFromSuperview()
    box.addSubview(control)
    control.$el[0].click()
    assert.equal(calls, 1)
    control.sendActions({for: UIControlEvent.touchUpInside})
    assert.equal(calls, 2)
})

test("an action is called with the sender alone, on the target, and its return value cancels nothing", function() {
    page("<div id=\"outer\"><button id=\"go\"></button></div>")
    var button = new UIButton("#go")
    var seen = []
    var target = {name: "target"}
    var secondRan = 0
    button.addTarget(target, {action: function() { seen.push([this, arguments.length, arguments[0]]); return false }, for: UIControlEvent.touchUpInside})
    button.addTarget({}, {action: function() { secondRan += 1 }, for: UIControlEvent.touchUpInside})
    var event = click("#go")
    assert.equal(event.defaultPrevented, false)
    assert.equal(secondRan, 1)
    assert.equal(seen.length, 1)
    assert.equal(seen[0][0], target)
    assert.equal(seen[0][1], 1)
    assert.equal(seen[0][2], button)
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.equal(seen.length, 2)
    assert.equal(seen[1][1], 1)
})

test("an addTarget pair stops its click at the control, an @IBAction connection does not", function() {
    page("<div id=\"outer\"><button id=\"pair\"></button><button id=\"nib\"></button></div>")
    var reached = []
    document.getElementById("outer").addEventListener("click", function(e) { reached.push(e.target.id) })
    new UIButton("#pair").addTarget({}, {action: function() {}, for: UIControlEvent.touchUpInside})
    var view = new (hostOf([["#nib", UIButton, "nibTapped"]]))("#outer")
    Bind.ibAction(view)
    click("#pair")
    click("#nib")
    assert.deepEqual(reached, ["nib"])
})

test("a disabled control's pair is skipped but still stops the click", function() {
    page("<div id=\"outer\"><button id=\"go\"></button></div>")
    var reached = 0
    document.getElementById("outer").addEventListener("click", function() { reached += 1 })
    var button = new UIButton("#go")
    var calls = 0
    button.addTarget({}, {action: function() { calls += 1 }, for: UIControlEvent.touchUpInside})
    button.isEnabled = false
    click("#go")
    assert.equal(calls, 0)
    assert.equal(reached, 0)
})

test("sendActions on a submit button fires no submit and leaves a checkbox as it was", function() {
    page("<form id=\"form\"><button id=\"submit\" type=\"submit\"></button><input id=\"box\" type=\"checkbox\"></form>")
    var submits = 0
    document.getElementById("form").addEventListener("submit", function(e) { e.preventDefault(); submits += 1 })
    var calls = []
    var button = new UIButton("#submit")
    var box = new UIControl("#box")
    button.addTarget({}, {action: function() { calls.push("button") }, for: UIControlEvent.touchUpInside})
    box.addTarget({}, {action: function() { calls.push("box") }, for: UIControlEvent.touchUpInside})
    button.sendActions({for: UIControlEvent.touchUpInside})
    box.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(calls, ["button", "box"])
    assert.equal(submits, 0)
    assert.equal(document.getElementById("box").checked, false)
})

test("sendActions for the editing events leaves the focus where it was", function() {
    page("<input id=\"a\"><input id=\"b\">")
    document.getElementById("a").focus()
    var field = new UITextField("#b")
    var calls = []
    field.addTarget({}, {action: function() { calls.push("begin") }, for: UIControlEvent.editingDidBegin})
    field.addTarget({}, {action: function() { calls.push("end") }, for: UIControlEvent.editingDidEnd})
    field.sendActions({for: UIControlEvent.editingDidBegin})
    field.sendActions({for: UIControlEvent.editingDidEnd})
    assert.deepEqual(calls, ["begin", "end"])
    assert.equal(document.activeElement, document.getElementById("a"))
})

test("sendActions reaches no ancestor row, outer control or tap recognizer, and never triggers a DOM event", function() {
    page("<div id=\"outer\"><button id=\"inner\"></button></div>")
    var log = []
    var outer = new UIControl("#outer")
    outer.addTarget({}, {action: function() { log.push("outer") }, for: UIControlEvent.touchUpInside})
    var tap = new UITapGestureRecognizer({target: {}, action: function() { log.push("recognizer") }})
    outer.addGestureRecognizer(tap)
    var inner = new UIButton("#inner")
    inner.addTarget({}, {action: function() { log.push("inner") }, for: UIControlEvent.touchUpInside})
    var triggered = 0
    var original = $.fn.trigger
    $.fn.trigger = function() { triggered += 1; return original.apply(this, arguments) }
    try {
        inner.sendActions({for: UIControlEvent.touchUpInside})
    } finally {
        $.fn.trigger = original
    }
    assert.deepEqual(log, ["inner"])
    assert.equal(triggered, 0)
})

test("sendActions reaches the pairs of the outlet and the connections of the nib, in the order they were made", function() {
    var log = []
    class Card extends UIView {
        goTapped() { log.push("nib") }
        awakeFromNib() {
            this.goButton.addTarget(this, {action: function() { log.push("pair") }, for: UIControlEvent.touchUpInside})
        }
    }
    Card.nib = "<div id=\"card\"><button id=\"go\">go</button></div>"
    IBOutlet("#go", UIButton)(Card.prototype, "goButton", {})
    IBAction("#go", UIButton)(Card.prototype, "goTapped", {})
    page("<div id=\"stage\"></div>")
    var card = new Card()
    new UIView("#stage").addSubview(card)
    card.goButton.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(log, ["nib", "pair"])
})

test("sendActions on a control that was never placed calls its targets", function() {
    var control = new UIControl()
    var calls = 0
    control.addTarget({}, {action: function() { calls += 1 }, for: UIControlEvent.valueChanged})
    control.sendActions({for: UIControlEvent.valueChanged})
    assert.equal(calls, 1)
})

test("sendActions runs a snapshot: a target removed by an earlier action still runs this time", function() {
    page("<button id=\"go\"></button>")
    var button = new UIButton("#go")
    var log = []
    var second = {}
    button.addTarget({}, {action: function() { log.push("first"); button.removeTarget(second, {for: UIControlEvent.touchUpInside}) }, for: UIControlEvent.touchUpInside})
    button.addTarget(second, {action: function() { log.push("second") }, for: UIControlEvent.touchUpInside})
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(log, ["first", "second"])
})

test("two controls over one element share one dispatch, in the order their targets were added", function() {
    page("<button id=\"go\"></button>")
    var one = new UIButton("#go")
    var two = new UIButton("#go")
    var log = []
    one.addTarget({}, {action: function() { log.push("one") }, for: UIControlEvent.touchUpInside})
    two.addTarget({}, {action: function() { log.push("two") }, for: UIControlEvent.touchUpInside})
    one.addTarget({}, {action: function() { log.push("one again") }, for: UIControlEvent.touchUpInside})
    click("#go")
    assert.deepEqual(log, ["one", "two", "one again"])
})

test("a controller's @IBAction connected before viewDidLoad receives a sendActions from viewDidLoad", async function() {
    var log = []
    class Page extends UIViewController {
        goTapped() { log.push("go") }
        viewDidLoad() { this.goButton.sendActions({for: UIControlEvent.touchUpInside}) }
    }
    Page.nib = "<button id=\"go\"></button>"
    IBOutlet("#go", UIButton)(Page.prototype, "goButton", {})
    IBAction("#go", UIButton)(Page.prototype, "goTapped", {})
    page("<cocoatouch></cocoatouch>")
    var controller = new Page()
    await new Promise((resolve) => controller.present(controller, {completion: resolve}))
    assert.deepEqual(log, ["go"])
})

// The event of an @IBAction is the connection's third field, as Interface
// Builder stores it on the connection: @IBAction(selector, cls, {for}).
function dispatch(selector, type) {
    var event = new window.Event(type, {bubbles: true, cancelable: true})
    document.querySelector(selector).dispatchEvent(event)
    return event
}

test("an @IBAction declared for an event runs on that event and not on the class default", function() {
    class Host extends UIView {
        log = []
        pressed() { this.log.push("pressed") }
    }
    IBAction("#go", UIButton, {for: UIControlEvent.touchDown})(Host.prototype, "pressed", {})
    page("<div id=\"host\"><button id=\"go\">go</button></div>")
    var host = new Host("#host")
    Bind.ibAction(host)
    click("#go")
    assert.deepEqual(host.log, [])
    dispatch("#go", "mousedown")
    assert.deepEqual(host.log, ["pressed"])
})

test("an @IBAction declared for editingChanged on a text field runs when the user types", function() {
    class Host extends UIView {
        log = []
        typed(sender) { this.log.push(sender.constructor.name) }
    }
    IBAction("#name", UITextField, {for: UIControlEvent.editingChanged})(Host.prototype, "typed", {})
    page("<div id=\"host\"><input id=\"name\"></div>")
    var host = new Host("#host")
    Bind.ibAction(host)
    dispatch("#name", "input")
    assert.deepEqual(host.log, ["UITextField"])
})

test("stacked declarations of one method are several connections, one per event", function() {
    class Host extends UIView {
        log = []
        changed() { this.log.push("changed") }
    }
    IBAction("#go", UIButton, {for: UIControlEvent.touchUpInside})(Host.prototype, "changed", {})
    IBAction("#go", UIButton, {for: UIControlEvent.touchDown})(Host.prototype, "changed", {})
    page("<div id=\"host\"><button id=\"go\">go</button></div>")
    var host = new Host("#host")
    Bind.ibAction(host)
    click("#go")
    dispatch("#go", "mousedown")
    assert.deepEqual(host.log, ["changed", "changed"])
})

test("an @IBAction with an event connects to the outlet, and sendActions for that event reaches it", function() {
    class Host extends UIView {
        log = []
        pressed(sender) { this.log.push(sender) }
    }
    IBOutlet("#go", UIButton)(Host.prototype, "goButton", {})
    IBAction("#go", UIButton, {for: UIControlEvent.touchDown})(Host.prototype, "pressed", {})
    page("<div id=\"host\"><button id=\"go\">go</button></div>")
    var host = new Host("#host")
    Bind.ibOutlet(host)
    Bind.ibAction(host)
    host.goButton.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(host.log, [])
    host.goButton.sendActions({for: UIControlEvent.touchDown})
    assert.deepEqual(host.log, [host.goButton])
})

test("an @IBAction refuses an event that is not a UIControlEvent, a class that is not a UIControl, and a key command", function() {
    var target = {}
    assert.throws(() => IBAction("#go", UIButton, {for: "doubleClick"})(target, "m", {}), TypeError)
    assert.throws(() => IBAction("#go", UIButton, {for: null})(target, "m", {}), TypeError)
    assert.throws(() => IBAction("#go", UIView, {for: UIControlEvent.touchDown})(target, "m", {}), TypeError)
    assert.throws(() => IBAction(UIKeyCommand.inputEscape, undefined, {for: UIControlEvent.touchDown})(target, "m", {}), TypeError)
    assert.doesNotThrow(() => IBAction("#go", UIButton, {})(target, "m", {}))
    assert.doesNotThrow(() => IBAction("#go", UIButton)(target, "m", {}))
})

// The element's registry of controls is held for as long as the element lives,
// so a bind that adds a sender each time would grow it with every reload of a row.
test("connecting a nib action registers no control on the element, so rebinding a row's sender again and again grows nothing", function() {
    page("<button id=\"tap\"></button>")
    var owner = {tapped() {}}
    for (var bind = 0; bind < 5; bind++) {
        new UIButton("#tap")._connectNibAction({target: owner, method: "tapped", controlEvent: UIControlEvent.touchUpInside})
    }
    assert.equal(_controlsOverElement(document.getElementById("tap")).length, 0)
    var kept = new UIButton("#tap")
    kept.addTarget({}, {action() {}, for: UIControlEvent.touchUpInside})
    assert.equal(_controlsOverElement(document.getElementById("tap")).length, 1, "an addTarget pair is registered")
})

test("a disposed control's addTarget pair no longer fires on a click of its element, and the registry lets it go", function() {
    page("<button id=\"go\"></button>")
    var button = new UIButton("#go")
    var taps = 0
    button.addTarget({}, {action() { taps += 1 }, for: UIControlEvent.touchUpInside})
    click("#go")
    assert.equal(taps, 1)
    button._dispose()
    click("#go")
    assert.equal(taps, 1)
    assert.equal(_controlsOverElement(document.getElementById("go")).includes(button), false)
})
