import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIDatePicker, UIControlEvent, Locale } from "../src/index.js"


// The picker keeps its input to itself, so a test reads the one in its element.
function inputOf(picker) {
    return $(picker.$el[0]).find("input")
}


// jQuery UI and ClockPicker are page scripts the framework wraps, not
// dependencies, so neither is on the test page: these stand-ins record the calls
// the picker makes and drive the callbacks as the plugins would. The clock's
// done() follows ClockPicker 0.0.7: beforeDone, the value, a change event on the
// wrapper only when the value differs, afterDone.
function raise(callback) {
    if (typeof callback === "function") { callback() }
}

function withPlugins(run) {
    var log = []
    var clocks = []
    var datepickerOptions = {}
    $.fn.datepicker = function(method, name, value) {
        if (typeof method === "object") { log.push("datepicker:init"); Object.assign(datepickerOptions, method); return this }
        log.push("datepicker:" + [method, name].filter((part) => part !== undefined).join(":"))
        if (method === "getDate") { return null }
        return this
    }
    $.fn.clockpicker = function(option) {
        var $wrapper = this
        if (typeof option === "object") {
            var clock = {options: option, $wrapper: $wrapper, removed: false}
            clock.done = function(text) {
                var $input = $wrapper.find("input")
                raise(option.beforeDone)
                var last = $input.prop("value")
                $input.prop("value", text)
                if (text !== last) { $wrapper.trigger("change") }
                raise(option.afterDone)
            }
            // The real plugin keeps its instance in the wrapper's data, and the
            // picker removes the clock through that instance.
            $wrapper.data("clockpicker", {remove() { log.push("clockpicker:remove"); clock.removed = true }})
            clocks.push(clock)
            log.push("clockpicker:init")
            return this
        }
        log.push("clockpicker:" + option)
        if (option === "remove") { clocks[clocks.length - 1].removed = true }
        return this
    }
    try { run({log, clocks, datepickerOptions}) } finally {
        delete $.fn.datepicker
        delete $.fn.clockpicker
    }
}

var markup = "<div id=\"start\" class=\"clockpicker\"></div>"

test("datePickerMode = \"time\" builds the clock and not the calendar", function() {
    page(markup)
    withPlugins(function({log, clocks}) {
        var picker = new UIDatePicker("#start")
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.date)
        assert.equal(clocks.length, 0)
        log.length = 0
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.time)
        assert.deepEqual(log, ["datepicker:getDate", "datepicker:destroy", "clockpicker:init"], "the date is read before the switch, to be kept")
        assert.equal(clocks.length, 1)
        assert.equal(clocks[0].$wrapper[0], document.getElementById("start"))
        assert.equal(clocks[0].options.placement, "bottom")
        assert.equal(clocks[0].options.align, "left")
        assert.equal(clocks[0].options.autoclose, true)
    })
})

test("the clock reads its other options from the element's data attributes, which beat the defaults", function() {
    page("<div id=\"end\" class=\"clockpicker\" data-default=\"23:59\" data-donetext=\"OK\" data-autoclose=\"false\"></div>")
    withPlugins(function({clocks}) {
        var picker = new UIDatePicker("#end")
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(clocks[0].options.default, "23:59")
        assert.equal(clocks[0].options.donetext, "OK")
        assert.equal(clocks[0].options.autoclose, false)
    })
})

test("date holds hours and minutes on the day last written, today's until one is, and round-trips", function() {
    page(markup)
    withPlugins(function() {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(picker.date, null)
        picker.date = new Date(2020, 0, 5, 9, 7, 30)
        assert.equal(inputOf(picker).prop("value"), "09:07")
        var read = picker.date
        assert.deepEqual([read.getFullYear(), read.getMonth(), read.getDate(), read.getHours(), read.getMinutes(), read.getSeconds()], [2020, 0, 5, 9, 7, 0], "the day part of date is kept")
        picker.setDate(new Date(2021, 5, 9, 23, 59), {animated: false})
        assert.equal(inputOf(picker).prop("value"), "23:59")
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate()], [2021, 5, 9])
        picker.datePickerMode = UIDatePicker.Mode.date
        picker.datePickerMode = UIDatePicker.Mode.time
        inputOf(picker).prop("value", "08:30")
        var today = new Date()
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate()], [today.getFullYear(), today.getMonth(), today.getDate()], "a new time session starts on today")
    })
})

