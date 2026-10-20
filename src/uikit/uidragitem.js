import { NSObject } from "../foundation/nsobject.js"
import { NSItemProvider } from "../foundation/nsitemprovider.js"
import { required, instance } from "../utils/required.js"


const providerType = instance(NSItemProvider, "NSItemProvider")


// One thing a drag carries: its itemProvider is the item's way to be loaded.
export class UIDragItem extends NSObject {

    /**
     * @param {object} options
     * @param {NSItemProvider} options.itemProvider
     */
    constructor({itemProvider} = {}) {
        super()
        this.itemProvider = required(itemProvider, "itemProvider", providerType, "UIDragItem", "Apple's is UIDragItem(itemProvider:); write new UIDragItem({itemProvider}).")
    }
}
