import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import * as framework from "../src/index.js"
import { UIColor, UITraitCollection } from "../src/index.js"


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

// UIColor(named:) fails where the asset catalog has no such color, so a token the
// theme does not define is a bug to see, never a color to guess.
test("a token that resolves to nothing throws a TypeError naming it, and never returns var()", function() {
    reset()
    var missing = new UIColor({named: "no-such-token"})
    assert.throws(() => missing.resolvedColor({with: UITraitCollection.current}), (error) => error instanceof TypeError && /--no-such-token/.test(error.message) && /resolvedColor/.test(error.message))
    define("empty-token", "   ")
    var empty = new UIColor({named: "empty-token"})
    assert.throws(() => empty.resolvedColor({with: UITraitCollection.current}), (error) => error instanceof TypeError && /--empty-token/.test(error.message))
})

test("a token defined as another token resolves through the chain to the concrete value", function() {
    reset()
    define("chart-blue", "#0070E0")
    define("brand", "var(--chart-blue)")
    define("brand-alias", "var(--brand)")
    var resolved = new UIColor({named: "brand-alias"}).resolvedColor({with: UITraitCollection.current})
    assert.equal(resolved.cgColor, "#0070E0")
    assert.ok(!resolved.cgColor.includes("var("))
})

test("a var() inside a larger value is replaced where it stands", function() {
    reset()
    define("channel", "12, 34, 56")
    define("tinted", "rgb(var(--channel))")
    assert.equal(new UIColor({named: "tinted"}).resolvedColor({with: UITraitCollection.current}).cgColor, "rgb(12, 34, 56)")
})

test("a chain that ends in a missing token throws naming the token that is missing, not the one asked for", function() {
    reset()
    define("brand", "var(--gone)")
    assert.throws(() => new UIColor({named: "brand"}).resolvedColor({with: UITraitCollection.current}), (error) => error instanceof TypeError && /--gone/.test(error.message))
})

test("a chain that loops throws a TypeError instead of running forever", function() {
    reset()
    define("ping", "var(--pong)")
    define("pong", "var(--ping)")
    assert.throws(() => new UIColor({named: "ping"}).resolvedColor({with: UITraitCollection.current}), (error) => error instanceof TypeError && /--ping/.test(error.message))
})

test("a var() form this resolver does not read, with a fallback, throws rather than come back unresolved", function() {
    reset()
    define("fallbacked", "var(--other, #fff)")
    assert.throws(() => new UIColor({named: "fallbacked"}).resolvedColor({with: UITraitCollection.current}), (error) => error instanceof TypeError && /--fallbacked/.test(error.message))
})

test("a chain is still read with one getComputedStyle call", function() {
    reset()
    define("chart-blue", "#0070E0")
    define("brand", "var(--chart-blue)")
    var calls = spied(function() { new UIColor({named: "brand"}).resolvedColor({with: UITraitCollection.current}) })
    assert.equal(calls.length, 1)
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

test("UITraitCollection.current is the page's collection, with its size classes", function() {
    assert.ok(UITraitCollection.current instanceof UITraitCollection)
    assert.equal(UITraitCollection.current, UITraitCollection.current)
    assert.ok(["compact", "regular"].includes(UITraitCollection.current.horizontalSizeClass))
})

// A light or dark style would have to be guessed from a background or from
// prefers-color-scheme; neither is the app's decision, so the framework has no
// interface style until the app's theme code can set one.
test("the page's collection has no interface style, and no UIUserInterfaceStyle exists", function() {
    reset()
    root.style.backgroundColor = "rgb(18, 19, 20)"
    assert.equal(UITraitCollection.current.userInterfaceStyle, undefined)
    assert.equal("userInterfaceStyle" in UITraitCollection.current, false)
    assert.equal(new UITraitCollection({userInterfaceStyle: "dark"}).userInterfaceStyle, undefined)
    assert.equal(framework.UIUserInterfaceStyle, undefined)
    reset()
})

test("resolvedColor works under any background and reads no style: the root's custom property alone", function() {
    reset()
    define("chart-blue", "#0070E0")
    var named = new UIColor({named: "chart-blue"})
    var calls = spied(function() {
        for (var background of ["rgb(255, 255, 255)", "rgb(18, 19, 20)", "rgba(0, 0, 0, 0)"]) {
            root.style.backgroundColor = background
            assert.equal(named.resolvedColor({with: UITraitCollection.current}).cgColor, "#0070E0")
        }
    })
    assert.equal(calls.length, 3, "one getComputedStyle call per resolve, none for a style")
    reset()
})
