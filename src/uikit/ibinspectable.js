import { UIColor } from "./uicolor.js"
import { UIImage } from "./uiimage.js"
import { CGPoint } from "../coregraphics/cgpoint.js"
import { CGSize } from "../coregraphics/cgsize.js"
import { CGRect } from "../coregraphics/cgrect.js"


// @IBInspectable title, or @IBInspectable(UIColor) tint: a property the nib
// sets on the view at load time, as Interface Builder's user-defined runtime
// attributes do. The value is the element's data-<property> attribute, the
// name dash-separated, read once outlets are connected and before
// awakeFromNib. The decorator returns nothing so the field keeps its
// initialiser: an absent attribute leaves the declared default standing.
/** @returns {any} */
export function IBInspectable(typeOrTarget, name, descriptor) {
    if (typeof name === "string") {
        _declare(typeOrTarget, name, String)
        return undefined
    }
    var type = typeOrTarget || String
    return (target, property, desc) => {
        _declare(target, property, type)
        return undefined
    }
}

// The conversions Interface Builder inspects, Swift type by Swift type.
export function inspectableValue({type, value, property}) {
    if (type === String) { return value }
    if (type === Number) { return _number(value, property) }
    if (type === Boolean) {
        if (value === "true") { return true }
        if (value === "false") { return false }
        throw new Error(`@IBInspectable ${property}: "${value}" is not a Boolean; write "true" or "false"`)
    }
    if (type === UIColor) {
        return value.charAt(0) === "#" ? new UIColor({hex: value}) : new UIColor({named: value})
    }
    if (type === UIImage) { return new UIImage({named: value}) }
    if (type === CGPoint) {
        var [x, y] = _numbers(value, property, 2)
        return new CGPoint({x, y})
    }
    if (type === CGSize) {
        var [width, height] = _numbers(value, property, 2)
        return new CGSize({width, height})
    }
    if (type === CGRect) {
        var [rx, ry, rw, rh] = _numbers(value, property, 4)
        return new CGRect({x: rx, y: ry, width: rw, height: rh})
    }
    throw new Error(`@IBInspectable ${property}: ${type && type.name} is not an inspectable type`)
}


function _declare(target, property, type) {
    var array = target["ibinspectables"] || []
    target["ibinspectables"] = array.concat({property: property, type: type})
}

function _number(value, property) {
    var number = Number(value)
    if (value.trim() === "" || Number.isNaN(number)) {
        throw new Error(`@IBInspectable ${property}: "${value}" is not a Number`)
    }
    return number
}

function _numbers(value, property, count) {
    var parts = value.split(",")
    if (parts.length !== count) {
        throw new Error(`@IBInspectable ${property}: "${value}" must be ${count} comma-separated numbers`)
    }
    return parts.map((part) => _number(part, property))
}
