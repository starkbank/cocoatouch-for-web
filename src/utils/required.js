// Apple requires the label and the type; JavaScript cannot refuse either at
// compile time, so the call refuses and names what Swift would have said. One
// place, so the check every labelled member makes changes together.
export function required(value, label, type, method, signature) {
    if (value === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    _check(value, label, type, method, signature)
    return value
}

// A positional argument has no label to be missing; only its type is checked.
export function typed(value, name, type, method, signature) {
    _check(value, name, type, method, signature)
    return value
}

// Type descriptors: {kind, name, optional}. Value types (Swift structs) are
// checked by shape, as Swift checks them structurally and as a second copy of
// the package, installed through a symlink, would fail an instanceof test on a
// correct value. Reference types keep instanceof, with that caveat documented.
export const Bool = Object.freeze({kind: "bool", name: "Bool"})
export const Int = Object.freeze({kind: "int", name: "Int"})
export const Float = Object.freeze({kind: "float", name: "Float"})
export const DateType = Object.freeze({kind: "date", name: "Date"})
export const FunctionType = Object.freeze({kind: "function", name: "a function"})
export const StringType = Object.freeze({kind: "string", name: "String"})

export function enumeration(cases, name) {
    return Object.freeze({kind: "enum", name: name, cases: cases})
}

export function shape(name, fields) {
    return Object.freeze({kind: "shape", name: name, fields: fields})
}

export function instance(constructor, name) {
    return Object.freeze({kind: "instance", name: name, constructor: constructor})
}

export function optional(type) {
    return Object.freeze(Object.assign({}, type, {optional: true}))
}

export const CGPointType = shape("CGPoint", {x: "number", y: "number"})
export const CGSizeType = shape("CGSize", {width: "number", height: "number"})
export const CGRectType = shape("CGRect", {origin: CGPointType, size: CGSizeType})
export const IndexPathType = shape("IndexPath", {row: "number", section: "number"})
export const NSRangeType = shape("NSRange", {location: "number", length: "number"})

function _check(value, label, type, method, signature) {
    if (value === null && type.optional) { return }
    if (_conforms(value, type)) { return }
    throw new TypeError(`${method} expects ${_article(type.name)} for ${label}, got ${_describe(value)}. ${signature}`)
}

function _conforms(value, type) {
    if (type.kind === "bool") { return typeof value === "boolean" }
    if (type.kind === "int") { return typeof value === "number" && Number.isInteger(value) }
    if (type.kind === "float") { return typeof value === "number" && Number.isFinite(value) }
    if (type.kind === "date") { return Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime()) }
    if (type.kind === "function") { return typeof value === "function" }
    if (type.kind === "string") { return typeof value === "string" }
    if (type.kind === "enum") { return _cases(type.cases).indexOf(value) !== -1 }
    if (type.kind === "instance") { return value instanceof type.constructor }
    if (type.kind === "shape") { return _hasShape(value, type.fields) }
    if (type.kind === "row") { return (typeof value === "number" && Number.isInteger(value)) || _hasShape(value, IndexPathType.fields) }
    return false
}

function _hasShape(value, fields) {
    if (value === null || typeof value !== "object") { return false }
    for (var field of Object.keys(fields)) {
        var expected = fields[field]
        if (expected === "number") {
            if (typeof value[field] !== "number" || !Number.isFinite(value[field])) { return false }
            continue
        }
        if (!_hasShape(value[field], expected.fields)) { return false }
    }
    return true
}

// The cases of an enumeration: a class of static getters or a frozen object,
// both of which list them as own property names. Memoised per enumeration.
var _casesByEnum = new WeakMap()

function _cases(enumeration) {
    if (_casesByEnum.has(enumeration)) { return _casesByEnum.get(enumeration) }
    var names = Object.getOwnPropertyNames(enumeration).filter(function(name) {
        return name !== "length" && name !== "name" && name !== "prototype"
    })
    var cases = Object.freeze(names.map(function(name) { return enumeration[name] }))
    _casesByEnum.set(enumeration, cases)
    return cases
}

function _article(name) {
    if (/^(a |an )/.test(name)) { return name }
    return (/^[AEIOUaeiou]/.test(name) ? "an " : "a ") + name
}

function _describe(value) {
    if (value === null) { return "null" }
    if (value === undefined) { return "undefined" }
    if (typeof value === "object" && value.constructor && value.constructor.name && value.constructor !== Object) { return "a " + value.constructor.name }
    if (typeof value === "function") { return "a function" }
    try { return JSON.stringify(value) } catch (error) { return String(value) }
}
