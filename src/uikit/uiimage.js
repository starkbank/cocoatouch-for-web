import { NSObject } from "../foundation/nsobject.js"


// UIImage(named:) is a file in the asset catalog, here a url. UIImage(systemName:)
// is a symbol from the system's icon library, here the classes of an icon font
// such as "fas fa-credit-card".
export class UIImage extends NSObject {

    /**
     * @param {object} options
     * @param {string} [options.named]
     * @param {string} [options.systemName]
     */
    constructor({named, systemName}) {
        super()
        this.named = named
        this.systemName = systemName
    }
}
