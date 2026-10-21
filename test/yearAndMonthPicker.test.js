import { page } from "./dom.js"
import test, { mock } from "node:test"
import assert from "node:assert/strict"
import { UIDatePicker, UIControlEvent } from "../src/index.js"


// jQuery UI is a page script, so this stand-in records the options the picker
// hands it. Its getDate answers a wrong day on purpose: the picker's own date
// must not come from re-reading the widget's text.
function withDatepicker(run) {
    var options = {}
    options.calls = []
    $.fn.datepicker = function(method, name, value) {
        if (typeof method === "object") { Object.assign(options, method); return this }
        options.calls.push(method)
        if (method === "getDate") { return new Date(1999, 11, 31) }
        return this
    }
    mock.timers.enable({apis: ["setTimeout"]})
    try { run(options) } finally {
        mock.timers.tick(200)
        mock.timers.reset()
        delete $.fn.datepicker
    }
}

function pickMonth(options, year, month) {
    document.body.insertAdjacentHTML("beforeend", "<div id=\"ui-datepicker-div\"><select class=\"ui-datepicker-month\"><option value=\"" + month + "\" selected>m</option></select><select class=\"ui-datepicker-year\"><option value=\"" + year + "\" selected>y</option></select></div>")
    options.onClose()
}

test("in yearAndMonth mode date is the first of the picked month, local, and one valueChanged is sent", function() {
    page("<div id=\"expiry\"></div>")
    withDatepicker(function(options) {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        var seen = []
        picker.addTarget({}, {action: function(sender) { seen.push(sender.date) }, for: UIControlEvent.valueChanged})
        pickMonth(options, "2026", "5")
        assert.equal(seen.length, 1)
        assert.deepEqual([seen[0].getFullYear(), seen[0].getMonth(), seen[0].getDate(), seen[0].getHours()], [2026, 5, 1, 0])
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate()], [2026, 5, 1])
    })
})

test("entering yearAndMonth mode holds the first of the current month in memory and leaves the input text alone", function() {
    page("<div id=\"expiry\"><input id=\"expiry-field\" placeholder=\"mm/aaaa\"></div>")
    withDatepicker(function(options) {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        var now = new Date()
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate(), picker.date.getHours(), picker.date.getMinutes()], [now.getFullYear(), now.getMonth(), 1, 0, 0])
        assert.equal(document.getElementById("expiry-field").value, "")
        assert.equal(document.getElementById("expiry-field").getAttribute("placeholder"), "mm/aaaa")
        assert.ok(!options.calls.includes("setDate"), "the widget is not asked to draw the default")
    })
})

test("a locale or the same mode set again keeps the picked month, and the held date is a copy", function() {
    page("<div id=\"expiry\"></div>")
    withDatepicker(function(options) {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        pickMonth(options, "2027", "0")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth()], [2027, 0])
        picker.date.setFullYear(1990)
        assert.equal(picker.date.getFullYear(), 2027)
    })
})

test("writing null in yearAndMonth mode throws a TypeError with Apple's signature and keeps the date", function() {
    page("<div id=\"expiry\"></div>")
    withDatepicker(function() {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        picker.date = new Date(2024, 2, 17)
        assert.throws(() => { picker.date = null }, (error) => error instanceof TypeError && /UIDatePicker\.date/.test(error.message) && /var date: Date/.test(error.message))
        assert.throws(() => picker.setDate(null, {animated: false}), TypeError)
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth()], [2024, 2])
    })
})

test("writing a date in yearAndMonth mode keeps the first of its month", function() {
    page("<div id=\"expiry\"></div>")
    withDatepicker(function() {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        picker.date = new Date(2024, 2, 17, 13, 45)
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate(), picker.date.getHours()], [2024, 2, 1, 0])
        picker.setDate(new Date(2031, 11, 31), {animated: false})
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate()], [2031, 11, 1])
    })
})

test("leaving yearAndMonth mode forgets the month, and the calendar answers again", function() {
    page("<div id=\"expiry\"></div>")
    withDatepicker(function(options) {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        pickMonth(options, "2026", "5")
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate()], [1999, 11, 31])
    })
})
