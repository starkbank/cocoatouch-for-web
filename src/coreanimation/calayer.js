

export class CALayer {

    constructor(selector) {
        this.selector = selector
    }

    set borderColor(color) {
        $(this.selector).css("border-color", color.hex)
    }

    // A sublayer that owns an element, like an AVPlayerLayer, is put inside this layer's element.
    addSublayer(layer) {
        if (layer._boundElement) { $(this.selector).append(layer._boundElement) }
    }
}
