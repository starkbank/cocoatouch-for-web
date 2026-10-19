import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { CADisplayLink, RunLoop } from "../src/index.js"


// A stand-in for the browser's frame clock: callbacks queue until a test runs
// the frame, as requestAnimationFrame holds them, and cancel removes one.
function withFrames(run) {
    var queue = new Map()
    var next = 1
    var originalRequest = globalThis.requestAnimationFrame
    var originalCancel = globalThis.cancelAnimationFrame
    globalThis.requestAnimationFrame = function(callback) { queue.set(next, callback); return next++ }
    globalThis.cancelAnimationFrame = function(handle) { queue.delete(handle) }
    var frames = {
        get pending() { return queue.size },
        run: function(milliseconds) {
            var callbacks = [...queue.values()]
            queue.clear()
            callbacks.forEach((callback) => callback(milliseconds))
        },
    }
    try { run(frames) } finally {
        globalThis.requestAnimationFrame = originalRequest
        globalThis.cancelAnimationFrame = originalCancel
    }
}

function counter() {
    var target = {steps: []}
    target.step = function(link) { this.steps.push(link) }
    return target
}

test("RunLoop.main and RunLoop.Mode are tokens only, and nothing else of Apple's RunLoop is here", function() {
    assert.ok(RunLoop.main instanceof RunLoop)
    assert.equal(RunLoop.main, RunLoop.main)
    assert.notEqual(RunLoop.Mode.default, RunLoop.Mode.common)
    assert.deepEqual(Object.keys(RunLoop.Mode).sort(), ["common", "default"])
    assert.equal(Object.isFrozen(RunLoop.Mode), true)
    assert.equal(RunLoop.current, undefined)
    assert.equal(typeof RunLoop.main.run, "undefined")
    assert.throws(() => new RunLoop(), TypeError)
})

test("a display link does not tick before it is added", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        assert.equal(frames.pending, 0)
        assert.equal(link.isPaused, false)
        assert.equal(link.timestamp, 0)
        frames.run(16)
        assert.equal(target.steps.length, 0)
    })
})

test("an added link ticks once per frame on its target with itself as the argument, and sets timestamp, targetTimestamp and duration in seconds", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        assert.equal(frames.pending, 1)
        frames.run(1000)
        assert.equal(target.steps.length, 1)
        assert.equal(target.steps[0], link)
        assert.equal(link.timestamp, 1)
        assert.ok(Math.abs(link.duration - 1 / 60) < 1e-9, "the first frame has the nominal duration")
        assert.ok(Math.abs(link.targetTimestamp - (1 + 1 / 60)) < 1e-9)
        frames.run(1020)
        assert.equal(target.steps.length, 2)
        assert.equal(link.timestamp, 1.02)
        assert.ok(Math.abs(link.duration - 0.02) < 1e-9)
        assert.ok(Math.abs(link.targetTimestamp - 1.04) < 1e-9)
        assert.equal(frames.pending, 1)
    })
})

test("the selector may be the name of a method of the target", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: "step"})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.default})
        frames.run(10)
        assert.equal(target.steps.length, 1)
    })
})

test("adding twice, or in two modes, does not tick twice per frame", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.default})
        assert.equal(frames.pending, 1)
        frames.run(10)
        assert.equal(target.steps.length, 1)
        assert.equal(frames.pending, 1)
    })
})

test("remove stops the ticks once its last mode is removed, and add resumes them", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.default})
        link.remove({from: RunLoop.main, forMode: RunLoop.Mode.common})
        assert.equal(frames.pending, 1)
        link.remove({from: RunLoop.main, forMode: RunLoop.Mode.default})
        assert.equal(frames.pending, 0)
        frames.run(10)
        assert.equal(target.steps.length, 0)
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        frames.run(20)
        assert.equal(target.steps.length, 1)
    })
})

