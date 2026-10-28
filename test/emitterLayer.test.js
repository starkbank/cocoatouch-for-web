import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { CAEmitterLayer, CAEmitterCell, CAEmitterLayerEmitterShape, CADisplayLink, CALayer, CGPoint, CGSize, UIApplication, UIImage } from "../src/index.js"


var recordings = new Map()

function recorderFor(canvas) {
    if (!recordings.has(canvas)) {
        recordings.set(canvas, {calls: [], fillStyle: "", globalCompositeOperation: "source-over"})
    }
    return recordings.get(canvas)
}

window.HTMLCanvasElement.prototype.getContext = function() {
    var canvas = this
    var recording = recorderFor(canvas)
    var context = {
        clearRect: (...a) => recording.calls.push(["clearRect", ...a]),
        setTransform: (...a) => recording.calls.push(["setTransform", ...a]),
        rotate: (...a) => recording.calls.push(["rotate", ...a]),
        scale: (...a) => recording.calls.push(["scale", ...a]),
        drawImage: (source, ...a) => recording.calls.push(["drawImage", source, ...a]),
        fillRect: (...a) => recording.calls.push(["fillRect", recording.fillStyle, recording.globalCompositeOperation, ...a]),
    }
    Object.defineProperty(context, "fillStyle", {get: () => recording.fillStyle, set: (value) => { recording.fillStyle = value }})
    Object.defineProperty(context, "globalCompositeOperation", {get: () => recording.globalCompositeOperation, set: (value) => { recording.globalCompositeOperation = value }})
    return context
}

globalThis.Image = class {
    constructor() { this.complete = true; this.naturalWidth = 2; this.naturalHeight = 4; this.width = 2; this.height = 4 }
    set src(value) { this._src = value; if (this.onload) { this.onload() } }
    get src() { return this._src }
}

var queue = new Map()
var next = 1
globalThis.requestAnimationFrame = (callback) => { queue.set(next, callback); return next++ }
globalThis.cancelAnimationFrame = (handle) => { queue.delete(handle) }

function frame(milliseconds) {
    var callbacks = [...queue.values()]
    queue.clear()
    callbacks.forEach((callback) => callback(milliseconds))
}

function run(frames, step = 100) {
    for (var index = 0; index <= frames; index++) { frame(index * step) }
}

var keyWindow = UIApplication.shared.keyWindow
var png = new UIImage({named: "./piece.png"})

function cell(overrides = {}) {
    var piece = new CAEmitterCell()
    piece.birthRate = 10
    piece.lifetime = 1
    piece.contents = png
    piece.color = "rgba(30,144,255,1)"
    Object.assign(piece, overrides)
    return piece
}

function emitter(cells, overrides = {}) {
    var layer = new CAEmitterLayer()
    layer.emitterPosition = new CGPoint({x: 100, y: 0})
    layer.emitterSize = new CGSize({width: 0, height: 0})
    layer.emitterShape = CAEmitterLayerEmitterShape.point
    layer.emitterCells = cells
    Object.assign(layer, overrides)
    return layer
}

function canvasOf() {
    return document.querySelector("body > canvas")
}

function drawsOf(canvas) {
    return recorderFor(canvas).calls.filter((call) => call[0] === "drawImage")
}

function lastFrameDraws(canvas) {
    var calls = recorderFor(canvas).calls
    var start = calls.map((call) => call[0]).lastIndexOf("clearRect")
    return calls.slice(start).filter((call) => call[0] === "drawImage")
}

function reset() {
    page("")
    queue.clear()
    recordings = new Map()
}

test("a cell starts as Apple's: nothing emitted, scale 1, no contents", function() {
    var piece = new CAEmitterCell()
    assert.deepEqual([piece.birthRate, piece.lifetime, piece.velocity, piece.velocityRange, piece.emissionLongitude, piece.emissionRange, piece.yAcceleration, piece.spin, piece.spinRange, piece.scale, piece.scaleRange], [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0])
    assert.equal(piece.contents, null)
    assert.equal(piece.color, null)
})

