import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIDatePicker, UIControlEvent, Locale } from "../src/index.js"


// jQuery UI is a page script the framework wraps, so this stand-in records
// what the picker asks of it; the native input is jsdom's own.
function withDatepicker(run) {
    var log = []
    $.fn.datepicker = function(method, name) {
        if (typeof method === "object") { log.push("datepicker:init"); return this }
        log.push("datepicker:" + [method, name].filter((part) => part !== undefined).join(":"))
        return this
    }
    try { run(log) } finally { delete $.fn.datepicker }
}

var markup = "<div id=\"start\"><input id=\"start-field\" class=\"input\" readonly></div>"

function nativePicker() {
    page(markup)
    var picker = new UIDatePicker("#start")
    picker.datePickerMode = "dateAndTime"
    return picker
}

test("datePickerMode = \"dateAndTime\" swaps the calendar for a native datetime-local input", function() {
    page(markup)
    withDatepicker(function(log) {
        var picker = new UIDatePicker("#start")
        log.length = 0
        picker.datePickerMode = "dateAndTime"
        assert.equal(picker.datePickerMode, "dateAndTime")
        assert.deepEqual(log, ["datepicker:destroy"])
        var input = document.getElementById("start-field")
        assert.equal(input.type, "datetime-local")
        assert.equal(input.hasAttribute("readonly"), false)
        assert.equal(document.querySelectorAll("#start input").length, 1)
    })
})

test("date holds the picked day and time to the minute in local time and round-trips", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        assert.equal(picker.date, null)
        picker.date = new Date(2026, 0, 5, 9, 7, 30)
        assert.equal(picker.$input.prop("value"), "2026-01-05T09:07")
        var read = picker.date
        assert.deepEqual([read.getFullYear(), read.getMonth(), read.getDate(), read.getHours(), read.getMinutes(), read.getSeconds()], [2026, 0, 5, 9, 7, 0])
        picker.setDate(new Date(2031, 11, 31, 23, 59), {animated: false})
        assert.equal(picker.$input.prop("value"), "2031-12-31T23:59")
        picker.date = null
        assert.equal(picker.date, null)
    })
})

test("a value the input cannot hold reads as null", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        picker.$input.prop("value", "2026-02-30T10:00")
        assert.equal(picker.date, null)
        picker.$input.prop("value", "not a date")
        assert.equal(picker.date, null)
    })
})

test("setDate requires animated and a Date", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        assert.throws(() => picker.setDate(new Date(), {}), TypeError)
        assert.throws(() => picker.setDate("2026-01-01T10:00", {animated: false}), TypeError)
    })
})

test("minimumDate and maximumDate are the input's min and max, and null clears them", function() {
    withDatepicker(function(log) {
        var picker = nativePicker()
        log.length = 0
        assert.equal(picker.minimumDate, null)
        assert.equal(picker.maximumDate, null)
        picker.minimumDate = new Date(2026, 0, 1, 8, 30)
        picker.maximumDate = new Date(2026, 11, 31, 18, 0)
        var input = document.getElementById("start-field")
        assert.equal(input.min, "2026-01-01T08:30")
        assert.equal(input.max, "2026-12-31T18:00")
        assert.deepEqual([picker.minimumDate.getFullYear(), picker.minimumDate.getHours(), picker.minimumDate.getMinutes()], [2026, 8, 30])
        assert.deepEqual([picker.maximumDate.getMonth(), picker.maximumDate.getDate(), picker.maximumDate.getHours()], [11, 31, 18])
        picker.minimumDate = null
        picker.maximumDate = null
        assert.equal(input.hasAttribute("min"), false)
        assert.equal(input.hasAttribute("max"), false)
        assert.deepEqual(log, [])
    })
})

test("a change the user commits is a valueChanged with the picker as the sender, and writing a date sends none", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        var seen = []
        picker.addTarget({}, {action: function(target, sender) { seen.push(sender) }, for: UIControlEvent.valueChanged})
        picker.date = new Date(2026, 5, 1, 12, 0)
        assert.equal(seen.length, 0)
        var input = document.getElementById("start-field")
        input.value = "2026-06-02T13:15"
        input.dispatchEvent(new window.Event("change", {bubbles: true}))
        assert.equal(seen.length, 1)
        assert.equal(seen[0], picker)
        assert.equal(seen[0].date.getDate(), 2)
    })
})

