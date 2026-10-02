// Core Graphics' CGAffineTransform: the 2×3 matrix [a b c d tx ty] that maps
// a view's coordinate space, which on the web is the element's CSS transform.
export class CGAffineTransform {

    // CGAffineTransform(a:b:c:d:tx:ty:), (scaleX:y:), (translationX:y:) or (rotationAngle:)
    constructor({a, b, c, d, tx, ty, scaleX, y, translationX, rotationAngle} = {}) {
        if (rotationAngle !== undefined) {
            var cos = Math.cos(rotationAngle), sin = Math.sin(rotationAngle)
            Object.assign(this, {a: cos, b: sin, c: -sin, d: cos, tx: 0, ty: 0})
            return
        }
        if (scaleX !== undefined) {
            Object.assign(this, {a: scaleX, b: 0, c: 0, d: y === undefined ? scaleX : y, tx: 0, ty: 0})
            return
        }
        if (translationX !== undefined) {
            Object.assign(this, {a: 1, b: 0, c: 0, d: 1, tx: translationX, ty: y === undefined ? 0 : y})
            return
        }
        Object.assign(this, {a: a === undefined ? 1 : a, b: b || 0, c: c || 0, d: d === undefined ? 1 : d, tx: tx || 0, ty: ty || 0})
    }

    static get identity() {
        return new CGAffineTransform()
    }

    get isIdentity() {
        return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.tx === 0 && this.ty === 0
    }

    // this × other, as CGAffineTransformConcat: other applies after this one.
    concatenating(other) {
        return new CGAffineTransform({
            a: this.a * other.a + this.b * other.c,
            b: this.a * other.b + this.b * other.d,
            c: this.c * other.a + this.d * other.c,
            d: this.c * other.b + this.d * other.d,
            tx: this.tx * other.a + this.ty * other.c + other.tx,
            ty: this.tx * other.b + this.ty * other.d + other.ty,
        })
    }

    scaledBy({x, y}) {
        return new CGAffineTransform({scaleX: x, y: y}).concatenating(this)
    }

    translatedBy({x, y}) {
        return new CGAffineTransform({translationX: x, y: y}).concatenating(this)
    }

    rotated({by}) {
        return new CGAffineTransform({rotationAngle: by}).concatenating(this)
    }

    inverted() {
        var det = this.a * this.d - this.b * this.c
        if (det === 0) { return new CGAffineTransform(this) }
        return new CGAffineTransform({
            a: this.d / det,
            b: -this.b / det,
            c: -this.c / det,
            d: this.a / det,
            tx: (this.c * this.ty - this.d * this.tx) / det,
            ty: (this.b * this.tx - this.a * this.ty) / det,
        })
    }
}
