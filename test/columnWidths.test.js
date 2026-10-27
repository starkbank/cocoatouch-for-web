import test from "node:test"
import assert from "node:assert/strict"
import { createColumnWidths, finiteWidth, replaySpans, reset, need, noteSignature, record, invalidate, insert, skeleton, otherSignatures, aggregate, pending, pendingCount, settle } from "../src/utils/columnwidths.js"


const sig = "td||1,td||1"

// The same aggregate written the slow way: the maximum per column over the counted records outside the window.
function bruteAggregate(widths, {from, to}) {
    var out = {min: [], max: []}
    var skeletonSignature = skeleton(widths)
    widths.records.forEach(function(entry, row) {
        if (entry === undefined || (row >= from && row < to) || widths.signatures[row] !== skeletonSignature) { return }
        for (var kind of ["min", "max"]) {
            entry[kind].forEach(function(value, column) { out[kind][column] = Math.max(out[kind][column] || 0, value) })
        }
    })
    return out
}

function measured(rows, {signature = sig} = {}) {
    var widths = createColumnWidths()
    for (var [row, min, max] of rows) { record(widths, {row, generation: widths.generation, signature, min, max}) }
    return widths
}


test("aggregate is the widest min-content and max-content per column over the recorded rows", function() {
    var widths = measured([[0, [10, 20], [30, 50]], [1, [15, 5], [25, 90]], [2, [1, 1], [1, 1]]])
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [15, 20], max: [30, 90]})
})

test("rows inside the window are left out of the aggregate", function() {
    var widths = measured([[0, [10, 20], [30, 50]], [1, [15, 5], [25, 90]], [2, [1, 1], [1, 1]]])
    assert.deepEqual(aggregate(widths, {from: 1, to: 2}), {min: [10, 20], max: [30, 50]})
})

test("the aggregate matches the brute-force maximum over many rows, windows and blocks", function() {
    var widths = createColumnWidths()
    var seed = 7
    var random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (var row = 0; row < 300; row++) {
        record(widths, {row, generation: 0, signature: sig, min: [Math.floor(random() * 100), Math.floor(random() * 100)], max: [Math.floor(random() * 500), Math.floor(random() * 500)]})
    }
    for (var window of [{from: 0, to: 0}, {from: 0, to: 40}, {from: 100, to: 131}, {from: 250, to: 300}, {from: 63, to: 65}]) {
        assert.deepEqual(aggregate(widths, window), bruteAggregate(widths, window))
    }
})

test("insert shifts the records and the signatures of the rows after it", function() {
    var widths = measured([[0, [1], [10]], [1, [2], [20]], [2, [3], [30]]], {signature: "td||1"})
    insert(widths, [1])
    assert.equal(widths.records[0].max[0], 10)
    assert.equal(widths.records[1], undefined)
    assert.equal(widths.records[2].max[0], 20)
    assert.equal(widths.records[3].max[0], 30)
    assert.equal(widths.signatures[1], undefined)
    assert.equal(widths.signatures[3], "td||1")
    assert.deepEqual(aggregate(widths, {from: 2, to: 3}), {min: [3], max: [30]})
})

test("an append past the last row touches no record and rebuilds nothing", function() {
    var widths = measured([[0, [1], [10]], [1, [2], [20]]], {signature: "td||1"})
    aggregate(widths, {from: 0, to: 0})
    var rebuilds = widths.stats.fullRebuilds
    for (var round = 0; round < 10; round++) {
        var first = 2 + round * 100
        insert(widths, Array.from({length: 100}, (_, i) => first + i))
        need(widths, Array.from({length: 100}, (_, i) => first + i))
        for (var row = first; row < first + 100; row++) { record(widths, {row, generation: 0, signature: "td||1", min: [row % 7], max: [row % 50]}) }
        aggregate(widths, {from: 0, to: 0})
    }
    assert.equal(widths.stats.fullRebuilds, rebuilds)
    assert.equal(widths.stats.blockRebuilds, 0)
})