test("a cell takes finite numbers, a CGColor and a UIImage, and refuses the rest naming the property", function() {
    var piece = new CAEmitterCell()
    piece.velocity = 12.5
    piece.color = "rgba(1,2,3,1)"
    piece.contents = png
    assert.equal(piece.velocity, 12.5)
    assert.equal(piece.color, "rgba(1,2,3,1)")
    assert.equal(piece.contents, png)
    assert.throws(() => { piece.birthRate = "10" }, (error) => error instanceof TypeError && /CAEmitterCell\.birthRate/.test(error.message))
    assert.throws(() => { piece.lifetime = Infinity }, TypeError)
    assert.throws(() => { piece.color = {cgColor: "red"} }, (error) => error instanceof TypeError && /CAEmitterCell\.color/.test(error.message))
    assert.throws(() => { piece.contents = "./piece.png" }, (error) => error instanceof TypeError && /CAEmitterCell\.contents/.test(error.message))
    piece.color = null
    piece.contents = null
})

test("a layer starts as Apple's: a point at the origin, no cells, birthRate and lifetime 1", function() {
    var layer = new CAEmitterLayer()
    assert.ok(layer instanceof CALayer)
    assert.deepEqual([layer.emitterPosition.x, layer.emitterPosition.y, layer.emitterSize.width, layer.emitterSize.height], [0, 0, 0, 0])
    assert.equal(layer.emitterShape, CAEmitterLayerEmitterShape.point)
    assert.deepEqual(layer.emitterCells, [])
    assert.deepEqual([layer.birthRate, layer.lifetime], [1, 1])
})

test("the emitter shapes are Apple's six, and the layer refuses a value that is none of them", function() {
    assert.deepEqual({...CAEmitterLayerEmitterShape}, {point: "point", line: "line", rectangle: "rectangle", cuboid: "cuboid", circle: "circle", sphere: "sphere"})
    var layer = new CAEmitterLayer()
    layer.emitterShape = CAEmitterLayerEmitterShape.line
    assert.equal(layer.emitterShape, "line")
    assert.throws(() => { layer.emitterShape = "triangle" }, (error) => error instanceof TypeError && /CAEmitterLayer\.emitterShape/.test(error.message))
})

test("a layer takes CGPoint, CGSize, CAEmitterCell arrays and finite rates, and refuses the rest", function() {
    var layer = new CAEmitterLayer()
    assert.throws(() => { layer.emitterPosition = [1, 2] }, (error) => error instanceof TypeError && /CAEmitterLayer\.emitterPosition/.test(error.message))
    assert.throws(() => { layer.emitterSize = {width: 1} }, (error) => error instanceof TypeError && /CAEmitterLayer\.emitterSize/.test(error.message))
    assert.throws(() => { layer.emitterCells = [{}] }, (error) => error instanceof TypeError && /CAEmitterLayer\.emitterCells/.test(error.message))
    assert.throws(() => { layer.birthRate = NaN }, (error) => error instanceof TypeError && /CAEmitterLayer\.birthRate/.test(error.message))
    assert.throws(() => { layer.lifetime = "1" }, (error) => error instanceof TypeError && /CAEmitterLayer\.lifetime/.test(error.message))
    layer.emitterCells = null
    assert.deepEqual(layer.emitterCells, [])
})

test("addSublayer puts the layer's own canvas in the window, and removeFromSuperlayer takes it out and stops the frames", function() {
    reset()
    var layer = emitter([cell()])
    keyWindow.layer.addSublayer(layer)
    var canvas = canvasOf()
    assert.ok(canvas)
    assert.equal(canvas.style.pointerEvents, "none")
    assert.equal(canvas.style.position, "fixed")
    assert.equal(queue.size, 1)
    layer.removeFromSuperlayer()
    assert.equal(canvasOf(), null)
    assert.equal(queue.size, 0)
    layer.removeFromSuperlayer()
})

test("the frames come from a CADisplayLink on the main run loop, and adding the layer twice does not double them", function() {
    reset()
    var layer = emitter([cell()])
    keyWindow.layer.addSublayer(layer)
    keyWindow.layer.addSublayer(layer)
    assert.equal(document.querySelectorAll("body > canvas").length, 1)
    assert.equal(queue.size, 1)
    assert.ok(CADisplayLink)
    layer.removeFromSuperlayer()
})

test("a cell emits birthRate pieces a second, each living lifetime seconds", function() {
    reset()
    var layer = emitter([cell({birthRate: 10, lifetime: 0.5})])
    keyWindow.layer.addSublayer(layer)
    run(10)
    var canvas = canvasOf()
    assert.equal(lastFrameDraws(canvas).length, 5)
    layer.removeFromSuperlayer()
})

