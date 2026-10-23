import { CALayer } from "./calayer.js"
import { CADisplayLink } from "./cadisplaylink.js"
import { CAEmitterCell } from "./caemittercell.js"
import { CGPoint } from "../coregraphics/cgpoint.js"
import { CGSize } from "../coregraphics/cgsize.js"
import { RunLoop } from "../foundation/runloop.js"
import { imageSource } from "../uikit/uiimage.js"
import { typed, enumeration, arrayOf, instance, CGPointType, CGSizeType } from "../utils/required.js"
import { uuid } from "../utils/uuid.js"


// Apple's CAEmitterLayerEmitterShape. The drawing is flat, so a cuboid is a
// rectangle and a sphere an ellipse: there is no depth to emit through.
export const CAEmitterLayerEmitterShape = Object.freeze({
    point: "point",
    line: "line",
    rectangle: "rectangle",
    cuboid: "cuboid",
    circle: "circle",
    sphere: "sphere",
})

const shapeType = enumeration(CAEmitterLayerEmitterShape, "CAEmitterLayerEmitterShape")
const cellsType = arrayOf(instance(CAEmitterCell, "CAEmitterCell"))

// A frame that took longer than this, a tab that was in the background, is
// simulated as this long, so the pieces do not jump and the emitter does not burst.
const longestStep = 0.1

// Seconds are floats: ten frames of a tenth of a second owe ten pieces, not nine and a rounding error.
const epsilon = 1e-9


// Core Animation's CAEmitterLayer: it throws the particles its cells describe.
// The layer owns a canvas that covers the window, fixed, above the page and
// deaf to the pointer, which an app cannot reach; it draws on one frame of a
// CADisplayLink once the layer is added to the key window's layer with
// addSublayer, and stops, with every particle gone, when removeFromSuperlayer
// takes it out. Its coordinates are the window's, y running down. A layer's
// birthRate and lifetime multiply its cells'. emitterMode and renderMode are
// not provided: particles are drawn in the order they are born, as volume.
// emissionLongitude 0 goes along +x and pi / 2 goes down the screen; the
// cone of emissionRange is centred on it, and every other Range is a variation
// of that much either way.
export class CAEmitterLayer extends CALayer {

    constructor() {
        super("#" + uuid())
        this._boundElement = null
        this._context = null
        this._emitterPosition = new CGPoint({x: 0, y: 0})
        this._emitterSize = new CGSize({width: 0, height: 0})
        this._emitterShape = CAEmitterLayerEmitterShape.point
        this._emitterCells = []
        this._birthRate = 1
        this._lifetime = 1
        this._particles = []
        this._carry = new Map()
        this._tints = new Map()
        this._link = null
        this._lastTimestamp = null
    }

    set emitterPosition(point) {
        typed(point, "emitterPosition", CGPointType, "CAEmitterLayer.emitterPosition", "Apple's is var emitterPosition: CGPoint; write layer.emitterPosition = new CGPoint({x, y}).")
        this._emitterPosition = point
    }

    get emitterPosition() {
        return this._emitterPosition
    }

    set emitterSize(size) {
        typed(size, "emitterSize", CGSizeType, "CAEmitterLayer.emitterSize", "Apple's is var emitterSize: CGSize; write layer.emitterSize = new CGSize({width, height}).")
        this._emitterSize = size
    }

    get emitterSize() {
        return this._emitterSize
    }

    set emitterShape(shape) {
        typed(shape, "emitterShape", shapeType, "CAEmitterLayer.emitterShape", "Apple's is var emitterShape: CAEmitterLayerEmitterShape; write layer.emitterShape = CAEmitterLayerEmitterShape.line.")
        this._emitterShape = shape
    }

    get emitterShape() {
        return this._emitterShape
    }

    set emitterCells(cells) {
        if (cells === null) { cells = [] }
        typed(cells, "emitterCells", cellsType, "CAEmitterLayer.emitterCells", "Apple's is var emitterCells: [CAEmitterCell]?; write layer.emitterCells = [cell].")
        this._emitterCells = cells
        this._carry = new Map()
    }

    get emitterCells() {
        return this._emitterCells
    }

    set birthRate(rate) {
        _rate(rate, "birthRate")
        this._birthRate = rate
    }

    get birthRate() {
        return this._birthRate
    }

    set lifetime(lifetime) {
        _rate(lifetime, "lifetime")
        this._lifetime = lifetime
    }

    get lifetime() {
        return this._lifetime
    }

    get _element() {
        if (this._boundElement) { return this._boundElement }
        var canvas = document.createElement("canvas")
        canvas.id = this.selector.slice(1)
        Object.assign(canvas.style, {display: "block", position: "fixed", top: "0", left: "0", zIndex: "999999", pointerEvents: "none"})
        this._boundElement = canvas
        this._context = canvas.getContext("2d")
        return canvas
    }

