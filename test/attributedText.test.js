import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UILabel, UITextField, UIButton, UISegmentedControl, UIPickerView, UISearchTextField, UISearchToken, UIControlState, NSAttributedString, NSAttributedStringDocumentType } from "../src/index.js"


var payload = "<img src=x onerror=\"alert(1)\">"

// Two states and no third: a plain-text sink always escapes, by assigning
// textContent and letting the DOM do it; markup is an opt-in path carried by
// an NSAttributedString, which sanitises nothing and is for trusted input.
test("every plain-text sink renders markup as literal text, with no element created", function() {
    page("<p id=\"l\"></p><input id=\"i\"><div id=\"d\"></div><button id=\"b\"></button><div id=\"s\"><span></span><span></span></div><select id=\"p\"></select><div id=\"t\"></div>")
    var label = new UILabel("#l")
    label.text = payload
    assert.equal(label.text, payload)
    assert.equal($("#l img").length, 0)
    var input = new UITextField("#i")
    input.text = payload
    assert.equal(input.text, payload)
    input.placeholder = payload
    assert.equal(input.placeholder, payload)
    assert.equal($("#i").attr("placeholder"), payload)
    var div = new UITextField("#d")
    div.text = payload
    assert.equal(div.text, payload)
    assert.equal($("#d img").length, 0)
    var button = new UIButton("#b")
    button.setTitle(payload, {for: UIControlState.normal})
    assert.equal(button.currentTitle, payload)
    assert.equal($("#b img").length, 0)
    var segments = new UISegmentedControl("#s")
    segments.setTitle(payload, {forSegmentAt: 1})
    assert.equal(segments.titleForSegment({at: 1}), payload)
    assert.equal($("#s img").length, 0)
    var picker = new UIPickerView("#p")
    picker.dataSource = {pickerViewNumberOfRowsInComponent: function() { return 1 }}
    picker.delegate = {pickerViewTitleForRowForComponent: function() { return payload }}
    assert.equal($("#p option").text(), payload)
    assert.equal($("#p img").length, 0)
    var search = new UISearchTextField("#t")
    search.insertToken(new UISearchToken({text: payload}), {at: 0})
    assert.equal($("#t .tag-text").text(), payload)
    assert.equal($("#t img").length, 0)
    assert.equal(document.querySelectorAll("img").length, 0)
})

test("escaping round-trips instead of accumulating", function() {
    page("<p id=\"l\"></p>")
    var label = new UILabel("#l")
    label.text = "Tom & Jerry <3"
    assert.equal(label.text, "Tom & Jerry <3")
    label.text = label.text
    assert.equal(label.text, "Tom & Jerry <3")
    assert.equal($("#l").text(), "Tom & Jerry <3")
})

test("attributedText with the html document type renders markup and sanitises nothing", function() {
    page("<p id=\"l\"></p>")
    var label = new UILabel("#l")
    label.attributedText = new NSAttributedString({data: "<b>x</b>", options: {documentType: NSAttributedStringDocumentType.html}})
    assert.equal($("#l b").length, 1)
    assert.ok(label.attributedText instanceof NSAttributedString)
    label.attributedText = new NSAttributedString({data: "<i onmouseover=\"1\">y</i>", options: {documentType: NSAttributedStringDocumentType.html}})
    assert.equal($("#l i").attr("onmouseover"), "1", "the markup path must not strip anything")
})

test("an attributed string from a plain string renders literal text, and .string is the plain text of an html one", function() {
    page("<p id=\"l\"></p>")
    var label = new UILabel("#l")
    label.attributedText = new NSAttributedString({string: "<b>x</b>"})
    assert.equal($("#l b").length, 0)
    assert.equal(label.text, "<b>x</b>")
    assert.equal(new NSAttributedString({string: "a & b"}).string, "a & b")
    assert.equal(new NSAttributedString({data: "<b>x</b> &amp; y", options: {documentType: NSAttributedStringDocumentType.html}}).string, "x & y")
    assert.equal(NSAttributedStringDocumentType.plain, "plain")
})

