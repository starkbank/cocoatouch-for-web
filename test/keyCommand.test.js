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

test("one control binding command and control on the same chord runs only the control method off Apple", function() {
    var bindings = {viaCommand: command + UIKeyCommand.input("k"), viaControl: control + UIKeyCommand.input("k")}
    for (var systemName of offApple) {
        assert.deepEqual(pressed(systemName, bindings, "k", {ctrlKey: true}), ["viaControl"], systemName)
    }
})

test("on macOS one control binding command and control on the same key runs each on its own chord", function() {
    var bindings = {viaCommand: command + UIKeyCommand.input("k"), viaControl: control + UIKeyCommand.input("k")}
    assert.deepEqual(pressed(mac, bindings, "k", {metaKey: true}), ["viaCommand"])
    assert.deepEqual(pressed(mac, bindings, "k", {ctrlKey: true}), ["viaControl"])
})

test("two methods bound to the identical chord on one control both fire, on macOS and off", function() {
    var chord = control + UIKeyCommand.input("k")
    var bindings = {first: chord, second: chord}
    for (var systemName of [mac, windows]) {
        assert.deepEqual(pressed(systemName, bindings, "k", {ctrlKey: true}).sort(), ["first", "second"], systemName)
    }
    var commandChord = command + UIKeyCommand.input("k")
    assert.deepEqual(pressed(windows, {first: commandChord, second: commandChord}, "k", {ctrlKey: true}).sort(), ["first", "second"])
})

test("a plain binding is no twin of a command binding: both run on Ctrl+F off Apple", function() {
    var bindings = {typed: UIKeyCommand.input("f"), find: command + UIKeyCommand.input("f")}
    assert.deepEqual(pressed(windows, bindings, "f", {ctrlKey: true}).sort(), ["find", "typed"])
})

test("a command binding on one control and a control binding on another both fire off Apple", function() {
    var fired = []
    var first = bound(fired, {viaCommand: command + UIKeyCommand.input("k")})
    var second = bound(fired, {viaControl: control + UIKeyCommand.input("k")})
    try {
        onPlatform(windows, function() { keydown("k", {ctrlKey: true}) })
    } finally {
        first._dispose()
        second._dispose()
    }
    assert.deepEqual(fired.sort(), ["viaCommand", "viaControl"])
})

test("with focus inside the control, one Ctrl+K off Apple still runs only the control method", function() {
    page("<div id=\"panel\"><input id=\"field\"></div>")
    var fired = []
    var controller = bound(fired, {viaCommand: command + UIKeyCommand.input("k"), viaControl: control + UIKeyCommand.input("k")})
    controller.selector = "#panel"
    try {
        document.getElementById("field").focus()
        onPlatform(windows, function() { keydown("k", {ctrlKey: true}) })
    } finally {
        controller._dispose()
        page("")
    }
    assert.deepEqual(fired, ["viaControl"])
})


// A text input is the first responder here: the focused element is what the
// dispatcher reads as the first responder.
function typingInto(html, run) {
    page("<div id=\"host\">" + html + "</div>")
    var element = document.querySelector("#host input, #host textarea")
    element.focus()
    run(element)
}

function backspace() {
    return keydown("Backspace")
}

function forwardDelete() {
    return keydown("Delete")
}

// Backspace has no named constant on Apple: it is the input string "\u{8}".
const backspaceInput = UIKeyCommand.input("\b")

test("inputDelete is the forward Delete key, the \\b input is Backspace, and wantsPriorityOverSystemBehavior is a flag before the input", function() {
    assert.equal(UIKeyCommand.inputDelete, UIKeyCommand.input("Delete"))
    assert.equal(UIKeyCommand.inputDelete, "keyboard:Delete")
    assert.equal(backspaceInput, UIKeyCommand.input("Backspace"))
    assert.equal(backspaceInput, "keyboard:Backspace")
    assert.equal(UIKeyCommand.wantsPriorityOverSystemBehavior + UIKeyCommand.inputDelete, "priority+keyboard:Delete")
    assert.equal(UIKeyCommand.wantsPriorityOverSystemBehavior + backspaceInput, "priority+keyboard:Backspace")
    assert.equal(UIKeyCommand.input("k"), "keyboard:k")
})

