// Core Graphics' CGPoint.
export class CGPoint {

    /**
     * @param {object} [options]
     * @param {number} [options.x]
     * @param {number} [options.y]
     */
    constructor({x = 0, y = 0} = {}) {
        this.x = x
        this.y = y
    }

    static get zero() {
        return new CGPoint()
    }
}
