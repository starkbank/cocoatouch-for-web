import { NSObject } from "../foundation/nsobject.js"


export class UIGestureRecognizer extends NSObject {

    constructor({target, action}) {
        super()
        this.target = target
        this.action = action
        this.view = null
    }

    get event() {
        return "click"
    }
}


export class UITapGestureRecognizer extends UIGestureRecognizer {

}
