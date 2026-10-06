import { NSObject } from "../foundation/nsobject.js"


// UIKit's UIColor. A color named after a design token resolves through the
// stylesheet's custom property of that name, the way UIColor(named:) reads the
// asset catalog, so the token stays the single place the value lives.
export class UIColor extends NSObject {

    // UIColor(named:), UIColor(red:green:blue:alpha:), UIColor(white:alpha:) or, web-side, {hex}
    /**
     * @param {object} [options]
     * @param {string} [options.named]
     * @param {number} [options.red]
     * @param {number} [options.green]
     * @param {number} [options.blue]
     * @param {number} [options.white]
     * @param {number} [options.alpha]
     * @param {string} [options.hex]
     */
    constructor({named, red, green, blue, white, alpha = 1, hex} = {}) {
        super()
        if (named !== undefined) {
            this._cssValue = `var(--${named})`
            return
        }
        if (white !== undefined) {
            var level = Math.round(white * 255)
            this._cssValue = `rgba(${level}, ${level}, ${level}, ${alpha})`
            return
        }
        if (red !== undefined) {
            this._cssValue = `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`
            return
        }
        this._cssValue = hex
    }

    static get clear() {
        return _fixed("transparent")
    }

    static get white() {
        return _fixed("#FFFFFF")
    }

    static get black() {
        return _fixed("#000000")
    }

    // The value a stylesheet understands, as cgColor is the value Core Graphics draws with.
    get cgColor() {
        return this._cssValue
    }

    get hex() {
        return this._cssValue
    }
}


function _fixed(cssValue) {
    return new UIColor({hex: cssValue})
}
