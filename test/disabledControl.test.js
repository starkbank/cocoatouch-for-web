import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, IBOutlet, UIView, UIControl, UIButton, UIKeyCommand, UIControlEvent } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { keydown } from "./dom.js"


// A host whose actions record themselves, one @IBAction per [selector, class, method],
// and whose outlets, [selector, class, property], are bound before the actions, as an
// owner's are: the outlet is then the element's owner and the @IBAction's sender is a
// second view over it.
function host(actions, outlets) {
    class Host extends UIView {
        log = []
    }
    for (var [selector, cls, method] of actions) {
        Host.prototype[method] = (function(name) { return function(sender) { this.log.push(name) } })(method)
        IBAction(selector, cls)(Host.prototype, method, {})
    }
    for (var [outletSelector, outletClass, property] of outlets) {
        IBOutlet(outletSelector, outletClass)(Host.prototype, property, {})
    }
    return Host
}

function mount(markup, actions, outlets = []) {
    page("<div id=\"host\">" + markup + "</div>")
    var view = new (host(actions, outlets))("#host")
    Bind.ibOutlet(view)
    Bind.ibAction(view)
    return view
}

function click(selector) {
    var event = new window.MouseEvent("click", {bubbles: true, cancelable: true})
    document.querySelector(selector).dispatchEvent(event)
    return event
}

function nativeClick(selector) {
    document.querySelector(selector).click()
}

test("a disabled UIButton runs neither its @IBAction nor its target, on a click or on element.click()", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]], [["#save", UIButton, "saveButton"]])
    var button = view.saveButton
    var pressed = 0
    button.addTarget({}, {action() { pressed += 1 }, for: UIControlEvent.touchUpInside})
    button.isEnabled = false
    click("#save")
    nativeClick("#save")
    assert.deepEqual(view.log, [])
    assert.equal(pressed, 0)
})

test("a control disabled in the markup is disabled for its actions too", function() {
    var view = mount("<button id=\"save\" disabled>save</button>", [["#save", UIButton, "saveTapped"]])
    click("#save")
    assert.deepEqual(view.log, [])
})

test("after isEnabled = true both fire once, each click", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]], [["#save", UIButton, "saveButton"]])
    var button = view.saveButton
    var pressed = 0
    button.addTarget({}, {action() { pressed += 1 }, for: UIControlEvent.touchUpInside})
    button.isEnabled = false
    click("#save")
    button.isEnabled = true
    click("#save")
    assert.deepEqual(view.log, ["saveTapped"])
    assert.equal(pressed, 1)
})

test("an enabled control keeps firing, and a click that bubbles from an element inside it does too", function() {
    var view = mount("<button id=\"save\"><span id=\"label\">save</span></button>", [["#save", UIButton, "saveTapped"]])
    click("#save")
    click("#label")
    assert.deepEqual(view.log, ["saveTapped", "saveTapped"])
})

test("sendActions fires a disabled control's targets and @IBAction, as a direct call does on Apple", function() {
    var view = mount("<button id=\"save\">save</button>", [["#save", UIButton, "saveTapped"]], [["#save", UIButton, "saveButton"]])
    var button = view.saveButton
    var pressed = 0
    button.addTarget({}, {action() { pressed += 1 }, for: UIControlEvent.touchUpInside})
    button.isEnabled = false
    button.sendActions({for: UIControlEvent.touchUpInside})
    assert.equal(pressed, 1)
    assert.deepEqual(view.log, ["saveTapped"])
    click("#save")
    assert.equal(pressed, 1, "a click on the still disabled control stays blocked")
    assert.deepEqual(view.log, ["saveTapped"])
})

test("sendActions on a disabled control whose action throws leaves the control disabled to a click", function() {
    mount("<button id=\"save\">save</button>", [])
    var button = new UIButton("#save")
    button.addTarget({}, {action() { throw new Error("boom") }, for: UIControlEvent.touchUpInside})
    button.isEnabled = false
    assert.throws(() => button.sendActions({for: UIControlEvent.touchUpInside}), /boom/)
    var calls = 0
    button.removeTarget({}, {for: UIControlEvent.touchUpInside})
    button.addTarget({}, {action() { calls += 1 }, for: UIControlEvent.touchUpInside})
    click("#save")
    assert.equal(calls, 0, "a later click on the still disabled control stays blocked")
})

