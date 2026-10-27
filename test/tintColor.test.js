import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UILabel, UIImageView, UIButton, UIControl, UIImage, UIColor, UIControlState, IBOutlet } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


var red = new UIColor({named: "test-red"})
var blue = new UIColor({named: "test-blue"})
var modes = UIImage.RenderingMode
var symbol = "fas fa-lock"
var closeIcon = "<svg width=\"12\" height=\"12\" viewBox=\"0 0 12 12\"><path fill=\"currentColor\" d=\"M1 1L11 11\"/></svg>"

// A view made in code takes its nib's single root as its element when it is placed.
function made(Type, nib) {
    class Made extends Type {}
    Made.nib = nib
    return new Made()
}

function placed(parent, Type, nib) {
    var view = made(Type, nib)
    parent.addSubview(view)
    return view
}

function root() {
    page("<div id=\"root\"></div>")
    return new UIView("#root")
}

function colorOf(view) {
    return view.$el[0].style.getPropertyValue("color")
}

function isUntouched(view) {
    return view.$el[0].style.cssText === ""
}

var log = []

class Tracked extends UIView {
    tintColorDidChange() {
        log.push(this.accessibilityIdentifier)
    }
}



test("the root tint is a UIColor named after the action token, never a plain object", function() {
    var view = root()
    assert.ok(view.tintColor instanceof UIColor)
    assert.equal(view.tintColor.cgColor, "var(--action-or-selection-color)")
    assert.equal(isUntouched(view), true)
})

test("tintColor is inherited through three levels, an own tint stops it, and null returns to the inherited one", function() {
    var top = root()
    var middle = placed(top, UIView, "<div class=\"middle\"></div>")
    var leaf = placed(middle, UIView, "<div class=\"leaf\"></div>")
    top.tintColor = red
    assert.equal(middle.tintColor, red)
    assert.equal(leaf.tintColor, red)
    middle.tintColor = blue
    assert.equal(top.tintColor, red)
    assert.equal(leaf.tintColor, blue)
    middle.tintColor = null
    assert.equal(leaf.tintColor, red)
    top.tintColor = null
    assert.equal(leaf.tintColor.cgColor, "var(--action-or-selection-color)")
})

test("a view placed under a tinted view inherits its tint", function() {
    var top = root()
    top.tintColor = red
    var late = placed(top, UIView, "<div class=\"late\"></div>")
    assert.equal(late.tintColor, red)
})

test("tintColor takes a UIColor or null, and refuses a hex string, a plain object and undefined", function() {
    var view = root()
    view.tintColor = red
    view.tintColor = null
    for (var wrong of ["#ff0000", {hex: "#ff0000"}, undefined, 1]) {
        assert.throws(() => { view.tintColor = wrong }, (error) => error instanceof TypeError && /UIView\.tintColor/.test(error.message))
    }
})

test("tintColorDidChange is empty by default, reaches the view and the descendants that inherit, in order, and stops at an own tint", function() {
    assert.equal(new UIView().tintColorDidChange(), undefined)
    page("<div id=\"top\"></div>")
    var top = new Tracked("#top")
    var middle = placed(top, Tracked, "<div id=\"middle\"></div>")
    placed(middle, Tracked, "<div id=\"leaf\"></div>")
    placed(top, Tracked, "<div id=\"sibling\"></div>")
    log = []
    top.tintColor = red
    assert.deepEqual(log, ["top", "middle", "leaf", "sibling"])
    log = []
    middle.tintColor = blue
    assert.deepEqual(log, ["middle", "leaf"])
    log = []
    top.tintColor = new UIColor({named: "test-green"})
    assert.deepEqual(log, ["top", "sibling"], "middle has its own tint, so it and the leaf below it are not told")
    log = []
    middle.tintColor = null
    assert.deepEqual(log, ["middle", "leaf"])
})

