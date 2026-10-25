import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { installLayout } from "./fakeLayout.js"
import { clipAncestors, visibleClip, scroller } from "../src/utils/scrollclip.js"


// The `.table-container` of the sites: overflow-x scroll makes the used overflow-y auto, its height is auto, and it is flipped twice
// so the scrollbar sits on top. jsdom does not compute `overflow-y: auto` from `overflow-x: scroll`, so the used value is written out.
var containerStyle = "overflow-x: scroll; overflow-y: auto; transform: rotateX(180deg);"

function build(html) {
    page(html)
    return installLayout({innerHeight: 900})
}

function fill(count, height) {
    var body = document.getElementById("body")
    for (var row = 0; row < count; row++) {
        var tr = document.createElement("tr")
        tr.setAttribute("data-height", String(height))
        tr.appendChild(document.createElement("td"))
        body.appendChild(tr)
    }
}

function ids(ancestors) {
    return ancestors.map(function(ancestor) { return ancestor.element.id + (ancestor.scrolls ? ":scrolls" : ":clips") })
}

function clip(element) {
    return visibleClip(element, clipAncestors(element))
}


test("clipAncestors lists the ancestors whose overflow-y clips, nearest first, and which of them scroll", function() {
    var layout = build("<div id=\"outer\" style=\"overflow-y: auto\"><div id=\"plain\"><div id=\"hidden\" style=\"overflow-y: hidden\"><div id=\"visible\" style=\"overflow-y: visible\"><div id=\"scrolling\" style=\"overflow-y: scroll\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div></div></div></div></div>")
    try {
        assert.deepEqual(ids(clipAncestors(document.getElementById("t"))), ["scrolling:scrolls", "hidden:clips", "outer:scrolls"])
    } finally {
        layout.restore()
    }
})

test("clipAncestors leaves out the element itself, the body and the root, whose overflow belongs to the viewport", function() {
    var layout = build("<div id=\"box\" style=\"overflow-y: auto\"><table id=\"t\" style=\"overflow-y: auto\"><tbody id=\"body\"></tbody></table></div>")
    document.body.style.overflowY = "hidden"
    document.documentElement.style.overflowY = "auto"
    try {
        assert.deepEqual(ids(clipAncestors(document.getElementById("t"))), ["box:scrolls"])
    } finally {
        document.body.style.overflowY = ""
        document.documentElement.style.overflowY = ""
        layout.restore()
    }
})

test("with no clipping ancestor the clip is the viewport", function() {
    var layout = build("<table id=\"t\"><tbody id=\"body\"></tbody></table>")
    try {
        assert.deepEqual(clip(document.getElementById("t")), {top: 0, bottom: 900})
    } finally {
        layout.restore()
    }
})

test("one scrolling ancestor shrinks the clip to its client box, in client coordinates", function() {
    var layout = build("<div id=\"box\" style=\"overflow-y: auto\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div>")
    try {
        fill(50, 100)
        layout.table(document.getElementById("t"), {top: 200})
        layout.scroller(document.getElementById("box"), {top: 150, height: 400})
        assert.deepEqual(clip(document.getElementById("t")), {top: 150, bottom: 550})
        window.scrollTo(0, 100)
        assert.deepEqual(clip(document.getElementById("t")), {top: 50, bottom: 450}, "the box moved up with the page")
        window.scrollTo(0, 400)
        assert.deepEqual(clip(document.getElementById("t")), {top: 0, bottom: 150}, "the box's top edge left the viewport")
        window.scrollTo(0, 1000)
        assert.deepEqual(clip(document.getElementById("t")), {top: 0, bottom: 0}, "the box is above the viewport: empty, not inverted")
    } finally {
        layout.restore()
    }
})