test("a time the clock writes keeps the day written before it", function() {
    page(markup)
    withPlugins(function({clocks}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        picker.date = new Date(2024, 1, 29, 7, 5)
        clocks[0].done("10:45")
        assert.deepEqual([picker.date.getFullYear(), picker.date.getMonth(), picker.date.getDate(), picker.date.getHours(), picker.date.getMinutes()], [2024, 1, 29, 10, 45])
    })
})

test("a value the clock cannot have written reads as null", function() {
    page(markup)
    withPlugins(function() {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        for (var text of ["", "ab:cd", "24:00", "12:60", "7", "12:3"]) {
            inputOf(picker).prop("value", text)
            assert.equal(picker.date, null, text)
        }
        inputOf(picker).prop("value", "8:05")
        assert.equal(picker.date.getHours(), 8)
    })
})

test("valueChanged is sent once when the clock closes with a different value, and neither on open nor for the same value", function() {
    page(markup)
    withPlugins(function({clocks}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        var seen = []
        var target = {}
        picker.addTarget(target, {action: function(sender) { seen.push(sender) }, for: UIControlEvent.valueChanged})
        inputOf(picker).trigger("focus")
        assert.equal(seen.length, 0)
        clocks[0].done("10:30")
        assert.equal(seen.length, 1)
        assert.equal(seen[0], picker)
        assert.equal(picker.date.getMinutes(), 30)
        clocks[0].done("10:30")
        assert.equal(seen.length, 1, "the date did not change")
        clocks[0].done("11:00")
        assert.equal(seen.length, 2)
    })
})

test("minimumDate and maximumDate are ignored in time mode and do not reach the destroyed calendar", function() {
    page(markup)
    withPlugins(function({log}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        log.length = 0
        picker.minimumDate = new Date(2030, 0, 1)
        picker.maximumDate = new Date(2031, 0, 1)
        assert.equal(picker.minimumDate, null)
        assert.equal(picker.maximumDate, null)
        assert.deepEqual(log, [])
    })
})

test("a locale set in time mode keeps the clock and does not reach the destroyed calendar", function() {
    page(markup)
    withPlugins(function({log, clocks}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        log.length = 0
        picker.locale = new Locale("pt-BR")
        assert.equal(picker.locale.identifier, "pt-BR")
        assert.equal(clocks.filter((clock) => !clock.removed).length, 1)
        assert.ok(!log.some((entry) => entry.indexOf("datepicker:option") === 0))
    })
})

test("switching back to date destroys the clock and rebuilds the calendar", function() {
    page(markup)
    withPlugins(function({log, clocks, datepickerOptions}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        log.length = 0
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.date)
        assert.deepEqual(log, ["clockpicker:remove", "datepicker:destroy", "datepicker:init"])
        assert.equal(clocks[0].removed, true)
        assert.equal(datepickerOptions.changeMonth, true)
    })
})

test("switching from time to yearAndMonth also removes the clock, and time twice builds one clock", function() {
    page(markup)
    withPlugins(function({clocks}) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.time
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(clocks.filter((clock) => !clock.removed).length, 1)
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        assert.equal(clocks.filter((clock) => !clock.removed).length, 0)
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.yearAndMonth)
    })
})

test("time mode without the ClockPicker plugin on the page says what is missing", function() {
    page(markup)
    withPlugins(function() {
        delete $.fn.clockpicker
        var picker = new UIDatePicker("#start")
        assert.throws(() => { picker.datePickerMode = UIDatePicker.Mode.time }, (error) => error instanceof TypeError && /ClockPicker/.test(error.message))
    })
})

test("an input the nib supplies is reused by time mode", function() {
    page("<div id=\"given\" class=\"clockpicker\"><input id=\"given-uidatepicker\" class=\"input\" autocomplete=\"off\"></div>")
    withPlugins(function() {
        var picker = new UIDatePicker("#given")
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(document.querySelectorAll("#given input").length, 1)
        picker.date = new Date(2020, 0, 1, 6, 0)
        assert.equal(document.getElementById("given-uidatepicker").value, "06:00")
    })
})
