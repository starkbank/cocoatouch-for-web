import test from "node:test"
import assert from "node:assert/strict"
import { automaticDimension, defaultEstimate, createRowHeights, effectiveHeight, offsetOf, rowAt, totalHeight, insert, measure, reset } from "../src/utils/rowheights.js"


// The same arithmetic written the slow way, from the public fields only, so the cached prefix sums are checked against something
// that cannot share their bug.
function bruteOffsets(heights) {
    var offsets = [0]
    for (var row = 0; row < heights.count; row++) { offsets.push(offsets[row] + effectiveHeight(heights, row)) }
    return offsets
}

function measured(count, entries, options) {
    var heights = createRowHeights(Object.assign({count: count}, options))
    for (var entry of entries) { measure(heights, entry[0], entry[1], entry[2]) }
    return heights
}


test("automaticDimension is Apple's raw value and nothing measured estimates 44", function() {
    assert.equal(automaticDimension, -1)
    assert.equal(defaultEstimate, 44)
    var heights = createRowHeights({count: 10})
    assert.equal(heights.estimatedRowHeight, automaticDimension)
    assert.equal(effectiveHeight(heights, 3), 44)
    assert.equal(totalHeight(heights), 440)
})

test("a measured row wins over every estimate", function() {
    var heights = measured(5, [[1, 95, "a"]], {estimatedRowHeight: 60, estimatedHeightForRow: function() { return 70 }})
    assert.equal(effectiveHeight(heights, 1), 95)
})

test("the delegate's estimate wins over estimatedRowHeight, and a number below zero means no answer", function() {
    var answers = {0: 70, 1: automaticDimension, 2: 0}
    var heights = createRowHeights({count: 4, estimatedRowHeight: 60, estimatedHeightForRow: function(row) { return answers[row] }})
    assert.equal(effectiveHeight(heights, 0), 70)
    assert.equal(effectiveHeight(heights, 1), 60)
    assert.equal(effectiveHeight(heights, 2), 0, "an explicit zero from the delegate is an answer")
    assert.equal(effectiveHeight(heights, 3), 60)
})

test("an explicit estimatedRowHeight wins over the measured means, and zero means no estimate", function() {
    var heights = measured(4, [[0, 100, "a"]], {estimatedRowHeight: 60})
    assert.equal(effectiveHeight(heights, 1), 60)
    var none = measured(4, [[0, 100, "a"]], {estimatedRowHeight: 0})
    assert.equal(effectiveHeight(none, 1), 0)
    assert.equal(totalHeight(none), 100)
})

test("with automaticDimension a row estimates as the mean of its identifier's measured rows", function() {
    var heights = measured(8, [[0, 100, "a"], [1, 50, "a"], [2, 30, "b"]])
    heights.identifiers[5] = "a"
    heights.identifiers[6] = "b"
    assert.equal(effectiveHeight(heights, 5), 75)
    assert.equal(effectiveHeight(heights, 6), 30)
})

test("a row whose identifier is unknown uses the dominant identifier, the one with most measurements", function() {
    var heights = measured(8, [[0, 100, "a"], [1, 50, "a"], [2, 30, "b"]])
    assert.equal(heights.dominantIdentifier, "a")
    assert.equal(effectiveHeight(heights, 7), 75, "never dequeued")
    heights.identifiers[7] = "c"
    assert.equal(effectiveHeight(heights, 7), 75, "an identifier with no measurement yet")
})

test("the dominant identifier changes when another identifier overtakes it, and a tie keeps the earlier one", function() {
    var heights = measured(10, [[0, 100, "a"], [1, 10, "b"]])
    assert.equal(heights.dominantIdentifier, "a")
    measure(heights, 2, 10, "b")
    assert.equal(heights.dominantIdentifier, "b")
})

test("a measured height of zero is unmeasured but still records the identifier", function() {
    var heights = measured(4, [[2, 0, "a"]])
    assert.equal(effectiveHeight(heights, 2), 44)
    assert.equal(heights.identifiers[2], "a")
    assert.equal(heights.estimates.size, 0)
    assert.equal(heights.dominantIdentifier, undefined)
})

