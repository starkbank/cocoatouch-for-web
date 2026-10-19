import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIColor, UITraitCollection, UIUserInterfaceStyle } from "../src/index.js"


var root = document.documentElement

function define(token, value) {
    root.style.setProperty("--" + token, value)
}

function reset() {
    root.removeAttribute("style")
    document.body.removeAttribute("style")
}

// Counts the calls to getComputedStyle, which every resolve must keep at one.
function spied(run) {
    var original = globalThis.getComputedStyle
    var calls = []
    globalThis.getComputedStyle = function(element, pseudo) {
        calls.push(element)
        return original(element, pseudo)
    }
    try {
        run()
    } finally {
        globalThis.getComputedStyle = original
    }
    return calls
}

test("a named token resolves to the root's computed value, and cgColor is no longer var()", function() {
    reset()
    define("chart-blue", "#0070E0")
    var named = new UIColor({named: "chart-blue"})
    assert.equal(named.cgColor, "var(--chart-blue)")
    var resolved = named.resolvedColor({with: UITraitCollection.current})
    assert.equal(resolved.cgColor, "#0070E0")
    assert.ok(!resolved.cgColor.includes("var("))
    assert.equal(named.cgColor, "var(--chart-blue)", "the receiver keeps being the token")
})

test("the result is a new UIColor, and it is concrete: resolving it again returns it as is", function() {
    reset()
    define("chart-blue", "rgb(0, 112, 224)")
    var named = new UIColor({named: "chart-blue"})
    var resolved = named.resolvedColor({with: UITraitCollection.current})
    assert.ok(resolved instanceof UIColor)
    assert.notEqual(resolved, named)
    define("chart-blue", "#ffffff")
    assert.equal(resolved.cgColor, "rgb(0, 112, 224)", "a resolved color does not follow the token")
    assert.equal(resolved.resolvedColor({with: UITraitCollection.current}), resolved)
    assert.equal(named.resolvedColor({with: UITraitCollection.current}).cgColor, "#ffffff", "a later resolve reads the token again")
})

test("a resolve reads the custom property once: one getComputedStyle call, on the document root", function() {
    reset()
    define("chart-blue", "#0070E0")
    var named = new UIColor({named: "chart-blue"})
    var calls = spied(function() { named.resolvedColor({with: UITraitCollection.current}) })
    assert.equal(calls.length, 1)
    assert.equal(calls[0], root)
    var three = spied(function() {
        for (var i = 0; i < 3; i++) { named.resolvedColor({with: UITraitCollection.current}) }
    })
    assert.equal(three.length, 3)
})

test("a token that does not resolve returns the receiver unchanged", function() {
    reset()
    var missing = new UIColor({named: "no-such-token"})
    assert.equal(missing.resolvedColor({with: UITraitCollection.current}), missing)
    define("empty-token", "   ")
    var empty = new UIColor({named: "empty-token"})
    assert.equal(empty.resolvedColor({with: UITraitCollection.current}), empty)
})

test("components, white and hex colors are concrete already and come back as they are, without reading style", function() {
    reset()
    var colors = [new UIColor({red: 1, green: 0, blue: 0, alpha: 0.5}), new UIColor({white: 0.5}), new UIColor({hex: "#123456"}), UIColor.clear, UIColor.white, UIColor.black]
    var calls = spied(function() {
        for (var color of colors) { assert.equal(color.resolvedColor({with: UITraitCollection.current}), color) }
    })
    assert.equal(calls.length, 0)
})

test("the with label is required and must be a UITraitCollection", function() {
    var color = new UIColor({named: "x"})
    assert.throws(() => color.resolvedColor(), (error) => error instanceof TypeError && /resolvedColor\(with:\)/.test(error.message))
    assert.throws(() => color.resolvedColor({}), TypeError)
    assert.throws(() => color.resolvedColor({with: "dark"}), TypeError)
    assert.throws(() => color.resolvedColor({with: {userInterfaceStyle: "dark"}}), TypeError)
})

test("UITraitCollection.current is the page's collection, and a collection can carry its own style", function() {
    assert.ok(UITraitCollection.current instanceof UITraitCollection)
    assert.equal(UITraitCollection.current, UITraitCollection.current)
    assert.equal(new UITraitCollection({userInterfaceStyle: UIUserInterfaceStyle.dark}).userInterfaceStyle, "dark")
    assert.equal(new UITraitCollection().userInterfaceStyle, "unspecified")
    assert.deepEqual([UIUserInterfaceStyle.unspecified, UIUserInterfaceStyle.light, UIUserInterfaceStyle.dark], ["unspecified", "light", "dark"])
})

test("current.userInterfaceStyle follows the root's background, the way the theme decides light or dark", function() {
    reset()
    root.style.backgroundColor = "rgb(255, 255, 255)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, UIUserInterfaceStyle.light)
    root.style.backgroundColor = "rgb(18, 19, 20)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, UIUserInterfaceStyle.dark)
    root.style.backgroundColor = "rgba(0, 0, 0, 0)"
    document.body.style.backgroundColor = "rgb(20, 20, 20)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, UIUserInterfaceStyle.dark, "a transparent root falls to the body")
    document.body.style.backgroundColor = "rgb(250, 250, 250)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, UIUserInterfaceStyle.light)
    reset()
})

test("the brightness threshold is the theme's: (299r + 587g + 114b) / 1000 under 128 is dark", function() {
    reset()
    root.style.backgroundColor = "rgb(127, 127, 127)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, "dark")
    root.style.backgroundColor = "rgb(128, 128, 128)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, "light")
    reset()
})

test("with no background anywhere, the style falls back to prefers-color-scheme, and to light without it", function() {
    reset()
    var original = window.matchMedia
    window.matchMedia = (query) => ({matches: query === "(prefers-color-scheme: dark)"})
    try {
        assert.equal(UITraitCollection.current.userInterfaceStyle, "dark")
        window.matchMedia = () => ({matches: false})
        assert.equal(UITraitCollection.current.userInterfaceStyle, "light")
        window.matchMedia = undefined
        assert.equal(UITraitCollection.current.userInterfaceStyle, "light")
    } finally {
        window.matchMedia = original
    }
})

test("a root background beats prefers-color-scheme", function() {
    reset()
    var original = window.matchMedia
    window.matchMedia = () => ({matches: true})
    try {
        root.style.backgroundColor = "rgb(255, 255, 255)"
        assert.equal(UITraitCollection.current.userInterfaceStyle, "light")
    } finally {
        window.matchMedia = original
        reset()
    }
})
