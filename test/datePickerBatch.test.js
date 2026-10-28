import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIDatePicker, UIControlEvent, Locale } from "../src/index.js"


// jQuery UI is a page script the framework wraps. This stand-in keeps, per
// input, what the widget would: the options it was created with (destroy drops
// them, as the real rebuild drops the limits), a day, and the calls it got in
// order. `reads` are the calls that cost the widget nothing; the others redraw
// its one shared calendar, which is what the picker batches.
var reads = ["getDate"]

async function withWidget(run) {
    var log = []
    var states = new Map()
    var stateOf = (element) => {
        if (!states.has(element)) { states.set(element, {options: {}, date: null}) }
        return states.get(element)
    }
    $.fn.datepicker = function(method, name, value) {
        var state = stateOf(this[0])
        if (typeof method === "object") {
            state.options = {...method}
            log.push({id: this[0].id, call: "init", options: method})
            return this
        }
        var isOptionRead = method === "option" && typeof name === "string" && arguments.length === 2
        log.push({id: this[0].id, call: method, name, value, isRead: isOptionRead || reads.includes(method)})
        if (method === "destroy") { state.options = {} }
        if (method === "option" && !isOptionRead) { Object.assign(state.options, typeof name === "object" ? name : {[name]: value}) }
        if (method === "option" && isOptionRead) { return name in state.options ? state.options[name] : null }
        if (method === "setDate") {
            if (state.failSetDate) { state.failSetDate = false; throw new Error("boom") }
            state.date = name === null ? null : new Date(name.getFullYear(), name.getMonth(), name.getDate())
            return this
        }
        if (method === "getDate") { return state.date }
        return this
    }
    var stateOfPicker = (picker) => stateOf(picker.$el.find("input")[0])
    try { await run(log, stateOfPicker) } finally { delete $.fn.datepicker }
}

var turnEnd = () => new Promise((resolve) => queueMicrotask(resolve))

var markup = "<div id=\"a\"><input id=\"a-field\" class=\"input\" readonly></div>"
var twoMarkup = markup + "<div id=\"b\"><input id=\"b-field\" class=\"input\" readonly></div>"
var portuguese = new Locale("pt-BR")
var day = new Date(2026, 4, 17)
var limit = new Date(2026, 11, 31)
var earlier = new Date(2020, 0, 1)

var renders = (log) => log.filter((entry) => !entry.isRead)
// An option write is one name and one value or an object of them, which jQuery UI treats alike, so a test sees the settings either way.
var settingsOf = (entry) => typeof entry.name === "object" ? entry.name : {[entry.name]: entry.value}
var names = (log) => renders(log).map((entry) => entry.call === "option" && entry.name === "dateFormat" ? "option:dateFormat" : entry.call)

// Pickers are made before the log starts, so a test sees only what its writes cost.
function pickerOn(log, selector) {
    var picker = new UIDatePicker(selector || "#a")
    log.length = 0
    return picker
}

// A throw inside a microtask is an uncaught exception, not a rejection, and
// node:test fails the running test for one, so the test takes the listeners
// off the process for the length of the turn and puts them back.
async function uncaughtDuring(run) {
    var saved = process.listeners("uncaughtException")
    var caught = []
    process.removeAllListeners("uncaughtException")
    process.on("uncaughtException", (error) => caught.push(error))
    try { await run() } finally {
        process.removeAllListeners("uncaughtException")
        saved.forEach((listener) => process.on("uncaughtException", listener))
    }
    return caught
}


test("B1: locale, maximumDate and a date written in one turn reach the widget together at the end of the turn", async function() {
    page(markup)
    await withWidget(async function(log, stateOf) {
        var picker = pickerOn(log)
        picker.locale = portuguese
        picker.maximumDate = limit
        picker.date = day
        assert.deepEqual(log, [], "nothing reaches the widget while the turn runs")
        await turnEnd()
        assert.deepEqual(names(log), ["destroy", "init", "setDate"])
        var init = log.find((entry) => entry.call === "init")
        assert.equal(init.options.maxDate, limit)
        assert.equal(init.options.dateFormat, "dd/mm/yy")
        assert.deepEqual(stateOf(picker).date, day)
    })
})

