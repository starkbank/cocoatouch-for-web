import { NSObject } from "../foundation/nsobject.js"
import { UIDropOperation } from "./uidropoperation.js"
import { required, enumeration } from "../utils/required.js"


const operationType = enumeration(UIDropOperation, "UIDropOperation")


// What a drop interaction's delegate answers a dragging session with.
export class UIDropProposal extends NSObject {

    /**
     * @param {object} options
     * @param {"cancel"|"forbidden"|"copy"|"move"} options.operation
     */
    constructor({operation} = {}) {
        super()
        this.operation = required(operation, "operation", operationType, "UIDropProposal", "Apple's is UIDropProposal(operation:); write new UIDropProposal({operation: UIDropOperation.copy}).")
    }
}
