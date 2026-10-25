import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UITableViewScrollPosition, IndexPath } from "../src/index.js"
import { setup, renderedRows, scrollTo } from "./tableReuseHelpers.js"


var position = UITableViewScrollPosition

function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

function rect(row) {
    return document.getElementById("cell-" + row).getBoundingClientRect()
}

function spyScrollBy() {
    var root = document.documentElement
    var calls = []
    var original = root.scrollBy
    root.scrollBy = function() {
        calls.push(arguments[0])
        return original.apply(this, arguments)
    }
    return {calls, restore() { delete root.scrollBy }}
}

var tall = {container: true, estimatedRowHeight: 95, heightOf: () => 130}

test("18. top, middle and bottom to the unrendered row 700 leave it rendered at the clip's top, middle and bottom, in at most 2 corrections", function() {
    for (var [at, expected] of [[position.top, (r) => r.top], [position.middle, (r) => (r.top + r.bottom) / 2], [position.bottom, (r) => r.bottom]]) {
        withTable(tall, function({table, layout}) {
            var spy = spyScrollBy()
            try {
                table.scrollToRow(new IndexPath({row: 700}), {at, animated: false})
                var target = {top: 0, middle: 450, bottom: 900}[at]
                assert.ok(renderedRows().includes(700))
                assert.ok(Math.abs(expected(rect(700)) - target) <= 0.5, at + ": " + expected(rect(700)))
                assert.ok(spy.calls.length <= 3, "one scroll and at most 2 corrections: " + spy.calls.length)
                assert.equal(document.getElementById("container").scrollTop, 0, "the page scrolled, not the .table-container")
            } finally {
                spy.restore()
            }
        })
    }
})

test("18. none does not scroll for a fully visible row and scrolls the minimum for one below the area", function() {
    withTable(tall, function({table, layout}) {
        var spy = spyScrollBy()
        try {
            table.scrollToRow(new IndexPath({row: 2}), {at: position.none, animated: false})
            assert.equal(window.scrollY, 0)
            assert.equal(spy.calls.length, 0)
            table.scrollToRow(new IndexPath({row: 300}), {at: position.none, animated: false})
            assert.ok(Math.abs(rect(300).bottom - 900) <= 0.5, "bottom " + rect(300).bottom)
        } finally {
            spy.restore()
        }
    })
})

test("18. inside a 400 px inner scroller the ancestor scrolls and the document does not", function() {
    withTable({top: 200, box: {top: 150, height: 400}, estimatedRowHeight: 95, heightOf: () => 130}, function({table}) {
        table.scrollToRow(new IndexPath({row: 400}), {at: position.top, animated: false})
        assert.ok(document.getElementById("box").scrollTop > 0)
        assert.equal(window.scrollY, 0)
        assert.ok(Math.abs(rect(400).top - 150) <= 0.5, "top " + rect(400).top)
    })
})

test("18. top to the last row stops at the scroller's maximum", function() {
    withTable({}, function({table}) {
        table.scrollToRow(new IndexPath({row: 999}), {at: position.top, animated: false})
        assert.ok(renderedRows().includes(999))
        assert.equal(window.scrollY, document.documentElement.scrollHeight - window.innerHeight)
    })
})

test("18. bad arguments throw before anything scrolls, naming scrollToRow(at:at:animated:)", function() {
    withTable({}, function({table}) {
        var named = (error) => /scrollToRow\(at:at:animated:\)/.test(error.message)
        var typeError = (error) => error instanceof TypeError && named(error)
        var rangeError = (error) => error instanceof RangeError && named(error)
        var cases = [
            [() => table.scrollToRow(new IndexPath({row: 5}), {animated: false}), typeError],
            [() => table.scrollToRow(new IndexPath({row: 5}), {at: "sideways", animated: false}), typeError],
            [() => table.scrollToRow(new IndexPath({row: 5}), {at: position.top}), typeError],
            [() => table.scrollToRow("five", {at: position.top, animated: false}), typeError],
            [() => table.scrollToRow(new IndexPath({section: 1, row: 5}), {at: position.top, animated: false}), rangeError],
            [() => table.scrollToRow(new IndexPath({row: -1}), {at: position.top, animated: false}), rangeError],
            [() => table.scrollToRow(new IndexPath({row: 1000}), {at: position.top, animated: false}), rangeError],
        ]
        for (var [call, matches] of cases) {
            assert.throws(call, matches)
            assert.equal(window.scrollY, 0)
        }
    })
})

test("18. a bare row number is accepted, selectRow lands where scrollToRow does, and animated changes nothing", function() {
    var landed = []
    for (var how of ["scrollToRow", "selectRow", "animated"]) {
        withTable(tall, function({table}) {
            if (how === "scrollToRow") { table.scrollToRow(700, {at: position.middle, animated: false}) }
            if (how === "selectRow") { table.selectRow({at: 700, animated: false, scrollPosition: position.middle}) }
            if (how === "animated") { table.scrollToRow(700, {at: position.middle, animated: true}) }
            landed.push(window.scrollY)
        })
    }
    assert.equal(landed[0], landed[1])
    assert.equal(landed[0], landed[2])
    assert.ok(landed[0] > 0)
})