test("outside a text input inputDelete fires on forward Delete and not on Backspace, and the \\b input the other way round", function() {
    page("<div id=\"host\"></div>")
    var fired = []
    var controller = bound(fired, {forward: UIKeyCommand.inputDelete, backward: backspaceInput})
    var onDelete = forwardDelete()
    assert.deepEqual(fired, ["forward"])
    assert.equal(onDelete.defaultPrevented, true)
    fired.length = 0
    var onBackspace = backspace()
    controller._dispose()
    assert.deepEqual(fired, ["backward"])
    assert.equal(onBackspace.defaultPrevented, true)
})

test("a delete key is consumed by a focused text input, so an ordinary command on it does not fire and nothing is prevented", function() {
    typingInto("<input id=\"field\">", function() {
        var fired = []
        var controller = bound(fired, {forward: UIKeyCommand.inputDelete, backward: backspaceInput})
        var onDelete = forwardDelete()
        var onBackspace = backspace()
        controller._dispose()
        assert.deepEqual(fired, [])
        assert.equal(onDelete.defaultPrevented, false)
        assert.equal(onBackspace.defaultPrevented, false)
    })
})

test("a command that wants priority fires from a text input on its own delete key and prevents it when its method acted", function() {
    typingInto("<input id=\"field\">", function() {
        var fired = []
        var controller = bound(fired, {
            forward: UIKeyCommand.wantsPriorityOverSystemBehavior + UIKeyCommand.inputDelete,
            backward: UIKeyCommand.wantsPriorityOverSystemBehavior + backspaceInput,
        })
        var onBackspace = backspace()
        assert.deepEqual(fired, ["backward"])
        assert.equal(onBackspace.defaultPrevented, true)
        fired.length = 0
        var onDelete = forwardDelete()
        controller._dispose()
        assert.deepEqual(fired, ["forward"])
        assert.equal(onDelete.defaultPrevented, true)
    })
})

test("a command that wants priority and declines, returning false, leaves the delete to the input", function() {
    typingInto("<input id=\"field\">", function() {
        class Page extends UIViewController {
            deleted() { return false }
            deletedForward() { return false }
        }
        IBAction(UIKeyCommand.wantsPriorityOverSystemBehavior + backspaceInput)(Page.prototype, "deleted", {})
        IBAction(UIKeyCommand.wantsPriorityOverSystemBehavior + UIKeyCommand.inputDelete)(Page.prototype, "deletedForward", {})
        var controller = new Page()
        Bind.ibAction(controller)
        var onBackspace = backspace()
        var onDelete = forwardDelete()
        controller._dispose()
        assert.equal(onBackspace.defaultPrevented, false)
        assert.equal(onDelete.defaultPrevented, false)
    })
})

test("a priority command prevents nothing of other keys, and an ordinary command on the same key still prevents", function() {
    typingInto("<input id=\"field\">", function() {
        var fired = []
        var controller = bound(fired, {
            priority: UIKeyCommand.wantsPriorityOverSystemBehavior + backspaceInput,
            plain: UIKeyCommand.inputEscape,
        })
        var event = keydown("Escape")
        controller._dispose()
        assert.deepEqual(fired, ["plain"])
        assert.equal(event.defaultPrevented, true)
    })
})

test("outside a text input the delete keys fire an ordinary command, with or without priority", function() {
    page("<div id=\"host\"></div>")
    var fired = []
    var controller = bound(fired, {
        plain: backspaceInput,
        priority: UIKeyCommand.wantsPriorityOverSystemBehavior + backspaceInput,
    })
    var event = backspace()
    controller._dispose()
    assert.deepEqual(fired.sort(), ["plain", "priority"])
    assert.equal(event.defaultPrevented, true)
})

test("a priority command on a character fires from a text input, where an ordinary one is typed", function() {
    typingInto("<input id=\"field\">", function() {
        var fired = []
        var controller = bound(fired, {
            typed: UIKeyCommand.input("k"),
            priority: UIKeyCommand.wantsPriorityOverSystemBehavior + UIKeyCommand.input("k"),
        })
        keydown("k")
        controller._dispose()
        assert.deepEqual(fired, ["priority"])
    })
})
