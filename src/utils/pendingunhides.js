// What a browser draws an element as when no stylesheet says otherwise.
export const naturalDisplays = Object.freeze({
    tr: "table-row", td: "table-cell", th: "table-cell", table: "table",
    thead: "table-header-group", tbody: "table-row-group", tfoot: "table-footer-group",
    li: "list-item",
    span: "inline", a: "inline", b: "inline", i: "inline", em: "inline", strong: "inline", small: "inline",
    label: "inline", code: "inline", abbr: "inline", sub: "inline", sup: "inline", u: "inline", s: "inline", img: "inline",
    input: "inline-block", button: "inline-block", select: "inline-block", textarea: "inline-block",
})

export function naturalDisplay(element) {
    var tag = element && element.tagName ? element.tagName.toLowerCase() : ""
    return naturalDisplays[tag] || "block"
}

// Elements unhidden this turn whose stylesheet may still hide them. Asking the
// browser at every unhide forces a style recalculation each time, so the answer
// is deferred to the end of the turn, as a transaction commits at the end of a
// run-loop turn, and read for the whole batch at once.
var _pending = new Set()
var _isScheduled = false

export function addPendingUnhide(element) {
    _pending.add(element)
    if (_isScheduled) { return }
    _isScheduled = true
    queueMicrotask(_resolveScheduled)
}

export function removePendingUnhide(element) {
    _pending.delete(element)
}

// Called before anything that reads what the fallback decides, and by the
// turn-end microtask. Every read comes before any write, so the batch costs one
// style recalculation. A detached element has no computed style to ask, and a
// test stand-in has no isConnected, so only a connected element is read.
export function resolvePendingUnhides() {
    if (_pending.size === 0) { return }
    var batch = Array.from(_pending)
    _pending.clear()
    var stillHidden = batch.filter((element) => element.isConnected === true && element.style.display === "" && getComputedStyle(element).display === "none")
    for (var element of stillHidden) { element.style.display = naturalDisplay(element) }
}

// A getter that resolved early leaves the flag set, so a later unhide in the
// same turn rides the microtask already queued.
function _resolveScheduled() {
    _isScheduled = false
    resolvePendingUnhides()
}
