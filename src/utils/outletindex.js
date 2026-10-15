// Only a bare id earns an index. jQuery answers a bare class or tag on an
// element context natively with a live getElementsByClassName or
// getElementsByTagName, in document order, and it asks the document for a bare
// id first and falls back to querySelectorAll only when the document-first
// element lies outside the owner, which is the repeated-card case this index
// exists for. A class or tag entry in the index would go stale on an attribute
// write (isSelected adds a class without changing the element count); the live
// collections cannot.
const idOutlet = /^#[\w-]+$/
const minimumIdOutlets = 2

export function isIdOutletSelector(selector) {
    return idOutlet.test(selector)
}

// null when an index would not pay or could not be trusted: under two id
// outlets the walk costs more than it saves, and a detached, multiple or
// non-element root has no single subtree whose document order is jQuery's.
export function outletIndexFor($parent, outlets) {
    if (!_isSingleElement($parent) || $parent[0].isConnected === false) { return null }
    var ids = 0
    for (var outlet of outlets) {
        if (isIdOutletSelector(outlet.selector)) { ids += 1 }
    }
    if (ids < minimumIdOutlets) { return null }
    var all = $parent[0].getElementsByTagName("*")
    var byId = new Map()
    for (var element of all) {
        if (element.id) { _add(byId, element.id, element) }
    }
    return {byId: byId, all: all, count: all.length}
}

// The order that reproduces jQuery: for an id its own fast path, which asks the
// document first and keeps that element only when it lies strictly inside the
// owner; then the index; and jQuery itself whenever the index cannot answer,
// including a match the page has since detached, so a miss is the same empty
// set as before. Nib loading and init() mutate the subtree mid-loop, so an
// entry is only trustworthy while the subtree's element count is the one the
// index was built at. Residual hole, left unguarded: an id assigned mid-loop
// to an element that duplicates an id earlier in the document. The consumers
// cannot produce it, since outlet and action ids are qualified by their owner.
export function outletElement({selector, $parent, index}) {
    if (!isIdOutletSelector(selector) || !_isSingleElement($parent)) { return $parent.find(selector) }
    var parent = $parent[0]
    var id = selector.slice(1)
    var found = parent.ownerDocument.getElementById(id)
    if (found && found !== parent && parent.contains(found)) { return $(found) }
    if (!index || index.all.length !== index.count) { return $parent.find(selector) }
    var matches = index.byId.get(id)
    if (!matches || matches.some(function(element) { return element.isConnected === false })) {
        return $parent.find(selector)
    }
    return $(matches)
}

function _isSingleElement($parent) {
    return $parent.length === 1 && !!$parent[0] && $parent[0].nodeType === 1
}

function _add(map, key, element) {
    var list = map.get(key)
    if (list) {
        list.push(element)
        return
    }
    map.set(key, [element])
}
