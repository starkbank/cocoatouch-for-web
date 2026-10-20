import { NSObject } from "../foundation/nsobject.js"


// One thing a drag carries: its itemProvider is the item's way to be loaded.
export class UIDragItem extends NSObject {

    constructor(itemProvider) {
        super()
        this.itemProvider = itemProvider
    }
}
