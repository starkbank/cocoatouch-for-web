import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIScrollView, UITableView, UITableViewCell, UITableViewScrollPosition, UILabel, UITextView, UIProgressView, UISearchTextField, CGAffineTransform, CGPoint } from "../src/index.js"


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
            assert.equal(view.isHidden, false, id)
            assert.equal(getComputedStyle(document.getElementById(id)).display, expected[id], id)
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


// Every getComputedStyle a test provokes, through jQuery's window path and the
// dom.js wrapper alike. `onCall` sees the element each time, before the read.
function spyComputedStyle(onCall) {
    var calls = []
    var windowOriginal = window.getComputedStyle
    var globalOriginal = globalThis.getComputedStyle
    window.getComputedStyle = function(element, pseudoElement) {
        calls.push(element)
        if (onCall) { onCall(element) }
        return windowOriginal.call(window, element, pseudoElement)
    }
    globalThis.getComputedStyle = function(element, pseudoElement) {
        calls.push(element)
        if (onCall) { onCall(element) }
        return globalOriginal(element, pseudoElement)
    }
    calls.restore = function() {
        window.getComputedStyle = windowOriginal
        globalThis.getComputedStyle = globalOriginal
    }
    return calls
}

function withStyle(css) {
    var style = document.createElement("style")
    style.textContent = css
    document.head.appendChild(style)
    return style
}

function nextTurn() {
    return new Promise((resolve) => setTimeout(resolve, 0))
}

// jsdom lets its own rule for a table row beat an author's display: none, so the
// hidden table elements here are cells, which it hides as a browser does.
var goneAndShown = "<table><tbody>" +
    "<tr id=\"goneRow\"><th id=\"goneTh\" class=\"gone\"></th><td id=\"goneTd\" class=\"gone\"></td></tr>" +
    "<tr id=\"shownTr\"><td id=\"shownTd\"></td></tr></tbody></table>" +
    "<ul><li id=\"goneLi\" class=\"gone\"></li><li id=\"shownLi\"></li></ul>" +
    "<section><span id=\"goneSpan\" class=\"gone\"></span><span id=\"shownSpan\"></span>" +
    "<div id=\"goneDiv\" class=\"gone\"></div><div id=\"flex\"></div>" +
    "<custom-view id=\"goneCustom\" class=\"gone\"></custom-view><custom-view id=\"shownCustom\"></custom-view></section>"

var goneIds = ["goneTh", "goneTd", "goneLi", "goneSpan", "goneDiv", "goneCustom"]
var shownIds = ["shownTr", "shownTd", "shownLi", "shownSpan", "flex", "shownCustom"]
var naturalOf = {goneTh: "table-cell", goneTd: "table-cell", goneLi: "list-item", goneSpan: "inline", goneDiv: "block", goneCustom: "block"}

function viewsOver(ids) {
    return ids.map((id) => new UIView("#" + id))
}

function inlineDisplays(ids) {
    return ids.map((id) => document.getElementById(id).style.display)
}

test("isHidden = false reads no computed style and leaves every inline display empty until the turn ends", function() {
    page(goneAndShown)
    var style = withStyle(".gone { display: none; } #flex { display: flex; }")
    var views = viewsOver(goneIds.concat(shownIds))
    var calls = spyComputedStyle()
    try {
        views.forEach((view) => { view.isHidden = false })
    } finally {
        calls.restore()
        style.remove()
    }
    assert.equal(calls.length, 0)
    assert.deepEqual(inlineDisplays(goneIds.concat(shownIds)), new Array(12).fill(""))
})

test("a turn's unhides are resolved in one pass that reads every element before writing any", async function() {
    page(goneAndShown)
    var style = withStyle(".gone { display: none; } #flex { display: flex; }")
    var ids = goneIds.concat(shownIds)
    var views = viewsOver(ids)
    var writtenBeforeARead = false
    var calls = spyComputedStyle(function() {
        if (inlineDisplays(ids).some((display) => display !== "")) { writtenBeforeARead = true }
    })
    try {
        views.forEach((view) => { view.isHidden = false })
        await Promise.resolve()
    } finally {
        calls.restore()
        style.remove()
    }
    assert.equal(calls.length, 12)
    assert.equal(writtenBeforeARead, false)
    for (var id of goneIds) { assert.equal(document.getElementById(id).style.display, naturalOf[id], id) }
    assert.deepEqual(inlineDisplays(shownIds), new Array(6).fill(""))
})

