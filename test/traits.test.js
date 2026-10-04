import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, UIView, UIViewController, UITraitCollection, UIUserInterfaceSizeClass } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

function resize(width, height) {
    window.innerWidth = width
    window.innerHeight = height
    window.dispatchEvent(new window.Event("resize"))
}

test("a narrow window is horizontally compact and a wide one regular; a short one is vertically compact", function() {
    page("<div id=\"box\"></div>")
    var view = new UIView("#box")
    resize(320, 768)
    assert.ok(view.traitCollection instanceof UITraitCollection)
    assert.equal(view.traitCollection.horizontalSizeClass, UIUserInterfaceSizeClass.compact)
    assert.equal(view.traitCollection.verticalSizeClass, UIUserInterfaceSizeClass.regular)
    resize(768, 400)
    assert.equal(view.traitCollection.horizontalSizeClass, UIUserInterfaceSizeClass.regular)
    assert.equal(view.traitCollection.verticalSizeClass, UIUserInterfaceSizeClass.compact)
    assert.equal(new UIViewController().traitCollection.horizontalSizeClass, UIUserInterfaceSizeClass.regular)
    assert.equal(UIUserInterfaceSizeClass.unspecified, "unspecified")
})

function recordingController(log) {
    class Panel extends UIView {
        traitCollectionDidChange(previous) { log.push("view.traitCollectionDidChange:" + previous.horizontalSizeClass) }
        layoutSubviews() { log.push("layoutSubviews") }
    }
    class Controller extends UIViewController {
        willTransition({to: newCollection, with: coordinator}) {
            log.push("willTransition:" + newCollection.horizontalSizeClass + ":" + this.traitCollection.horizontalSizeClass)
            coordinator.animate({alongsideTransition: null, completion: null})
        }
        viewWillTransition({to: size, with: coordinator}) { log.push("viewWillTransition:" + size.width) }
        traitCollectionDidChange(previous) { log.push("traitCollectionDidChange:" + previous.horizontalSizeClass + ":" + this.traitCollection.horizontalSizeClass) }
    }
    Controller.nib = "<div id=\"panel\"></div>"
    IBOutlet("#panel", Panel)(Controller.prototype, "panel", {})
    return Controller
}

test("a resize across the threshold sends willTransition, viewWillTransition, traitCollectionDidChange and layoutSubviews, in that order", async function() {
    var log = []
    resize(1024, 768)
    page("<cocoatouch></cocoatouch>")
    var controller = new (recordingController(log))()
    await present(controller)
    log.length = 0
    resize(500, 768)
    assert.deepEqual(log, [
        "willTransition:compact:regular",
        "viewWillTransition:500",
        "traitCollectionDidChange:regular:compact",
        "view.traitCollectionDidChange:regular",
        "layoutSubviews",
    ])
})

test("a resize that stays on one side of the threshold sends no trait hook", async function() {
    var log = []
    resize(1024, 768)
    page("<cocoatouch></cocoatouch>")
    var controller = new (recordingController(log))()
    await present(controller)
    log.length = 0
    resize(1200, 768)
    assert.deepEqual(log, ["viewWillTransition:1200", "layoutSubviews"])
})
