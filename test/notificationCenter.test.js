import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIResponder, NotificationCenter, NSNotification } from "../src/index.js"
import { defineNotificationNames } from "../src/foundation/nsnotification.js"


test("two observers of the same name both receive the notification", function() {
    var received = []
    var first = new UIResponder("#first")
    var second = new UIResponder("#second")
    NotificationCenter.default.addObserver(first, {selector: function(n) { received.push("first:" + n.userInfo.value) }, name: "ping"})
    NotificationCenter.default.addObserver(second, {selector: function(n) { received.push("second:" + n.userInfo.value) }, name: "ping"})
    NotificationCenter.default.post({name: "ping", userInfo: {value: 1}})
    assert.deepEqual(received, ["first:1", "second:1"])
    NotificationCenter.default.removeObserver(first)
    NotificationCenter.default.removeObserver(second)
})

test("a string selector resolves to the observer's method with the observer as this", function() {
    var responder = new UIResponder("#r")
    var seen = null
    responder.handlePing = function(notification) { seen = {self: this, name: notification.name} }
    NotificationCenter.default.addObserver(responder, {selector: "handlePing", name: "ping"})
    NotificationCenter.default.post({name: "ping"})
    assert.equal(seen.self, responder)
    assert.equal(seen.name, "ping")
    NotificationCenter.default.removeObserver(responder)
})

test("an event target as object observes that DOM event until removeObserver", function() {
    var target = new EventTarget()
    var responder = new UIResponder("#r")
    var hits = 0
    NotificationCenter.default.addObserver(responder, {selector: function() { hits += 1 }, name: "tick", object: target})
    target.dispatchEvent(new Event("tick"))
    assert.equal(hits, 1)
    NotificationCenter.default.removeObserver(responder)
    target.dispatchEvent(new Event("tick"))
    assert.equal(hits, 1)
})

test("removeObserver with a name keeps the observer's other notifications", function() {
    var responder = new UIResponder("#r")
    var received = []
    NotificationCenter.default.addObserver(responder, {selector: function() { received.push("a") }, name: "a"})
    NotificationCenter.default.addObserver(responder, {selector: function() { received.push("b") }, name: "b"})
    NotificationCenter.default.removeObserver(responder, {name: "a"})
    NotificationCenter.default.post({name: "a"})
    NotificationCenter.default.post({name: "b"})
    assert.deepEqual(received, ["b"])
    NotificationCenter.default.removeObserver(responder)
})

test("an in-app object filters notifications by sender", function() {
    var responder = new UIResponder("#r")
    var sender = {}
    var other = {}
    var hits = 0
    NotificationCenter.default.addObserver(responder, {selector: function() { hits += 1 }, name: "changed", object: sender})
    NotificationCenter.default.post({name: "changed", object: other})
    NotificationCenter.default.post({name: "changed", object: sender})
    assert.equal(hits, 1)
    NotificationCenter.default.removeObserver(responder)
})

test("an observer registered while a notification is delivered does not receive it", function() {
    var late = {}
    var hits = 0
    var first = {}
    NotificationCenter.default.addObserver(first, {name: "step", selector: function() {
        NotificationCenter.default.removeObserver(first)
        NotificationCenter.default.addObserver(late, {name: "step", selector: function() { hits += 1 }})
    }})
    NotificationCenter.default.post({name: "step"})
    assert.equal(hits, 0)
    NotificationCenter.default.post({name: "step"})
    assert.equal(hits, 1)
    NotificationCenter.default.removeObserver(late)
})

test("an observer removed while a notification is delivered is skipped", function() {
    var hits = 0
    var a = {}, b = {}
    NotificationCenter.default.addObserver(a, {name: "step", selector: function() { NotificationCenter.default.removeObserver(b) }})
    NotificationCenter.default.addObserver(b, {name: "step", selector: function() { hits += 1 }})
    NotificationCenter.default.post({name: "step"})
    assert.equal(hits, 0)
    NotificationCenter.default.removeObserver(a)
})


// NSNotification.Name is the namespace every framework hangs its notification
// constants off, as `extension NSNotification.Name { static let ... }` does.
test("NSNotification.Name is a namespace frameworks extend; a defined name is enumerable and non-writable", function() {
    defineNotificationNames({PDFTestPing: "PDFTestPing"})
    assert.equal(NSNotification.Name.PDFTestPing, "PDFTestPing")
    assert.ok(Object.keys(NSNotification.Name).includes("PDFTestPing"))
    var descriptor = Object.getOwnPropertyDescriptor(NSNotification.Name, "PDFTestPing")
    assert.equal(descriptor.enumerable, true)
    assert.equal(descriptor.writable, false)
    assert.equal(descriptor.configurable, false)
    assert.throws(function() { NSNotification.Name.PDFTestPing = "other" }, TypeError)

    var seen = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: NSNotification.Name.PDFTestPing, selector: function(n) { seen.push(n.name) }})
    NotificationCenter.default.post({name: NSNotification.Name.PDFTestPing})
    NotificationCenter.default.removeObserver(observer)
    assert.deepEqual(seen, ["PDFTestPing"])
})

test("redefining a notification name with a different value throws naming the constant; the same value is a no-op", function() {
    defineNotificationNames({PDFTestRedefine: "PDFTestRedefine"})
    assert.doesNotThrow(function() { defineNotificationNames({PDFTestRedefine: "PDFTestRedefine"}) })
    assert.throws(function() { defineNotificationNames({PDFTestRedefine: "somethingElse"}) }, /PDFTestRedefine/)
    assert.equal(NSNotification.Name.PDFTestRedefine, "PDFTestRedefine")
})

test("defineNotificationNames is framework-internal: Foundation's public entry does not export it", async function() {
    var foundation = await import("../src/foundation/index.js")
    assert.equal(foundation.defineNotificationNames, undefined)
    assert.equal(foundation.NSNotification, NSNotification)
})

// A page that loads two bundles has two copies of the package and one
// NotificationCenter.default, as it has one document, so an observer added
// through one copy hears what the other posts.
test("two evaluations of the entry share one default center, and each hears the other's posts", async function() {
    var first = await import("../src/foundation/notificationcenter.js?copy=first")
    var second = await import("../src/foundation/notificationcenter.js?copy=second")
    assert.notEqual(first.NotificationCenter, second.NotificationCenter, "two evaluations are two copies of the class")
    assert.equal(first.NotificationCenter.default, second.NotificationCenter.default)
    var heard = []
    var observer = {}
    second.NotificationCenter.default.addObserver(observer, {name: "crossCopy", selector: function(n) { heard.push(n.userInfo.from) }})
    first.NotificationCenter.default.post({name: "crossCopy", userInfo: {from: "first"}})
    second.NotificationCenter.default.removeObserver(observer)
    assert.deepEqual(heard, ["first"])
})

test("the default center is the one this package's own copy hands out too", async function() {
    var copy = await import("../src/foundation/notificationcenter.js?copy=third")
    assert.equal(copy.NotificationCenter.default, NotificationCenter.default)
})