test("isPaused stops the ticks without removing the link, and unpausing resumes with a fresh duration", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        frames.run(1000)
        link.isPaused = true
        assert.equal(link.isPaused, true)
        assert.equal(frames.pending, 0)
        frames.run(1016)
        assert.equal(target.steps.length, 1)
        link.isPaused = true
        assert.equal(frames.pending, 0)
        link.isPaused = false
        assert.equal(frames.pending, 1)
        frames.run(9000)
        assert.equal(target.steps.length, 2)
        assert.ok(Math.abs(link.duration - 1 / 60) < 1e-9, "the time spent paused is not a frame")
    })
})

test("a link paused before it is added ticks only when it is added and unpaused", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.isPaused = true
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        assert.equal(frames.pending, 0)
        link.isPaused = false
        assert.equal(frames.pending, 1)
    })
})

test("invalidate cancels the next frame for good and releases the target and selector", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        frames.run(1000)
        link.invalidate()
        assert.equal(frames.pending, 0)
        frames.run(1016)
        assert.equal(target.steps.length, 1)
        assert.ok(!Object.values(link).includes(target), "the link holds no reference to its target")
        assert.ok(!Object.values(link).includes(target.step), "nor to its selector")
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        link.isPaused = false
        assert.equal(frames.pending, 0, "an invalidated link cannot be revived")
        link.invalidate()
    })
})

test("a selector that invalidates or pauses its own link ends the ticks that frame", function() {
    withFrames(function(frames) {
        var ticks = 0
        var target = {step: function(link) { ticks++; link.invalidate() }}
        var link = new CADisplayLink({target, selector: target.step})
        link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        frames.run(10)
        assert.equal(frames.pending, 0)
        frames.run(20)
        assert.equal(ticks, 1)
        var other = {step: function(link) { ticks++; link.isPaused = true }}
        var paused = new CADisplayLink({target: other, selector: other.step})
        paused.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
        frames.run(30)
        assert.equal(frames.pending, 0)
        assert.equal(ticks, 2)
    })
})

test("the constructor requires a target and a selector", function() {
    var target = counter()
    assert.throws(() => new CADisplayLink(), (error) => error instanceof TypeError && /CADisplayLink\(target:selector:\)/.test(error.message))
    assert.throws(() => new CADisplayLink({selector: target.step}), TypeError)
    assert.throws(() => new CADisplayLink({target}), TypeError)
    assert.throws(() => new CADisplayLink({target, selector: "missing"}), TypeError)
    assert.throws(() => new CADisplayLink({target: null, selector: target.step}), TypeError)
    assert.throws(() => new CADisplayLink({target, selector: 7}), TypeError)
})

test("add and remove refuse a run loop that is not the main one and a mode that is not a RunLoop.Mode, naming Apple's signature", function() {
    withFrames(function(frames) {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        assert.throws(() => link.add({to: {}, forMode: RunLoop.Mode.common}), (error) => error instanceof TypeError && /add\(to:forMode:\)/.test(error.message))
        assert.throws(() => link.add({to: RunLoop.main, forMode: "tracking"}), (error) => error instanceof TypeError && /add\(to:forMode:\)/.test(error.message))
        assert.throws(() => link.add({to: RunLoop.main}), TypeError)
        assert.throws(() => link.add({forMode: RunLoop.Mode.common}), TypeError)
        assert.throws(() => link.add(), TypeError)
        assert.throws(() => link.remove({from: {}, forMode: RunLoop.Mode.common}), (error) => error instanceof TypeError && /remove\(from:forMode:\)/.test(error.message))
        assert.throws(() => link.remove({from: RunLoop.main, forMode: "tracking"}), TypeError)
        assert.equal(frames.pending, 0)
    })
})

test("adding without requestAnimationFrame says what is missing", function() {
    var original = globalThis.requestAnimationFrame
    delete globalThis.requestAnimationFrame
    try {
        var target = counter()
        var link = new CADisplayLink({target, selector: target.step})
        assert.throws(() => link.add({to: RunLoop.main, forMode: RunLoop.Mode.common}), (error) => /requestAnimationFrame/.test(error.message))
    } finally {
        if (original) { globalThis.requestAnimationFrame = original }
    }
})