test("B2: four pickers written as the export modal writes them cost four renders", async function() {
    page(twoMarkup + "<div id=\"c\"><input id=\"c-field\" readonly></div><div id=\"d\"><input id=\"d-field\" readonly></div>")
    await withWidget(async function(log) {
        var pickers = ["#a", "#b", "#c", "#d"].map((selector) => new UIDatePicker(selector))
        log.length = 0
        for (var picker of pickers) {
            picker.locale = portuguese
            picker.maximumDate = limit
            picker.date = day
        }
        await turnEnd()
        var rendering = renders(log).filter((entry) => entry.call === "setDate" || entry.call === "option")
        assert.equal(rendering.length, 4)
    })
})

test("B3: minimumDate and maximumDate written in one turn are one option call carrying both", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.minimumDate = earlier
        picker.maximumDate = limit
        assert.deepEqual(log, [])
        await turnEnd()
        assert.equal(log.length, 1)
        assert.equal(log[0].call, "option")
        assert.deepEqual(log[0].name, {minDate: earlier, maxDate: limit})
        assert.equal(log[0].name.minDate, earlier)
        assert.equal(log[0].name.maxDate, limit)
    })
})

test("B4: reading date, minimumDate or maximumDate after writing returns what was written and applies the batch first", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.maximumDate = limit
        assert.equal(picker.maximumDate, limit)
        assert.deepEqual(names(log), ["option"], "the limit was applied before the read")
        log.length = 0

        picker.minimumDate = earlier
        assert.equal(picker.minimumDate, earlier)
        assert.deepEqual(names(log), ["option"])
        log.length = 0

        picker.date = day
        assert.deepEqual(picker.date, day)
        assert.deepEqual(names(log), ["setDate"])
        await turnEnd()
        assert.deepEqual(names(log), ["setDate"], "the turn's end has nothing left to apply")
    })
})

test("B5: a maximumDate written before a locale is gone after it, as before", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.maximumDate = limit
        picker.locale = portuguese
        await turnEnd()
        assert.equal(picker.maximumDate, null)
    })
})

test("B6: a date written before a limit reaches the widget before the limit", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.date = day
        picker.maximumDate = limit
        await turnEnd()
        assert.deepEqual(names(log), ["setDate", "option"])
        assert.deepEqual(settingsOf(renders(log)[1]), {maxDate: limit})
    })
})

test("B7: the same limit written twice is two option calls, in order", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.maximumDate = limit
        picker.maximumDate = earlier
        await turnEnd()
        assert.deepEqual(names(log), ["option", "option"])
        assert.deepEqual(renders(log).map((entry) => settingsOf(entry).maxDate), [limit, earlier])
    })
})

test("B8: a locale alone is the date format, a destroy and an init", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.locale = portuguese
        await turnEnd()
        assert.deepEqual(names(log), ["option:dateFormat", "destroy", "init"])
        assert.equal(renders(log)[0].value, "dd/mm/yy")
    })
})

test("B9: a pending locale is applied before a datePickerMode switch, which still applies at once", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.date = day
        await turnEnd()
        log.length = 0
        picker.locale = portuguese
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        assert.deepEqual(log.map((entry) => entry.call), ["option", "destroy", "init", "getDate", "destroy", "init", "setDate"])
        var applied = log.length
        await turnEnd()
        assert.equal(log.length, applied, "nothing is left for the turn's end")
    })
})

test("B10: a write followed by _dispose in the same turn reaches the widget no further and throws nothing", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.locale = portuguese
        picker.maximumDate = limit
        picker.date = day
        picker._dispose()
        var applied = log.length
        assert.deepEqual(log.slice(-2).map((entry) => entry.call), ["hide", "destroy"])
        var caught = await uncaughtDuring(turnEnd)
        assert.deepEqual(caught, [])
        assert.equal(log.length, applied)
    })
})

