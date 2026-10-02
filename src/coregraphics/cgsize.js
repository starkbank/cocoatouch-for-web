// Core Graphics' CGSize.
export class CGSize {

    constructor({width = 0, height = 0} = {}) {
        this.width = width
        this.height = height
    }

    static get zero() {
        return new CGSize()
    }
}
