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
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
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
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        document.getElementById("start-field").id = "renamed"
        picker.date = new Date(2026, 0, 5, 9, 7)
        assert.equal(document.getElementById("renamed").value, "2026-01-05T09:07")
        var read = picker.date
        assert.deepEqual([read.getFullYear(), read.getMonth(), read.getDate(), read.getHours(), read.getMinutes()], [2026, 0, 5, 9, 7])
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(document.getElementById("renamed").type, "text")
        assert.equal(log.filter((entry) => entry.startsWith("init:")).pop(), "init:renamed", "the calendar is built on the held input under its new id")
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
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
        owner.picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        document.getElementById("start-field").setAttribute("id", "start-accessibility-id")
        owner.picker.date = new Date(2026, 4, 2, 13, 30)
        assert.equal(document.getElementById("start-accessibility-id").value, "2026-05-02T13:30")
        assert.equal(owner.picker.date.getHours(), 13)
    })
})

test("the picker keeps its input to itself, and nothing in it queries the document for the input", function() {
    page(markup)
    withDatepicker(function() {
        var picker = new UIDatePicker("#start")
        assert.equal("inputSelector" in picker, false)
        assert.equal("$input" in picker, false)
        var queries = 0
        var originals = [window.Element.prototype.querySelectorAll, window.Document.prototype.querySelectorAll, window.Document.prototype.getElementById]
        window.Element.prototype.querySelectorAll = function(...args) { queries += 1; return originals[0].apply(this, args) }
        window.Document.prototype.querySelectorAll = function(...args) { queries += 1; return originals[1].apply(this, args) }
        window.Document.prototype.getElementById = function(...args) { queries += 1; return originals[2].apply(this, args) }
        try {
            picker.date = new Date(2026, 0, 5)
            picker.date
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
        picker.datePickerMode = UIDatePicker.Mode.dateAndTime
        var first = document.getElementById("start-field")
        page(markup)
        var replaced = document.getElementById("start-field")
        assert.notEqual(replaced, first)
        picker.date = new Date(2026, 0, 5, 9, 7)
        assert.equal(replaced.value, "2026-01-05T09:07", "the new element's input is the one written")
        assert.equal(first.value, "")
        $("#start").remove()
        replaced.value = "2026-03-04T05:06"
        assert.equal(picker.date.getMonth(), 2, "gone, so the held input stays the one read")
        picker.date = new Date(2026, 0, 6, 9, 7)
        assert.equal(replaced.value, "2026-01-06T09:07")
    })
})

test("date, time, dateAndTime and yearAndMonth behave as before on the held input", function() {
    page(markup)
    withDatepicker(function() {
        $.fn.clockpicker = function() { return this }
        try {
            var picker = new UIDatePicker("#start")
            picker.datePickerMode = UIDatePicker.Mode.time
            picker.date = new Date(2026, 0, 5, 7, 5)
            assert.equal(document.getElementById("start-field").value, "07:05")
            assert.equal(picker.date.getHours(), 7)
            picker.datePickerMode = UIDatePicker.Mode.dateAndTime
            picker.date = new Date(2026, 0, 5, 9, 7)
            assert.equal(document.getElementById("start-field").value, "2026-01-05T09:07")
            picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
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
        var child = nested(UIDatePicker.Mode.dateAndTime)
        var input = document.getElementById("when-input")
        assert.equal(input.type, "datetime-local")
        child.removeFromParent()
        assert.equal(input.type, "text", "the held input is restored although it left the document")
        assert.equal(input.readOnly, true)
        var second = nested(UIDatePicker.Mode.dateAndTime)
        second.picker.date = new Date(2026, 6, 1, 8, 15)
        assert.equal(document.getElementById("when-input").value, "2026-07-01T08:15")
        assert.equal(second.picker.date.getMinutes(), 15)
        second.removeFromParent()
        assert.equal(document.querySelectorAll("input").length, 0)
    })
})

test("a calendar picker disposed after its element left the page closes and destroys the widget on the held input", function() {
    withDatepicker(function(log) {
        var child = nested(UIDatePicker.Mode.date)
        log.length = 0
        child.removeFromParent()
        assert.ok(log.includes("hide") && log.includes("destroy"), log.join())
    })
})


// jQuery UI's datepicker keeps its instance in the input's jQuery data and marks the
// input with a class. Emptying the picker's element wipes the data and leaves the class,
// and destroy() then reads an instance that is not there: this stand-in fails the same way.
function withRealisticDatepicker(run) {
    var log = []
    $.fn.datepicker = function(method) {
        if (typeof method === "object") {
            this.data("datepicker", {append: $("<span>"), options: method}).addClass("hasDatepicker")
            log.push("init")
            return this
        }
        if (method === "destroy") {
            if (!this.hasClass("hasDatepicker")) { return this }
            var instance = this.data("datepicker")
            instance.append.remove()
            this.removeData("datepicker").removeClass("hasDatepicker")
            log.push("destroy")
            return this
        }
        if (method === "getDate") { return null }
        log.push(method)
        return this
    }
    try { run(log) } finally { delete $.fn.datepicker }
}

test("a calendar picker disposed after its element was emptied still destroys its widget, and does not throw", function() {
    withRealisticDatepicker(function(log) {
        var child = nested(UIDatePicker.Mode.date)
        var input = document.getElementById("when-input")
        assert.equal(input.classList.contains("hasDatepicker"), true)
        log.length = 0
        child.removeFromParent()
        assert.equal(input.classList.contains("hasDatepicker"), false)
        assert.ok(log.includes("destroy"), log.join())
    })
})

test("a yearAndMonth picker disposed after its element was emptied destroys its widget too", function() {
    withRealisticDatepicker(function(log) {
        var child = nested(UIDatePicker.Mode.yearAndMonth)
        var input = document.getElementById("when-input")
        child.removeFromParent()
        assert.equal(input.classList.contains("hasDatepicker"), false)
    })
})

test("switching modes after the widget was built destroys it once and builds the next on the held input", function() {
    page(markup)
    withRealisticDatepicker(function(log) {
        var picker = new UIDatePicker("#start")
        picker.datePickerMode = UIDatePicker.Mode.yearAndMonth
        picker.datePickerMode = UIDatePicker.Mode.date
        assert.equal(document.getElementById("start-field").classList.contains("hasDatepicker"), true)
        assert.equal(log.filter((entry) => entry === "destroy").length, 2)
        picker._dispose()
        assert.equal(document.getElementById("start-field").classList.contains("hasDatepicker"), false)
    })
})
