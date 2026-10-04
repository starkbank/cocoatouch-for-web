import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, IBAction, UIView, UIButton, UIViewController, UISearchTextField } from "../src/index.js"
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
