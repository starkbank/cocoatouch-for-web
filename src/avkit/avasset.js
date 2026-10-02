import { NSObject } from "../foundation/nsobject.js"


export class AVAsset extends NSObject {

}


export class AVURLAsset extends AVAsset {

    constructor({url}) {
        super()
        this.url = url
    }
}
