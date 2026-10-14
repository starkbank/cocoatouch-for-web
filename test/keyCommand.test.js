import "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, UIViewController, UIKeyCommand, UIKeyModifierFlags, UIDevice } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"
import { keydown, page } from "./dom.js"


const command = UIKeyModifierFlags.command
const control = UIKeyModifierFlags.control
const shift = UIKeyModifierFlags.shift
const mac = "MacIntel"
const windows = "Win32"
const linux = "Linux x86_64"
const offApple = [windows, linux]


// Runs `body` on a platform, as navigator.platform reports it, and puts the
// real device back so a failing assertion cannot leak into the next test.
function onPlatform(systemName, body) {
    var previous = UIDevice._current
    UIDevice._current = {systemName: systemName}
    try {
        body()
    } finally {
        UIDevice._current = previous
    }
}

// A controller whose methods are named by `bindings`, {method: chord}; each
// call pushes its method's name onto `fired`.
function bound(fired, bindings) {
    class Page extends UIViewController {}
    for (var name of Object.keys(bindings)) {
        Page.prototype[name] = (function(label) { return function() { fired.push(label) } })(name)
        IBAction(bindings[name])(Page.prototype, name, {})
    }
    var controller = new Page()
    Bind.ibAction(controller)
    return controller
}

// One controller, one keydown on `platform`, the names of the methods that ran.
function pressed(platform, bindings, key, modifiers) {
    var fired = []
    var controller = bound(fired, bindings)
    try {
        onPlatform(platform, function() { keydown(key, modifiers) })
    } finally {
        controller._dispose()
    }
    return fired
}


test("macOS: a command key command fires on Cmd+F", function() {
    var bindings = {find: command + UIKeyCommand.input("f")}
    assert.deepEqual(pressed(mac, bindings, "f", {metaKey: true}), ["find"])
})

test("macOS: a command key command does not fire on Ctrl+F", function() {
    var bindings = {find: command + UIKeyCommand.input("f")}
    assert.deepEqual(pressed(mac, bindings, "f", {ctrlKey: true}), [])
})

test("macOS: a control key command fires on Ctrl+K and not on Cmd+K", function() {
    var bindings = {kill: control + UIKeyCommand.input("k")}
    assert.deepEqual(pressed(mac, bindings, "k", {ctrlKey: true}), ["kill"])
    assert.deepEqual(pressed(mac, bindings, "k", {metaKey: true}), [])
})

for (const platform of offApple) {
    test("on " + platform + " a command key command fires on Ctrl+F", function() {
        var bindings = {find: command + UIKeyCommand.input("f")}
        assert.deepEqual(pressed(platform, bindings, "f", {ctrlKey: true}), ["find"])
    })
}

test("on Windows a command key command does not fire on Win+F", function() {
    var bindings = {find: command + UIKeyCommand.input("f")}
    assert.deepEqual(pressed(windows, bindings, "f", {metaKey: true}), [])
})

test("on Windows a control key command still fires on Ctrl+K", function() {
    var bindings = {kill: control + UIKeyCommand.input("k")}
    assert.deepEqual(pressed(windows, bindings, "k", {ctrlKey: true}), ["kill"])
})

test("command and control together fire on Cmd+Ctrl+X on macOS and on no chord elsewhere", function() {
    var bindings = {both: command + control + UIKeyCommand.input("x")}
    assert.deepEqual(pressed(mac, bindings, "x", {metaKey: true, ctrlKey: true}), ["both"])
    assert.deepEqual(pressed(windows, bindings, "x", {ctrlKey: true}), [])
    assert.deepEqual(pressed(windows, bindings, "x", {metaKey: true, ctrlKey: true}), [])
})

test("a key command without modifiers fires whatever is held, on every platform", function() {
    var bindings = {close: UIKeyCommand.inputEscape}
    for (var systemName of [mac, windows, linux]) {
        assert.deepEqual(pressed(systemName, bindings, "Escape", {metaKey: true}), ["close"], systemName)
    }
})

test("on Windows command and shift fire on Ctrl+Shift+Space and not on Ctrl+Space", function() {
    var bindings = {toggle: command + shift + UIKeyCommand.input(" ")}
    assert.deepEqual(pressed(windows, bindings, " ", {ctrlKey: true, shiftKey: true}), ["toggle"])
    assert.deepEqual(pressed(windows, bindings, " ", {ctrlKey: true}), [])
})

test("a key command matched through the Control substitute still has its default action prevented", function() {
    var controller = bound([], {find: command + UIKeyCommand.input("f")})
    var event
    try {
        onPlatform(windows, function() { event = keydown("f", {ctrlKey: true}) })
    } finally {
        controller._dispose()
    }
    assert.equal(event.defaultPrevented, true)
})

test("a plain character key command is still swallowed by a focused text input, and command stays meta", function() {
    page("<input id=\"field\">")
    try {
        document.getElementById("field").focus()
        var bindings = {slash: UIKeyCommand.input("/")}
        for (var systemName of [mac, windows]) {
            assert.deepEqual(pressed(systemName, bindings, "/"), [], systemName)
            onPlatform(systemName, function() { assert.equal(UIKeyModifierFlags.command, "meta+") })
        }
    } finally {
        page("")
    }
})
