import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBOutlet, IBInspectable, UIView, UIColor, UIImage, UIViewController, CGPoint, CGSize, CGRect } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

function bannerClass(log) {
    class Banner extends UIView {
        title = "Default"
        count = 1
        isWide = false
        titleColor = null
        image = null
        anchor = null
        extent = null
        area = null
        awakeFromNib() {
            log.push({title: this.title, count: this.count, isWide: this.isWide, titleColor: this.titleColor, image: this.image, anchor: this.anchor, extent: this.extent, area: this.area})
        }
    }
    IBInspectable(Banner.prototype, "title", {})
    IBInspectable(Number)(Banner.prototype, "count", {})
    IBInspectable(Boolean)(Banner.prototype, "isWide", {})
    IBInspectable(UIColor)(Banner.prototype, "titleColor", {})
    IBInspectable(UIImage)(Banner.prototype, "image", {})
    IBInspectable(CGPoint)(Banner.prototype, "anchor", {})
    IBInspectable(CGSize)(Banner.prototype, "extent", {})
    IBInspectable(CGRect)(Banner.prototype, "area", {})
    return Banner
}

function controllerWith(Banner, attributes) {
    class Controller extends UIViewController {}
    Controller.nib = `<div id="banner" ${attributes}></div>`
    IBOutlet("#banner", Banner)(Controller.prototype, "banner", {})
    return Controller
}

test("inspectables arrive after the field initialiser and before awakeFromNib, converted to their types", async function() {
    var log = []
    var Banner = bannerClass(log)
    var Controller = controllerWith(Banner, 'data-title="Pix" data-count="3" data-is-wide="true" data-title-color="#ff0000" data-image="/hero.png" data-anchor="1, 2" data-extent="30,40" data-area="1,2,3,4"')
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    assert.equal(log.length, 1)
    var seen = log[0]
    assert.equal(seen.title, "Pix")
    assert.equal(seen.count, 3)
    assert.equal(seen.isWide, true)
    assert.ok(seen.titleColor instanceof UIColor)
    assert.equal(seen.titleColor.cgColor, "#ff0000")
    assert.ok(seen.image instanceof UIImage)
    assert.equal(seen.image.named, "/hero.png")
    assert.deepEqual(seen.anchor, new CGPoint({x: 1, y: 2}))
    assert.deepEqual(seen.extent, new CGSize({width: 30, height: 40}))
    assert.deepEqual(seen.area, new CGRect({x: 1, y: 2, width: 3, height: 4}))
    assert.equal(controller.banner.title, "Pix")
})

test("an absent attribute leaves the declared default, and a named color resolves like UIColor(named:)", async function() {
    var log = []
    var Banner = bannerClass(log)
    var Controller = controllerWith(Banner, 'data-title-color="title-color"')
    page("<cocoatouch></cocoatouch>")
    var controller = new Controller()
    await present(controller)
    assert.equal(log[0].title, "Default")
    assert.equal(log[0].count, 1)
    assert.equal(log[0].isWide, false)
    assert.equal(log[0].image, null)
    assert.equal(log[0].titleColor.cgColor, "var(--title-color)")
})

// On an app-constructed view the constructor binds before the subclass's
// fields run, so the values are observed inside awakeFromNib, not afterwards.
test("a malformed number or boolean throws, naming the property", function() {
    var log = []
    var Banner = bannerClass(log)
    Banner.nib = "<i></i>"
    page("<div id=\"host\" data-count=\"three\"></div>")
    assert.throws(() => new Banner("#host"), /count/)
    page("<div id=\"host\" data-is-wide=\"yes\"></div>")
    assert.throws(() => new Banner("#host"), /isWide/)
    page("<div id=\"host\" data-count=\"4\" data-is-wide=\"false\"></div>")
    new Banner("#host")
    assert.equal(log.length, 1)
    assert.equal(log[0].count, 4)
    assert.equal(log[0].isWide, false)
})

test("an inspectable on a view added with addSubview is read from its own root element", function() {
    var log = []
    class Chip extends UIView {
        kind = "plain"
        awakeFromNib() { log.push(this.kind) }
    }
    Chip.nib = "<span class=\"chip\" data-kind=\"warning\"></span>"
    IBInspectable(Chip.prototype, "kind", {})
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var chip = new Chip()
    host.addSubview(chip)
    assert.deepEqual(log, ["warning"])
    assert.equal(chip.kind, "warning")
})
