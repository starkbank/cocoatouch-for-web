// The single place a plain-text sink writes its value. Assigning textContent
// makes the DOM do the escaping, so no escaping function exists to get wrong;
// a sink that renders text calls this and nothing else, which is also what
// makes it the one chokepoint a census can instrument.
export function setText($el, value) {
    if (!$el) { return }
    $el.text(value === null || value === undefined ? "" : String(value))
}

// The opt-in markup path. It sanitises nothing and is for trusted input: the
// browser's own Element.setHTML is used where it exists as hardening, never
// as the boundary, and is feature-detected rather than sniffed.
export function setMarkup($el, markup) {
    if (!$el) { return }
    var html = markup === null || markup === undefined ? "" : String(markup)
    var element = $el[0]
    if (element && typeof element.setHTML === "function") {
        element.setHTML(html)
        return
    }
    $el.html(html)
}
