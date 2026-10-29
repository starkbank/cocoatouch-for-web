import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { installLayout } from "./fakeLayout.js"


var tableHtml = "<div id=\"scroller\"><div id=\"container\"><table id=\"t\"><thead><tr data-height=\"30\"><th>h</th></tr></thead><tbody id=\"body\"></tbody></table></div></div>"

function fill(count, height) {
    var body = document.getElementById("body")
    for (var row = 0; row < count; row++) {
        var tr = document.createElement("tr")
        tr.id = "cell-" + row
        tr.setAttribute("data-height", String(height))
        tr.appendChild(document.createElement("td"))
        body.appendChild(tr)
    }
}

function withLayout(options, body) {
    page(tableHtml)
    var layout = installLayout(options)
    try { body(layout) } finally { layout.restore() }
}


test("rows stack from their data-height below the table's top and the header", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(5, 95)
        var table = document.getElementById("t")
        layout.table(table, {top: 100})
        assert.equal(table.getBoundingClientRect().top, 100)
        assert.equal(table.getBoundingClientRect().height, 30 + 5 * 95)
        assert.equal(document.getElementById("cell-0").getBoundingClientRect().top, 130)
        assert.equal(document.getElementById("cell-3").getBoundingClientRect().top, 130 + 3 * 95)
        assert.equal(document.getElementById("cell-3").getBoundingClientRect().height, 95)
        assert.equal(document.getElementById("cell-4").getBoundingClientRect().bottom, 130 + 5 * 95)
        var body = document.getElementById("body").getBoundingClientRect()
        assert.equal(body.top, 130)
        assert.equal(body.height, 5 * 95)
    })
})

test("a spacer takes its inline height, and a hidden tbody and the rows in it take none", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(2, 50)
        var table = document.getElementById("t")
        var spacer = document.createElement("tr")
        spacer.style.height = "4000px"
        document.getElementById("body").insertBefore(spacer, document.getElementById("cell-0"))
        var queue = document.createElement("tbody")
        queue.style.display = "none"
        var queued = document.createElement("tr")
        queued.setAttribute("data-height", "77")
        queue.appendChild(queued)
        table.insertBefore(queue, document.getElementById("body"))
        layout.table(table, {top: 0})
        assert.equal(spacer.getBoundingClientRect().top, 30)
        assert.equal(document.getElementById("cell-0").getBoundingClientRect().top, 4030)
        assert.equal(queued.getBoundingClientRect().height, 0)
        assert.equal(queue.getBoundingClientRect().height, 0)
        assert.equal(table.getBoundingClientRect().height, 30 + 4000 + 100)
    })
})

test("client rects follow window.scrollY, and scrollTo clamps to the document and fires one scroll event per frame", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(100, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 100})
        assert.equal(window.innerHeight, 900)
        assert.equal(document.documentElement.clientHeight, 900)
        assert.equal(document.documentElement.scrollHeight, 100 + 30 + 10000)
        var fired = 0
        document.addEventListener("scroll", function() { fired++ })
        window.scrollTo(0, 500)
        window.scrollBy(0, 250)
        assert.equal(window.scrollY, 750)
        assert.equal(fired, 0, "scroll events wait for the frame")
        layout.flushFrames()
        assert.equal(fired, 1)
        assert.equal(document.getElementById("cell-0").getBoundingClientRect().top, 130 - 750)
        window.scrollTo(0, 1e9)
        assert.equal(window.scrollY, 100 + 30 + 10000 - 900)
        window.scrollTo(0, -10)
        assert.equal(window.scrollY, 0)
        layout.flushFrames()
        assert.equal(fired, 2)
        layout.flushFrames()
        assert.equal(fired, 2, "a position that did not change fires nothing")
    })
})

test("an inner scroller clips its own box, scrolls its content and leaves the document alone", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(50, 100)
        var scroller = document.getElementById("scroller")
        layout.table(document.getElementById("t"), {top: 200})
        layout.scroller(scroller, {top: 150, height: 400})
        assert.equal(scroller.clientHeight, 400)
        assert.equal(scroller.scrollHeight, 200 + 30 + 5000 - 150)
        assert.equal(scroller.getBoundingClientRect().top, 150)
        assert.equal(scroller.getBoundingClientRect().height, 400)
        var fired = []
        scroller.addEventListener("scroll", function() { fired.push("element") })
        document.addEventListener("scroll", function() { fired.push("document") })
        scroller.scrollTop = 300
        layout.flushFrames()
        assert.equal(scroller.scrollTop, 300)
        assert.equal(window.scrollY, 0)
        assert.deepEqual(fired, ["element"], "element scroll events do not bubble")
        assert.equal(document.getElementById("cell-0").getBoundingClientRect().top, 230 - 300)
        assert.equal(scroller.getBoundingClientRect().top, 150)
        scroller.scrollBy({top: 1e9})
        assert.equal(scroller.scrollTop, scroller.scrollHeight - 400)
    })
})

test("a container with no height of its own takes the table's rect", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(3, 100)
        layout.table(document.getElementById("t"), {top: 40})
        var container = document.getElementById("container").getBoundingClientRect()
        assert.equal(container.top, 40)
        assert.equal(container.height, 330)
    })
})

