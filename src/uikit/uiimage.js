import { NSObject } from "../foundation/nsobject.js"


export class UIImage extends NSObject {

    constructor({named}) {
        super()
        this.named = named
    }
}
