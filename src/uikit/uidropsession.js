import { NSObject } from "../foundation/nsobject.js"
import { required, arrayOf, StringType } from "../utils/required.js"


const identifiersType = arrayOf(StringType)


// A drag over a drop interaction's view. Its items are the files the drag
// carries; strings and links are not items here, so a session that carries
// nothing a page can load has none.
export class UIDropSession extends NSObject {

    constructor(items) {
        super()
        this.items = items
    }

    // True when any item conforms to any of the types; a delegate that wants only
    // those items filters them with hasItemConformingToTypeIdentifier.
    /**
     * @param {object} options
     * @param {string[]} options.toTypeIdentifiers
     * @returns {boolean}
     */
    hasItemsConforming({toTypeIdentifiers} = {}) {
        required(toTypeIdentifiers, "toTypeIdentifiers", identifiersType, "UIDropSession.hasItemsConforming", "Apple's is hasItemsConforming(toTypeIdentifiers:); write session.hasItemsConforming({toTypeIdentifiers: [UTType.pdf.identifier]}).")
        return this.items.some((item) => toTypeIdentifiers.some((identifier) => item.itemProvider.hasItemConformingToTypeIdentifier(identifier)))
    }
}
