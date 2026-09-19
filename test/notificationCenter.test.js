import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIResponder, NotificationCenter } from "../src/index.js"


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
