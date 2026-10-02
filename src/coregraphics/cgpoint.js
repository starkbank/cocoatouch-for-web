// Core Graphics' CGPoint.
export class CGPoint {

    constructor({x = 0, y = 0} = {}) {
        this.x = x
        this.y = y
    }

    static get zero() {
        return new CGPoint()
    }
}
