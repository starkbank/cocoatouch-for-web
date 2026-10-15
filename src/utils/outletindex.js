// An outlet is a bare id, class or tag in every consumer, so one walk of the
// owner's subtree can answer all of them where jQuery would query once each.
// Anything else keeps jQuery's own lookup.
const simpleOutlet = /^(?:#[\w-]+|\.[\w-]+|[a-z][a-z0-9]*)$/
const htmlNamespace = "http://www.w3.org/1999/xhtml"
const minimumSimpleOutlets = 2

export function isSimpleOutletSelector(selector) {
    return simpleOutlet.test(selector)
}

// null when an index would not pay or could not be trusted: under two simple
// outlets the walk costs more than it saves, and a detached, multiple or
// non-element root has no single subtree whose document order is jQuery's.
export function outletIndexFor($parent, outlets) {
    if (!_isSingleElement($parent) || $parent[0].isConnected === false) { return null }
    var simple = 0
    for (var outlet of outlets) {
        if (isSimpleOutletSelector(outlet.selector)) { simple += 1 }
    }
    if (simple < minimumSimpleOutlets) { return null }
    var index = {byId: new Map(), byClass: new Map(), byTag: new Map()}
    for (var element of $parent[0].querySelectorAll("*")) {
        _add(index.byTag, _tagKey(element), element)
        for (var name of element.classList) { _add(index.byClass, name, element) }
        if (element.id) { _add(index.byId, element.id, element) }
    }
    return index
}

// The order that reproduces jQuery: for an id its own fast path, which asks the
// document first and keeps that element only when it lies strictly inside the
// owner; then the index; and jQuery itself whenever the index cannot answer,
// including a match the page has since detached, so a miss is the same empty
// set as before.
export function outletElement({selector, $parent, index}) {
    if (!isSimpleOutletSelector(selector) || !_isSingleElement($parent)) { return $parent.find(selector) }
    var parent = $parent[0]
    if (selector[0] === "#") {
        var found = parent.ownerDocument.getElementById(selector.slice(1))
        if (found && found !== parent && parent.contains(found)) { return $(found) }
    }
    if (!index) { return $parent.find(selector) }
    var matches = _matches(index, selector)
    if (!matches || matches.some(function(element) { return element.isConnected === false })) {
        return $parent.find(selector)
    }
    return $(matches)
}

function _isSingleElement($parent) {
    return $parent.length === 1 && !!$parent[0] && $parent[0].nodeType === 1
}

function _matches(index, selector) {
    if (selector[0] === "#") { return index.byId.get(selector.slice(1)) }
    if (selector[0] === ".") { return index.byClass.get(selector.slice(1)) }
    return index.byTag.get(selector)
}

// Type selectors match case-insensitively in an HTML element and exactly in
// any other, so the key is the form the selector will be written in.
function _tagKey(element) {
    return element.namespaceURI === htmlNamespace ? element.tagName.toLowerCase() : element.tagName
}

function _add(map, key, element) {
    var list = map.get(key)
    if (list) {
        list.push(element)
        return
    }
    map.set(key, [element])
}
