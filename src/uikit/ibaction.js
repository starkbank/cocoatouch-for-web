import { Bind } from "../utils/bind.js"


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
        return target
    }
}