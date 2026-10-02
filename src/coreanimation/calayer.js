

export class CALayer {

    constructor(selector) {
        this.selector = selector
    }

    set borderColor(color) {
        $(this.selector).css("border-color", color.cgColor)
    }

    // A sublayer that owns an element, like an AVPlayerLayer or a CAGradientLayer,
    // is put inside this layer's element.
    addSublayer(layer) {
        var element = layer._element
        if (element) { $(this.selector).append(element) }
    }
}
