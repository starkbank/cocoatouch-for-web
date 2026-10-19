import { UIColor } from "../uikit/uicolor.js"


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

    // Apple's nil is no value of the layer's own: the inline border color is
    // removed, so the stylesheet's returns, and reads back as null.
    set borderColor(color) {
        this._$el().css("border-color", color === null ? "" : color.cgColor)
    }

    get borderColor() {
        var element = this._$el()[0]
        if (!element || !element.style || element.style.borderColor === "") { return null }
        return new UIColor({hex: element.style.borderColor})
    }

    // A sublayer that owns an element, like an AVPlayerLayer or a CAGradientLayer,
    // is put inside this layer's element.
    addSublayer(layer) {
        var element = layer._element
        if (element) { this._$el().append(element) }
    }
}
