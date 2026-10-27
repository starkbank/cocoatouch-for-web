import { page } from "./dom.js"
import test, { mock } from "node:test"
import assert from "node:assert/strict"
import { UIDatePicker, UIControlEvent } from "../src/index.js"


// A write to a calendar picker reaches the widget at the end of the turn, so the stand-in stays until then.
var turnEnd = () => new Promise((resolve) => queueMicrotask(resolve))

// jQuery UI and ClockPicker are page scripts the framework wraps. This
// stand-in for the calendar keeps a day, as getDate and setDate do, and `pick`
// drives the widget's callbacks in the order it calls them: beforeShow when it
// opens, then onSelect when a day is clicked.
async function withCalendar(run) {
    var widget = {options: {}, date: null}
    $.fn.datepicker = function(method, name) {
        if (typeof method === "object") { Object.assign(widget.options, method); return this }
        if (method === "setDate") { widget.date = name === null ? null : new Date(name.getFullYear(), name.getMonth(), name.getDate()); return this }
        if (method === "getDate") { return widget.date }
        return this
    }
    mock.timers.enable({apis: ["setTimeout"]})
    try { run(widget) } finally {
        await turnEnd()
        mock.timers.tick(200)
        mock.timers.reset()
        delete $.fn.datepicker
    }
}

function pick(widget, date) {
    widget.options.beforeShow()
    widget.date = date
    widget.options.onSelect()
}

function pickMonth(widget, year, month) {
    document.body.insertAdjacentHTML("beforeend", "<div id=\"ui-datepicker-div\"><select class=\"ui-datepicker-month\"><option value=\"" + month + "\" selected>m</option></select><select class=\"ui-datepicker-year\"><option value=\"" + year + "\" selected>y</option></select></div>")
    widget.options.beforeShow()
    widget.options.onClose()
    document.getElementById("ui-datepicker-div").remove()
}

function counting(picker) {
    var count = {changes: 0}
    picker.addTarget({}, {action() { count.changes += 1 }, for: UIControlEvent.valueChanged})
    return count
}


test("UIDatePicker.Mode is Apple's UIDatePicker.Mode with its raw values, and the default mode is .date", async function() {
    assert.deepEqual({...UIDatePicker.Mode}, {time: 0, date: 1, dateAndTime: 2, countDownTimer: 3, yearAndMonth: 4})
    assert.equal(Object.isFrozen(UIDatePicker.Mode), true)
    page("<div id=\"when\"></div>")
    await withCalendar(function() {
        assert.equal(new UIDatePicker("#when").datePickerMode, UIDatePicker.Mode.date)
    })
})

test("a string is refused as the mode, naming the Swift property, and the mode stays", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function() {
        var picker = new UIDatePicker("#when")
        for (var text of ["time", "date", "dateAndTime", "yearAndMonth", "countDownTimer", "datetime", ""]) {
            assert.throws(() => { picker.datePickerMode = text }, (error) => error instanceof TypeError && /UIDatePicker\.datePickerMode/.test(error.message) && /UIDatePicker\.Mode/.test(error.message), JSON.stringify(text))
        }
        assert.throws(() => { picker.datePickerMode = null }, TypeError)
        assert.throws(() => { picker.datePickerMode = 9 }, TypeError)
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.date)
    })
})

test(".countDownTimer is Apple's case, and a page has no control for it, so assigning it says so and keeps the mode", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function() {
        var picker = new UIDatePicker("#when")
        assert.throws(() => { picker.datePickerMode = UIDatePicker.Mode.countDownTimer }, (error) => error instanceof TypeError && /countDownTimer/.test(error.message))
        assert.equal(picker.datePickerMode, UIDatePicker.Mode.date)
    })
})

test("the picker does not publish its input: no inputSelector and no $input on the instance", async function() {
    page("<div id=\"when\"><input id=\"when-field\"></div>")
    await withCalendar(function() {
        var picker = new UIDatePicker("#when")
        assert.equal("inputSelector" in picker, false)
        assert.equal("$input" in picker, false)
        assert.equal(picker.inputSelector, undefined)
        assert.equal(picker.$input, undefined)
    })
})

test("valueChanged is sent when the user picks a different day, and not when the pick leaves the date as it was", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#when")
        var count = counting(picker)
        pick(widget, new Date(2026, 2, 4))
        assert.equal(count.changes, 1)
        pick(widget, new Date(2026, 2, 4))
        assert.equal(count.changes, 1, "the same day again")
        pick(widget, new Date(2026, 2, 5))
        assert.equal(count.changes, 2)
        pick(widget, new Date(2026, 2, 4))
        assert.equal(count.changes, 3)
    })
})

