// The class each .xib is attached to, by the name the webpack loader wrote as a
// string literal. A table view reads it to find the class an unregistered
// identifier names, as iOS finds the prototype cell whose identifier a storyboard
// declares. Never constructor.name: a minifier renames the class, never the literal.
var _classesByName = new Map()

// Two classes under one name: the name no longer says which is meant.
var _ambiguous = {}

export function registerNibClass(name, cls) {
    var known = _classesByName.get(name)
    if (known === undefined) {
        _classesByName.set(name, cls)
        return
    }
    if (known === cls) { return }
    _classesByName.set(name, _ambiguous)
}

// A Map, so "constructor" and "toString" are not found through the prototype.
export function nibClassNamed(name) {
    var cls = _classesByName.get(name)
    if (cls === undefined) { return null }
    if (cls === _ambiguous) {
        throw new Error(`two classes carry a .xib named ${name}, so the identifier ${name} cannot tell them apart: register the one it means for the identifier`)
    }
    return cls
}