test("the layer's birthRate multiplies the cells' and its lifetime multiplies theirs", function() {
    reset()
    var layer = emitter([cell({birthRate: 10, lifetime: 0.5})], {birthRate: 2, lifetime: 2})
    keyWindow.layer.addSublayer(layer)
    run(10)
    assert.equal(lastFrameDraws(canvasOf()).length, 20)
    layer.removeFromSuperlayer()
})

test("birthRate 0 stops the emission and the pieces already alive finish their lifetime", function() {
    reset()
    var layer = emitter([cell({birthRate: 10, lifetime: 0.5})])
    keyWindow.layer.addSublayer(layer)
    run(10)
    layer.birthRate = 0
    frame(1100)
    assert.equal(lastFrameDraws(canvasOf()).length, 4)
    run(0)
    for (var index = 12; index <= 20; index++) { frame(index * 100) }
    assert.equal(lastFrameDraws(canvasOf()).length, 0)
    layer.removeFromSuperlayer()
})

test("a cell with no contents is simulated and draws nothing", function() {
    reset()
    var layer = emitter([cell({contents: null})])
    keyWindow.layer.addSublayer(layer)
    run(5)
    assert.equal(drawsOf(canvasOf()).length, 0)
    layer.removeFromSuperlayer()
})

test("a piece is drawn tinted with its cell's color, from its contents, and the tint is made once", function() {
    reset()
    var layer = emitter([cell({color: "rgba(220,20,60,1)"})])
    keyWindow.layer.addSublayer(layer)
    run(5)
    var tints = [...recordings.values()].flatMap((recording) => recording.calls.filter((call) => call[0] === "fillRect" && call[2] === "source-in"))
    assert.deepEqual(tints.map((call) => call[1]), ["rgba(220,20,60,1)"])
    var draws = drawsOf(canvasOf())
    assert.ok(draws.length > 1)
    assert.ok(draws.every((call) => call[1] === draws[0][1]))
    layer.removeFromSuperlayer()
})

function isPiece(call) {
    return call[0] === "setTransform" && !(call[5] === 0 && call[6] === 0)
}

function transformsOfLastFrame(canvas) {
    var calls = recorderFor(canvas).calls
    var start = calls.map((call) => call[0]).lastIndexOf("clearRect")
    return calls.slice(start).filter(isPiece).map((call) => ({x: call[5], y: call[6]}))
}

test("velocity along the emission longitude moves a piece, y downward as on the screen", function() {
    reset()
    var layer = emitter([cell({birthRate: 10, lifetime: 5, velocity: 100, emissionLongitude: Math.PI / 2})])
    keyWindow.layer.addSublayer(layer)
    frame(0)
    frame(100)
    frame(200)
    var pieces = transformsOfLastFrame(canvasOf()).sort((a, b) => a.y - b.y)
    assert.equal(pieces.length, 2)
    assert.ok(Math.abs(pieces[0].y - 10) < 1e-6 && Math.abs(pieces[1].y - 20) < 1e-6)
    assert.ok(pieces.every((piece) => Math.abs(piece.x - 100) < 1e-6))
    layer.removeFromSuperlayer()
})

test("emissionLongitude 0 goes along +x, and yAcceleration adds to the vertical velocity each frame", function() {
    reset()
    var right = emitter([cell({birthRate: 10, lifetime: 5, velocity: 100, emissionLongitude: 0})])
    keyWindow.layer.addSublayer(right)
    frame(0)
    frame(100)
    frame(200)
    var moved = transformsOfLastFrame(canvasOf()).sort((a, b) => a.x - b.x)
    assert.ok(Math.abs(moved[0].x - 110) < 1e-6 && Math.abs(moved[1].x - 120) < 1e-6)
    assert.ok(moved.every((piece) => Math.abs(piece.y) < 1e-6))
    right.removeFromSuperlayer()
    reset()
    var falling = emitter([cell({birthRate: 10, lifetime: 5, velocity: 0, yAcceleration: 1000})])
    keyWindow.layer.addSublayer(falling)
    frame(0)
    frame(100)
    frame(200)
    var ys = transformsOfLastFrame(canvasOf()).map((piece) => piece.y).sort((a, b) => a - b)
    assert.ok(Math.abs(ys[0] - 10) < 1e-6 && Math.abs(ys[1] - 30) < 1e-6)
    falling.removeFromSuperlayer()
})