test("a day written from code is the date the next pick is compared with, and writing sends nothing", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#when")
        var count = counting(picker)
        picker.date = new Date(2026, 2, 4, 15, 30)
        assert.equal(count.changes, 0)
        pick(widget, new Date(2026, 2, 4))
        assert.equal(count.changes, 0, "the same day as the one written, whatever its time")
        pick(widget, new Date(2026, 2, 6))
        assert.equal(count.changes, 1)
        picker.date = null
        pick(widget, new Date(2026, 2, 6))
        assert.equal(count.changes, 2, "the field was cleared, so this is a change")
    })
})

test("a disabled picker does not open its calendar, a selection that arrives anyway sends nothing, and sendActions keeps Apple's direct-call semantics", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#when")
        var count = counting(picker)
        picker.isEnabled = false
        assert.equal(widget.options.beforeShow(), false, "jQuery UI shows nothing when beforeShow says false")
        widget.date = new Date(2026, 2, 4)
        widget.options.onSelect()
        assert.equal(count.changes, 0)
        picker.sendActions({for: UIControlEvent.valueChanged})
        assert.equal(count.changes, 1, "a direct call is the app's own")
        picker.isEnabled = true
        assert.notEqual(widget.options.beforeShow(), false)
        pick(widget, new Date(2026, 2, 5))
        assert.equal(count.changes, 2)
    })
})

test("yearAndMonth sends valueChanged for a different month only, and a disabled picker does not open", async function() {
    page("<div id=\"expiry\"></div>")
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#expiry")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        var count = counting(picker)
        pickMonth(widget, "2026", "5")
        assert.equal(count.changes, 1)
        pickMonth(widget, "2026", "5")
        assert.equal(count.changes, 1, "the same month")
        picker.isEnabled = false
        assert.equal(widget.options.beforeShow(), false, "never opened, so never closed with a month")
        assert.equal(count.changes, 1)
        picker.isEnabled = true
        pickMonth(widget, "2026", "7")
        assert.equal(count.changes, 2)
    })
})

test("a change the clock or the native input commits on a disabled picker reaches no target", function() {
    page("<div id=\"clock\" class=\"clockpicker\"></div><div id=\"native\"><input id=\"native-field\"></div>")
    var done = null
    $.fn.datepicker = function() { return this }
    $.fn.clockpicker = function(option) {
        if (typeof option !== "object") { return this }
        var wrapper = this
        done = (text) => { wrapper.find("input").prop("value", text); wrapper.trigger("change") }
        wrapper.data("clockpicker", {remove() {}})
        return this
    }
    try {
        var clock = new UIDatePicker("#clock")
        clock.datePickerMode = UIDatePicker.Mode.time
        var clockCount = counting(clock)
        clock.isEnabled = false
        done("10:30")
        assert.equal(clockCount.changes, 0)
        clock.isEnabled = true
        done("11:30")
        assert.equal(clockCount.changes, 1)
        var native = new UIDatePicker("#native")
        native.datePickerMode = UIDatePicker.Mode.dateAndTime
        var nativeCount = counting(native)
        native.isEnabled = false
        var input = document.getElementById("native-field")
        input.value = "2026-06-02T13:15"
        input.dispatchEvent(new window.Event("change", {bubbles: true}))
        assert.equal(nativeCount.changes, 0)
        native.isEnabled = true
        input.dispatchEvent(new window.Event("change", {bubbles: true}))
        assert.equal(nativeCount.changes, 1)
    } finally {
        delete $.fn.datepicker
        delete $.fn.clockpicker
    }
})

test("changing the mode keeps a date that was set, written through the new mode", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function() {
        var picker = new UIDatePicker("#when")
        picker.date = new Date(2026, 5, 17)
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        assert.equal(picker.date.getTime(), new Date(2026, 5, 1).getTime())
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(picker.date.getTime(), new Date(2026, 5, 1).getTime())
        picker.date = new Date(2026, 7, 9)
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        assert.equal(picker.date.getTime(), new Date(2026, 7, 9).getTime())
        picker.date = new Date(2026, 7, 9, 14, 30)
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(picker.date.getFullYear() + "-" + picker.date.getMonth() + "-" + picker.date.getDate(), "2026-7-9")
    })
})