test("a click on the input opens the native picker, and a missing showPicker is not an error", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        var input = document.getElementById("start-field")
        assert.doesNotThrow(() => input.dispatchEvent(new window.MouseEvent("click", {bubbles: true})))
        var opened = 0
        input.showPicker = function() { opened++ }
        input.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
        assert.equal(opened, 1)
        picker.datePickerMode = "dateAndTime"
        input.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
        assert.equal(opened, 2, "setting the mode again binds one handler, not two")
    })
})

test("a locale set in dateAndTime mode is kept and does not reach the destroyed calendar", function() {
    withDatepicker(function(log) {
        var picker = nativePicker()
        log.length = 0
        picker.locale = new Locale("pt-BR")
        assert.equal(picker.locale.identifier, "pt-BR")
        assert.equal(document.getElementById("start-field").type, "datetime-local")
        assert.ok(!log.some((entry) => entry.indexOf("datepicker:option") === 0))
    })
})

test("a locale or the same mode set again keeps the value and the native input", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        picker.date = new Date(2026, 0, 5, 9, 7)
        picker.locale = new Locale("pt-BR")
        picker.datePickerMode = "dateAndTime"
        assert.equal(picker.$input.prop("value"), "2026-01-05T09:07")
        assert.equal(document.getElementById("start-field").type, "datetime-local")
    })
})

test("switching back to date restores the text input and the calendar, and clears the native binding", function() {
    withDatepicker(function(log) {
        var picker = nativePicker()
        var input = document.getElementById("start-field")
        var opened = 0
        input.showPicker = function() { opened++ }
        picker.date = new Date(2026, 0, 5, 9, 7)
        log.length = 0
        picker.datePickerMode = "date"
        assert.deepEqual(log, ["datepicker:destroy", "datepicker:init"])
        assert.equal(input.type, "text")
        assert.equal(input.hasAttribute("readonly"), true)
        assert.equal(input.value, "")
        input.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
        assert.equal(opened, 0)
    })
})

test("an input without readonly keeps none after dateAndTime", function() {
    page("<div id=\"start\"><input id=\"start-field\"></div>")
    withDatepicker(function() {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = "dateAndTime"
        picker.datePickerMode = "date"
        assert.equal(document.getElementById("start-field").hasAttribute("readonly"), false)
    })
})

test("disposing a dateAndTime picker removes its binding and leaves the calendar alone", function() {
    withDatepicker(function(log) {
        var picker = nativePicker()
        var input = document.getElementById("start-field")
        var opened = 0
        input.showPicker = function() { opened++ }
        log.length = 0
        picker._dispose()
        assert.ok(!log.includes("datepicker:hide"))
        input.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
        assert.equal(opened, 0)
    })
})

function click(input) {
    input.dispatchEvent(new window.MouseEvent("click", {bubbles: true}))
}

// Chrome refuses showPicker() without a user activation or inside a
// cross-origin frame; the field still works by keyboard, so the click that was
// refused must not abort the other handlers on it.
test("a showPicker the browser refuses (NotAllowedError, SecurityError) is swallowed and later click handlers still run", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        var input = document.getElementById("start-field")
        var ran = []
        picker.$input.on("click", () => ran.push("input"))
        picker.addTarget({}, {action: function() { ran.push("target") }, for: UIControlEvent.touchUpInside})
        var errors = []
        window.addEventListener("error", (event) => { errors.push(event.error) })
        for (var name of ["NotAllowedError", "SecurityError"]) {
            input.showPicker = function() { throw new window.DOMException("refused", name) }
            ran.length = 0
            click(input)
            assert.deepEqual(ran, ["input", "target"], name)
        }
        assert.deepEqual(errors, [])
    })
})

test("any other error from showPicker still propagates", function() {
    withDatepicker(function() {
        var picker = nativePicker()
        var input = document.getElementById("start-field")
        var failure = new window.DOMException("not active", "InvalidStateError")
        input.showPicker = function() { throw failure }
        var errors = []
        window.addEventListener("error", (event) => { event.preventDefault(); errors.push(event.error) })
        click(input)
        assert.deepEqual(errors, [failure])
    })
})
