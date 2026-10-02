import { CALayer } from "./calayer.js"
import { CGPoint } from "../coregraphics/cgpoint.js"
import { uuid } from "../utils/uuid.js"


// Core Animation's CAGradientLayer: a layer that paints a gradient between
// its colors. It owns a <div> that fills its superlayer's element once added
// with addSublayer, and draws the gradient as a CSS linear-gradient.
export class CAGradientLayer extends CALayer {

    constructor() {
        super("#" + uuid())
        this._boundElement = null
        this._colors = []
        this._locations = null
        this._startPoint = new CGPoint({x: 0.5, y: 0})
        this._endPoint = new CGPoint({x: 0.5, y: 1})
        this.type = "axial"
    }

    get colors() {
        return this._colors
    }

    set colors(colors) {
        this._colors = colors || []
        this._draw()
    }

    get locations() {
        return this._locations
    }

    set locations(locations) {
        this._locations = locations
        this._draw()
    }

    get startPoint() {
        return this._startPoint
    }

    set startPoint(point) {
        this._startPoint = point
        this._draw()
    }

    get endPoint() {
        return this._endPoint
    }

    set endPoint(point) {
        this._endPoint = point
        this._draw()
    }

    get _element() {
        if (this._boundElement) { return this._boundElement }
        var element = document.createElement("div")
        element.id = this.selector.slice(1)
        Object.assign(element.style, {position: "absolute", inset: "0", pointerEvents: "none"})
        this._boundElement = element
        this._draw()
        return element
    }

    _draw() {
        if (!this._boundElement) { return }
        if (this._colors.length === 0) {
            this._boundElement.style.background = ""
            return
        }
        var stops = this._colors.map((color, index) => {
            var location = this._locations ? this._locations[index] : index / Math.max(1, this._colors.length - 1)
            return `${color} ${Math.round(location * 1000) / 10}%`
        })
        this._boundElement.style.background = `linear-gradient(${_angle(this._startPoint, this._endPoint)}deg, ${stops.join(", ")})`
    }
}


// CSS measures the gradient line clockwise from "up"; the points run top-left to bottom-right.
function _angle(start, end) {
    var degrees = Math.atan2(end.x - start.x, -(end.y - start.y)) * 180 / Math.PI
    return Math.round(((degrees % 360) + 360) % 360 * 100) / 100
}
