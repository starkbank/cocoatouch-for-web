import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UISwitch, UIButton } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { isSimpleOutletSelector, outletIndexFor, outletElement } from "../src/utils/outletindex.js"


// A view declaring one UIView outlet per selector, bound the way a controller's
// outlets are, so each result can be compared with what jQuery's find returns.
function hostClass(selectors, cls = UIView) {
    class Host extends UIView {}
    selectors.forEach((selector, i) => IBOutlet(selector, cls)(Host.prototype, "outlet" + i, {}))
    return Host
}

// The page is already in place: a test that needs the expected elements reads them first.
function bindHost(selectors, cls) {
    var host = new (hostClass(selectors, cls))("#host")
    Bind.ibOutlet(host)
    return host
}

function elementsOf($set) {
    return Array.from($set)
}

// What every outlet must equal: the elements jQuery's find gives from the host.
function expectedFor(selectors) {
    return selectors.map((selector) => elementsOf($("#host").find(selector)))
}

function assertEquivalent(selectors, html) {
    page(html)
    var expected = expectedFor(selectors)
    var host = bindHost(selectors)
    selectors.forEach(function(selector, i) {
        var actual = elementsOf(host["outlet" + i].$el)
        assert.equal(actual.length, expected[i].length, selector)
        actual.forEach((element, at) => assert.equal(element, expected[i][at], selector))
    })
}

// An index needs two simple outlets, so each case carries these two beside it.
var fillers = ["#filler", ".filler"]
var fillerHtml = "<i id=\"filler\"></i><i class=\"filler\"></i>"

test("an outlet binds the elements jQuery's find gives, for every kind of selector", function() {
    var cases = {
        "a unique id": ["#solo", "<div id=\"host\"><b id=\"solo\"></b>" + fillerHtml + "</div>"],
        "a duplicate id whose document-first element is inside the host": ["#dup", "<div id=\"host\"><b id=\"dup\"></b><b id=\"dup\"></b>" + fillerHtml + "</div><b id=\"dup\"></b>"],
        "a duplicate id whose document-first element is outside the host": ["#dup", "<b id=\"dup\"></b><div id=\"host\"><b id=\"dup\"></b>" + fillerHtml + "</div>"],
        "a class matching three elements": [".c", "<div id=\"host\"><b class=\"c\"></b><u><b class=\"c\"></b></u><b class=\"c\"></b>" + fillerHtml + "</div><b class=\"c\"></b>"],
        "a bare tag": ["p", "<div id=\"host\"><p></p><span></span><p></p>" + fillerHtml + "</div><p></p>"],
        "an id matching nothing": ["#nothing", "<div id=\"host\">" + fillerHtml + "</div>"],
        "a class matching nothing": [".nothing", "<div id=\"host\">" + fillerHtml + "</div>"],
        "an id that is not a valid css identifier": ["#1x", "<div id=\"host\"><b id=\"1x\"></b>" + fillerHtml + "</div>"],
        "a compound selector beside simple ones": ["#a > .b", "<div id=\"host\"><div id=\"a\"><b class=\"b\"></b></div><i class=\"b\"></i>" + fillerHtml + "</div>"],
    }
    for (var name of Object.keys(cases)) {
        var [selector, html] = cases[name]
        assertEquivalent([selector].concat(fillers), html)
    }
})

// jsdom's own prototypes, which are not Node's: the spy wraps what the framework calls.
function countQueries(work) {
    var count = 0
    var prototypes = [window.Element.prototype, window.Document.prototype]
    var originals = prototypes.map((prototype) => prototype.querySelectorAll)
    prototypes.forEach(function(prototype, i) {
        prototype.querySelectorAll = function(...args) {
            count += 1
            return originals[i].apply(this, args)
        }
    })
    try {
        work()
    } finally {
        prototypes.forEach((prototype, i) => { prototype.querySelectorAll = originals[i] })
    }
    return count
}

// Two cards sharing every id, as repeated components do: the document-first
// element of each id lies in card A, so card B is where a per-outlet query
// would be paid.
function twoCards(outlets) {
    var ids = Array.from({length: outlets}, (_, i) => "o" + i)
    var markup = (card) => "<div id=\"" + card + "\">" + ids.map((id) => "<input id=\"" + id + "\">").join("") + "</div>"
    page(markup("card-a") + markup("card-b"))
    var Card = hostClass(ids.map((id) => "#" + id), UISwitch)
    return [new Card("#card-a"), new Card("#card-b")]
}

test("binding the outlets of a class costs one query per class, however many outlets it has", function() {
    var queriesFor = function(outlets) {
        var cards = twoCards(outlets)
        return countQueries(() => cards.forEach((card) => Bind.ibOutlet(card)))
    }
    var few = queriesFor(10)
    var many = queriesFor(40)
    assert.equal(many, few)
    assert.equal(few, 2)
})

test("an outlet that matches nothing keeps an empty set, defined and without throwing", function() {
    page("<div id=\"host\">" + fillerHtml + "</div>")
    var host = bindHost(["#nothing", ".nothing", "#filler", ".filler"])
    assert.equal(host.outlet0.$el.length, 0)
    assert.equal(host.outlet1.$el.length, 0)
    assert.ok(Object.hasOwn(host, "outlet0"))
    assert.ok(host.outlet0 instanceof UIView)
})

// The first outlet's nib puts #late (and .late) in the page after the index
// was built; the second outlet, declared after it, selects them.
function nibbedClass() {
    class Filler extends UIView {}
    Filler.nib = "<span id=\"late\" class=\"late\"></span>"
    return Filler
}

