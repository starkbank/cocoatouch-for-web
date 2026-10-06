// The single place a plain-text sink writes its value. Assigning textContent
// makes the DOM do the escaping, so no escaping function exists to get wrong;
// a sink that renders text calls this and nothing else, which is also what
// makes it the one chokepoint a census can instrument.
export function setText($el, value) {
    if (!$el) { return }
    $el.text(value === null || value === undefined ? "" : String(value))
}

// The opt-in markup path. It sanitises nothing and is for trusted input; the
// boundary is that a caller must construct an html-typed NSAttributedString,
// never a filter here. The browser's Sanitizer API is not used: its default
// configuration removes the classes, attributes and custom elements first-party
// markup is built from, and a configuration that keeps them is an allowlist,
// which this package does not ship.
export function setMarkup($el, markup) {
    if (!$el) { return }
    $el.html(markup === null || markup === undefined ? "" : String(markup))
}
