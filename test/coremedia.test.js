import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { CMTime, CMTimeCompare } from "../src/index.js"


test("CMTime(value:timescale:) and CMTime(seconds:preferredTimescale:) agree on seconds and keep ticks exact", function() {
    var ticks = new CMTime({value: 900, timescale: 600})
    assert.equal(ticks.seconds, 1.5)
    assert.equal(ticks.isValid, true)
    assert.equal(ticks.isNumeric, true)
    var fromSeconds = new CMTime({seconds: 1.5, preferredTimescale: 600})
    assert.equal(fromSeconds.value, 900)
    assert.equal(fromSeconds.timescale, 600)
    assert.equal(fromSeconds.hasBeenRounded, false)
    var rounded = new CMTime({seconds: 1 / 3, preferredTimescale: 10})
    assert.equal(rounded.value, 3)
    assert.equal(rounded.hasBeenRounded, true)
    assert.throws(() => new CMTime({seconds: 1}), TypeError)
})

test("the special times carry their flags, and only numeric times have seconds", function() {
    assert.equal(CMTime.zero.seconds, 0)
    assert.equal(CMTime.invalid.isValid, false)
    assert.ok(Number.isNaN(CMTime.invalid.seconds))
    assert.equal(CMTime.indefinite.isIndefinite, true)
    assert.ok(Number.isNaN(CMTime.indefinite.seconds))
    assert.equal(CMTime.positiveInfinity.seconds, Infinity)
    assert.equal(CMTime.negativeInfinity.seconds, -Infinity)
    assert.equal(CMTime.positiveInfinity.isNumeric, false)
    assert.equal(new CMTime({seconds: NaN, preferredTimescale: 600}).isValid, false)
    assert.equal(new CMTime({seconds: Infinity, preferredTimescale: 600}).isPositiveInfinity, true)
})

test("CMTimeCompare orders across timescales and puts infinities, indefinite and invalid at the edges", function() {
    assert.equal(CMTimeCompare(new CMTime({value: 1, timescale: 2}), new CMTime({value: 300, timescale: 600})), 0)
    assert.equal(CMTimeCompare(new CMTime({value: 1, timescale: 3}), new CMTime({value: 1, timescale: 2})), -1)
    assert.equal(CMTimeCompare(CMTime.positiveInfinity, new CMTime({value: 10, timescale: 1})), 1)
    assert.equal(CMTimeCompare(CMTime.negativeInfinity, CMTime.zero), -1)
    assert.equal(CMTimeCompare(CMTime.indefinite, CMTime.positiveInfinity), 1)
    assert.equal(CMTimeCompare(CMTime.invalid, CMTime.indefinite), 1)
})
