import { NSObject } from "../foundation/nsobject.js"
import { typed, optional, instance } from "../utils/required.js"
import { UIImage } from "../uikit/uiimage.js"


const cgColorType = optional(Object.freeze({kind: "string", name: "CGColor"}))
const contentsType = optional(instance(UIImage, "UIImage"))

const numbers = {
    birthRate: 0,
    lifetime: 0,
    velocity: 0,
    velocityRange: 0,
    emissionLongitude: 0,
    emissionRange: 0,
    yAcceleration: 0,
    spin: 0,
    spinRange: 0,
    scale: 1,
    scaleRange: 0,
}


// Core Animation's CAEmitterCell: the recipe for one kind of particle an
// emitter layer throws. Rates are per second, angles in radians, velocities
// and accelerations in points per second, as Apple's are; a Range is how far
// the value may vary either way. `color` is a CGColor, the string
// UIColor.cgColor returns, and tints `contents`, a UIImage standing in for
// Apple's CGImage; a cell with no contents is simulated and draws nothing.
export class CAEmitterCell extends NSObject {

    constructor() {
        super()
        this._values = {...numbers}
        this._color = null
        this._contents = null
    }

    set color(color) {
        typed(color, "color", cgColorType, "CAEmitterCell.color", "Apple's is var color: CGColor?; write cell.color = color.cgColor.")
        this._color = color
    }

    get color() {
        return this._color
    }

    set contents(image) {
        typed(image, "contents", contentsType, "CAEmitterCell.contents", "Apple's is var contents: Any?; write cell.contents = new UIImage({named}), the particle's image, tinted by color.")
        this._contents = image
    }

    get contents() {
        return this._contents
    }
}


for (const name of Object.keys(numbers)) {
    Object.defineProperty(CAEmitterCell.prototype, name, {
        get() { return this._values[name] },
        set(value) {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new TypeError(`CAEmitterCell.${name} takes a finite number: Apple's is var ${name}: Float.`)
            }
            this._values[name] = value
        },
        enumerable: true,
    })
}
