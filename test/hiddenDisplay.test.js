import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView } from "../src/index.js"


// A view the stylesheet keeps hidden is shown with the display its element
// has by nature, not always block, so a table cell stays a cell.
test("isHidden = false over a stylesheet that hides the element restores the element's natural display", function() {
    page("<table><tbody><tr id=\"row\" class=\"gone\"><td id=\"cell\" class=\"gone\">x</td></tr></tbody></table><p><span id=\"inline\" class=\"gone\">y</span><a id=\"link\" class=\"gone\">z</a><input id=\"field\" class=\"gone\"><li id=\"item\" class=\"gone\"></li><div id=\"block\" class=\"gone\"></div><custom-view id=\"custom\" class=\"gone\"></custom-view></p>")
    var style = document.createElement("style")
    style.textContent = "#row, #cell, #inline, #link, #field, #item, #block, #custom { display: none; }"
    document.head.appendChild(style)
    try {
        var expected = {row: "table-row", cell: "table-cell", inline: "inline", link: "inline", field: "inline-block", item: "list-item", block: "block", custom: "block"}
        for (var id of Object.keys(expected)) {
            var view = new UIView("#" + id)
            assert.equal(view.isHidden, true, id)
            view.isHidden = false
            assert.equal(getComputedStyle(document.getElementById(id)).display, expected[id], id)
            assert.equal(view.isHidden, false, id)
        }
    } finally {
        style.remove()
    }
})

test("isHidden = false on a view the stylesheet shows gives the stylesheet's display back and leaves no inline value", function() {
    page("<div id=\"flex\"></div><span id=\"s\">y</span>")
    var style = document.createElement("style")
    style.textContent = "#flex { display: flex; }"
    document.head.appendChild(style)
    try {
        var flex = new UIView("#flex")
        flex.isHidden = true
        assert.equal(flex.isHidden, true)
        flex.isHidden = false
        assert.equal(flex.isHidden, false)
        assert.equal(document.getElementById("flex").style.display, "")
        assert.equal(getComputedStyle(document.getElementById("flex")).display, "flex")
        var span = new UIView("#s")
        span.isHidden = true
        span.isHidden = false
        assert.equal(document.getElementById("s").style.display, "")
    } finally {
        style.remove()
    }
})
