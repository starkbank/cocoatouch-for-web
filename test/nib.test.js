import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UILabel, UIViewController } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

// A nibbed view declaring an outlet of its own, so binding it is observable.
function innerClass(log) {
    class Inner extends UIView {
        taps = 0
        awakeFromNib() { log.push("inner:" + this.taps) }
    }
    Inner.nib = "<span id=\"inner-text\"></span>"
    IBOutlet("#inner-text", UILabel)(Inner.prototype, "textLabel", {})
    return Inner
}

function controllerClass(Outer) {
    class Controller extends UIViewController {}
    Controller.nib = "<div id=\"outer\"></div><div id=\"host\"></div>"
    IBOutlet("#outer", Outer)(Controller.prototype, "outer", {})
    return Controller
}

// A controller whose outlet is a nibbed view, whose nib in turn declares a
// nested nibbed outlet. Build.html fills only the controller's first-level
// outlets, so the nested element is in the page but empty.
function nestedOutlets(log) {
    var Inner = innerClass(log)
    class Outer extends UIView {
        awakeFromNib() { log.push("outer") }
    }
    Outer.nib = "<div id=\"inner\"></div>"
    IBOutlet("#inner", Inner)(Outer.prototype, "inner", {})
    return {Inner, Outer, Controller: controllerClass(Outer)}
}

test("awakeFromNib is sent exactly once to each view of a nested nibbed outlet", async function() {
    var log = []
    var {Controller} = nestedOutlets(log)
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    assert.deepEqual(log.filter((entry) => entry === "outer"), ["outer"])
    assert.deepEqual(log.filter((entry) => entry.startsWith("inner")).length, 1)
    assert.equal(controller.outer.inner.$el.find("#inner-text").length, 1)
})

test("awakeFromNib runs after the subclass's field initialisers", async function() {
    var log = []
    var {Controller} = nestedOutlets(log)
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    assert.deepEqual(log.filter((entry) => entry.startsWith("inner")), ["inner:0"])
    assert.ok(controller.outer.inner.textLabel instanceof UILabel)
})

test("an outlet owner holds exactly one responder per declared outlet", async function() {
    var {Controller, Inner} = nestedOutlets([])
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    assert.equal(controller.outer.subviews.length, 1)
    assert.ok(controller.outer.subviews[0] instanceof Inner)
    assert.equal(controller.outer.inner.subviews.length, 1)
})

test("a view the app constructs on an existing empty element gets its nib and one awakeFromNib", function() {
    var log = []
    var {Inner} = nestedOutlets(log)
    page("<div id=\"host\"></div>")
    var view = new Inner("#host")
    assert.equal($("#host #inner-text").length, 1)
    assert.deepEqual(log, ["inner:undefined"])
    assert.ok(view.textLabel instanceof UILabel)
    assert.equal(view.textLabel.$el.length, 1)
})

// A nested outlet Outer, whose element Build.html leaves empty, constructs
// another nibbed, outlet-declaring class on an element the controller's nib
// provides: the inner view must bind itself, and the marker must come back so
// Outer does not bind itself inside its own constructor as well.
function outerConstructingInner(log, where) {
    var Inner = innerClass(log)
    class Outer extends UIView {
        awakeFromNib() { log.push("outer") }
    }
    if (where === "init") {
        Outer.prototype.init = function() { this.made = new Inner("#host") }
    }
    if (where === "field") {
        Outer = class extends Outer { made = new Inner("#host") }
    }
    Outer.nib = "<div id=\"inner\"></div>"
    IBOutlet("#inner", Inner)(Outer.prototype, "inner", {})
    class Wrapper extends UIView {}
    Wrapper.nib = "<div id=\"outer\"></div>"
    IBOutlet("#outer", Outer)(Wrapper.prototype, "outer", {})
    class Controller extends UIViewController {}
    Controller.nib = "<div id=\"wrapper\"></div><div id=\"host\"></div>"
    IBOutlet("#wrapper", Wrapper)(Controller.prototype, "wrapper", {})
    return Controller
}

async function assertBothSidesAwakeOnce(log, Controller) {
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    var outer = controller.wrapper.outer
    assert.ok(outer.made.textLabel instanceof UILabel)
    assert.equal(outer.made.textLabel.$el.length, 1)
    assert.equal($("#host #inner-text").length, 1)
    assert.deepEqual(log.filter((entry) => entry === "outer"), ["outer"])
    assert.equal(log.filter((entry) => entry.startsWith("inner")).length, 2, "one for #host, one for the declared outlet")
    assert.equal(outer.subviews.length, 1)
}

test("a nibbed view constructed inside an outlet's init() binds itself, and the outlet still binds once", async function() {
    var log = []
    await assertBothSidesAwakeOnce(log, outerConstructingInner(log, "init"))
})

test("a nibbed view constructed in an outlet's field initialiser binds itself, and the outlet still binds once", async function() {
    var log = []
    await assertBothSidesAwakeOnce(log, outerConstructingInner(log, "field"))
})

// Item 2.3: a view created in code takes its class nib's single root as its element.
function nibbed(html) {
    class Rooted extends UIView {}
    Rooted.nib = html
    return Rooted
}

test("a single-root class nib becomes the view's element and keeps its id", function() {
    page("<div id=\"grid\"></div>")
    var grid = new UIView("#grid")
    var Card = nibbed("<section id=\"card-1\" class=\"card\"><h3>Hi</h3></section>")
    var card = new Card()
    grid.addSubview(card)
    assert.equal(card.selector, "#card-1")
    assert.equal(card.$el[0].tagName, "SECTION")
    assert.ok(card.$el.hasClass("card"))
    assert.equal($("#grid > section.card").length, 1)
})

test("a two-root class nib throws, naming the root count and an excerpt of the nib", function() {
    page("<div id=\"grid\"></div>")
    var grid = new UIView("#grid")
    var Split = nibbed("<div class=\"sidebar-header\"></div><div class=\"sidebar-body\"></div>")
    assert.throws(() => grid.addSubview(new Split()), (error) => {
        assert.match(error.message, /2 top-level nodes/)
        assert.match(error.message, /<div class="sidebar-header">/)
        assert.match(error.message, /addSubview/)
        return true
    })
})

test("whitespace around a single root is not a second node, but stray text is", function() {
    page("<div id=\"grid\"></div>")
    var grid = new UIView("#grid")
    var Padded = nibbed("\n    <div class=\"card\"></div>\n")
    var padded = new Padded()
    grid.addSubview(padded)
    assert.ok(padded.$el.hasClass("card"))
    var Texty = nibbed("<div class=\"card\"></div>hello")
    assert.throws(() => grid.addSubview(new Texty()), /2 top-level nodes/)
})

test("an empty class nib and UIView.loadFromNib with several roots both still wrap", function() {
    page("<div id=\"grid\"></div>")
    var grid = new UIView("#grid")
    var Empty = nibbed("")
    var empty = new Empty()
    grid.addSubview(empty)
    assert.equal(empty.$el[0].tagName, "DIV")
    assert.equal(empty.identifier, "grid-1")
    var loaded = UIView.loadFromNib("<p>a</p><p>b</p>")
    grid.addSubview(loaded)
    assert.equal(loaded.identifier, "grid-2")
    assert.equal(loaded.$el.children("p").length, 2)
})
