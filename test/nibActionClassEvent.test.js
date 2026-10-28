import { page } from "./dom.js"
import test, { mock } from "node:test"
import assert from "node:assert/strict"
import { IBAction, IBOutlet, UIViewController, UIView, UISwitch, UISegmentedControl, UIColorWell, UIDatePicker, UITextField, UISearchTextField, UIControl, UIControlEvent } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


// A host with one @IBAction connected the way Interface Builder does it, with
// no event named: the class's own default decides which gesture runs it.
function mount(markup, selector, cls) {
    class Host extends UIView {
        log = []
        changed(sender) { this.log.push(sender) }
    }
    IBAction(selector, cls)(Host.prototype, "changed", {})
    page("<div id=\"host\">" + markup + "</div>")
    var view = new Host("#host")
    Bind.ibAction(view)
    return view
}

function fire(selector, type, init = {}) {
    document.querySelector(selector).dispatchEvent(new window.Event(type, {bubbles: true, cancelable: true, ...init}))
}

test("the nib event of each class is the one Interface Builder connects", function() {
    assert.equal(UIControl._nibEvent, UIControlEvent.touchUpInside)
    assert.equal(UISwitch._nibEvent, UIControlEvent.valueChanged)
    assert.equal(UISegmentedControl._nibEvent, UIControlEvent.valueChanged)
    assert.equal(UIColorWell._nibEvent, UIControlEvent.valueChanged)
    assert.equal(UIDatePicker._nibEvent, UIControlEvent.valueChanged)
    assert.equal(UITextField._nibEvent, UIControlEvent.editingDidEnd)
    assert.equal(UISearchTextField._nibEvent, UIControlEvent.editingDidEnd)
})

test("an @IBAction on a UISwitch runs once on the toggle and reads the new state", function() {
    var view = mount("<input id=\"flag\" type=\"checkbox\">", "#flag", UISwitch)
    var box = document.querySelector("#flag")
    box.click()
    assert.equal(view.log.length, 1)
    assert.equal(view.log[0].isOn, true)
    box.checked = false
    fire("#flag", "change")
    assert.equal(view.log.length, 2)
})

test("an @IBAction on a UISegmentedControl runs when a segment is tapped, after it is selected", function() {
    var view = mount("<div id=\"tabs\"><button>A</button><button>B</button></div>", "#tabs", UISegmentedControl)
    document.querySelectorAll("#tabs button")[1].click()
    assert.equal(view.log.length, 1)
    assert.equal(view.log[0].selectedSegmentIndex, 1)
})

test("an @IBAction on a UIColorWell runs on a pick and not when the chooser opens", function() {
    var view = mount("<div id=\"well\"></div>", "#well", UIColorWell)
    var input = document.querySelector("#well input")
    input.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    assert.equal(view.log.length, 0)
    input.value = "#ff0000"
    input.dispatchEvent(new window.Event("change", {bubbles: true}))
    assert.equal(view.log.length, 1)
    assert.equal(view.log[0].selectedColor.cgColor, "#ff0000")
})

test("an @IBAction on a UIDatePicker runs when a date is picked", function() {
    var widget = {options: {}, date: null}
    $.fn.datepicker = function(method, name) {
        if (typeof method === "object") { Object.assign(widget.options, method); return this }
        if (method === "setDate") { widget.date = name; return this }
        if (method === "getDate") { return widget.date }
        return this
    }
    mock.timers.enable({apis: ["setTimeout"]})
    try {
        var view = mount("<div id=\"when\"></div>", "#when", UIDatePicker)
        widget.options.beforeShow()
        widget.date = new Date(2026, 9, 21)
        widget.options.onSelect()
        assert.equal(view.log.length, 1)
        assert.equal(view.log[0].date.getDate(), 21)
    } finally {
        mock.timers.reset()
        delete $.fn.datepicker
    }
})

test("an @IBAction on a UITextField runs when editing ends, not on a click or a keystroke", function() {
    var view = mount("<input id=\"name\">", "#name", UITextField)
    var input = document.querySelector("#name")
    input.focus()
    input.click()
    fire("#name", "input")
    assert.equal(view.log.length, 0)
    input.blur()
    assert.equal(view.log.length, 1)
})

test("an @IBAction on a UISearchTextField runs once when its input loses the focus, not on a click or a keystroke", function() {
    var view = mount("<div id=\"search\"></div>", "#search", UISearchTextField)
    var input = document.querySelector("#search input")
    input.focus()
    input.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    fire("#search input", "input")
    assert.equal(view.log.length, 0)
    input.blur()
    assert.equal(view.log.length, 1)
    assert.ok(view.log[0] instanceof UISearchTextField)
})

test("on a restored page a UISearchTextField revived over its pre-rendered wrapper runs its default action once on a native blur", function() {
    Bind._restorePrototypes.clear()
    var taps = []
    class Panel extends UIView {
        changed(sender) { taps.push(sender) }
    }
    IBAction("#search", UISearchTextField)(Panel.prototype, "changed", {})
    class Controller extends UIViewController {}
    page("<cocoatouch><div id=\"panel\"><div id=\"search\"><input class=\"search-input-tag\"></div></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var input = document.querySelector("#search input")
    input.focus()
    input.dispatchEvent(new window.MouseEvent("click", {bubbles: true, cancelable: true}))
    assert.equal(taps.length, 0)
    input.blur()
    assert.equal(taps.length, 1)
    Bind._restorePrototypes.clear()
})

test("an @IBAction on a UISearchTextField outlet runs once on blur after a restore", function() {
    Bind._restorePrototypes.clear()
    var taps = []
    class Controller extends UIViewController {
        changed(sender) { taps.push(sender) }
    }
    IBOutlet("#search", UISearchTextField)(Controller.prototype, "searchField", {})
    IBAction("#search", UISearchTextField)(Controller.prototype, "changed", {})
    page("<cocoatouch><div id=\"search\"><input class=\"search-input-tag\"></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var input = document.querySelector("#search input")
    input.focus()
    input.blur()
    assert.equal(taps.length, 1)
    assert.equal(taps[0], controller.searchField)
    Bind._restorePrototypes.clear()
})
