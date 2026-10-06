// Core Graphics' CGSize.
export class CGSize {

    /**
     * @param {object} [options]
     * @param {number} [options.width]
     * @param {number} [options.height]
     */
    constructor({width = 0, height = 0} = {}) {
        this.width = width
        this.height = height
    }

    static get zero() {
        return new CGSize()
    }
}
