import { typed, optional } from "../utils/required.js"


// Core Graphics' CGColor is, here, the value UIColor.cgColor returns: the
// string a stylesheet understands.
const cgColorType = optional(Object.freeze({kind: "string", name: "CGColor"}))


// A view's layer is made for it once and resolves the element through the view
// on every use, never from a node kept here: the view re-resolves its element
// once it is disconnected, and a repeated id would otherwise answer with the
// first match on the page. A standalone layer, which the sublayers that own an
// element are, still resolves its selector.
export function layerOf(view) {
    var layer = new CALayer(view.selector)
    layer._view = view
    return layer
}


export class CALayer {

    constructor(selector) {
        this.selector = selector
        this._view = null
    }

    _$el() {
        return this._view ? this._view.$el : $(this.selector)
    }

    // A CGColor, as Apple's is: write `layer.borderColor = color.cgColor`, and a
    // UIColor is refused. Apple's nil is no value of the layer's own: the inline
    // border color is removed, so the stylesheet's returns, and reads back as
    // null. What reads back is the element's own inline value, a hex as the
    // browser's normalised rgb() and a token as the var() it was written as.
    /** @param {string|null} color */
    set borderColor(color) {
        typed(color, "borderColor", cgColorType, "CALayer.borderColor", "Apple's is var borderColor: CGColor?; write layer.borderColor = color.cgColor.")
        this._$el().css("border-color", color === null ? "" : color)
    }

    /** @returns {string|null} */
    get borderColor() {
        var element = this._$el()[0]
        if (!element || !element.style || element.style.borderColor === "") { return null }
        return element.style.borderColor
    }

    // Apple's default is 0, and so is nil: the inline border-width and
    // border-style are both removed, so the stylesheet's border returns. Above 0
    // the width is drawn with a solid style, since a width alone draws nothing
    // on an element whose stylesheet has no border. The layer only ever writes
    // and reads its own inline values, never the stylesheet's.
    set borderWidth(width) {
        if (width !== null && width !== undefined && !(typeof width === "number" && Number.isFinite(width) && width >= 0)) {
            throw new TypeError("CALayer.borderWidth takes a finite number of 0 or more, or null: Apple's is var borderWidth: CGFloat.")
        }
        var $el = this._$el()
        if (!width) {
            $el.css("border-width", "").css("border-style", "")
            return
        }
        $el.css("border-width", width + "px").css("border-style", "solid")
    }

    get borderWidth() {
        var element = this._$el()[0]
        if (!element || !element.style || element.style.borderWidth === "") { return 0 }
        var width = parseFloat(element.style.borderWidth)
        return Number.isFinite(width) ? width : 0
    }

    // A sublayer that owns an element, like an AVPlayerLayer or a CAGradientLayer,
    // is put inside this layer's element.
    addSublayer(layer) {
        var element = layer._element
        if (element) { this._$el().append(element) }
    }
}
