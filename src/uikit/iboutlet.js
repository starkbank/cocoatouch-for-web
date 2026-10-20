import { decoratedDescriptor } from "../utils/decoratedDescriptor.js"


// Swift's `@IBOutlet var chips: [UILabel]!` is an outlet collection, written
// here as the class in an array: `@IBOutlet(".chip", [UILabel]) chips`. The
// selector then binds every element it matches, in document order.
/**
 * @param {string} selector
 * @param {Function|Function[]} cls
 * @returns {(target: object, name: string, descriptor?: PropertyDescriptor) => any}
 */
export function IBOutlet(selector, cls) {
    _validatedClass(selector, cls)
    return (target, name, descriptor) => {
        var array = target["iboutlets"] || []
        target["iboutlets"] = array.concat({
            cls: cls,
            selector: selector,
            method: name,
            target: target,
        })
        return decoratedDescriptor(descriptor)
    }
}


// The class each bound view is built from: the declared class, or the array's
// one element for a collection.
export function outletElementClass(outlet) {
    return Array.isArray(outlet.cls) ? outlet.cls[0] : outlet.cls
}


// An array is Swift's [Class]: exactly one class. Anything else is a typo that
// would otherwise surface as a failed binding far from the declaration.
function _validatedClass(selector, cls) {
    if (!Array.isArray(cls)) { return }
    if (cls.length === 1 && typeof cls[0] === "function") { return }
    throw new TypeError(`IBOutlet("${selector}", ...) takes a class or an array of exactly one class, as Swift's [UILabel]; got an array of ${cls.length}.`)
}
