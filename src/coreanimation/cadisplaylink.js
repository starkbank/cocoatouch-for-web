import { NSObject } from "../foundation/nsobject.js"
import { RunLoop } from "../foundation/runloop.js"
import { required, enumeration } from "../utils/required.js"


const modeType = enumeration(RunLoop.Mode, "RunLoop.Mode")

// What duration reads until a frame has been measured: a display's usual refresh.
const nominalDuration = 1 / 60

const initSignature = "Apple's is CADisplayLink(target:selector:); write new CADisplayLink({target, selector: target.step})."
const addSignature = "Apple's is add(to:forMode:); write link.add({to: RunLoop.main, forMode: RunLoop.Mode.common})."
const removeSignature = "Apple's is remove(from:forMode:); write link.remove({from: RunLoop.main, forMode: RunLoop.Mode.common})."


// Core Animation's CADisplayLink on requestAnimationFrame: once added to the
// main run loop it calls the selector on its target before every frame. It
// ticks while it is added to at least one mode and is not paused; a browser
// has no run loop modes, so every mode behaves alike. The selector receives the
// link, as Apple's `@objc func step(displayLink:)` does, and `timestamp`,
// `targetTimestamp` and `duration` are seconds, as Apple's CFTimeIntervals are.
export class CADisplayLink extends NSObject {

    /**
     * @param {object} options
     * @param {object} options.target
     * @param {Function|string} options.selector A function, or the name of a method of the target.
     */
    constructor({target, selector} = {}) {
        super()
        if (target === undefined || target === null) { throw new TypeError(`CADisplayLink(target:selector:) requires a target: ${initSignature}`) }
        var method = typeof selector === "string" ? target[selector] : selector
        if (typeof method !== "function") { throw new TypeError(`CADisplayLink(target:selector:) requires a selector that is a function or the name of a method of the target: ${initSignature}`) }
        this._target = target
        this._selector = method
        this._modes = new Set()
        this._isPaused = false
        this._handle = null
        this._previous = null
        this._timestamp = 0
        this._duration = nominalDuration
        this._isInvalid = false
    }

    get timestamp() {
        return this._timestamp
    }

    get duration() {
        return this._duration
    }

    get targetTimestamp() {
        return this._timestamp + this._duration
    }

    get isPaused() {
        return this._isPaused
    }

    set isPaused(paused) {
        this._isPaused = Boolean(paused)
        this._previous = null
        this._update()
    }

    /**
     * @param {object} options
     * @param {RunLoop} options.to
     * @param {"default"|"common"} options.forMode
     */
    add({to, forMode} = {}) {
        _check(to, forMode, "CADisplayLink.add", addSignature)
        if (this._isInvalid) { return }
        if (typeof globalThis.requestAnimationFrame !== "function") {
            throw new TypeError("CADisplayLink.add needs requestAnimationFrame, which this environment does not have.")
        }
        this._modes.add(forMode)
        this._update()
    }

    /**
     * @param {object} options
     * @param {RunLoop} options.from
     * @param {"default"|"common"} options.forMode
     */
    remove({from, forMode} = {}) {
        _check(from, forMode, "CADisplayLink.remove", removeSignature)
        this._modes.delete(forMode)
        this._update()
    }

    // Ends the link for good and drops what it holds, so a target is not kept alive by it.
    invalidate() {
        this._isInvalid = true
        this._modes.clear()
        this._target = null
        this._selector = null
        this._update()
    }

    // One frame is requested at a time, so a link added twice ticks once, and
    // the next is requested before the selector runs so that the selector may
    // pause or invalidate the link and end the ticks that same frame.
    _update() {
        var shouldTick = this._modes.size > 0 && !this._isPaused && !this._isInvalid
        if (shouldTick && this._handle === null) {
            this._handle = globalThis.requestAnimationFrame((milliseconds) => this._tick(milliseconds))
            return
        }
        if (shouldTick || this._handle === null) { return }
        globalThis.cancelAnimationFrame(this._handle)
        this._handle = null
    }

    _tick(milliseconds) {
        this._handle = null
        var seconds = milliseconds / 1000
        this._duration = this._previous === null ? nominalDuration : seconds - this._previous
        this._previous = seconds
        this._timestamp = seconds
        this._update()
        this._selector.call(this._target, this)
    }
}


function _check(loop, mode, method, signature) {
    if (loop !== RunLoop.main) {
        throw new TypeError(`${method} supports only RunLoop.main, as a browser has one event loop: ${signature}`)
    }
    required(mode, "forMode", modeType, method, signature)
}
