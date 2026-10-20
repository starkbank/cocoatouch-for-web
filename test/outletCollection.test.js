import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UILabel, UIButton, UIViewController } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { Build } from "../src/utils/build.js"


function hostWith(declare, Base = UIView) {
    class Host extends Base {}
    declare(Host.prototype)
    return Host
}

var chipsHtml = "<div id=\"host\"><span class=\"chip\" id=\"first\">a</span><div><span class=\"chip\">b</span></div><span class=\"chip\">c</span><span class=\"other\"></span></div>"

test("@IBOutlet(selector, [Class]) binds one view per matched element, in document order", function() {
    page(chipsHtml)
    var Host = hostWith((proto) => IBOutlet(".chip", [UILabel])(proto, "chips", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.equal(host.chips.length, 3)
    assert.ok(host.chips.every((chip) => chip instanceof UILabel))
    var elements = Array.from(document.querySelectorAll(".chip"))
    assert.deepEqual(host.chips.map((chip) => chip.$el[0]), elements)
    host.chips[1].text = "changed"
    assert.equal(elements[1].textContent, "changed")
    assert.equal(elements[0].textContent, "a")
})

test("each view of the collection is an ordinary subview of its owner, linked in the responder chain", function() {
    page(chipsHtml)
    var Host = hostWith((proto) => IBOutlet(".chip", [UIView])(proto, "chips", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    for (var chip of host.chips) {
        assert.equal(chip.next, host)
        assert.equal(chip.superview, host)
        assert.ok(host.subviews.includes(chip))
    }
})

test("an element without an id is given <owner id>-<property>-<n>, one with an id keeps it", function() {
    page(chipsHtml)
    var Host = hostWith((proto) => IBOutlet(".chip", [UIView])(proto, "weekdayChips", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(host.weekdayChips.map((chip) => chip.$el.attr("id")), ["first", "host-weekday-chips-2", "host-weekday-chips-3"])
    assert.deepEqual(host.weekdayChips.map((chip) => chip.accessibilityIdentifier), ["first", "host-weekday-chips-2", "host-weekday-chips-3"])
})

test("a selector that matches nothing binds an empty array, defined", function() {
    page(chipsHtml)
    var Host = hostWith((proto) => IBOutlet(".missing", [UILabel])(proto, "labels", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(host.labels, [])
})

test("the collection is whole when each element's awakeFromNib runs, and every element is awakened once", function() {
    page(chipsHtml)
    var seen = []
    class Chip extends UIView {
        awakeFromNib() { seen.push(this.next.chips.length) }
    }
    var Host = hostWith((proto) => IBOutlet(".chip", [Chip])(proto, "chips", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(seen, [3, 3, 3])
})

test("an element of the collection can declare outlets of its own", function() {
    page("<div id=\"host\"><div class=\"card\"><b class=\"title\">x</b></div><div class=\"card\"><b class=\"title\">y</b></div></div>")
    class Card extends UIView {}
    IBOutlet(".title", UILabel)(Card.prototype, "titleLabel", {})
    var Host = hostWith((proto) => IBOutlet(".card", [Card])(proto, "cards", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(host.cards.map((card) => card.titleLabel.$el.text()), ["x", "y"])
})

test("a collection over an element another outlet of the same owner holds is refused, naming both classes", function() {
    page("<div id=\"host\"><span class=\"chip\" id=\"special\"></span><span class=\"chip\"></span></div>")
    class Special extends UIView {}
    var Host = hostWith(function(proto) {
        IBOutlet("#special", Special)(proto, "special", {})
        IBOutlet(".chip", [UILabel])(proto, "chips", {})
    })
    var host = new Host("#host")
    assert.throws(() => Bind.ibOutlet(host), (error) => error instanceof TypeError && /chips/.test(error.message) && /Special/.test(error.message) && /one owner/.test(error.message))
})

test("two collections over the same elements are refused", function() {
    page(chipsHtml)
    var Host = hostWith(function(proto) {
        IBOutlet(".chip", [UILabel])(proto, "labels", {})
        IBOutlet(".chip", [UIButton])(proto, "buttons", {})
    })
    var host = new Host("#host")
    assert.throws(() => Bind.ibOutlet(host), (error) => error instanceof TypeError && /buttons/.test(error.message) && /UILabel/.test(error.message))
})

test("an element another owner's outlet holds is rebound by a new owner, as a reloaded cell does", function() {
    page(chipsHtml)
    var Host = hostWith((proto) => IBOutlet(".chip", [UILabel])(proto, "chips", {}))
    var first = new Host("#host")
    Bind.ibOutlet(first)
    var second = new Host("#host")
    Bind.ibOutlet(second)
    assert.equal(second.chips.length, 3)
    assert.equal(second.chips[0].$el[0], first.chips[0].$el[0])
})

test("a collection class that carries a nib draws it into every matched element", function() {
    page("<div id=\"host\"><div class=\"slot\"></div><div class=\"slot\"></div></div>")
    class Slot extends UIView {}
    Slot.nib = "<i class=\"mark\">m</i>"
    var Host = hostWith((proto) => IBOutlet(".slot", [Slot])(proto, "slots", {}))
    var host = new Host("#host")
    Bind.ibOutlet(host)
    assert.deepEqual(Array.from(document.querySelectorAll(".slot")).map((slot) => slot.innerHTML), ["<i class=\"mark\">m</i>", "<i class=\"mark\">m</i>"])
})

test("pre-rendering a controller draws the collection class's nib into every matched element", function() {
    class Slot extends UIView {}
    Slot.nib = "<i class=\"mark\"></i>"
    class Controller extends UIViewController {}
    Controller.nib = "<div class=\"slot\"></div><div class=\"slot\"></div>"
    IBOutlet(".slot", [Slot])(Controller.prototype, "slots", {})
    var html = Build.html(new Controller())
    assert.equal(html.split("<i class=\"mark\"></i>").length - 1, 2)
})

test("restore rebinds a collection, sending didMoveToWindow to each element and no awakeFromNib", function() {
    Bind._restorePrototypes.clear()
    var hooks = []
    class Chip extends UIView {
        awakeFromNib() { hooks.push("awake") }
        didMoveToWindow() { hooks.push("moved") }
    }
    class Controller extends UIViewController {}
    IBOutlet(".chip", [Chip])(Controller.prototype, "chips", {})
    page("<cocoatouch><span class=\"chip\"></span><span class=\"chip\"></span></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    assert.equal(controller.chips.length, 2)
    assert.deepEqual(controller.chips.map((chip) => chip.$el[0]), Array.from(document.querySelectorAll(".chip")))
    assert.deepEqual(hooks, ["moved", "moved"])
})

test("a controller presented over a nib binds its collection", async function() {
    class Controller extends UIViewController {}
    Controller.nib = "<span class=\"chip\">1</span><span class=\"chip\">2</span><span class=\"chip\">3</span>"
    IBOutlet(".chip", [UILabel])(Controller.prototype, "chips", {})
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    controller.present(controller)
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(controller.chips.map((chip) => chip.$el.text()), ["1", "2", "3"])
})

test("a collection declaration is [Class], one class in an array, and anything else is refused", function() {
    assert.throws(() => IBOutlet(".chip", [])({}, "chips"), (error) => error instanceof TypeError && /IBOutlet/.test(error.message))
    assert.throws(() => IBOutlet(".chip", [UILabel, UIView])({}, "chips"), TypeError)
    assert.throws(() => IBOutlet(".chip", ["UILabel"])({}, "chips"), TypeError)
    assert.doesNotThrow(() => IBOutlet(".chip", [UILabel])({}, "chips"))
})
