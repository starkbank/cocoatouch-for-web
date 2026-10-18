import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { IBOutlet, UIDatePicker, UIViewController } from "../src/index.js"


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
        viewDidLoad() { this.picker.datePickerMode = "time" }
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
    controller.picker.$input.trigger("focus")
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