test("D7 case 1: with no explicit tint anywhere, template icons keep the stylesheet's color and nothing is written", function() {
    var top = root()
    var icon = placed(top, UIImageView, "<i class=\"icon\"></i>")
    icon.image = new UIImage({systemName: symbol})
    var picture = placed(top, UIImageView, "<img class=\"picture\">")
    picture.image = new UIImage({named: "/lock.png"}).withRenderingMode(modes.alwaysTemplate)
    var close = placed(top, UIControl, "<button class=\"close\">" + closeIcon + "</button>")
    var pay = placed(top, UIButton, "<button class=\"pay\">Pay</button>")
    pay.configuration.image = new UIImage({systemName: symbol})
    for (var view of [top, icon, picture, close, pay]) {
        assert.equal(view.$el[0].style.cssText, "", view.$el[0].className)
    }
    assert.equal(pay.$el[0].querySelector("i").style.cssText, "")
})

test("D7 case 2: an ancestor's tint paints every template icon below it, and stops at a descendant with its own tint", function() {
    var top = root()
    var icon = placed(top, UIImageView, "<i class=\"icon\"></i>")
    icon.image = new UIImage({systemName: symbol})
    var picture = placed(top, UIImageView, "<img class=\"picture\">")
    picture.image = new UIImage({named: "/lock.png"}).withRenderingMode(modes.alwaysTemplate)
    var close = placed(top, UIControl, "<button class=\"close\">" + closeIcon + "</button>")
    var pay = placed(top, UIButton, "<button class=\"pay\">Pay</button>")
    pay.configuration.image = new UIImage({systemName: symbol})
    var group = placed(top, UIView, "<div class=\"group\"></div>")
    var inner = placed(group, UIImageView, "<i class=\"inner\"></i>")
    inner.image = new UIImage({systemName: symbol})
    var own = placed(top, UIView, "<div class=\"own\"></div>")
    own.tintColor = blue
    var ownIcon = placed(own, UIImageView, "<i class=\"own-icon\"></i>")
    ownIcon.image = new UIImage({systemName: symbol})

    top.tintColor = red
    assert.equal(colorOf(icon), red.cgColor)
    assert.equal(picture.$el[0].style.getPropertyValue("background-color"), red.cgColor)
    assert.match(picture.$el[0].style.getPropertyValue("mask-image"), /lock\.png/)
    assert.equal(colorOf(close), red.cgColor)
    assert.equal(pay.$el[0].querySelector("i").style.getPropertyValue("color"), red.cgColor)
    assert.equal(colorOf(inner), red.cgColor, "a template icon below a container is painted, the container is not")
    assert.equal(colorOf(ownIcon), blue.cgColor, "the tint stops at a descendant that has its own, and its icons keep that one")

    top.tintColor = null
    for (var cleared of [icon, picture, close, inner]) {
        assert.equal(cleared.$el[0].style.cssText, "", cleared.$el[0].className)
    }
    assert.equal(pay.$el[0].querySelector("i").style.cssText, "")
    assert.equal(colorOf(ownIcon), blue.cgColor, "a descendant's own tint stays")
})

test("a tint set again repaints with the new color, and an icon placed or drawn later under a tint is painted", function() {
    var top = root()
    top.tintColor = red
    var icon = placed(top, UIImageView, "<i class=\"icon\"></i>")
    assert.equal(colorOf(icon), "", "no image yet: nothing to paint")
    icon.image = new UIImage({systemName: symbol})
    assert.equal(colorOf(icon), red.cgColor)
    top.tintColor = blue
    assert.equal(colorOf(icon), blue.cgColor)
    var pay = placed(top, UIButton, "<button class=\"pay\">Pay</button>")
    pay.configuration.image = new UIImage({systemName: symbol})
    assert.equal(pay.$el[0].querySelector("i").style.getPropertyValue("color"), blue.cgColor)
    pay.configuration.image = new UIImage({named: "/lock.png"})
    assert.equal(pay.$el[0].querySelector("img").style.cssText, "", "an automatic file image is original")
    pay.configuration.image = new UIImage({systemName: symbol})
    assert.equal(pay.$el[0].querySelector("i").style.getPropertyValue("color"), blue.cgColor)
    pay.configuration.image = null
    assert.equal(pay.$el[0].querySelector(".uibutton-image"), null)
})

test("D7 test 3: a UILabel and a plain UIView below a tinted ancestor carry no inline color, nor does the view that owns the tint", function() {
    var top = root()
    var plain = placed(top, UIView, "<div class=\"plain\"></div>")
    var label = placed(top, UILabel, "<span class=\"label\">Name</span>")
    top.tintColor = red
    assert.equal(isUntouched(top), true)
    assert.equal(isUntouched(plain), true)
    assert.equal(isUntouched(label), true)
    var nested = placed(plain, UIView, "<div class=\"nested\"></div>")
    assert.equal(isUntouched(nested), true)
    assert.equal(isUntouched(plain), true)
})