test("measuring a row again replaces its contribution to the estimate, and measuring it as zero removes it", function() {
    var heights = measured(6, [[0, 100, "a"], [1, 50, "a"]])
    measure(heights, 0, 40, "a")
    assert.equal(heights.estimates.get("a").count, 2)
    assert.equal(effectiveHeight(heights, 5), 45)
    measure(heights, 1, 0, "a")
    assert.equal(heights.estimates.get("a").count, 1)
    assert.equal(effectiveHeight(heights, 5), 40)
    measure(heights, 0, 0, "a")
    assert.equal(heights.estimates.has("a"), false, "an identifier with no measurement is forgotten")
    assert.equal(heights.dominantIdentifier, undefined)
    assert.equal(effectiveHeight(heights, 5), 44)
})

test("re-measuring a row under another identifier moves its contribution", function() {
    var heights = measured(6, [[0, 100, "a"], [1, 50, "b"], [2, 60, "b"]])
    assert.equal(heights.dominantIdentifier, "b")
    measure(heights, 1, 20, "a")
    assert.equal(heights.estimates.get("a").count, 2)
    assert.equal(heights.estimates.get("b").count, 1)
    assert.equal(heights.dominantIdentifier, "a")
})

test("offsetOf, totalHeight and rowAt agree at every boundary", function() {
    var heights = measured(4, [[0, 10, "a"], [1, 20, "a"], [2, 30, "a"], [3, 40, "a"]])
    assert.deepEqual([0, 1, 2, 3, 4].map(function(row) { return offsetOf(heights, row) }), [0, 10, 30, 60, 100])
    assert.equal(totalHeight(heights), 100)
    var cases = [[-5, 0], [0, 0], [9.99, 0], [10, 1], [29.5, 1], [30, 2], [59.99, 2], [60, 3], [99.99, 3], [100, 3], [5000, 3]]
    for (var entry of cases) { assert.equal(rowAt(heights, entry[0]), entry[1], "y = " + entry[0]) }
})

test("rowAt on an empty table is -1 and totalHeight is 0", function() {
    var heights = createRowHeights({count: 0})
    assert.equal(rowAt(heights, 0), -1)
    assert.equal(totalHeight(heights), 0)
    assert.equal(offsetOf(heights, 0), 0)
})

test("rowAt skips zero-height rows: the row at an offset is the one that has height there", function() {
    var heights = measured(5, [[0, 10, "a"], [3, 10, "a"], [4, 10, "a"]], {estimatedRowHeight: 0})
    assert.deepEqual([0, 1, 2, 3, 4].map(function(row) { return offsetOf(heights, row) }), [0, 10, 10, 10, 20])
    assert.equal(rowAt(heights, 9), 0)
    assert.equal(rowAt(heights, 10), 3)
    assert.equal(rowAt(heights, 20), 4)
})

test("a measurement below the first unmeasured row, with an explicit estimate, dirties only from that row", function() {
    var heights = createRowHeights({count: 1000, estimatedRowHeight: 60})
    assert.equal(totalHeight(heights), 60000)
    assert.equal(heights.dirtyFrom, 1000, "clean after a read")
    measure(heights, 900, 95, "a")
    assert.equal(heights.dirtyFrom, 900)
    assert.equal(offsetOf(heights, 900), 54000)
    assert.equal(heights.dirtyFrom, 1000)
    assert.equal(totalHeight(heights), 60035)
})

test("a measurement that moves a mean dirties every row, and one that does not moves only its own", function() {
    var heights = createRowHeights({count: 100})
    totalHeight(heights)
    measure(heights, 50, 95, "a")
    assert.equal(heights.dirtyFrom, 0, "the unmeasured rows' estimate went from 44 to 95")
    totalHeight(heights)
    measure(heights, 60, 95, "a")
    assert.equal(heights.dirtyFrom, 60, "the mean is still 95")
    totalHeight(heights)
    measure(heights, 70, 95, "a")
    measure(heights, 71, 35, "a")
    assert.equal(heights.dirtyFrom, 0)
})

