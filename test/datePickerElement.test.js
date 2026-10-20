import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIDatePicker, UIView, UIViewController } from "../src/index.js"


// jQuery UI is a page script the framework wraps; this stand-in records the calls.
function withDatepicker(run) {
    var log = []
    $.fn.datepicker = function(method, name) {
        if (typeof method === "object") { log.push("init:" + this.attr("id")); return this }
        log.push([method, name].filter((part) => part !== undefined).join(":"))
        if (method === "getDate") { return null }
        return this
    }
    try { run(log) } finally { delete $.fn.datepicker }
}

var markup = "<div id=\"start\"><input id=\"start-field\" class=\"input\" readonly></div>"

test("disposing a dateAndTime picker whose element has left the document does not throw, and the held input gets its type and readOnly back", function() {
    page(markup)
    withDatepicker(function() {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = "dateAndTime"
        var input = document.getElementById("start-field")
        assert.equal(input.type, "datetime-local")
        assert.equal(input.readOnly, false)
        $("#start").remove()
        picker._dispose()
        assert.equal(input.type, "text")
        assert.equal(input.readOnly, true)
        assert.equal(input.value, "")
    })
})

test("renaming the input's id after construction leaves date, value and the mode switches working", function() {
    page(markup)
    withDatepicker(function(log) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = "dateAndTime"
        document.getElementById("start-field").id = "renamed"
        picker.date = new Date(2026, 0, 5, 9, 7)
        assert.equal(document.getElementById("renamed").value, "2026-01-05T09:07")
        assert.equal(picker.$input.prop("value"), "2026-01-05T09:07")
        var read = picker.date
        assert.deepEqual([read.getFullYear(), read.getMonth(), read.getDate(), read.getHours(), read.getMinutes()], [2026, 0, 5, 9, 7])
        picker.datePickerMode = "date"
        assert.equal(document.getElementById("renamed").type, "text")
        assert.equal(log[log.length - 1], "init:renamed", "the calendar is built on the held input under its new id")
        picker.datePickerMode = "dateAndTime"
        assert.equal(document.getElementById("renamed").type, "datetime-local")
        assert.equal(document.querySelectorAll("#start input").length, 1)
    })
})

test("an input given a new id by awakeFromNib still reads as the picker's, as an @IBOutlet", function() {
    class Owner extends UIView {}
    Owner.nib = markup
    IBOutlet("#start", UIDatePicker)(Owner.prototype, "picker", {})
    page("<div id=\"owner\"></div>")
    withDatepicker(function() {
        var owner = new Owner("#owner")
        owner.picker.datePickerMode = "dateAndTime"
        document.getElementById("start-field").setAttribute("id", "start-accessibility-id")
        owner.picker.date = new Date(2026, 4, 2, 13, 30)
        assert.equal(document.getElementById("start-accessibility-id").value, "2026-05-02T13:30")
        assert.equal(owner.picker.date.getHours(), 13)
    })
})

test("inputSelector keeps what it was at construction, and nothing in the picker queries the document for its input", function() {
    page(markup)
    withDatepicker(function() {
        var picker = new UIDatePicker("#start")
        assert.equal(picker.inputSelector, "#start-field")
        var queries = 0
        var originals = [window.Element.prototype.querySelectorAll, window.Document.prototype.querySelectorAll, window.Document.prototype.getElementById]
        window.Element.prototype.querySelectorAll = function(...args) { queries += 1; return originals[0].apply(this, args) }
        window.Document.prototype.querySelectorAll = function(...args) { queries += 1; return originals[1].apply(this, args) }
        window.Document.prototype.getElementById = function(...args) { queries += 1; return originals[2].apply(this, args) }
        try {
            picker.date = new Date(2026, 0, 5)
            picker.date
            picker.$input
        } finally {
            window.Element.prototype.querySelectorAll = originals[0]
            window.Document.prototype.querySelectorAll = originals[1]
            window.Document.prototype.getElementById = originals[2]
        }
        assert.equal(queries, 0)
    })
})

test("a picker whose element was replaced with a new node holds the input of the new one, and one whose element is only gone keeps the old", function() {
    page(markup)
    withDatepicker(function() {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = "dateAndTime"
        var first = document.getElementById("start-field")
        page(markup)
        var replaced = document.getElementById("start-field")
        assert.notEqual(replaced, first)
        assert.equal(picker.$input[0], replaced)
        $("#start").remove()
        assert.equal(picker.$input[0], replaced, "gone, so the held input stays")
    })
})

test("date, time, dateAndTime and yearAndMonth behave as before on the held input", function() {
    page(markup)
    withDatepicker(function() {
        $.fn.clockpicker = function() { return this }
        try {
            var picker = new UIDatePicker("#start")
            picker.datePickerMode = "time"
            picker.date = new Date(2026, 0, 5, 7, 5)
            assert.equal(document.getElementById("start-field").value, "07:05")
            assert.equal(picker.date.getHours(), 7)
            picker.datePickerMode = "dateAndTime"
            picker.date = new Date(2026, 0, 5, 9, 7)
            assert.equal(document.getElementById("start-field").value, "2026-01-05T09:07")
            picker.datePickerMode = "yearAndMonth"
            picker.date = new Date(2026, 5, 17)
            assert.equal(picker.date.getDate(), 1)
            assert.equal(picker.date.getMonth(), 5)
        } finally {
            delete $.fn.clockpicker
        }
    })
})

// The controller empties its element before it disposes its views, so a picker is
// disposed after its element has left the document.
function nested(mode) {
    class Page extends UIViewController {
        viewDidLoad() { this.picker.datePickerMode = mode }
    }
    Page.nib = "<div id=\"when\"><input id=\"when-input\" class=\"input\" readonly></div>"
    IBOutlet("#when", UIDatePicker)(Page.prototype, "picker", {})
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

test("a controller removed with a dateAndTime picker releases it without throwing, and the page can attach a new one", function() {
    withDatepicker(function() {
        var child = nested("dateAndTime")
        var input = document.getElementById("when-input")
        assert.equal(input.type, "datetime-local")
        child.removeFromParent()
        assert.equal(input.type, "text", "the held input is restored although it left the document")
        assert.equal(input.readOnly, true)
        var second = nested("dateAndTime")
        second.picker.date = new Date(2026, 6, 1, 8, 15)
        assert.equal(document.getElementById("when-input").value, "2026-07-01T08:15")
        assert.equal(second.picker.date.getMinutes(), 15)
        second.removeFromParent()
        assert.equal(document.querySelectorAll("input").length, 0)
    })
})

test("a calendar picker disposed after its element left the page closes and destroys the widget on the held input", function() {
    withDatepicker(function(log) {
        var child = nested("date")
        log.length = 0
        child.removeFromParent()
        assert.ok(log.includes("hide") && log.includes("destroy"), log.join())
    })
})
