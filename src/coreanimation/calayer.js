import { UIColor } from "../uikit/uicolor.js"


export class CALayer {

    constructor(selector) {
        this.selector = selector
    }

    // Apple's nil is no value of the layer's own: the inline border color is
    // removed, so the stylesheet's returns, and reads back as null.
    set borderColor(color) {
        $(this.selector).css("border-color", color === null ? "" : color.cgColor)
    }

    get borderColor() {
        var element = $(this.selector)[0]
        if (!element || !element.style || element.style.borderColor === "") { return null }
        return new UIColor({hex: element.style.borderColor})
    }

    // A sublayer that owns an element, like an AVPlayerLayer or a CAGradientLayer,
    // is put inside this layer's element.
    addSublayer(layer) {
        var element = layer._element
        if (element) { $(this.selector).append(element) }
    }
}