test("the cached offsets equal a brute-force sum after any mix of measure, insert and reset", function() {
    var seed = 7
    var next = function(limit) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit }
    var heights = createRowHeights({count: 40})
    for (var step = 0; step < 400; step++) {
        var action = next(10)
        if (action < 6) { measure(heights, next(heights.count), next(5) === 0 ? 0 : 20 + next(80), ["a", "b", "c"][next(3)]) }
        if (action === 6) { insert(heights, [next(heights.count + 1)]) }
        if (action === 7 && heights.count > 5) { reset(heights, {count: heights.count - 3, keepEstimates: next(2) === 0}) }
        if (action === 8) { assert.equal(offsetOf(heights, next(heights.count + 1)) >= 0, true) }
        if (action === 9) { heights.estimatedRowHeight = [automaticDimension, 0, 60][next(3)]; heights.dirtyFrom = 0 }
        var expected = bruteOffsets(heights)
        assert.equal(totalHeight(heights), expected[heights.count], "total at step " + step)
        var row = next(heights.count + 1)
        assert.equal(offsetOf(heights, row), expected[row], "offset of " + row + " at step " + step)
        assert.equal(heights.heights.length, heights.count)
        assert.equal(heights.identifiers.length, heights.count)
    }
})

test("insert splices unmeasured rows at their final positions and shifts heights and identifiers", function() {
    var heights = measured(4, [[0, 10, "a"], [1, 20, "b"], [2, 30, "a"], [3, 40, "b"]])
    totalHeight(heights)
    insert(heights, [2, 5])
    assert.equal(heights.count, 6)
    assert.deepEqual(heights.heights.map(function(height) { return Number.isNaN(height) ? null : height }), [10, 20, null, 30, 40, null])
    assert.deepEqual(heights.identifiers, ["a", "b", undefined, "a", "b", undefined])
    assert.equal(heights.dirtyFrom, 2)
    assert.equal(offsetOf(heights, 3), 10 + 20 + effectiveHeight(heights, 2))
    assert.equal(heights.estimates.get("a").count, 2, "measured rows keep their contribution")
})

test("insert at the end appends, at the start prepends, and several rows at once keep order", function() {
    var heights = measured(2, [[0, 10, "a"], [1, 20, "a"]])
    insert(heights, [2, 3])
    assert.deepEqual(heights.heights.slice(0, 2), [10, 20])
    assert.equal(heights.count, 4)
    insert(heights, [0])
    assert.equal(Number.isNaN(heights.heights[0]), true)
    assert.deepEqual(heights.heights.slice(1, 3), [10, 20])
    assert.equal(heights.dirtyFrom, 0)
})

test("reset drops the measured heights and identifiers and sets the new count; the estimates stay only on request", function() {
    var heights = measured(6, [[0, 100, "a"], [1, 100, "a"]])
    totalHeight(heights)
    reset(heights, {count: 3, keepEstimates: true})
    assert.equal(heights.count, 3)
    assert.equal(heights.heights.every(Number.isNaN), true)
    assert.deepEqual(heights.identifiers, [undefined, undefined, undefined])
    assert.equal(effectiveHeight(heights, 0), 100, "page 2 is estimated from page 1's cells")
    assert.equal(heights.dominantIdentifier, "a")
    assert.equal(totalHeight(heights), 300)
    reset(heights, {count: 3, keepEstimates: false})
    assert.equal(heights.estimates.size, 0)
    assert.equal(heights.dominantIdentifier, undefined)
    assert.equal(totalHeight(heights), 132)
})

test("a large table costs a lookup, not a rebuild: 100000 rows, 2000 lookups after one measurement", function() {
    var heights = createRowHeights({count: 100000, estimatedRowHeight: 50})
    totalHeight(heights)
    measure(heights, 99990, 80, "a")
    var started = process.hrtime.bigint()
    for (var step = 0; step < 2000; step++) { rowAt(heights, step * 2400) }
    var elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
    assert.equal(heights.dirtyFrom, 100000)
    assert.ok(elapsedMs < 200, "took " + elapsedMs + " ms")
    assert.equal(rowAt(heights, 2400 * 1000), 48000)
})
