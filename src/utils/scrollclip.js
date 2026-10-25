// What of a table can be seen, for the code that decides which rows to render. The table does not scroll itself: the page does, or an
// ancestor, so the visible part is the viewport cut by every ancestor that clips. Reads only, in client coordinates.

// The ancestors whose computed overflow-y clips (auto, scroll or hidden), nearest first, and whether each one scrolls (auto or scroll).
// The body and the root are left out: their overflow belongs to the viewport, which the clip starts from.
export function clipAncestors(element) {
    var view = element.ownerDocument.defaultView
    var found = []
    for (var node = element.parentElement; node; node = node.parentElement) {
        if (_isRoot(node)) { continue }
        var overflow = view.getComputedStyle(node).getPropertyValue("overflow-y")
        if (overflow === "auto" || overflow === "scroll") { found.push({element: node, scrolls: true}) }
        if (overflow === "hidden") { found.push({element: node, scrolls: false}) }
    }
    return found
}

// The viewport's vertical extent cut by each ancestor's client box (its padding box, scrollbars excluded). A document with no layout
// reports a client height of 0, so the window's height stands in for it there. An empty intersection comes back as a zero-height clip
// at its top, never inverted.
export function visibleClip(element, ancestors) {
    var top = 0
    var bottom = element.ownerDocument.documentElement.clientHeight || element.ownerDocument.defaultView.innerHeight
    for (var ancestor of ancestors) {
        var node = ancestor.element
        var clientTop = node.getBoundingClientRect().top + node.clientTop
        top = Math.max(top, clientTop)
        bottom = Math.min(bottom, clientTop + node.clientHeight)
    }
    return {top: top, bottom: Math.max(top, bottom)}
}

// The first ancestor that scrolls vertically and has something to scroll, else the document's scroller. It is asked each time it is
// needed because a list grows: an auto-height box such as `.table-container` has overflow-y auto but nothing to scroll, and a box that
// had nothing yesterday may have a page of rows today.
export function scroller(element) {
    var view = element.ownerDocument.defaultView
    for (var node = element.parentElement; node; node = node.parentElement) {
        if (_isRoot(node)) { continue }
        var overflow = view.getComputedStyle(node).getPropertyValue("overflow-y")
        if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) { return node }
    }
    return element.ownerDocument.scrollingElement
}

function _isRoot(node) {
    return node === node.ownerDocument.documentElement || node === node.ownerDocument.body
}