    _didAddToSuperlayer() {
        if (this._link !== null) { return }
        this._link = new CADisplayLink({target: this, selector: (link) => this._step(link)})
        this._link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
    }

    _didRemoveFromSuperlayer() {
        if (this._link !== null) {
            this._link.invalidate()
            this._link = null
        }
        this._particles = []
        this._carry = new Map()
        this._lastTimestamp = null
    }

    _step(link) {
        var elapsed = this._lastTimestamp === null ? 0 : link.timestamp - this._lastTimestamp
        var seconds = Math.min(Math.max(elapsed, 0), longestStep)
        this._lastTimestamp = link.timestamp
        this._fit()
        this._emit(seconds)
        this._advance(seconds)
        this._draw()
    }

    _fit() {
        var canvas = this._boundElement
        var width = window.innerWidth
        var height = window.innerHeight
        if (canvas.width !== width) { canvas.width = width }
        if (canvas.height !== height) { canvas.height = height }
    }

    _emit(seconds) {
        for (var cell of this._emitterCells) {
            var rate = cell.birthRate * this._birthRate
            var lifetime = cell.lifetime * this._lifetime
            if (rate <= 0 || lifetime <= 0) { continue }
            var owed = (this._carry.get(cell) || 0) + rate * seconds
            var count = Math.floor(owed + epsilon)
            this._carry.set(cell, owed - count)
            for (var index = 0; index < count; index++) {
                this._particles.push(this._born(cell, lifetime))
            }
        }
    }

    _born(cell, lifetime) {
        var spot = this._spot(Math.random(), Math.random())
        var speed = cell.velocity + _spread(cell.velocityRange)
        var direction = cell.emissionLongitude + _spread(cell.emissionRange / 2)
        return {
            cell: cell,
            x: spot.x,
            y: spot.y,
            vx: Math.cos(direction) * speed,
            vy: Math.sin(direction) * speed,
            spin: cell.spin + _spread(cell.spinRange),
            scale: cell.scale + _spread(cell.scaleRange),
            angle: 0,
            age: 0,
            lifetime: lifetime,
        }
    }

    _spot(across, down) {
        var {x, y} = this._emitterPosition
        var {width, height} = this._emitterSize
        var shape = this._emitterShape
        if (shape === CAEmitterLayerEmitterShape.line) {
            return {x: x + (across - 0.5) * width, y: y}
        }
        if (shape === CAEmitterLayerEmitterShape.rectangle || shape === CAEmitterLayerEmitterShape.cuboid) {
            return {x: x + (across - 0.5) * width, y: y + (down - 0.5) * height}
        }
        if (shape === CAEmitterLayerEmitterShape.circle || shape === CAEmitterLayerEmitterShape.sphere) {
            var radius = Math.sqrt(down) / 2
            var angle = across * 2 * Math.PI
            return {x: x + Math.cos(angle) * radius * width, y: y + Math.sin(angle) * radius * height}
        }
        return {x, y}
    }

    _advance(seconds) {
        var alive = []
        for (var particle of this._particles) {
            particle.age += seconds
            if (particle.age >= particle.lifetime) { continue }
            particle.vy += particle.cell.yAcceleration * seconds
            particle.x += particle.vx * seconds
            particle.y += particle.vy * seconds
            particle.angle += particle.spin * seconds
            alive.push(particle)
        }
        this._particles = alive
    }

    _draw() {
        var context = this._context
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, this._boundElement.width, this._boundElement.height)
        for (var particle of this._particles) {
            var tint = this._tint(particle.cell)
            if (tint === null) { continue }
            context.setTransform(1, 0, 0, 1, particle.x, particle.y)
            context.rotate(particle.angle)
            context.scale(particle.scale, particle.scale)
            context.drawImage(tint, -tint.width / 2, -tint.height / 2)
        }
    }

    // The cell's image in the cell's color, made when its image has loaded and
    // kept while neither changes.
    _tint(cell) {
        var image = cell.contents
        if (image === null) { return null }
        var source = imageSource(image)
        var color = cell.color || "rgba(255,255,255,1)"
        var kept = this._tints.get(cell)
        if (kept && kept.source === source && kept.color === color) { return kept.canvas }
        var tint = {source, color, canvas: null}
        this._tints.set(cell, tint)
        var picture = new Image()
        picture.onload = () => {
            var canvas = document.createElement("canvas")
            canvas.width = picture.naturalWidth || picture.width
            canvas.height = picture.naturalHeight || picture.height
            var tinting = canvas.getContext("2d")
            tinting.drawImage(picture, 0, 0)
            tinting.globalCompositeOperation = "source-in"
            tinting.fillStyle = color
            tinting.fillRect(0, 0, canvas.width, canvas.height)
            tint.canvas = canvas
        }
        picture.src = source
        return tint.canvas
    }
}


function _rate(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`CAEmitterLayer.${name} takes a finite number of 0 or more: Apple's is var ${name}: Float.`)
    }
}

function _spread(range) {
    return (Math.random() * 2 - 1) * range
}