test("requestAnimationFrame runs on flushFrames, callbacks queued during a flush wait, and cancel works", function() {
    withLayout({}, function(layout) {
        var ran = []
        var cancelled = requestAnimationFrame(function() { ran.push("cancelled") })
        requestAnimationFrame(function() {
            ran.push("first")
            requestAnimationFrame(function() { ran.push("nested") })
        })
        cancelAnimationFrame(cancelled)
        assert.equal(layout.flushFrames(), 1)
        assert.deepEqual(ran, ["first"])
        assert.equal(layout.flushFrames(), 1)
        assert.deepEqual(ran, ["first", "nested"])
        assert.equal(layout.flushFrames(), 0)
    })
})

test("ResizeObserver reports on resize with the content size, and stops after unobserve and disconnect", function() {
    withLayout({}, function(layout) {
        fill(2, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 0, width: 800})
        var reports = []
        var observer = new ResizeObserver(function(entries) {
            for (var entry of entries) { reports.push([entry.target.id, entry.contentRect.width, entry.contentBoxSize[0].inlineSize, entry.contentBoxSize[0].blockSize]) }
        })
        observer.observe(table)
        layout.resize(table, {width: 400})
        assert.deepEqual(reports, [], "delivery waits for the frame")
        layout.flushFrames()
        assert.deepEqual(reports, [["t", 400, 400, 230]])
        assert.equal(table.getBoundingClientRect().width, 400)
        layout.resize(table, {})
        layout.flushFrames()
        assert.equal(reports.length, 2, "a height-only report is still a report")
        observer.unobserve(table)
        layout.resize(table, {width: 10})
        layout.flushFrames()
        assert.equal(reports.length, 2)
        observer.observe(table)
        observer.disconnect()
        layout.resize(table, {width: 20})
        layout.flushFrames()
        assert.equal(reports.length, 2)
    })
})

test("the read and write log shows each switch between reading layout and mutating the document", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(2, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 0})
        layout.clearLog()
        document.getElementById("cell-0").getBoundingClientRect()
        document.documentElement.clientHeight
        document.getElementById("cell-1").style.height = "10px"
        document.getElementById("body").appendChild(document.createElement("tr"))
        getComputedStyle(table)
        assert.deepEqual(layout.readWriteLog(), ["read", "write", "read"])
        document.getElementById("cell-1").setAttribute("class", "x")
        assert.deepEqual(layout.readWriteLog(), ["read", "write", "read", "write"])
    })
})

test("restore gives the document its unstyled answers back", function() {
    page(tableHtml)
    fill(2, 100)
    var layout = installLayout({innerHeight: 900})
    layout.table(document.getElementById("t"), {top: 50})
    assert.equal(document.getElementById("cell-0").getBoundingClientRect().height, 100)
    layout.restore()
    assert.equal(document.getElementById("cell-0").getBoundingClientRect().height, 0)
    assert.equal(typeof ResizeObserver, "undefined")
})

test("native scroll anchoring keeps an anchored element still when a mutation moves it, and reports it as a scroll", function() {
    withLayout({innerHeight: 900}, function(layout) {
        fill(60, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 0})
        var row = document.getElementById("cell-30")
        window.scrollTo(0, 2500)
        layout.anchorTo(row)
        var before = row.getBoundingClientRect().top
        var spacer = document.createElement("tr")
        spacer.style.height = "300px"
        document.getElementById("body").insertBefore(spacer, document.getElementById("cell-0"))
        assert.equal(row.getBoundingClientRect().top, before, "the page scrolled by the 300 px the row moved")
        assert.equal(window.scrollY, 2800)
        var fired = 0
        document.addEventListener("scroll", function() { fired++ })
        layout.flushFrames()
        assert.equal(fired, 1)
    })
})

test("a ResizeObserver reports once when it starts observing a sized element, and reports the content box, which padding makes narrower than the border box", function() {
    withLayout({}, function(layout) {
        fill(2, 100)
        var table = document.getElementById("t")
        layout.table(table, {top: 0, width: 800, padding: 20})
        var reports = []
        var observer = new ResizeObserver(function(entries) {
            for (var entry of entries) { reports.push([entry.contentBoxSize[0].inlineSize, entry.contentRect.width, entry.borderBoxSize[0].inlineSize]) }
        })
        observer.observe(table)
        assert.deepEqual(reports, [], "delivery waits for the frame")
        layout.flushFrames()
        assert.deepEqual(reports, [[780, 780, 800]])
        assert.equal(table.getBoundingClientRect().width, 800)
        var hidden = document.createElement("div")
        hidden.style.display = "none"
        document.body.appendChild(hidden)
        observer.observe(hidden)
        layout.flushFrames()
        assert.equal(reports.length, 1, "an element with no size has nothing to report")
    })
})

test("a cell written width 0 is laid out squeezed to nothing: its client width is its padding, and its scroll width runs from its padding edge to the end of what it holds", function() {
    withLayout({}, function(layout) {
        var style = document.createElement("style")
        style.textContent = "td { padding: 0 6px }"
        document.head.appendChild(style)
        try {
            fill(1, 40)
            var cell = document.querySelector("#cell-0 td")
            assert.equal(cell.scrollWidth, 0, "a cell that is not measured reads what the document says")
            cell.style.setProperty("display", "inline-block", "important")
            cell.style.setProperty("width", "0", "important")
            cell.setAttribute("data-min", "50")
            assert.equal(cell.clientWidth, 12)
            assert.equal(cell.scrollWidth, 56, "the padding edge to the end of the 50 px it asks")
            cell.setAttribute("data-reach", "20")
            assert.equal(cell.scrollWidth, 26, "data-reach is what reaches, when it is given")
            cell.setAttribute("data-reach", "3")
            assert.equal(cell.scrollWidth, 12, "content inside the padding scrolls no further than the box")
        } finally {
            style.remove()
        }
    })
})
