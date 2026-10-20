import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { IBOutlet, UIDatePicker, UIView, UIViewController } from "../src/index.js"


// The picker keeps its input to itself, so a test reads the one in its element.
function inputOf(picker) {
    return $(picker.$el[0]).find("input")
}


// The real ClockPicker 0.0.7 (MIT, vendored as a fixture only), run in the jsdom
// window like a page script: the stand-ins in timePicker.test.js cannot show what
// the plugin leaves behind in the body and on the window. Its own file because
// the stand-ins delete $.fn.clockpicker, and node gives each file a process.
window.jQuery = $
window.eval(readFileSync(new URL("./fixtures/jquery-clockpicker.js", import.meta.url), "utf8"))
$.fn.datepicker = function() { return this }

function clockListeners() {
    var events = $._data(window, "events") || {}
    return (events.resize || []).filter((entry) => entry.namespace.indexOf("clockpicker") !== -1).length
}

var tick = () => new Promise((resolve) => setTimeout(resolve, 20))

function timeController() {
    class Controller extends UIViewController {
        viewDidLoad() { this.picker.datePickerMode = UIDatePicker.Mode.time }
    }
    Controller.nib = "<div id=\"start\" class=\"clockpicker\"></div>"
    IBOutlet("#start", UIDatePicker)(Controller.prototype, "picker", {})
    return new Controller()
}

test("dismissing a controller whose time picker was opened removes the popover and the window listener", async function() {
    page("<cocoatouch></cocoatouch>")
    var controller = timeController()
    controller.present(controller)
    await tick()
    assert.equal(document.querySelectorAll(".clockpicker-popover").length, 0)
    inputOf(controller.picker).trigger("focus")
    assert.equal(document.querySelectorAll(".clockpicker-popover").length, 1)
    assert.equal(clockListeners(), 1)

    var next = new UIViewController()
    next.present(next)
    await tick()
    assert.equal(document.querySelectorAll(".clockpicker-popover").length, 0)
    assert.equal(clockListeners(), 0)
})

test("a time picker that was never opened is disposed without error", async function() {
    page("<cocoatouch></cocoatouch>")
    var controller = timeController()
    controller.present(controller)
    await tick()
    var next = new UIViewController()
    next.present(next)
    await tick()
    assert.equal(clockListeners(), 0)
    assert.equal($("#start").data("clockpicker"), undefined)
})


function popovers() {
    return document.querySelectorAll(".clockpicker-popover").length
}

// U15's repro (a time picker in a child controller whose parent is on the
// page): the controller empties its element before it disposes the views, so a
// picker that re-resolved its element to remove the clock found nothing.
function nestedTimePage() {
    class Page extends UIViewController {
        viewDidLoad() { this.picker.datePickerMode = UIDatePicker.Mode.time }
    }
    Page.nib = "<div id=\"clock\" class=\"clockpicker\"><input id=\"clock-input\" class=\"input\" value=\"23:59\"></div>"
    IBOutlet("#clock", UIDatePicker)(Page.prototype, "picker", {})
    class Host extends UIViewController {}
    Host.nib = "<div id=\"slot\"></div>"
    page("<div id=\"root\"></div>")
    var host = new Host()
    new UIView("#root").addSubview(host.view)
    var child = new Page()
    host.addChild(child)
    new UIView("#slot").addSubview(child.view)
    return child
}

test("removing a child controller whose time picker was opened leaves no popover (U15)", function() {
    var child = nestedTimePage()
    $("#clock-input").trigger("focus")
    assert.equal(popovers(), 1)
    assert.equal(clockListeners(), 1)
    child.removeFromParent()
    assert.equal(popovers(), 0)
    assert.equal(clockListeners(), 0)
})

test("after a controller is removed and presented again, only the live picker's popover and listener remain", function() {
    var first = nestedTimePage()
    $("#clock-input").trigger("focus")
    first.removeFromParent()
    var second = nestedTimePage()
    $("#clock-input").trigger("focus")
    assert.equal(popovers(), 1)
    assert.equal(clockListeners(), 1)
    second.removeFromParent()
    assert.equal(popovers(), 0)
    assert.equal(clockListeners(), 0)
})

test("nothing accumulates over many presents", function() {
    for (var round = 0; round < 8; round++) {
        var child = nestedTimePage()
        $("#clock-input").trigger("focus")
        assert.equal(popovers(), 1, "round " + round)
        assert.equal(clockListeners(), 1, "round " + round)
        child.removeFromParent()
        assert.equal(popovers(), 0, "round " + round)
        assert.equal(clockListeners(), 0, "round " + round)
    }
})

test("switching time, date, time leaves exactly one popover and one listener once the clock opens again", function() {
    var child = nestedTimePage()
    $("#clock-input").trigger("focus")
    assert.equal(popovers(), 1)
    child.picker.datePickerMode = UIDatePicker.Mode.date
    assert.equal(popovers(), 0)
    assert.equal(clockListeners(), 0)
    child.picker.datePickerMode = UIDatePicker.Mode.time
    $("#clock-input").trigger("focus")
    assert.equal(popovers(), 1)
    assert.equal(clockListeners(), 1)
    child.removeFromParent()
    assert.equal(popovers(), 0)
    assert.equal(clockListeners(), 0)
})

test("a time picker whose element was emptied away still releases its clock when it is disposed", function() {
    var child = nestedTimePage()
    $("#clock-input").trigger("focus")
    var picker = child.picker
    picker.$el.parent().empty()
    picker._dispose()
    assert.equal(popovers(), 0)
    assert.equal(clockListeners(), 0)
})
