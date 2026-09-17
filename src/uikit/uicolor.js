import { NSObject } from "../foundation/nsobject.js"


export class UIColor extends NSObject {

    constructor({hex}) {
        super()
        this.hex = hex
    }
}