test("hiding a view after unhiding it in the same turn leaves it hidden and reads no computed style", async function() {
    page("<div id=\"v\" class=\"gone\"></div>")
    var style = withStyle(".gone { display: none; }")
    var view = new UIView("#v")
    var calls = spyComputedStyle()
    try {
        view.isHidden = false
        view.isHidden = true
        await Promise.resolve()
    } finally {
        calls.restore()
    }
    try {
        assert.equal(calls.length, 0)
        assert.equal(document.getElementById("v").style.display, "none")
        assert.equal(getComputedStyle(document.getElementById("v")).display, "none")
    } finally {
        style.remove()
    }
})

test("a view removed in the turn it was unhidden is neither read nor written", async function() {
    page("<div id=\"host\"><span id=\"sub\" class=\"gone\"></span></div><div id=\"plain\" class=\"gone\"></div>")
    var style = withStyle(".gone { display: none; }")
    var plain = document.getElementById("plain")
    var sub = document.getElementById("sub")
    var plainView = new UIView("#plain")
    var subView = new UIView("#sub")
    var calls = spyComputedStyle()
    try {
        plainView.isHidden = false
        plainView.$el.remove()
        subView.isHidden = false
        subView.removeFromSuperview()
        await Promise.resolve()
    } finally {
        calls.restore()
        style.remove()
    }
    assert.equal(calls.length, 0)
    assert.equal(plain.style.display, "")
    assert.equal(sub.style.display, "")
})

// jQuery reads a detached node through window.getComputedStyle, which jsdom
// answers as if the node were attached; every browser answers it empty.
function detachedReadsEmpty() {
    var original = window.getComputedStyle
    var empty = new Proxy({}, {get: function(target, property) {
        return property === "getPropertyValue" ? function() { return "" } : ""
    }})
    window.getComputedStyle = function(element, pseudoElement) {
        if (element && element.isConnected === false) { return empty }
        return original.call(window, element, pseudoElement)
    }
    return function() { window.getComputedStyle = original }
}

test("a view unhidden while detached and attached in the same turn shows with its natural display", async function() {
    var style = withStyle(".gone { display: none; }")
    var restore = detachedReadsEmpty()
    try {
        var element = document.createElement("div")
        element.className = "gone"
        var view = new UIView("#detached")
        view._$el = $(element)
        view.isHidden = false
        document.body.appendChild(element)
        await Promise.resolve()
        assert.equal(element.style.display, "block")
        assert.notEqual(getComputedStyle(element).display, "none")
    } finally {
        restore()
        style.remove()
    }
})

test("reading isHidden resolves the whole batch, so a second view already has its natural display", function() {
    page("<div id=\"a\" class=\"gone\"></div><span id=\"b\" class=\"gone\"></span>")
    var style = withStyle(".gone { display: none; }")
    try {
        var a = new UIView("#a")
        var b = new UIView("#b")
        a.isHidden = false
        b.isHidden = false
        assert.equal(a.isHidden, false)
        assert.equal(document.getElementById("b").style.display, "inline")
    } finally {
        style.remove()
    }
})

// A container the stylesheet hides, unhidden, then the API under test reads or
// writes the DOM. `record` is what the container's inline display was at that
// moment: the read is only right once the fallback has been written.
function hiddenBox(inner) {
    page("<div id=\"box\" class=\"gone\">" + inner + "</div>")
    var box = document.getElementById("box")
    var records = []
    return {
        box: box,
        records: records,
        record: function() { records.push(box.style.display) },
        unhide: function() { new UIView("#box").isHidden = false },
    }
}

