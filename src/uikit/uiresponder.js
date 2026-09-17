import { uuid } from "../utils/uuid.js"
import { NSObject } from "../foundation/nsobject.js"
import { NSNotificationCenter } from "../foundation/nsnotificationcenter.js"


export class UIResponder extends NSObject {

    constructor(selector) {
        super()
        this.selector = selector || "#"+uuid()
        this.next = null
    }

    get identifier() {
        if (this._identifier) { return this._identifier }
        var id = this.selector.replace(/#\b[\w\-]{36}\b #/, "").replaceAll("#", "")
        var ids = id.split(" ")
        this._identifier = ids.pop()
        return this._identifier
    }

    _link(responder) {
        responder.next = this
    }

    // Observers on window and document outlive the DOM the responder was bound
    // to, so they are released here when the owning controller is dismissed.
    _dispose() {
        NSNotificationCenter.removeObserver(this)
    }
}
