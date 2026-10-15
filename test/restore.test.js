import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, IBAction, UIView, UIButton, UIViewController, UISearchTextField, UISwitch } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


function instancesOf(controller, cls) {
    var found = []
    var walk = (view) => {
        if (view instanceof cls) { found.push(view) }
        for (var subview of view.subviews) { walk(subview) }
    }
    walk(controller.view)
    return found
}

test("restoring a page whose outlet declares an action yields one instance, the outlet, with its fields and its handler", function() {
    Bind._restorePrototypes.clear()
    var taps = []
    class Menu extends UIView {
        count = 0
        logoTapped(sender) { taps.push(this) }
    }
    IBAction("#logo", UIButton)(Menu.prototype, "logoTapped", {})
    class Controller extends UIViewController {}
    IBOutlet("#menu", Menu)(Controller.prototype, "menu", {})
    page("<cocoatouch><nav id=\"menu\"><a id=\"logo\"></a></nav></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var menus = instancesOf(controller, Menu)
    assert.equal(menus.length, 1)
    assert.equal(menus[0], controller.menu)
    assert.equal(controller.menu.count, 0)
    $("#logo").trigger("click")
    assert.deepEqual(taps, [controller.menu])
})

test("a code-added view inside an outlet container that declares no action is still revived, initialised", function() {
    Bind._restorePrototypes.clear()
    class Chip extends UIView {
        closed = 0
        closeTapped(sender) { this.closed += 1 }
    }
    IBAction(".chip-close", UIButton)(Chip.prototype, "closeTapped", {})
    class Controller extends UIViewController {}
    IBOutlet("#messages", UIView)(Controller.prototype, "messagesView", {})
    page("<cocoatouch><div id=\"messages\"><div class=\"chip\"><a class=\"chip-close\" id=\"close-1\"></a></div></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var chips = instancesOf(controller, Chip)
    assert.equal(chips.length, 1)
    assert.equal(chips[0].closed, 0)
    $("#close-1").trigger("click")
    assert.equal(chips[0].closed, 1)
})

test("a class and its subclass matching the same target produce one instance, of the subclass", function() {
    Bind._restorePrototypes.clear()
    class Base extends UIView {
        logoTapped() {}
    }
    IBAction("#brand", UIButton)(Base.prototype, "logoTapped", {})
    class Derived extends Base {
        extraTapped() {}
    }
    IBAction("#extra", UIButton)(Derived.prototype, "extraTapped", {})
    class Controller extends UIViewController {}
    IBOutlet("#side", UIView)(Controller.prototype, "sideView", {})
    page("<cocoatouch><div id=\"side\"><a id=\"brand\"></a></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var revived = instancesOf(controller, Base)
    assert.equal(revived.length, 1)
    assert.ok(revived[0] instanceof Derived)
})

test("a revived UISearchTextField does not append its input to the restore scope", function() {
    Bind._restorePrototypes.clear()
    class TokenField extends UISearchTextField {
        clearTapped() {}
    }
    IBAction(".token-clear", UIButton)(TokenField.prototype, "clearTapped", {})
    class Controller extends UIViewController {}
    page("<cocoatouch><div id=\"filters\"><span class=\"token-clear\" id=\"clear-1\"></span></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    assert.equal(instancesOf(controller, TokenField).length, 1)
    assert.equal($("cocoatouch > input").length, 0)
    assert.equal($("input.search-input-tag").length, 0)
})

// The prerenderer loaded the page; the client only appears. A viewDidLoad
// that builds content must therefore not run again on restore, or the
// prerendered html is duplicated.
function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

function capturedPage() {
    return "<cocoatouch>" + $("cocoatouch").html() + "</cocoatouch>"
}

test("restoring a prerendered page does not run its content builders again", async function() {
    Bind._restorePrototypes.clear()
    class Docs extends UIViewController {
        viewDidLoad() {
            for (var i = 0; i < 3; i++) { this.contentView.addSubview(UIView.loadFromNib("<section class=\"section\"></section>")) }
        }
    }
    Docs.nib = "<main id=\"content\"></main>"
    IBOutlet("#content", UIView)(Docs.prototype, "contentView", {})
    page("<cocoatouch></cocoatouch>")
    var presented = new Docs()
    await present(presented)
    assert.equal($("cocoatouch .section").length, 3)
    var html = capturedPage()
    page(html)
    assert.equal($("cocoatouch .section").length, 3)
    var restored = new Docs()
    restored.restore(restored)
    assert.equal($("cocoatouch .section").length, 3)
    assert.equal(restored.isViewLoaded, true)
})

test("restoring a prerendered page does not run an outlet-bound controller's content builder again", async function() {
    Bind._restorePrototypes.clear()
    class Panel extends UIViewController {
        viewDidLoad() { this.view.addSubview(UIView.loadFromNib("<p class=\"row\"></p>")) }
    }
    Panel.nib = ""
    class Host extends UIViewController {}
    Host.nib = "<div id=\"panel\"></div>"
    IBOutlet("#panel", Panel)(Host.prototype, "panel", {})
    page("<cocoatouch></cocoatouch>")
    var presented = new Host()
    await present(presented)
    assert.equal($("#panel .row").length, 1)
    var html = capturedPage()
    page(html)
    var restored = new Host()
    restored.restore(restored)
    assert.equal($("#panel .row").length, 1)
    assert.equal(restored.panel.isViewLoaded, true)
})


// A page of the docs' /api shape: repeated cards sharing every id, each bound
// by a class of its own, restored rather than built.
function restoredCards() {
    Bind._restorePrototypes.clear()
    class Card extends UIView {}
    IBOutlet("#sw", UISwitch)(Card.prototype, "toggle", {})
    IBOutlet(".x", UIView)(Card.prototype, "marks", {})
    IBOutlet(".nothing", UIView)(Card.prototype, "nothing", {})
    class Controller extends UIViewController {}
    IBOutlet("#card-a", Card)(Controller.prototype, "cardA", {})
    IBOutlet("#card-b", Card)(Controller.prototype, "cardB", {})
    var card = (id) => "<div id=\"" + id + "\"><input id=\"sw\"><i class=\"x\"></i><i class=\"x\"></i></div>"
    page("<cocoatouch>" + card("card-a") + card("card-b") + "</cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    return controller
}

test("restore binds each card's outlets to its own elements, as find would, when ids repeat across cards", function() {
    var controller = restoredCards()
    var [inputA, inputB] = document.querySelectorAll("input")
    assert.deepEqual(Array.from(controller.cardA.toggle.$el), [inputA])
    assert.deepEqual(Array.from(controller.cardB.toggle.$el), [inputB])
    assert.deepEqual(Array.from(controller.cardB.marks.$el), Array.from($("#card-b").find(".x")))
    assert.equal(controller.cardB.marks.$el.length, 2)
})

test("restore leaves an outlet that matches nothing with an empty set", function() {
    var controller = restoredCards()
    assert.equal(controller.cardA.nothing.$el.length, 0)
    assert.equal(controller.cardB.nothing.$el.length, 0)
})

test("a control restored on the second card highlights that card's element and not the first", function() {
    var controller = restoredCards()
    var inputs = document.querySelectorAll("input")
    inputs[1].dispatchEvent(new window.Event("pointerdown", {bubbles: true}))
    assert.equal(controller.cardB.toggle.isHighlighted, true)
    assert.equal(controller.cardA.toggle.isHighlighted, false)
})

test("a revived view's outlets resolve inside the restored scope, as find would", function() {
    Bind._restorePrototypes.clear()
    class Chip extends UIView {}
    IBOutlet("#label", UIView)(Chip.prototype, "label", {})
    IBOutlet(".x", UIView)(Chip.prototype, "marks", {})
    IBAction(".chip-close", UIButton)(Chip.prototype, "closeTapped", {})
    class Controller extends UIViewController {}
    page("<cocoatouch><div class=\"chip\"><a class=\"chip-close\"></a><b id=\"label\"></b><i class=\"x\"></i><i class=\"x\"></i></div><b id=\"label\"></b></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var chips = instancesOf(controller, Chip)
    assert.equal(chips.length, 1)
    assert.deepEqual(Array.from(chips[0].label.$el), Array.from($("cocoatouch").find("#label")))
    assert.deepEqual(Array.from(chips[0].marks.$el), Array.from($("cocoatouch").find(".x")))
    assert.equal(chips[0].marks.$el.length, 2)
})