function assertSettled(scene, label) {
    assert.ok(scene.records.length > 0, label + ": the DOM was read")
    assert.deepEqual(scene.records, new Array(scene.records.length).fill("block"), label)
}

function spyOn(element, name, scene) {
    var original = element[name]
    element[name] = function() {
        scene.record()
        return original.apply(element, arguments)
    }
}

function readingProperty(element, name, value, scene) {
    Object.defineProperty(element, name, {configurable: true, get: function() { scene.record(); return value }})
}

test("frame and bounds resolve a hidden ancestor before measuring", function() {
    var scene = hiddenBox("<div id=\"target\"></div>")
    var style = withStyle(".gone { display: none; }")
    try {
        var target = document.getElementById("target")
        var real = target.getBoundingClientRect.bind(target)
        target.getBoundingClientRect = function() { scene.record(); return real() }
        scene.unhide()
        new UIView("#target").frame
        assertSettled(scene, "frame")
        scene.records.length = 0
        scene.unhide()
        new UIView("#target").bounds
        assertSettled(scene, "bounds")
    } finally {
        style.remove()
    }
})

test("transform resolves a hidden ancestor before reading the computed transform", function() {
    var scene = hiddenBox("<div id=\"target\"></div>")
    var style = withStyle(".gone { display: none; }")
    var target = document.getElementById("target")
    var calls = spyComputedStyle(function(element) { if (element === target) { scene.record() } })
    try {
        scene.unhide()
        new UIView("#target").transform
    } finally {
        calls.restore()
        style.remove()
    }
    assertSettled(scene, "transform")
})

test("becomeFirstResponder resolves a hidden ancestor before focusing", function() {
    var scene = hiddenBox("<input id=\"field\">")
    var style = withStyle(".gone { display: none; }")
    try {
        document.getElementById("field").addEventListener("focus", scene.record)
        scene.unhide()
        new UIView("#field").becomeFirstResponder()
        assertSettled(scene, "UIView")
    } finally {
        style.remove()
    }
})

test("UISearchTextField.becomeFirstResponder resolves a hidden ancestor before focusing its input", function() {
    var scene = hiddenBox("<div id=\"search\"></div>")
    var style = withStyle(".gone { display: none; }")
    try {
        var field = new UISearchTextField("#search")
        field.textField[0].addEventListener("focus", scene.record)
        scene.unhide()
        field.becomeFirstResponder()
        assertSettled(scene, "UISearchTextField")
    } finally {
        style.remove()
    }
})

test("UIScrollView contentOffset, contentSize and setContentOffset resolve a hidden ancestor before touching the scroller", function() {
    var scene = hiddenBox("<div id=\"list\"></div>")
    var style = withStyle(".gone { display: none; }")
    try {
        var list = document.getElementById("list")
        readingProperty(list, "scrollLeft", 0, scene)
        readingProperty(list, "scrollTop", 0, scene)
        readingProperty(list, "scrollWidth", 0, scene)
        readingProperty(list, "scrollHeight", 0, scene)
        list.scrollTo = scene.record
        var scroller = new UIScrollView("#list")
        scene.unhide()
        scroller.contentOffset
        assertSettled(scene, "contentOffset")
        scene.records.length = 0
        scene.unhide()
        scroller.contentSize
        assertSettled(scene, "contentSize")
        scene.records.length = 0
        scene.unhide()
        scroller.setContentOffset(new CGPoint({x: 0, y: 0}), {animated: false})
        assertSettled(scene, "setContentOffset")
    } finally {
        style.remove()
    }
})

class RowCell extends UITableViewCell {}
RowCell.nib = "<tr><td></td></tr>"

test("UITableView.selectRow with a scroll position resolves a hidden ancestor before reading where the row is", function() {
    var scene = hiddenBox("<table id=\"table\"><tbody></tbody></table>")
    var style = withStyle(".gone { display: none; }")
    try {
        var table = new UITableView("#table")
        table.register(RowCell, {forCellReuseIdentifier: "row"})
        table.dataSource = {
            tableViewNumberOfRowsInSection: function() { return 1 },
            tableViewCellForRowAtIndexPath: function(tableView, indexPath) {
                return tableView.dequeueReusableCell({withIdentifier: "row", for: indexPath})
            },
        }
        spyOn(document.querySelector("#table tr"), "getBoundingClientRect", scene)
        scene.unhide()
        table.selectRow({at: 0, animated: false, scrollPosition: UITableViewScrollPosition.top})
        assertSettled(scene, "selectRow")
    } finally {
        style.remove()
    }
})

