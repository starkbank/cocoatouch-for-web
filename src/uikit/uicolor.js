import { NSObject } from "../foundation/nsobject.js"
import { UITraitCollection } from "./uitraitcollection.js"
import { required, instance } from "../utils/required.js"


const traitCollectionType = instance(UITraitCollection, "UITraitCollection")


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
            this._token = named
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

    // The concrete color a named token has now, for a canvas, which cannot read
    // var(--token): a new UIColor holding the root's computed value, read once
    // per call. A color that is no token is concrete already and comes back as
    // it is. A token the root does not define throws: Apple's UIColor(named:)
    // is nil for a color the catalog lacks, and handing a canvas var(--token)
    // or a fallback would draw a colour nobody chose. Resolve at load and again
    // when the theme changes, never in a drawing callback or per frame.
    /**
     * @param {object} options
     * @param {UITraitCollection} options.with
     * @returns {UIColor}
     */
    resolvedColor({with: traitCollection} = {}) {
        required(traitCollection, "with", traitCollectionType, "UIColor.resolvedColor", "Apple's is resolvedColor(with:); write color.resolvedColor({with: UITraitCollection.current}).")
        if (this._token === undefined || typeof document === "undefined") { return this }
        var value = getComputedStyle(document.documentElement).getPropertyValue("--" + this._token).trim()
        if (value === "") {
            throw new TypeError(`UIColor.resolvedColor(with:): the page's root defines no --${this._token}, so UIColor(named: "${this._token}") names no color; Apple's UIColor(named:) is nil for a color the catalog does not have.`)
        }
        return new UIColor({hex: value})
    }
}


function _fixed(cssValue) {
    return new UIColor({hex: cssValue})
}