test("setAttributedTitle keeps a title per state like setTitle, and attributedTitle reads it back", function() {
    page("<button id=\"b\"></button>")
    var button = new UIButton("#b")
    button.setAttributedTitle(new NSAttributedString({data: "<svg></svg>", options: {documentType: NSAttributedStringDocumentType.html}}), {for: UIControlState.normal})
    assert.equal($("#b svg").length, 1)
    button.setAttributedTitle(new NSAttributedString({string: "Saving"}), {for: UIControlState.disabled})
    assert.equal($("#b svg").length, 1)
    button.isEnabled = false
    assert.equal($("#b").text(), "Saving")
    assert.equal($("#b svg").length, 0)
    assert.ok(button.attributedTitle({for: UIControlState.disabled}) instanceof NSAttributedString)
    assert.equal(button.attributedTitle({for: UIControlState.selected}).string, "")
    button.isEnabled = true
    assert.equal($("#b svg").length, 1)
})

test("a DOMPurify global changes nothing: there is no hook", function() {
    page("<p id=\"l\"></p>")
    globalThis.DOMPurify = {sanitize: function() { return "purified" }}
    try {
        var label = new UILabel("#l")
        label.text = "<b>x</b>"
        assert.equal(label.text, "<b>x</b>")
        label.attributedText = new NSAttributedString({data: "<b>x</b>", options: {documentType: NSAttributedStringDocumentType.html}})
        assert.equal($("#l b").length, 1)
    } finally {
        delete globalThis.DOMPurify
    }
})

test("the markup path calls Element.setHTML where the browser has it and falls back to plain insertion where it does not", function() {
    page("<p id=\"with\"></p><p id=\"without\"></p>")
    var withIt = document.getElementById("with")
    var calls = []
    withIt.setHTML = function(markup) { calls.push(markup); this.textContent = "set by setHTML" }
    new UILabel("#with").attributedText = new NSAttributedString({data: "<b>x</b>", options: {documentType: NSAttributedStringDocumentType.html}})
    assert.deepEqual(calls, ["<b>x</b>"])
    assert.equal(withIt.innerHTML, "set by setHTML")
    var without = document.getElementById("without")
    assert.equal(typeof without.setHTML, "undefined")
    new UILabel("#without").attributedText = new NSAttributedString({data: "<b>y</b>", options: {documentType: NSAttributedStringDocumentType.html}})
    assert.equal(without.innerHTML, "<b>y</b>")
})

// The spinner saves and restores the rendered title through the markup path;
// a title that arrived as text must come back as text.
test("a text title survives the activity indicator round-trip without becoming markup", function() {
    page("<button id=\"send\"></button>")
    var button = new UIButton("#send")
    button.setTitle("<b>Send</b>", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    assert.equal($("#send .fa-spin").length, 1)
    button.showsActivityIndicator = false
    assert.equal($("#send b").length, 0)
    assert.equal(document.getElementById("send").textContent, "<b>Send</b>")
    assert.equal(button.currentTitle, "<b>Send</b>")
})

// Reading the plain text of markup must parse it somewhere inert: a live
// element given innerHTML starts loading an <img> and would run its handler.
test("the string of a markup attributed string is read without executing the markup", function() {
    delete globalThis.hit
    var attributed = new NSAttributedString({data: "<img src=x onerror=\"globalThis.hit = 1\">a", options: {documentType: NSAttributedStringDocumentType.html}})
    assert.equal(attributed.string, "a")
    assert.equal(globalThis.hit, undefined)
})

// The spinner is the framework's one internal markup write, and it goes through
// setMarkup so the setHTML hardening reaches it too.
test("the activity indicator writes its spinner and the restored title through Element.setHTML where the browser has it", function() {
    page("<button id=\"send\"></button>")
    var element = document.getElementById("send")
    var calls = []
    element.setHTML = function(markup) { calls.push(markup); this.innerHTML = markup }
    var button = new UIButton("#send")
    button.setTitle("Send", {for: UIControlState.normal})
    button.showsActivityIndicator = true
    button.showsActivityIndicator = false
    assert.equal(calls.length, 2)
    assert.match(calls[0], /fa-spin/)
    assert.equal(calls[1], "Send")
})