test("D7 test 4: clearing the tint takes the inline color away, and an alwaysOriginal image is never written", function() {
    var top = root()
    var icon = placed(top, UIImageView, "<i class=\"icon\"></i>")
    var original = placed(top, UIImageView, "<i class=\"original\"></i>")
    var plainFile = placed(top, UIImageView, "<img class=\"file\">")
    var templateFile = placed(top, UIImageView, "<img class=\"template\">")
    icon.image = new UIImage({systemName: symbol})
    original.image = new UIImage({systemName: symbol}).withRenderingMode(modes.alwaysOriginal)
    plainFile.image = new UIImage({named: "/lock.png"})
    templateFile.image = new UIImage({named: "/lock.png"}).withRenderingMode(modes.alwaysOriginal)
    top.tintColor = red
    assert.equal(colorOf(icon), red.cgColor)
    for (var untouched of [original, plainFile, templateFile]) {
        assert.equal(untouched.$el[0].style.cssText, "", untouched.$el[0].className)
    }
    icon.image = new UIImage({systemName: symbol}).withRenderingMode(modes.alwaysOriginal)
    assert.equal(icon.$el[0].style.cssText, "", "a template turned original loses the tint")
    icon.image = new UIImage({systemName: symbol})
    assert.equal(colorOf(icon), red.cgColor)
    top.tintColor = null
    assert.equal(icon.$el[0].style.cssText, "")
})

test("what an icon's element carried before the tint comes back when it goes, and an app's later color is left alone", function() {
    var top = root()
    var close = placed(top, UIButton, "<button class=\"close\">" + closeIcon + "</button>")
    close.setTitleColor(red, {for: UIControlState.normal})
    top.tintColor = blue
    assert.equal(colorOf(close), blue.cgColor)
    top.tintColor = null
    assert.equal(colorOf(close), red.cgColor)
    top.tintColor = blue
    close.setTitleColor(new UIColor({named: "test-green"}), {for: UIControlState.normal})
    top.tintColor = null
    assert.equal(colorOf(close), "var(--test-green)")
})

test("an inline svg that is no currentColor drawing, and a control without an svg, are not template images", function() {
    var top = root()
    var fixed = placed(top, UIControl, "<button class=\"fixed\"><svg><path fill=\"#707072\" d=\"M1 1\"/></svg></button>")
    var bare = placed(top, UIControl, "<button class=\"bare\">Text</button>")
    var host = placed(top, UIImageView, "<svg class=\"host\" fill=\"currentColor\"><path d=\"M1 1\"/></svg>")
    top.tintColor = red
    assert.equal(isUntouched(fixed), true)
    assert.equal(isUntouched(bare), true)
    assert.equal(colorOf(host), red.cgColor, "an image view over an svg host is the template image")
})

test("an outlet bound after its owner was tinted is painted, and one bound before it is painted when the tint is set", function() {
    class Card extends UIView {}
    IBOutlet(".icon", UIImageView)(Card.prototype, "icon", {})
    IBOutlet(".close", UIControl)(Card.prototype, "close", {})
    var markup = "<div id=\"card\"><i class=\"icon\"></i><button class=\"close\">" + closeIcon + "</button></div>"
    page(markup)
    var tinted = new Card("#card")
    tinted.tintColor = red
    Bind.ibOutlet(tinted)
    tinted.icon.image = new UIImage({systemName: symbol})
    assert.equal(colorOf(tinted.icon), red.cgColor)
    assert.equal(colorOf(tinted.close), red.cgColor, "the close control's svg was in the markup when it was bound")
    assert.equal(isUntouched(tinted), true)

    page(markup)
    var later = new Card("#card")
    Bind.ibOutlet(later)
    later.icon.image = new UIImage({systemName: symbol})
    assert.equal(isUntouched(later.icon), true)
    later.tintColor = blue
    assert.equal(colorOf(later.icon), blue.cgColor)
    assert.equal(colorOf(later.close), blue.cgColor)
    assert.equal(isUntouched(later), true)
})