test("sendActions on one disabled control does not open another disabled control", function() {
    mount("<button id=\"one\">1</button><button id=\"two\">2</button>", [])
    var one = new UIButton("#one")
    var two = new UIButton("#two")
    var fired = []
    one.addTarget({}, {action() { fired.push("one"); two.$el.trigger("click") }, for: UIControlEvent.touchUpInside})
    two.addTarget({}, {action() { fired.push("two") }, for: UIControlEvent.touchUpInside})
    one.isEnabled = false
    two.isEnabled = false
    one.sendActions({for: UIControlEvent.touchUpInside})
    assert.deepEqual(fired, ["one"])
})

test("a disabled outer control with an enabled inner control: a click on the inner runs only the inner action", function() {
    var view = mount("<div id=\"outer\"><button id=\"inner\">go</button></div>", [["#outer", UIControl, "outerTapped"], ["#inner", UIButton, "innerTapped"]], [["#outer", UIControl, "outerControl"]])
    view.outerControl.isEnabled = false
    click("#inner")
    assert.deepEqual(view.log, ["innerTapped"])
})

test("a plain view is never gated: only a UIControl's isEnabled stops its action", function() {
    var view = mount("<div id=\"plain\" disabled>x</div>", [["#plain", UIView, "plainTapped"]])
    click("#plain")
    assert.deepEqual(view.log, ["plainTapped"])
})

test("a disabled control's key command @IBAction is not a control action and still runs", function() {
    class Page extends UIView {
        log = []
        submitted() { this.log.push("submitted") }
    }
    IBAction(UIKeyCommand.inputReturn)(Page.prototype, "submitted", {})
    page("<div id=\"page\"><button id=\"save\">save</button></div>")
    var view = new Page("#page")
    Bind.ibAction(view)
    new UIButton("#save").isEnabled = false
    try {
        keydown("Enter")
    } finally {
        view._dispose()
    }
    assert.deepEqual(view.log, ["submitted"])
})

test("an @IBAction on a checkbox sees the new checked state and leaves the box toggled", function() {
    var seen = []
    class Form extends UIView {
        toggled() { seen.push(document.querySelector("#agree").checked) }
    }
    IBAction("#agree", UIControl)(Form.prototype, "toggled", {})
    page("<div id=\"form\"><input id=\"agree\" type=\"checkbox\"><input id=\"pick\" type=\"radio\"></div>")
    var form = new Form("#form")
    Bind.ibAction(form)
    var event = click("#agree")
    assert.deepEqual(seen, [true])
    assert.equal(document.querySelector("#agree").checked, true)
    assert.equal(event.defaultPrevented, false)
    click("#agree")
    assert.deepEqual(seen, [true, false])
    assert.equal(document.querySelector("#agree").checked, false)
})

test("an @IBAction on a radio leaves it selected", function() {
    class Form extends UIView {
        picked() {}
    }
    IBAction("#pick", UIControl)(Form.prototype, "picked", {})
    page("<div id=\"form\"><input id=\"pick\" type=\"radio\"></div>")
    var form = new Form("#form")
    Bind.ibAction(form)
    var event = click("#pick")
    assert.equal(document.querySelector("#pick").checked, true)
    assert.equal(event.defaultPrevented, false)
})

test("an anchor or a button with an @IBAction still has its default prevented, so it neither navigates nor submits", function() {
    var view = mount("<form id=\"f\"><a id=\"go\" href=\"https://example.com/away\">go</a><button id=\"send\" type=\"submit\">send</button></form>", [["#go", UIControl, "went"], ["#send", UIButton, "sent"]])
    assert.equal(click("#go").defaultPrevented, true)
    assert.equal(click("#send").defaultPrevented, true)
    assert.deepEqual(view.log, ["went", "sent"])
})

test("the exception follows the clicked element, not the sender's class: a UIButton on a wrapper of a checkbox", function() {
    var view = mount("<label id=\"row\"><input id=\"box\" type=\"checkbox\"></label>", [["#row", UIButton, "rowTapped"]])
    var event = click("#box")
    assert.equal(event.defaultPrevented, false)
    assert.equal(document.querySelector("#box").checked, true)
    assert.deepEqual(view.log, ["rowTapped"])
})