test("a date kept across a mode change is not a selection, so it sends nothing and the next pick of it sends nothing", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#when")
        picker.date = new Date(2026, 5, 17)
        var count = counting(picker)
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        assert.equal(count.changes, 0)
        pickMonth(widget, "2026", "5")
        assert.equal(count.changes, 0, "the same month")
        pickMonth(widget, "2026", "6")
        assert.equal(count.changes, 1)
    })
})

test("changing the mode of a picker with no date keeps each mode's own default", async function() {
    page("<div id=\"when\"></div>")
    await withCalendar(function() {
        var picker = new UIDatePicker("#when")
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        assert.equal(picker.date, null)
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        var now = new Date()
        assert.equal(picker.date.getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime())
    })
})

test("a day written in time mode survives the switch to the calendar", async function() {
    page("<div id=\"clock\"></div>")
    $.fn.clockpicker = function(option) {
        if (typeof option === "object") { this.data("clockpicker", {remove() {}}) }
        return this
    }
    await withCalendar(function(widget) {
        var picker = new UIDatePicker("#clock")
        picker.datePickerMode = UIDatePicker.Mode.time
        picker.date = new Date(2026, 5, 17, 10, 30)
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(widget.date.getTime(), new Date(2026, 5, 17).getTime())
    })
    delete $.fn.clockpicker
})


// jQuery UI 1.13.3 answers getDate from the field's own text: _getDateDatepicker
// runs _setDateFromField, whose parseDate throws on text it cannot read, and the
// catch leaves the default day (today) in place unless noDefault asks for none.
// The stand-in reads the field the same way, in the "mm/dd/yy" of the en format.
function withFieldCalendar(run) {
    var dayText = /^(\d\d)\/(\d\d)\/(\d{4})$/
    $.fn.datepicker = function(method, noDefault) {
        if (typeof method === "object") { return this }
        if (method === "setDate") {
            var text = noDefault === null ? "" : String(noDefault.getMonth() + 1).padStart(2, "0") + "/" + String(noDefault.getDate()).padStart(2, "0") + "/" + noDefault.getFullYear()
            this.prop("value", text)
            return this
        }
        if (method !== "getDate") { return this }
        var value = this.prop("value")
        if (value === "") { return null }
        var parts = dayText.exec(value)
        if (parts) { return new Date(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2])) }
        if (noDefault === true) { return null }
        var now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    $.fn.clockpicker = function(option) {
        if (typeof option === "object") { this.data("clockpicker", {remove() {}}) }
        return this
    }
    mock.timers.enable({apis: ["setTimeout"]})
    try { run() } finally {
        mock.timers.tick(200)
        mock.timers.reset()
        delete $.fn.datepicker
        delete $.fn.clockpicker
    }
}

test("a nib's time over a picker that becomes a clock stays, and is no date the calendar made up", function() {
    page("<div id=\"invoice-time-picker\" class=\"clockpicker\"><input id=\"invoice-time\" type=\"text input\" class=\"input\" value=\"23:59\"></div>")
    withFieldCalendar(function() {
        var picker = new UIDatePicker("#invoice-time-picker")
        var count = counting(picker)
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(document.getElementById("invoice-time").value, "23:59")
        var today = new Date()
        assert.equal(picker.date.getTime(), new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59).getTime())
        assert.equal(count.changes, 0)
    })
})

test("a nib's datetime text over a picker that becomes .dateAndTime stays", function() {
    page("<div id=\"native\"><input id=\"native-field\" value=\"2026-06-02T13:15\"></div>")
    withFieldCalendar(function() {
        var picker = new UIDatePicker("#native")
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        assert.equal(document.getElementById("native-field").value, "2026-06-02T13:15")
        assert.equal(picker.date.getTime(), new Date(2026, 5, 2, 13, 15).getTime())
    })
})

test("a day the calendar reads from the field is still carried across the switch", function() {
    page("<div id=\"when\" class=\"clockpicker\"><input id=\"when-field\" value=\"06/17/2026\"></div>")
    withFieldCalendar(function() {
        var picker = new UIDatePicker("#when")
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(picker.date.getTime(), new Date(2026, 5, 17, 0, 0).getTime())
        assert.equal(document.getElementById("when-field").value, "00:00")
    })
})

test("an empty field leaves the clock to the plugin's own data-default", function() {
    page("<div id=\"clock\" class=\"clockpicker\" data-default=\"23:59\"><input class=\"input\"></div>")
    withFieldCalendar(function() {
        var picker = new UIDatePicker("#clock")
        picker.datePickerMode = UIDatePicker.Mode.time
        assert.equal(document.querySelector("#clock input").value, "")
        assert.equal(picker.date, null)
    })
})
