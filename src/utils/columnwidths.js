// What every row of a table is believed to ask of each column: the smallest (min-content) and widest (max-content) border-box width of
// each of its cells, kept as numbers so the rows that are not in the document can still be counted into the table's column widths.
// It is plain data with module functions over it, in the style of rowheights.js, and it never touches the document.
//
// generation      bumped by every reset; a record or a chunk of work that carries an older one is stale and ignored
// signatures      signatures[row] is the row's cell structure (tag, class and colSpan per cell) as a string, undefined until noted
// signatureCounts Map(signature -> number of rows that carry it)
// records         records[row] is {min: number[], max: number[]} of a measured row, undefined until then
// pendingRows     the rows to measure in this generation that have no record yet
// floor           the previous aggregate, kept while its own generation still has rows pending (null otherwise)
// blocks          per block of blockSize rows, the per-column maxima of the records that carry the skeleton's signature
// stats           fullRebuilds counts the times every record had to be revisited, blockRebuilds the blocks that had to be recomputed

const blockSize = 64
// A width the page cannot have: a measured value above it is a layout that went wrong, never a column.
const maxWidth = 100000
// A replayed span is never wider than this, and a cell never has more spans than maxSpans.
const maxSpanWidth = 10000
const maxSpans = 1024

export function createColumnWidths() {
    return {
        generation: 0,
        signatures: [],
        signatureCounts: new Map(),
        skeletonSignature: null,
        records: [],
        pendingRows: new Set(),
        floor: null,
        floorGeneration: -1,
        blocks: [],
        dirtyBlocks: new Set(),
        stats: {fullRebuilds: 0, blockRebuilds: 0},
    }
}

// A measured width that is not a finite, non-negative number is no width at all, so it counts as 0.
export function finiteWidth(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) { return 0 }
    return Math.min(value, maxWidth)
}

// Starts a new generation: nothing is recorded or pending any more. `floor` is the aggregate the table had before, which stands in
// for the rows that are not measured yet until this generation's last row lands.
export function reset(widths, {floor = null} = {}) {
    widths.generation += 1
    widths.signatures = []
    widths.signatureCounts = new Map()
    widths.skeletonSignature = null
    widths.records = []
    widths.pendingRows = new Set()
    widths.floor = floor
    widths.floorGeneration = floor ? widths.generation : -1
    widths.blocks = []
    widths.dirtyBlocks = new Set()
}

// Marks the rows to measure in this generation. A row that is already recorded is never measured twice.
export function need(widths, rows) {
    for (var row of rows) {
        if (widths.records[row] === undefined) { widths.pendingRows.add(row) }
    }
}

// Notes a row's signature without a record: a rendered row counts in the majority though it is measured live.
export function noteSignature(widths, row, signature) {
    _setSignature(widths, row, signature)
}

// Keeps what a chunk measured for a row. A chunk from an older generation is ignored.
export function record(widths, {row, generation, signature, min, max}) {
    if (generation !== widths.generation) { return false }
    var previous = widths.records[row]
    var clean = {min: min.map(finiteWidth), max: max.map(finiteWidth)}
    _setSignature(widths, row, signature)
    widths.records[row] = clean
    widths.pendingRows.delete(row)
    var block = Math.floor(row / blockSize)
    if (previous !== undefined) {
        widths.dirtyBlocks.add(block)
    } else if (_isCounted(widths, row)) {
        _raise(widths, block, clean)
    }
    _settleFloor(widths)
    return true
}

// A row whose cell was reconfigured or whose data changed: what was measured is stale. The table decides whether to measure it again.
export function invalidate(widths, rows) {
    for (var row of rows) {
        var previous = widths.records[row]
        widths.pendingRows.delete(row)
        if (previous === undefined) { continue }
        widths.records[row] = undefined
        widths.dirtyBlocks.add(Math.floor(row / blockSize))
    }
}