test("B11: after a batched write a selection of the same day sends no valueChanged, another day sends one", async function() {
    page(markup)
    await withWidget(async function(log, stateOf) {
        var picker = pickerOn(log)
        var changes = 0
        picker.addTarget({}, {action() { changes += 1 }, for: UIControlEvent.valueChanged})
        picker.date = day
        await turnEnd()
        stateOf(picker).options.onSelect()
        assert.equal(changes, 0)
        stateOf(picker).date = new Date(2026, 4, 18)
        stateOf(picker).options.onSelect()
        assert.equal(changes, 1)
    })
})

test("B12: a disabled picker batches the same and its beforeShow still refuses", async function() {
    page(markup)
    await withWidget(async function(log, stateOf) {
        var picker = pickerOn(log)
        picker.isEnabled = false
        picker.maximumDate = limit
        picker.date = day
        await turnEnd()
        assert.deepEqual(names(log), ["option", "setDate"])
        assert.equal(stateOf(picker).options.beforeShow(), false)
    })
})

test("B13: time and dateAndTime writes are visible at once and leave nothing pending", async function() {
    page(markup)
    $.fn.clockpicker = function() { return this }
    try {
        await withWidget(async function(log) {
            var picker = pickerOn(log)
            var input = document.getElementById("a-field")
            picker.datePickerMode = UIDatePicker.Mode.dateAndTime
            picker.date = new Date(2026, 0, 5, 9, 7)
            picker.maximumDate = new Date(2026, 11, 31, 18, 0)
            picker.minimumDate = new Date(2026, 0, 1, 8, 30)
            assert.equal(input.value, "2026-01-05T09:07")
            assert.equal(input.getAttribute("max"), "2026-12-31T18:00")
            assert.equal(input.getAttribute("min"), "2026-01-01T08:30")
            picker.datePickerMode = UIDatePicker.Mode.time
            picker.date = new Date(2026, 0, 5, 10, 15)
            assert.equal(input.value, "10:15")
            log.length = 0
            await turnEnd()
            assert.deepEqual(log, [])
        })
    } finally { delete $.fn.clockpicker }
})

test("B14: a widget call that throws at the turn's end surfaces once and leaves no record", async function() {
    page(markup)
    await withWidget(async function(log, stateOf) {
        var picker = pickerOn(log)
        stateOf(picker).failSetDate = true
        picker.maximumDate = limit
        picker.date = day
        var caught = await uncaughtDuring(turnEnd)
        assert.equal(caught.length, 1)
        assert.equal(caught[0].message, "boom")
        log.length = 0
        picker.date
        assert.deepEqual(log.map((entry) => entry.call), ["getDate"])
        log.length = 0
        picker.maximumDate = earlier
        assert.deepEqual(log, [])
        await turnEnd()
        assert.deepEqual(names(log), ["option"])
    })
})

test("B15: writes made from a selection's action reach neither widget until the turn ends, in write order", async function() {
    page(twoMarkup)
    await withWidget(async function(log, stateOf) {
        var first = new UIDatePicker("#a")
        var second = new UIDatePicker("#b")
        log.length = 0
        var changes = 0
        first.addTarget({}, {action() {
            first.date = new Date(2026, 5, 1)
            second.date = new Date(2026, 5, 2)
        }, for: UIControlEvent.valueChanged})
        first.addTarget({}, {action() { changes += 1 }, for: UIControlEvent.valueChanged})
        stateOf(first).date = new Date(2026, 4, 30)
        stateOf(first).options.onSelect()
        assert.deepEqual(renders(log), [])
        await turnEnd()
        assert.deepEqual(renders(log).map((entry) => entry.id + ":" + entry.call), ["a-field:setDate", "b-field:setDate"])
        assert.equal(changes, 1)
    })
})

test("B16: a date written before a locale is set under the old format, then the locale is applied as before", async function() {
    page(markup)
    await withWidget(async function(log) {
        var picker = pickerOn(log)
        picker.date = day
        picker.locale = portuguese
        await turnEnd()
        assert.deepEqual(names(log), ["setDate", "option:dateFormat", "destroy", "init"])
    })
})
