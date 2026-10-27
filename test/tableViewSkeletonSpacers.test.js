import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UILabel, UITableViewCell } from "../src/index.js"
import { Row, Other, setup, rowsBody, spacers, scrollTo, click } from "./tableReuseHelpers.js"


function withTable(options, body) {
    var context = setup(options)
    try { body(context) } finally { context.layout.restore() }
}

// A row of four cells whose structure the skeleton must copy: tags, classes and a colSpan, and nothing else the app put on them.
class Wide extends UITableViewCell {}
Wide.nib = "<tr data-height=\"95\" id=\"x\" onclick=\"alert(1)\" data-x=\"1\"><td class=\"a first\" id=\"title\" style=\"width: 7px\" onclick=\"alert(2)\" data-secret=\"s\">text</td><th class=\"b\">th text</th><td class=\"c\" colspan=\"2\" href=\"/leak\" aria-label=\"l\"><button>go</button></td></tr>"
IBOutlet("#title", UILabel)(Wide.prototype, "titleLabel", {})

// The same structure with nothing inline, so the columns come from the page's rules alone.
class Plain extends UITableViewCell {}
Plain.nib = "<tr data-height=\"95\"><td class=\"a first\" id=\"title\">text</td><th class=\"b\">th text</th><td class=\"c\" colspan=\"2\"></td></tr>"
IBOutlet("#title", UILabel)(Plain.prototype, "titleLabel", {})

function scrolledWithSpacers(context) {
    scrollTo(context.layout, 40000)
    assert.equal(spacers().length, 2, "both spacers are present mid-list")
}

test("the spacer's cells are the majority signature's: tag, class and colSpan, in order", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            var cells = Array.from(spacer.children)
            assert.deepEqual(cells.map((cell) => cell.tagName), ["TD", "TH", "TD"])
            assert.deepEqual(cells.map((cell) => cell.className), ["a first", "b", "c"])
            assert.deepEqual(cells.map((cell) => cell.colSpan), [1, 1, 2])
        }
    })
})

test("a spacer copies no id, attribute, content or handler of the app's cells", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            assert.equal(spacer.id, "")
            assert.deepEqual(Array.from(spacer.attributes).map((attribute) => attribute.name).sort(), ["aria-hidden", "style"])
            assert.equal(spacer.textContent, "")
            for (var cell of Array.from(spacer.children)) {
                assert.ok(Array.from(cell.attributes).every((attribute) => ["class", "colspan", "style"].includes(attribute.name)), Array.from(cell.attributes).map((attribute) => attribute.name).join())
                assert.equal(cell.childNodes.length, 0)
                assert.equal(cell.getAttribute("style").includes("7px"), false)
            }
        }
    })
})

test("the vertical box is zeroed by important CSSOM on the spacer row and its cells, and the horizontal box is left to the page", function() {
    withTable({}, function(context) {
        context.table.register(Wide, {forCellReuseIdentifier: "row"})
        context.table.reloadData()
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            for (var element of [spacer, ...Array.from(spacer.children)]) {
                for (var property of ["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]) {
                    assert.equal(element.style.getPropertyValue(property), "0px", property)
                    assert.equal(element.style.getPropertyPriority(property), "important", property)
                }
                assert.equal(element.style.getPropertyPriority("box-shadow"), "important")
                assert.equal(element.style.getPropertyPriority("outline"), "important")
                assert.equal(element.style.getPropertyPriority("background-color"), "important")
                assert.equal(element.style.getPropertyValue("padding-left"), "")
                assert.equal(element.style.getPropertyValue("padding-right"), "")
                assert.equal(element.style.getPropertyValue("border-left-width"), "")
                assert.equal(element.style.getPropertyValue("width"), "")
            }
            assert.equal(spacer.style.getPropertyPriority("height"), "important")
            assert.ok(parseFloat(spacer.style.height) > 0)
            for (var cell of Array.from(spacer.children)) { assert.equal(cell.style.getPropertyValue("height"), "0px") }
        }
    })
})

test("a list whose row 0 has another structure gets the majority skeleton, and the hook counts the other row", function() {
    withTable({identifier: (row) => row === 0 ? "other" : "row"}, function(context) {
        scrolledWithSpacers(context)
        assert.equal(spacers()[0].children.length, 3, "the three-cell structure most rows have, not row 0's single cell")
        assert.equal(context.table._otherSignatureCount(), 1)
    })
})

test("the skeleton follows a reload that changes the majority signature", function() {
    withTable({}, function(context) {
        scrolledWithSpacers(context)
        assert.equal(spacers()[0].children.length, 3)
        var before = spacers()[0]
        context.model.identifier = () => "other"
        context.table.reloadData()
        assert.equal(spacers().length > 0, true)
        for (var spacer of spacers()) { assert.equal(spacer.children.length, 1, "the single cell of the new majority") }
        assert.equal(before.isConnected, false, "the old spacer is gone, not left beside the new one")
        assert.equal(context.table._otherSignatureCount(), 0)
    })
})

test("a spacer built from the skeleton has no handlers, and a click on it selects nothing", function() {
    withTable({}, function(context) {
        scrolledWithSpacers(context)
        for (var spacer of spacers()) {
            for (var element of [spacer, ...Array.from(spacer.children)]) {
                assert.equal($._data(element, "events"), undefined)
            }
            click(spacer)
            click(spacer.children[0])
        }
        assert.equal(context.table.indexPathsForSelectedRows.length, 0)
    })
})

test("under table-layout fixed the first row, which is the top spacer mid-list, gives the columns row 0 would give", function() {
    var style = document.createElement("style")
    style.textContent = "td.a{width:40px} th.b{width:70px} td.c{width:90px} tbody > tr > :nth-child(1){min-width:5px}"
    document.head.appendChild(style)
    try {
        withTable({}, function(context) {
            context.table.register(Plain, {forCellReuseIdentifier: "row"})
            context.table.reloadData()
            var widths = (row) => Array.from(row.children).map((cell) => [getComputedStyle(cell).width, getComputedStyle(cell).minWidth])
            var withoutSpacer = widths(rowsBody().firstElementChild)
            scrolledWithSpacers(context)
            var withSpacer = widths(rowsBody().firstElementChild)
            assert.deepEqual(withSpacer, withoutSpacer)
            assert.deepEqual(withSpacer.map((entry) => entry[0]), ["40px", "70px", "90px"])
        })
    } finally {
        style.remove()
    }
})

test("a table whose rows share one structure has a spacer of that structure, and Other's single cell stays a single cell", function() {
    withTable({identifier: () => "other"}, function(context) {
        scrollTo(context.layout, 20000)
        for (var spacer of spacers()) {
            assert.equal(spacer.children.length, Array.from(rowsBody().querySelector("tr[id]").children).length)
        }
        assert.ok(Other.nib.includes("<td"))
    })
})