test("an element created while an earlier outlet binds is found by a later outlet", function() {
    page("<div id=\"host\"><div id=\"first\"></div><i id=\"filler\"></i></div>")
    class Host extends UIView {}
    IBOutlet("#first", nibbedClass())(Host.prototype, "first", {})
    IBOutlet("#late", UIView)(Host.prototype, "lateById", {})
    IBOutlet(".late", UIView)(Host.prototype, "lateByClass", {})
    IBOutlet("#filler", UIView)(Host.prototype, "filler", {})
    var host = new Host("#host")
    Bind.ibOutlet(host)
    var late = document.getElementById("late")
    assert.ok(late)
    assert.deepEqual(elementsOf(host.lateById.$el), [late])
    assert.deepEqual(elementsOf(host.lateByClass.$el), [late])
})

test("an element replaced while an earlier outlet binds resolves to the live node, not the detached one", function() {
    page("<div id=\"host\"><div id=\"first\"></div><b id=\"swap\" class=\"swap\"></b><i id=\"filler\"></i></div>")
    var replacement = document.createElement("b")
    replacement.id = "swap"
    replacement.className = "swap"
    class Replacer extends UIView {
        init() { document.getElementById("swap").replaceWith(replacement) }
    }
    class Host extends UIView {}
    IBOutlet("#first", Replacer)(Host.prototype, "first", {})
    IBOutlet("#swap", UIView)(Host.prototype, "swapById", {})
    IBOutlet(".swap", UIView)(Host.prototype, "swapByClass", {})
    IBOutlet("#filler", UIView)(Host.prototype, "filler", {})
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(elementsOf(host.swapById.$el), [replacement])
    assert.deepEqual(elementsOf(host.swapByClass.$el), [replacement])
})

function pointerdown(element) {
    element.dispatchEvent(new window.Event("pointerdown", {bubbles: true}))
}

test("a control outlet highlights its own element when another card carries the same id", function() {
    page("<div id=\"card-a\"><input id=\"sw\"><i class=\"x\"></i></div><div id=\"card-b\"><input id=\"sw\"><i class=\"x\"></i></div>")
    var Card = hostClass(["#sw", ".x"], UISwitch)
    var cardA = new Card("#card-a")
    var cardB = new Card("#card-b")
    Bind.ibOutlet(cardA)
    Bind.ibOutlet(cardB)
    var inputs = document.querySelectorAll("input")
    pointerdown(inputs[1])
    assert.equal(cardB.outlet0.isHighlighted, true)
    assert.equal(cardA.outlet0.isHighlighted, false)
    assert.deepEqual(elementsOf(cardB.outlet0.$el), [inputs[1]])
})

test("a control written by app code with a bare id still highlights", function() {
    page("<button id=\"solo\"></button>")
    var button = new UIButton("#solo")
    pointerdown(document.getElementById("solo"))
    assert.equal(button.isHighlighted, true)
})

test("a nib fills only the element of its own outlet when an earlier element shares the id", function() {
    page("<div id=\"x\"></div><div id=\"host\"><div id=\"x\"></div><i id=\"filler\"></i></div>")
    class Nibbed extends UIView {}
    Nibbed.nib = "<span class=\"inside\"></span>"
    class Host extends UIView {}
    IBOutlet("#x", Nibbed)(Host.prototype, "nibbed", {})
    IBOutlet("#filler", UIView)(Host.prototype, "filler", {})
    var host = new Host("#host")
    Bind.ibOutlet(host)
    var [outside, inside] = document.querySelectorAll("#x")
    assert.equal(outside.children.length, 0)
    assert.equal(inside.children.length, 1)
    assert.deepEqual(elementsOf(host.nibbed.$el), [inside])
})

test("only a bare id, class or tag is a simple outlet selector", function() {
    for (var selector of ["#a", "#a-b_1", "#1x", ".c", ".c-d", "p", "h1"]) { assert.equal(isSimpleOutletSelector(selector), true, selector) }
    for (var selector of ["#a > .b", "#a .b", "a.b", "[href]", "a:first", "P", "#", "", "*"]) { assert.equal(isSimpleOutletSelector(selector), false, selector) }
})

test("no index is built for fewer than two simple outlets, several or detached roots, or a non-element root", function() {
    page("<div id=\"host\"><b class=\"c\"></b></div><div id=\"other\"></div>")
    var simple = [{selector: "#a"}, {selector: ".c"}]
    assert.ok(outletIndexFor($("#host"), simple))
    assert.equal(outletIndexFor($("#host"), [{selector: "#a"}, {selector: "#a > .b"}]), null)
    assert.equal(outletIndexFor($("#host, #other"), simple), null)
    assert.equal(outletIndexFor($(), simple), null)
    assert.equal(outletIndexFor($(document.createElement("div")), simple), null)
    assert.equal(outletIndexFor($(document), simple), null)
})

test("a type selector matches an svg element by its exact name and an html element in any case", function() {
    page("<div id=\"host\"><svg><linearGradient></linearGradient><g></g></svg><P></P></div>")
    var index = outletIndexFor($("#host"), [{selector: "g"}, {selector: "p"}])
    assert.deepEqual(Array.from(outletElement({selector: "g", $parent: $("#host"), index})), Array.from($("#host").find("g")))
    assert.deepEqual(Array.from(outletElement({selector: "p", $parent: $("#host"), index})), Array.from($("#host").find("p")))
    assert.equal(outletElement({selector: "p", $parent: $("#host"), index}).length, 1)
})