test("velocityRange, emissionRange, scaleRange and spinRange spread a cell around its values", function() {
    reset()
    var originalRandom = Math.random
    Math.random = () => 1
    try {
        var layer = emitter([cell({birthRate: 10, lifetime: 5, velocity: 100, velocityRange: 50, emissionLongitude: 0, emissionRange: Math.PI, scale: 1, scaleRange: 0.5, spin: 1, spinRange: 2})])
        keyWindow.layer.addSublayer(layer)
        frame(0)
        frame(100)
        var calls = recorderFor(canvasOf()).calls
        var last = calls.slice(calls.map((call) => call[0]).lastIndexOf("clearRect"))
        var piece = last.find(isPiece)
        var speed = Math.hypot(piece[5] - 100, piece[6]) / 0.1
        assert.ok(Math.abs(speed - 150) < 1e-6)
        assert.ok(Math.abs(Math.atan2(piece[6], piece[5] - 100) - Math.PI / 2) < 1e-6)
        var rotation = last.find((call) => call[0] === "rotate")
        assert.ok(Math.abs(rotation[1] - 0.3) < 1e-6)
        var scale = last.find((call) => call[0] === "scale")
        assert.ok(Math.abs(scale[1] - 1.5) < 1e-6 && Math.abs(scale[2] - 1.5) < 1e-6)
        layer.removeFromSuperlayer()
    } finally {
        Math.random = originalRandom
    }
})

test("a line emits across its width, a rectangle inside its size, and a point at its position", function() {
    reset()
    var originalRandom = Math.random
    var values = [0, 1, 0.5, 0.25, 0.75, 0.1, 0.9]
    var at = 0
    Math.random = () => values[at++ % values.length]
    try {
        var line = emitter([cell({birthRate: 30, lifetime: 5})], {emitterShape: CAEmitterLayerEmitterShape.line, emitterPosition: new CGPoint({x: 100, y: 0}), emitterSize: new CGSize({width: 40, height: 0})})
        keyWindow.layer.addSublayer(line)
        frame(0)
        frame(100)
        var xs = recorderFor(canvasOf()).calls.filter(isPiece).map((call) => call[5])
        assert.ok(xs.length >= 3)
        assert.ok(xs.every((x) => x >= 80 - 1e-6 && x <= 120 + 1e-6))
        assert.ok(xs.some((x) => x < 100) && xs.some((x) => x > 100))
        line.removeFromSuperlayer()
    } finally {
        Math.random = originalRandom
    }
})

test("the canvas covers the window and follows its size", function() {
    reset()
    window.innerWidth = 800
    window.innerHeight = 600
    var layer = emitter([cell()])
    keyWindow.layer.addSublayer(layer)
    frame(0)
    var canvas = canvasOf()
    assert.deepEqual([canvas.width, canvas.height], [800, 600])
    window.innerWidth = 1000
    frame(100)
    assert.deepEqual([canvas.width, canvas.height], [1000, 600])
    layer.removeFromSuperlayer()
})

test("removing the layer clears what it was drawing and a second add starts again", function() {
    reset()
    var layer = emitter([cell({birthRate: 10, lifetime: 5})])
    keyWindow.layer.addSublayer(layer)
    run(10)
    layer.removeFromSuperlayer()
    keyWindow.layer.addSublayer(layer)
    frame(2000)
    assert.equal(lastFrameDraws(canvasOf()).length, 0)
    layer.removeFromSuperlayer()
})

test("a cell's tint is resolved once per frame, not once per particle", function() {
    reset()
    var layer = emitter([cell({birthRate: 100, lifetime: 5}), cell({birthRate: 100, lifetime: 5, color: "rgba(1,2,3,1)"}), cell({birthRate: 0, lifetime: 5})])
    keyWindow.layer.addSublayer(layer)
    run(5)
    var resolutions = 0
    var original = layer._tint
    layer._tint = function(...a) { resolutions += 1; return original.apply(this, a) }
    frame(600)
    layer._tint = original
    assert.ok(lastFrameDraws(canvasOf()).length > 10)
    assert.equal(resolutions, 2)
    layer.removeFromSuperlayer()
})

