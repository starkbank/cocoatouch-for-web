import { NSObject } from "../foundation/nsobject.js"


// UINavigationItem: what the navigation bar shows for a controller. Bar
// button items wait for UIBarButtonItem.
export class UINavigationItem extends NSObject {

    /**
     * @param {object} [options]
     * @param {string|null} [options.title]
     */
    constructor({title = null} = {}) {
        super()
        this.title = title
        this.hidesBackButton = false
    }
}