test("nested ancestors intersect, and the viewport trims what sticks out of it", function() {
    var layout = build("<div id=\"outer\" style=\"overflow-y: auto\"><div id=\"inner\" style=\"overflow-y: hidden\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div></div>")
    try {
        fill(50, 100)
        layout.table(document.getElementById("t"), {top: 0})
        layout.box(document.getElementById("outer"), {top: 100, height: 600})
        layout.box(document.getElementById("inner"), {top: 300, height: 800})
        assert.deepEqual(clip(document.getElementById("t")), {top: 300, bottom: 700})
        layout.box(document.getElementById("inner"), {top: -200, height: 800})
        assert.deepEqual(clip(document.getElementById("t")), {top: 100, bottom: 600})
        layout.box(document.getElementById("outer"), {top: -300, height: 2000})
        assert.deepEqual(clip(document.getElementById("t")), {top: 0, bottom: 600})
    } finally {
        layout.restore()
    }
})

test("an ancestor scrolled out of the viewport leaves an empty clip that is never inverted", function() {
    var layout = build("<div id=\"box\" style=\"overflow-y: auto\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div>")
    try {
        layout.box(document.getElementById("box"), {top: 2000, height: 400})
        var result = clip(document.getElementById("t"))
        assert.equal(result.bottom - result.top, 0)
        layout.box(document.getElementById("box"), {top: -2000, height: 400})
        result = clip(document.getElementById("t"))
        assert.equal(result.bottom - result.top, 0)
    } finally {
        layout.restore()
    }
})

test("the flipped .table-container clips to the table's own rect: on the table's rows it changes nothing", function() {
    var layout = build("<div id=\"container\" style=\"" + containerStyle + "\"><table id=\"t\"><thead><tr data-height=\"30\"><th>h</th></tr></thead><tbody id=\"body\"></tbody></table></div>")
    try {
        fill(100, 95)
        var table = document.getElementById("t")
        layout.table(table, {top: 130})
        assert.deepEqual(ids(clipAncestors(table)), ["container:scrolls"])
        assert.deepEqual(clip(table), {top: 130, bottom: 900})
        window.scrollTo(0, 500)
        assert.deepEqual(clip(table), {top: 0, bottom: 900}, "the rows in view are all inside the container's rect")
        window.scrollTo(0, 8900)
        var rect = table.getBoundingClientRect()
        assert.deepEqual(clip(table), {top: 0, bottom: Math.min(900, rect.bottom)})
    } finally {
        layout.restore()
    }
})

test("scroller is the document when nothing scrolls, and never the auto-height .table-container", function() {
    var layout = build("<div id=\"container\" style=\"" + containerStyle + "\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div>")
    try {
        fill(100, 95)
        layout.table(document.getElementById("t"), {top: 0})
        assert.equal(scroller(document.getElementById("t")), document.scrollingElement)
    } finally {
        layout.restore()
    }
})

test("scroller is the nearest ancestor that scrolls vertically and actually has something to scroll", function() {
    var layout = build("<div id=\"outer\" style=\"overflow-y: scroll\"><div id=\"inner\" style=\"overflow-y: auto\"><div id=\"container\" style=\"" + containerStyle + "\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div></div></div>")
    try {
        fill(3, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 0})
        layout.scroller(document.getElementById("outer"), {top: 0, height: 800})
        layout.scroller(document.getElementById("inner"), {top: 0, height: 600})
        assert.equal(scroller(table), document.scrollingElement, "300 px of rows fit in both boxes")
        fill(20, 100)
        assert.equal(scroller(table), document.getElementById("inner"), "the list grew, so the answer changed with it")
    } finally {
        layout.restore()
    }
})

test("scroller skips an ancestor whose overflow-y is hidden or visible even when it overflows", function() {
    var layout = build("<div id=\"hidden\" style=\"overflow-y: hidden\"><div id=\"visible\"><table id=\"t\"><tbody id=\"body\"></tbody></table></div></div>")
    try {
        fill(50, 100)
        layout.table(document.getElementById("t"), {top: 0})
        layout.scroller(document.getElementById("hidden"), {top: 0, height: 300})
        assert.equal(scroller(document.getElementById("t")), document.scrollingElement)
    } finally {
        layout.restore()
    }
})
