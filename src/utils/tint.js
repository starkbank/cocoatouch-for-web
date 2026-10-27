import { imageSource } from "../uikit/uiimage.js"
import { UIImageRenderingMode } from "../uikit/uiimagerenderingmode.js"


// UIView.tintColor's drawing. Apple fills a template image with the effective
// tint, and every view has one, the root default included. The stylesheets of
// the sites already color their icons, so the root default is the color the
// stylesheet draws: nothing is written until some view on the chain has an
// explicit tintColor, and then only on the template images below it, never on a
// container or on a label. What is written is taken back, to the value the
// element had before, when the tint goes.

const currentColorPaint = "[fill=\"currentColor\"], [stroke=\"currentColor\"]"

// view -> what the tint wrote on the elements of its template images.
var _painted = new WeakMap()


// The nearest view, the view itself included, that has a tintColor of its own.
export function tintSourceOf(view) {
    for (var at = view; at; at = at._superview) {
        if (at._tintColor) { return at }
    }
    return null
}

// The view's own tint changed: it and every descendant that inherits it, in
// order, draw it and are told. A descendant with its own tint shadows the
// subtree below it, so the walk stops there.
export function propagateTint(view) {
    drawTint(view)
    view.tintColorDidChange()
    for (var subview of view.subviews) {
        if (!subview._tintColor) { propagateTint(subview) }
    }
}

// A view just placed under a superview draws what it inherits. The hook is not
// sent: the view is not built yet, its outlets are bound after it is placed.
export function inheritTint(view) {
    if (view._tintColor || tintSourceOf(view) === null) { return }
    _drawSubtree(view)
}

export function drawTint(view) {
    if (typeof view._templateImages !== "function") { return }
    var source = tintSourceOf(view)
    var records = _painted.get(view)
    if (!records && source === null) { return }
    if (records) {
        records.forEach(_erase)
        _painted.delete(view)
    }
    if (source === null) { return }
    var color = source._tintColor.cgColor
    var written = view._templateImages().map((target) => _paint(target, color)).filter(Boolean)
    if (written.length > 0) { _painted.set(view, written) }
}

// The template image a picture is: a symbol is the glyph in the tint, a file's
// or bytes' image is its shape filled with it. Only alwaysTemplate is one; a
// file image is drawn through a mask, which only an img element can carry.
export function templateTargets(image, element) {
    if (!image || !element || image.renderingMode !== UIImageRenderingMode.alwaysTemplate) { return [] }
    if (image.systemName !== undefined) { return [{element, source: null}] }
    var source = imageSource(image)
    if (!source || String(element.tagName).toLowerCase() !== "img") { return [] }
    return [{element, source}]
}

// An inline svg drawn with currentColor takes the color of the element that
// hosts it, so the host is what is painted: the svg itself, or the control
// that holds it.
export function currentColorTargets(element) {
    if (!element || typeof element.matches !== "function") { return [] }
    var svg = element.matches("svg") ? element : element.querySelector("svg")
    if (!svg || !(svg.matches(currentColorPaint) || svg.querySelector(currentColorPaint))) { return [] }
    return [{element, source: null}]
}


function _drawSubtree(view) {
    drawTint(view)
    for (var subview of view.subviews) {
        if (!subview._tintColor) { _drawSubtree(subview) }
    }
}

function _paint({element, source}, color) {
    var style = element.style
    if (!style) { return null }
    var writes = source === null ? {color} : _maskWrites(color, source)
    var previous = {}
    var written = {}
    for (var property of Object.keys(writes)) {
        previous[property] = style.getPropertyValue(property)
        style.setProperty(property, writes[property])
        written[property] = style.getPropertyValue(property)
    }
    return {element, previous, written}
}

// A mask shows the background only where the image has pixels, so the image's
// shape is filled with the tint; the image itself is moved out of its box, or it
// would cover the fill.
function _maskWrites(color, source) {
    return {
        "background-color": color,
        "mask-image": `url("${source.replace(/[\\"\n\r]/g, (character) => "\\" + character.charCodeAt(0).toString(16) + " ")}")`,
        "mask-size": "contain",
        "mask-repeat": "no-repeat",
        "mask-position": "center",
        "object-fit": "none",
        "object-position": "-100vw 0",
    }
}

// A property the app wrote after the tint did is the app's, and is left alone.
function _erase({element, previous, written}) {
    var style = element.style
    for (var property of Object.keys(written)) {
        if (style.getPropertyValue(property) !== written[property]) { continue }
        if (previous[property] === "") {
            style.removeProperty(property)
            continue
        }
        style.setProperty(property, previous[property])
    }
}
