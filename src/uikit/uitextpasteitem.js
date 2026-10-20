import { NSObject } from "../foundation/nsobject.js"
import { typed, StringType } from "../utils/required.js"


const defaultResult = Object.freeze({kind: "default"})
const noResult = Object.freeze({kind: "none"})


/**
 * @typedef {object} UITextPasteDelegate
 * @property {(textPasteConfigurationSupporting: UITextField, item: UITextPasteItem) => void} [textPasteConfigurationSupportingTransform]
 */


// UIKit's UITextPasteItem, for a text field's paste: the provider holding the
// flavours of the paste and the three results a delegate can choose. The last
// one set while the delegate runs counts, and none set is the default.
export class UITextPasteItem extends NSObject {

    _itemProvider = null
    _result = defaultResult

    get itemProvider() {
        return this._itemProvider
    }

    // Inserts this string, as text, where the paste lands, in place of the clipboard's.
    /** @param {string} string */
    setStringResult(string) {
        typed(string, "string", StringType, "UITextPasteItem.setStringResult", "Apple's is setStringResult(_:); write item.setStringResult(\"a, b\").")
        this._result = Object.freeze({kind: "string", string: string})
    }

    // The browser pastes the clipboard itself.
    setDefaultResult() {
        this._result = defaultResult
    }

    // Inserts nothing and consumes the paste.
    setNoResult() {
        this._result = noResult
    }
}


// How the framework makes an item and reads what the delegate chose.
export function textPasteItemFor({itemProvider}) {
    var item = new UITextPasteItem()
    item._itemProvider = itemProvider
    return item
}

export function resultOfTextPasteItem(item) {
    return item._result
}
