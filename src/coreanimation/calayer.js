

export class CALayer {

    constructor(selector) {
        this.selector = selector
    }

    set borderColor(color) {
        $(this.selector).css("border-color", color.hex)
    }
}