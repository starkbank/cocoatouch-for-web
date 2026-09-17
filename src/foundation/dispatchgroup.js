

// Tracks a set of asynchronous tasks: enter() before each starts, leave()
// when it ends, notify() runs once every entered task has left.
export class DispatchGroup {

    constructor() {
        this._entered = 0
        this._left = 0
        this._callback = null
    }

    enter() {
        this._entered += 1
    }

    leave() {
        this._left += 1
        this._notifyIfDone()
    }

    notify(callback) {
        this._callback = callback
        this._notifyIfDone()
    }

    _notifyIfDone() {
        if (!this._callback) { return }
        if (this._entered === 0 || this._left < this._entered) { return }
        var callback = this._callback
        this._callback = null
        callback()
    }
}
