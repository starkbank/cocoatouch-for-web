// UITableView.automaticDimension's raw value on Apple's side.
export const automaticDimension = -1

// What a row estimates as when nothing has been measured and no estimate was given: the pre-iOS 11 default row height, 44 pt = 44 px.
export const defaultEstimate = 44

// The height model of a table: what every row is believed to measure, as prefix sums a binary search can walk. It is plain data
// with module functions over it, and it never touches the document, so the arithmetic is tested without a layout.
//
// heights[row]       measured height, NaN while unmeasured
// identifiers[row]   the reuse identifier last measured for the row, undefined until then
// estimates          Map(identifier -> {sum, count}) of the positive heights measured under that identifier
// dominantIdentifier the identifier with most measurements (the earlier one on a tie), undefined with none
// offsets            offsets[row] is the top of the row and offsets[count] the total; valid for rows 0...dirtyFrom
// dirtyFrom          the lowest row whose offset may be stale; count when the prefix sums are clean
export function createRowHeights({count, estimatedRowHeight = automaticDimension, estimatedHeightForRow = null}) {
    return {
        count: count,
        estimatedRowHeight: estimatedRowHeight,
        estimatedHeightForRow: estimatedHeightForRow,
        heights: new Array(count).fill(NaN),
        identifiers: new Array(count).fill(undefined),
        estimates: new Map(),
        dominantIdentifier: undefined,
        offsets: [0],
        dirtyFrom: 0,
    }
}

// First match wins: measured, the delegate's estimate, an explicit estimatedRowHeight, the mean of the row's identifier, the mean of
// the dominant identifier, 44. A delegate answer below zero (automaticDimension) is no answer.
export function effectiveHeight(heights, row) {
    var measuredHeight = heights.heights[row]
    if (!Number.isNaN(measuredHeight)) { return measuredHeight }
    var delegateHeight = heights.estimatedHeightForRow ? heights.estimatedHeightForRow(row) : undefined
    if (typeof delegateHeight === "number" && delegateHeight >= 0) { return delegateHeight }
    if (heights.estimatedRowHeight >= 0) { return heights.estimatedRowHeight }
    return _meanEstimate(heights, heights.identifiers[row])
}

export function offsetOf(heights, row) {
    _rebuild(heights)
    return heights.offsets[row]
}

export function totalHeight(heights) {
    _rebuild(heights)
    return heights.offsets[heights.count]
}

// The last row that starts at or before y, so a zero-height row never owns an offset another row has height at; y below the table is
// row 0, y past its end the last row, and -1 for a table with no rows.
export function rowAt(heights, y) {
    _rebuild(heights)
    var low = 0
    var high = heights.count - 1
    while (low < high) {
        var middle = (low + high + 1) >> 1
        if (heights.offsets[middle] <= y) { low = middle } else { high = middle - 1 }
    }
    return high
}

// The first row that ends past y, so a window starting here never begins on a zero-height row that ends at or before y, where `rowAt`
// answers the last row of an equal-offset run (999 of 1000 with nothing measured and no estimate). When no row ends past y it is the
// first row of the trailing zero-height run, which is the first unmeasured row when estimates are off, and the count when the last row
// has height. Equal to `rowAt` for a y inside a table whose rows all have height.
export function firstRowAt(heights, y) {
    _rebuild(heights)
    if (heights.count === 0) { return 0 }
    var offsets = heights.offsets
    var total = offsets[heights.count]
    if (y < total) { return _lowerBound(offsets, 1, heights.count, function(offset) { return offset > y }) - 1 }
    return _lowerBound(offsets, 0, heights.count, function(offset) { return offset >= total })
}

