import { CGPoint } from "./cgpoint.js"
import { CGSize } from "./cgsize.js"


// Core Graphics' CGRect: an origin and a size, with the edges and midpoints
// derived from them. There is no x or y, as there is none on Apple's.
export class CGRect {

    constructor({x = 0, y = 0, width = 0, height = 0} = {}) {
        this.origin = new CGPoint({x: x, y: y})
        this.size = new CGSize({width: width, height: height})
    }

    static get zero() {
        return new CGRect()
    }

    get width() {
        return this.size.width
    }

    get height() {
        return this.size.height
    }

    get minX() {
        return this.origin.x
    }

    get minY() {
        return this.origin.y
    }

    get maxX() {
        return this.origin.x + this.size.width
    }

    get maxY() {
        return this.origin.y + this.size.height
    }

    get midX() {
        return this.origin.x + this.size.width / 2
    }

    get midY() {
        return this.origin.y + this.size.height / 2
    }

    get isEmpty() {
        return this.size.width <= 0 || this.size.height <= 0
    }

    // CGRectContainsPoint: the minimum edges are inside, the maximum ones are not.
    contains(point) {
        return point.x >= this.minX && point.x < this.maxX && point.y >= this.minY && point.y < this.maxY
    }

    insetBy({dx, dy}) {
        return new CGRect({x: this.minX + dx, y: this.minY + dy, width: this.width - 2 * dx, height: this.height - 2 * dy})
    }

    offsetBy({dx, dy}) {
        return new CGRect({x: this.minX + dx, y: this.minY + dy, width: this.width, height: this.height})
    }
}
