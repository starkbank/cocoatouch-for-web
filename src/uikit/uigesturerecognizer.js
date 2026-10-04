import { NSObject } from "../foundation/nsobject.js"


const State = Object.freeze({
    possible: "possible",
    began: "began",
    changed: "changed",
    ended: "ended",
    cancelled: "cancelled",
    failed: "failed",
})


export class UIGestureRecognizer extends NSObject {

    static get State() {
        return State
    }

    /**
     * @param {object} options
     * @param {object} options.target
     * @param {Function} options.action
     */
    constructor({target, action}) {
        super()
        this.target = target
        this.action = action
        this.view = null
        this.state = State.possible
    }

    get event() {
        return "click"
    }

    // The DOM events the view listens to, and the state each one puts the recognizer in.
    get events() {
        return {[this.event]: State.ended}
    }

    // Whether a DOM event counts for this recognizer at all.
    _recognizes(event) {
        return true
    }
}


export class UITapGestureRecognizer extends UIGestureRecognizer {

}


// Fires as a pointer enters, moves over and leaves the view. As on iPadOS it
// hears only indirect pointers, so a finger tapping the view is not a hover.
export class UIHoverGestureRecognizer extends UIGestureRecognizer {

    get events() {
        return {pointerenter: State.began, pointermove: State.changed, pointerleave: State.ended}
    }

    _recognizes(event) {
        var original = event.originalEvent || event
        return original.pointerType === "mouse"
    }
}