// `rows` are the inserted rows' positions after the insertion, ascending, as insertRows(at:) names them. The rows around them keep
// their measurement and identifier, so the estimates, which count measured rows only, are untouched.
export function insert(heights, rows) {
    if (rows.length === 0) { return }
    var count = heights.count + rows.length
    var merged = new Array(count)
    var mergedIdentifiers = new Array(count)
    var inserted = new Set(rows)
    var source = 0
    for (var row = 0; row < count; row++) {
        if (inserted.has(row)) {
            merged[row] = NaN
            mergedIdentifiers[row] = undefined
            continue
        }
        merged[row] = heights.heights[source]
        mergedIdentifiers[row] = heights.identifiers[source]
        source++
    }
    heights.count = count
    heights.heights = merged
    heights.identifiers = mergedIdentifiers
    heights.dirtyFrom = Math.min(heights.dirtyFrom, rows[0])
}

// A height of zero is a row the cell hides, or a document with no layout: it counts as unmeasured but still names the identifier.
export function measure(heights, row, height, identifier) {
    var previous = heights.identifiers[row]
    var before = _estimateSignature(heights, previous, identifier)
    _forget(heights, row)
    heights.identifiers[row] = identifier
    _remember(heights, row, height)
    heights.dirtyFrom = Math.min(heights.dirtyFrom, row)
    if (heights.estimatedRowHeight >= 0 || before === _estimateSignature(heights, previous, identifier)) { return }
    heights.dirtyFrom = 0
}

// reloadData drops what was measured because the rows are new data, and keeps the estimates so page 2 starts from page 1's cells;
// a width change drops both because responsive layouts change every height.
export function reset(heights, {count, keepEstimates = false}) {
    heights.count = count
    heights.heights = new Array(count).fill(NaN)
    heights.identifiers = new Array(count).fill(undefined)
    heights.dirtyFrom = 0
    if (keepEstimates) { return }
    heights.estimates = new Map()
    heights.dominantIdentifier = undefined
}

// The smallest index in [low, high] whose offset satisfies isPast, which must hold at `high` and, the offsets never decreasing, from
// the answer on.
function _lowerBound(offsets, low, high, isPast) {
    while (low < high) {
        var middle = (low + high) >> 1
        if (isPast(offsets[middle])) { high = middle } else { low = middle + 1 }
    }
    return low
}

function _meanEstimate(heights, identifier) {
    var estimate = heights.estimates.get(identifier) || heights.estimates.get(heights.dominantIdentifier)
    return estimate ? estimate.sum / estimate.count : defaultEstimate
}

// What the unmeasured rows of these identifiers estimate as: if it is the same after a measurement, no row but the measured one moved.
function _estimateSignature(heights, previousIdentifier, identifier) {
    return [_meanEstimate(heights, previousIdentifier), _meanEstimate(heights, identifier), _meanEstimate(heights, undefined)].join("/")
}

function _remember(heights, row, height) {
    if (!(height > 0)) {
        heights.heights[row] = NaN
        return
    }
    heights.heights[row] = height
    var identifier = heights.identifiers[row]
    var estimate = heights.estimates.get(identifier) || {sum: 0, count: 0}
    estimate.sum += height
    estimate.count += 1
    heights.estimates.set(identifier, estimate)
    var dominant = heights.estimates.get(heights.dominantIdentifier)
    if (!dominant || estimate.count > dominant.count) { heights.dominantIdentifier = identifier }
}

function _forget(heights, row) {
    var height = heights.heights[row]
    if (Number.isNaN(height)) { return }
    var identifier = heights.identifiers[row]
    var estimate = heights.estimates.get(identifier)
    estimate.sum -= height
    estimate.count -= 1
    heights.heights[row] = NaN
    if (estimate.count === 0) { heights.estimates.delete(identifier) }
    _electDominant(heights)
}

// Identifiers are few, so scanning them after a removal is cheaper than keeping an ordered structure.
function _electDominant(heights) {
    var winner
    var winnerCount = 0
    for (var [identifier, estimate] of heights.estimates) {
        if (estimate.count <= winnerCount) { continue }
        winner = identifier
        winnerCount = estimate.count
    }
    heights.dominantIdentifier = winner
}

function _rebuild(heights) {
    var offsets = heights.offsets
    offsets.length = heights.count + 1
    for (var row = heights.dirtyFrom; row < heights.count; row++) {
        offsets[row + 1] = offsets[row] + effectiveHeight(heights, row)
    }
    heights.dirtyFrom = heights.count
}