test("invalidate drops a record and the maximum it held", function() {
    var widths = measured([[0, [1], [10]], [1, [2], [99]]], {signature: "td||1"})
    invalidate(widths, [1])
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [1], max: [10]})
    assert.equal(widths.stats.blockRebuilds, 1)
})

test("a record from an older generation is ignored", function() {
    var widths = createColumnWidths()
    var stale = widths.generation
    reset(widths)
    assert.equal(record(widths, {row: 0, generation: stale, signature: sig, min: [1, 1], max: [9, 9]}), false)
    assert.equal(widths.records[0], undefined)
    assert.equal(record(widths, {row: 0, generation: widths.generation, signature: sig, min: [1, 1], max: [9, 9]}), true)
})

test("reset keeps the floor until its own generation's last pending row lands", function() {
    var widths = measured([[0, [4, 4], [40, 40]]])
    var previous = aggregate(widths, {from: 0, to: 0})
    reset(widths, {floor: previous})
    need(widths, [0, 1, 2])
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [4, 4], max: [40, 40]})
    record(widths, {row: 0, generation: widths.generation, signature: sig, min: [1, 1], max: [5, 5]})
    record(widths, {row: 1, generation: widths.generation, signature: sig, min: [1, 1], max: [6, 6]})
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [4, 4], max: [40, 40]}, "row 2 is still pending")
    record(widths, {row: 2, generation: widths.generation, signature: sig, min: [2, 2], max: [7, 7]})
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [2, 2], max: [7, 7]}, "the last chunk dropped the floor")
})

test("a stale chunk does not drop or satisfy the floor of the generation in force", function() {
    var widths = createColumnWidths()
    var older = widths.generation
    reset(widths, {floor: {min: [3], max: [30]}})
    need(widths, [0, 1])
    record(widths, {row: 0, generation: older, signature: "td||1", min: [1], max: [2]})
    record(widths, {row: 1, generation: older, signature: "td||1", min: [1], max: [2]})
    assert.equal(pendingCount(widths), 2)
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [3], max: [30]})
})

test("a floor is dropped at once when nothing is pending", function() {
    var widths = createColumnWidths()
    reset(widths, {floor: {min: [3], max: [30]}})
    settle(widths)
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [], max: []})
})

test("a second reset replaces the floor with its own and never revives an earlier one", function() {
    var widths = createColumnWidths()
    reset(widths, {floor: {min: [9], max: [90]}})
    need(widths, [0])
    reset(widths, {floor: {min: [5], max: [50]}})
    need(widths, [0])
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [5], max: [50]})
})

test("insert shifts the pending rows, and each row is measured once per generation", function() {
    var widths = createColumnWidths()
    need(widths, [3, 4, 5])
    insert(widths, [1, 2])
    assert.deepEqual(pending(widths, {from: 0, to: 0}).sort((a, b) => a - b), [5, 6, 7])
    need(widths, [1, 2])
    record(widths, {row: 5, generation: widths.generation, signature: sig, min: [1], max: [1]})
    need(widths, [5])
    assert.deepEqual(pending(widths, {from: 0, to: 0}).sort((a, b) => a - b), [1, 2, 6, 7], "a recorded row is not asked again")
})

test("pending is ordered by distance from the window, and limited", function() {
    var widths = createColumnWidths()
    need(widths, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.deepEqual(pending(widths, {from: 4, to: 6}), [3, 6, 2, 7, 1, 8, 0, 9])
    assert.deepEqual(pending(widths, {from: 4, to: 6, limit: 3}), [3, 6, 2])
    assert.deepEqual(pending(widths, {from: 0, to: 2, limit: 3}), [2, 3, 4])
})

test("rows with a foreign signature stay out of the aggregate and are counted", function() {
    var widths = createColumnWidths()
    for (var row = 0; row < 4; row++) { record(widths, {row, generation: 0, signature: "td||1,td||1", min: [row], max: [row * 10]}) }
    record(widths, {row: 4, generation: 0, signature: "td||2", min: [500], max: [900]})
    assert.equal(skeleton(widths), "td||1,td||1")
    assert.equal(otherSignatures(widths), 1)
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [3], max: [30]})
})

