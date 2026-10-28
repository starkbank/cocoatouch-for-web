import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIScreen, CGRect, CGSize } from "../src/index.js"


function stubScreen({width, height, ratio}) {
    var savedScreen = Object.getOwnPropertyDescriptor(window, "screen")
    var savedRatio = Object.getOwnPropertyDescriptor(window, "devicePixelRatio")
    Object.defineProperty(window, "screen", {configurable: true, value: {width, height}})
    Object.defineProperty(window, "devicePixelRatio", {configurable: true, value: ratio})
    return function restore() {
        if (savedScreen) { Object.defineProperty(window, "screen", savedScreen) } else { delete window.screen }
        if (savedRatio) { Object.defineProperty(window, "devicePixelRatio", savedRatio) } else { delete window.devicePixelRatio }
    }
}

test("nativeScale is the device pixel ratio", function() {
    page("")
    var restore = stubScreen({width: 390, height: 844, ratio: 3})
    assert.equal(UIScreen.main.nativeScale, 3)
    restore()
})

test("nativeBounds is the screen in pixels: its size times the native scale, as a CGRect at the origin", function() {
    page("")
    var restore = stubScreen({width: 390, height: 844, ratio: 3})
    var bounds = UIScreen.main.nativeBounds
    assert.ok(bounds instanceof CGRect)
    assert.ok(bounds.size instanceof CGSize)
    assert.equal(bounds.width, 1170)
    assert.equal(bounds.height, 2532)
    assert.equal(bounds.origin.x, 0)
    assert.equal(bounds.origin.y, 0)
    restore()
})

test("nativeBounds divided by nativeScale is the screen's own size, whatever the ratio", function() {
    page("")
    var restore = stubScreen({width: 1440, height: 900, ratio: 2})
    assert.equal(UIScreen.main.nativeBounds.width / UIScreen.main.nativeScale, 1440)
    assert.equal(UIScreen.main.nativeBounds.height / UIScreen.main.nativeScale, 900)
    restore()
    restore = stubScreen({width: 430, height: 932, ratio: 1})
    assert.equal(UIScreen.main.nativeBounds.width, 430)
    assert.equal(UIScreen.main.nativeScale, 1)
    restore()
})

test("the values are read on every use, so a change of ratio or screen is seen", function() {
    page("")
    var restore = stubScreen({width: 390, height: 844, ratio: 2})
    assert.equal(UIScreen.main.nativeBounds.width, 780)
    restore()
    restore = stubScreen({width: 844, height: 390, ratio: 2})
    assert.equal(UIScreen.main.nativeBounds.width, 1688)
    assert.equal(UIScreen.main.nativeBounds.height, 780)
    restore()
})

test("bounds still reads the viewport, not the screen, and is unaffected by the ratio", function() {
    page("")
    var restore = stubScreen({width: 390, height: 844, ratio: 3})
    var savedWidth = window.innerWidth
    var savedHeight = window.innerHeight
    window.innerWidth = 500
    window.innerHeight = 600
    var bounds = UIScreen.main.bounds
    assert.ok(bounds instanceof CGRect)
    assert.equal(bounds.width, 500)
    assert.equal(bounds.height, 600)
    window.innerWidth = savedWidth
    window.innerHeight = savedHeight
    restore()
})
