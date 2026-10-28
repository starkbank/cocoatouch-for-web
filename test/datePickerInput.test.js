import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIDatePicker, UIView } from "../src/index.js"


function withDatepicker(run) {
    var inits = []
    $.fn.datepicker = function(method) {
        if (typeof method === "object") { inits.push(this.attr("id")); return this }
        return this
    }
    try { run(inits) } finally { delete $.fn.datepicker }
}

test("a picker whose element holds an input uses it and adds none", function() {
    page("<div id=\"birth\"><input id=\"birth-field\" class=\"text-field item-stretch\" readonly></div>")
    withDatepicker(function(inits) {
        var picker = new UIDatePicker("#birth")
        assert.equal("inputSelector" in picker, false)
        assert.equal($("#birth input").length, 1)
        assert.equal($("#birth input").attr("class"), "text-field item-stretch")
        assert.deepEqual(inits, ["birth-field"])
    })
})

test("an input without an id is given the id the picker would have generated", function() {
    page("<div id=\"birth\"><input class=\"text-field\"></div>")
    withDatepicker(function() {
        var picker = new UIDatePicker("#birth")
        assert.equal("inputSelector" in picker, false)
        assert.equal($("#birth input").attr("id"), "birth-uidatepicker")
        assert.equal($("#birth input").length, 1)
    })
})

test("an element without an input gets one of the picker's own", function() {
    page("<div id=\"birth\"></div>")
    withDatepicker(function() {
        var picker = new UIDatePicker("#birth")
        assert.equal($("#birth input").attr("id"), "birth-uidatepicker")
        assert.equal($("#birth input").length, 1)
        assert.equal($("#birth input").attr("class"), "input dateinput")
    })
})

test("an outlet-bound picker uses the input its owner's nib supplies, whatever the owner's selector is", function() {
    page("<div id=\"owner\"></div>")
    class Owner extends UIView {}
    Owner.nib = "<div id=\"birth\"><input id=\"birth-field\" class=\"text-field item-stretch\" placeholder=\"dd/mm/aaaa\"></div>"
    IBOutlet("#birth", UIDatePicker)(Owner.prototype, "picker", {})
    withDatepicker(function() {
        var owner = new Owner("#owner")
        assert.equal("inputSelector" in owner.picker, false)
        assert.equal($("#owner input").attr("id"), "birth-field")
        assert.equal($("#owner input").length, 1)
        assert.equal($("#birth-field").attr("placeholder"), "dd/mm/aaaa")
    })
})

test("disposing a calendar picker closes its calendar and destroys the widget, and disposing a clock does not touch the calendar", function() {
    page("<div id=\"owner\"></div>")
    var calls = []
    $.fn.datepicker = function(method) {
        if (typeof method === "string") { calls.push(method) }
        return this
    }
    $.fn.clockpicker = function() { return this }
    try {
        class Owner extends UIView {}
        Owner.nib = "<div id=\"birth\"><input id=\"birth-field\"></div>"
        IBOutlet("#birth", UIDatePicker)(Owner.prototype, "picker", {})
        var owner = new Owner("#owner")
        calls.length = 0
        owner._dispose()
        assert.deepEqual(calls, ["hide", "destroy"])

        page("<div id=\"owner\"></div>")
        var clockOwner = new Owner("#owner")
        clockOwner.picker.datePickerMode = UIDatePicker.Mode.time
        calls.length = 0
        clockOwner._dispose()
        assert.deepEqual(calls, [])
    } finally {
        delete $.fn.datepicker
        delete $.fn.clockpicker
    }
})