test("the skeleton is the majority signature, a tie going to the earliest row", function() {
    var widths = createColumnWidths()
    noteSignature(widths, 0, "b")
    noteSignature(widths, 1, "a")
    assert.equal(skeleton(widths), "b")
    noteSignature(widths, 2, "a")
    assert.equal(skeleton(widths), "a")
    noteSignature(widths, 3, "b")
    assert.equal(skeleton(widths), "b", "2 against 2: the earliest row's signature")
})

test("the skeleton follows a change of majority and the aggregate follows the skeleton", function() {
    var widths = createColumnWidths()
    record(widths, {row: 0, generation: 0, signature: "a", min: [1], max: [10]})
    record(widths, {row: 1, generation: 0, signature: "b", min: [2], max: [200]})
    record(widths, {row: 2, generation: 0, signature: "b", min: [3], max: [300]})
    assert.equal(skeleton(widths), "b")
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [3], max: [300]})
    noteSignature(widths, 3, "a")
    noteSignature(widths, 4, "a")
    assert.equal(skeleton(widths), "a")
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}), {min: [1], max: [10]})
    assert.equal(otherSignatures(widths), 2)
})

test("a measured width that is not finite or is negative is recorded as 0", function() {
    var widths = createColumnWidths()
    record(widths, {row: 0, generation: 0, signature: "a", min: [NaN, -4, Infinity, 7], max: [Infinity, 12, -Infinity, NaN]})
    assert.deepEqual(widths.records[0], {min: [0, 0, 0, 7], max: [0, 12, 0, 0]})
    assert.equal(finiteWidth("12"), 0)
    assert.equal(finiteWidth(undefined), 0)
})

test("the aggregate is updated in O(columns) by a record and rebuilt only when a maximum shrinks", function() {
    var widths = createColumnWidths()
    for (var row = 0; row < 200; row++) { record(widths, {row, generation: 0, signature: "a", min: [row % 9], max: [row]}) }
    aggregate(widths, {from: 0, to: 0})
    assert.equal(widths.stats.fullRebuilds, 0)
    assert.equal(widths.stats.blockRebuilds, 0)
    invalidate(widths, [199])
    assert.deepEqual(aggregate(widths, {from: 0, to: 0}).max, [198])
    assert.equal(widths.stats.blockRebuilds, 1)
    assert.equal(widths.stats.fullRebuilds, 0)
})

test("replaySpans: every span is at most the min, one is exactly the min, and they add up to the max", function() {
    var plan = replaySpans(40, 900)
    assert.equal(plan.widths.length, 23)
    assert.ok(plan.widths.every((width) => width <= 40))
    assert.ok(plan.widths.includes(40))
    assert.equal(plan.widths.reduce((total, width) => total + width, 0), 900)
    assert.equal(plan.k, 23)
    assert.equal(plan.ceiled, false)
    assert.deepEqual(replaySpans(0, 50).widths, [])
    assert.deepEqual(replaySpans(NaN, 50).widths, [])
    assert.deepEqual(replaySpans(30, 10).widths, [30], "a max under the min is the min")
})

test("replaySpans past 1024 spans widens them to ceil(max / 1024) and reports it", function() {
    var plan = replaySpans(1, 9000)
    assert.equal(plan.k, 9000)
    assert.equal(plan.ceiled, true)
    assert.equal(plan.widths.length, 1000)
    assert.ok(plan.widths.every((width) => width === 9))
    assert.equal(plan.widths.reduce((total, width) => total + width, 0), 9000)
    var uneven = replaySpans(1, 9001)
    assert.ok(uneven.widths.length <= 1024)
    assert.equal(uneven.widths.reduce((total, width) => total + width, 0), 9001)
    assert.equal(Math.max(...uneven.widths), 9)
})