test("UILabel fits its text only after a hidden ancestor is resolved, since offsetParent is null under display none", function() {
    var scene = hiddenBox("<span id=\"label\"></span>")
    var style = withStyle(".gone { display: none; }")
    try {
        var element = document.getElementById("label")
        var label = new UILabel("#label")
        label.adjustsFontSizeToFitWidth = true
        readingProperty(element, "offsetParent", null, scene)
        scene.unhide()
        label.text = "x"
        assertSettled(scene, "UILabel")
    } finally {
        style.remove()
    }
})

test("UITextView measures its content only after a hidden ancestor is resolved", function() {
    var scene = hiddenBox("<textarea id=\"note\"></textarea>")
    var style = withStyle(".gone { display: none; }")
    try {
        var element = document.getElementById("note")
        var view = new UITextView("#note")
        view.awakeFromNib()
        view.isScrollEnabled = false
        readingProperty(element, "scrollHeight", 10, scene)
        scene.unhide()
        view.text = "changed"
        assertSettled(scene, "UITextView")
    } finally {
        style.remove()
    }
})

test("UIProgressView.setProgress resolves a hidden ancestor before measuring the track", function() {
    var scene = hiddenBox("<div id=\"track\"><div></div></div>")
    var style = withStyle(".gone { display: none; }")
    var track = document.getElementById("track")
    var calls = spyComputedStyle(function(element) { if (element === track) { scene.record() } })
    try {
        var progress = new UIProgressView("#track")
        scene.unhide()
        progress.setProgress(0.5, {animated: false})
    } finally {
        calls.restore()
        style.remove()
    }
    assertSettled(scene, "UIProgressView")
})

async function withEffectsOff(body) {
    var original = $.fx.off
    $.fx.off = true
    var style = withStyle(".gone { display: none; }")
    try {
        await body()
    } finally {
        style.remove()
        $.fx.off = original
    }
}

test("animate hiding a view that was just unhidden leaves it hidden", async function() {
    page("<div id=\"v\" class=\"gone\"></div>")
    await withEffectsOff(async function() {
        var view = new UIView("#v")
        view.isHidden = false
        UIView.animate({withDuration: 0.2, animations: () => { view.isHidden = true }})
        await nextTurn()
        var element = document.getElementById("v")
        assert.equal(element.style.display, "none")
        assert.equal(getComputedStyle(element).display, "none")
    })
})

test("animate fading in a view that was just unhidden ends visible with its natural display", async function() {
    page("<div id=\"v\" class=\"gone\"></div>")
    await withEffectsOff(async function() {
        var view = new UIView("#v")
        view.isHidden = false
        UIView.animate({withDuration: 0.2, animations: () => { view.alpha = 1 }})
        await nextTurn()
        var computed = getComputedStyle(document.getElementById("v"))
        assert.equal(computed.display, "block")
        assert.equal(computed.opacity, "1")
    })
})

test("animate starts a transform transition from a view that already has its natural display", async function() {
    page("<div id=\"v\" class=\"gone\"></div>")
    await withEffectsOff(async function() {
        var view = new UIView("#v")
        var element = document.getElementById("v")
        var displayAtTransition = []
        var stored = ""
        Object.defineProperty(element.style, "transition", {configurable: true, get: function() { return stored }, set: function(value) {
            displayAtTransition.push(element.style.display)
            stored = value
        }})
        view.isHidden = false
        UIView.animate({withDuration: 0.2, animations: () => { view.transform = new CGAffineTransform({rotationAngle: Math.PI}) }})
        await nextTurn()
        assert.equal(displayAtTransition[0], "block")
    })
})
