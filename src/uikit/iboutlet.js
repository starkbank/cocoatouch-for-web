

/** @returns {(target: object, name: string, descriptor?: PropertyDescriptor) => any} */
export function IBOutlet(selector, cls) {
    return (target, name, descriptor) => {
        var array = target["iboutlets"] || []
        target["iboutlets"] = array.concat({
            cls: cls,
            selector: selector,
            method: name,
            target: target,
        })
        return target
    }
}