// `rows` are the inserted rows' positions after the insertion, ascending, as insertRows(at:) names them. The records, the signatures
// and the pending list of the rows after them shift; the inserted rows have nothing yet.
export function insert(widths, rows) {
    if (rows.length === 0) { return }
    var first = rows[0]
    var pending = new Set()
    for (var pendingRow of widths.pendingRows) { pending.add(pendingRow >= first ? _shiftedTo(pendingRow, rows) : pendingRow) }
    widths.pendingRows = pending
    var length = Math.max(widths.signatures.length, widths.records.length)
    if (first >= length) { return }
    var inserted = new Set(rows)
    var count = length + rows.length
    var signatures = new Array(count)
    var records = new Array(count)
    var source = 0
    for (var row = 0; row < count; row++) {
        if (inserted.has(row)) { continue }
        signatures[row] = widths.signatures[source]
        records[row] = widths.records[source]
        source++
    }
    widths.signatures = signatures
    widths.records = records
    _rebuild(widths)
}

// The signature most rows carry; a tie goes to the signature of the earliest row.
export function skeleton(widths) {
    return _majority(widths)
}

// How many noted rows carry a signature other than the skeleton's: the rows the replay cannot stand in for.
export function otherSignatures(widths) {
    var skeletonSignature = _majority(widths)
    var total = 0
    for (var count of widths.signatureCounts.values()) { total += count }
    return total - (widths.signatureCounts.get(skeletonSignature) || 0)
}

// The widest min-content and max-content of each column over the recorded rows outside [from, to), the rows the table renders, which
// contribute live. While the generation's floor is active it is part of the answer.
export function aggregate(widths, {from = 0, to = 0} = {}) {
    _majority(widths)
    var result = {min: [], max: []}
    if (widths.floor && widths.floorGeneration === widths.generation) { _merge(result, widths.floor) }
    var last = Math.floor((widths.records.length - 1) / blockSize)
    for (var block = 0; block <= last; block++) {
        var start = block * blockSize
        var end = start + blockSize
        if (end <= from || start >= to) {
            _merge(result, _blockOf(widths, block))
            continue
        }
        for (var row = start; row < end && row < widths.records.length; row++) {
            if (row >= from && row < to) { continue }
            if (_isCounted(widths, row)) { _merge(result, widths.records[row]) }
        }
    }
    return result
}

// The rows still to measure, the ones nearest [from, to) first, at most `limit` of them.
export function pending(widths, {from = 0, to = 0, limit = Infinity} = {}) {
    var found = []
    if (widths.pendingRows.size === 0 || limit <= 0) { return found }
    var highest = 0
    for (var row of widths.pendingRows) { highest = Math.max(highest, row) }
    var above = from - 1
    var below = Math.max(to, from)
    while ((above >= 0 || below <= highest) && found.length < limit) {
        if (above >= 0) {
            if (widths.pendingRows.has(above)) { found.push(above) }
            above -= 1
        }
        if (below <= highest && found.length < limit) {
            if (widths.pendingRows.has(below)) { found.push(below) }
            below += 1
        }
    }
    return found
}

export function pendingCount(widths) {
    return widths.pendingRows.size
}

// The table has nothing left to measure in this generation, so the floor stands in for nothing.
export function settle(widths) {
    _settleFloor(widths)
}

function _settleFloor(widths) {
    if (widths.pendingRows.size === 0) {
        widths.floor = null
        widths.floorGeneration = -1
    }
}

function _setSignature(widths, row, signature) {
    var previous = widths.signatures[row]
    if (previous === signature) { return }
    if (previous !== undefined) {
        var remaining = widths.signatureCounts.get(previous) - 1
        if (remaining === 0) { widths.signatureCounts.delete(previous) } else { widths.signatureCounts.set(previous, remaining) }
    }
    widths.signatures[row] = signature
    widths.signatureCounts.set(signature, (widths.signatureCounts.get(signature) || 0) + 1)
    if (widths.skeletonSignature === null) { widths.skeletonSignature = signature }
    // The record, if any, joins or leaves the aggregate with its signature.
    if (widths.records[row] !== undefined) { widths.dirtyBlocks.add(Math.floor(row / blockSize)) }
}

