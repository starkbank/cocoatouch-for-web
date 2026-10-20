import { Bind } from "../utils/bind.js"
import { decoratedDescriptor } from "../utils/decoratedDescriptor.js"


/** @returns {(target: object, name: string, descriptor?: PropertyDescriptor) => any} */
export function IBAction(selector, cls) {
    return (target, name, descriptor) => {
        var array = target["ibactions"] || []
        target["ibactions"] = array.concat({
            cls: cls,
            selector: selector,
            method: name,
            target: target,
        })
        Bind.registerPrototypeForRestore(target)
        return decoratedDescriptor(descriptor)
    }
}