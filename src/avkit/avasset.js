import { NSObject } from "../foundation/nsobject.js"


export class AVAsset extends NSObject {

}


export class AVURLAsset extends AVAsset {

    /**
     * @param {object} options
     * @param {*} options.url
     */
    constructor({url}) {
        super()
        this.url = url
    }
}