// The majority signature, re-evaluated here: when it changes the aggregate is the maximum over a different set of rows, so every
// block is rebuilt, which is the one full pass.
function _majority(widths) {
    var best = null
    var bestCount = 0
    var tied = []
    for (var [signature, count] of widths.signatureCounts) {
        if (count > bestCount) { best = signature; bestCount = count; tied = [signature]; continue }
        if (count === bestCount) { tied.push(signature) }
    }
    if (tied.length > 1) { best = _earliest(widths, tied) }
    if (best !== widths.skeletonSignature) {
        widths.skeletonSignature = best
        _rebuild(widths)
    }
    return widths.skeletonSignature
}

function _earliest(widths, candidates) {
    var wanted = new Set(candidates)
    for (var row = 0; row < widths.signatures.length; row++) {
        if (wanted.has(widths.signatures[row])) { return widths.signatures[row] }
    }
    return candidates[0]
}

function _isCounted(widths, row) {
    return widths.records[row] !== undefined && widths.signatures[row] === widths.skeletonSignature
}

function _rebuild(widths) {
    widths.stats.fullRebuilds += 1
    widths.blocks = []
    widths.dirtyBlocks = new Set()
    for (var row = 0; row < widths.records.length; row++) {
        if (_isCounted(widths, row)) { _raise(widths, Math.floor(row / blockSize), widths.records[row]) }
    }
}

// A block's maxima, recomputed from its rows when a record that held one of them shrank or went away.
function _blockOf(widths, block) {
    if (widths.dirtyBlocks.has(block)) {
        widths.dirtyBlocks.delete(block)
        widths.stats.blockRebuilds += 1
        var rebuilt = {min: [], max: []}
        var start = block * blockSize
        for (var row = start; row < start + blockSize && row < widths.records.length; row++) {
            if (_isCounted(widths, row)) { _merge(rebuilt, widths.records[row]) }
        }
        widths.blocks[block] = rebuilt
    }
    return widths.blocks[block] || {min: [], max: []}
}

// A record joins a block: raising a maximum is O(columns).
function _raise(widths, block, entry) {
    if (!widths.blocks[block]) { widths.blocks[block] = {min: [], max: []} }
    _merge(widths.blocks[block], entry)
}

function _merge(target, entry) {
    for (var kind of ["min", "max"]) {
        for (var column = 0; column < entry[kind].length; column++) {
            if (!(entry[kind][column] <= (target[kind][column] || 0))) { target[kind][column] = entry[kind][column] }
        }
    }
}

// Where a pending row that was at `old` is once the rows at `inserted` (ascending, final positions) are in.
function _shiftedTo(old, inserted) {
    var row = old
    for (var position of inserted) {
        if (position <= row) { row += 1 }
    }
    return row
}

// The widths of the spans a spacer's cell holds so that its min-content is `min` and its max-content `max`, both with the cell's own
// padding and border already taken out: every span is at most `min`, one is exactly `min`, and they add up to `max`, so k = ceil(max /
// min) of them, the last the remainder. Past maxSpans the spans are ceil(max / maxSpans) wide instead, which raises the min-content
// to that width `w` (the true min is `minTrue`): that case is reported through `ceiled`. A column with no min-content has no span.
export function replaySpans(min, max) {
    var smallest = finiteWidth(min)
    var widest = Math.max(finiteWidth(max), smallest)
    if (smallest <= 0) { return {widths: [], k: 0, ceiled: false, w: 0, minTrue: 0} }
    var k = Math.ceil(widest / smallest)
    var width = smallest
    var count = k
    var ceiled = k > maxSpans
    if (ceiled) {
        width = Math.ceil(widest / maxSpans)
        count = Math.ceil(widest / width)
    }
    width = Math.min(width, maxSpanWidth)
    var widths = []
    var left = widest
    for (var i = 0; i < count; i++) {
        var span = Math.min(width, left)
        widths.push(span)
        left -= span
    }
    return {widths: widths, k: k, ceiled: ceiled, w: width, minTrue: smallest}
}
