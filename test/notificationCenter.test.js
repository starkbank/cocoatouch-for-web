import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIResponder, NSNotificationCenter } from "../src/index.js"


test("two observers of the same name both receive the notification", function() {
    var received = []
    var first = new UIResponder("#first")
    var second = new UIResponder("#second")
    NSNotificationCenter.addObserver(first, {selector: function(n) { received.push("first:" + n.userInfo.value) }, name: "ping"})
    NSNotificationCenter.addObserver(second, {selector: function(n) { received.push("second:" + n.userInfo.value) }, name: "ping"})
    NSNotificationCenter.postNotification({name: "ping", userInfo: {value: 1}})
    assert.deepEqual(received, ["first:1", "second:1"])
    NSNotificationCenter.removeObserver(first)
    NSNotificationCenter.removeObserver(second)
})

test("a string selector resolves to the observer's method with the observer as this", function() {
    var responder = new UIResponder("#r")
    var seen = null
    responder.handlePing = function(notification) { seen = {self: this, name: notification.name} }
    NSNotificationCenter.addObserver(responder, {selector: "handlePing", name: "ping"})
    NSNotificationCenter.postNotification({name: "ping"})
    assert.equal(seen.self, responder)
    assert.equal(seen.name, "ping")
    NSNotificationCenter.removeObserver(responder)
})

test("an event target as object observes that DOM event until removeObserver", function() {
    var target = new EventTarget()
    var responder = new UIResponder("#r")
    var hits = 0
    NSNotificationCenter.addObserver(responder, {selector: function() { hits += 1 }, name: "tick", object: target})
    target.dispatchEvent(new Event("tick"))
    assert.equal(hits, 1)
    NSNotificationCenter.removeObserver(responder)
    target.dispatchEvent(new Event("tick"))
    assert.equal(hits, 1)
})

test("removeObserver with a name keeps the observer's other notifications", function() {
    var responder = new UIResponder("#r")
    var received = []
    NSNotificationCenter.addObserver(responder, {selector: function() { received.push("a") }, name: "a"})
    NSNotificationCenter.addObserver(responder, {selector: function() { received.push("b") }, name: "b"})
    NSNotificationCenter.removeObserver(responder, {name: "a"})
    NSNotificationCenter.postNotification({name: "a"})
    NSNotificationCenter.postNotification({name: "b"})
    assert.deepEqual(received, ["b"])
    NSNotificationCenter.removeObserver(responder)
})

test("an in-app object filters notifications by sender", function() {
    var responder = new UIResponder("#r")
    var sender = {}
    var other = {}
    var hits = 0
    NSNotificationCenter.addObserver(responder, {selector: function() { hits += 1 }, name: "changed", object: sender})
    NSNotificationCenter.postNotification({name: "changed", object: other})
    NSNotificationCenter.postNotification({name: "changed", object: sender})
    assert.equal(hits, 1)
    NSNotificationCenter.removeObserver(responder)
})
