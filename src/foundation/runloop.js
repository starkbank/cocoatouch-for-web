import { NSObject } from "./nsobject.js"


// RunLoop.Mode's two cases. A browser has one event loop and no modes, so both
// are accepted and neither changes anything; they exist so that Apple's
// add(to:forMode:) is written as it is on iOS.
const runLoopMode = Object.freeze({
    default: "default",
    common: "common",
})

var _isConstructing = false
var _main = null


// Foundation's RunLoop, as a token: `RunLoop.main` and `RunLoop.Mode` are what
// CADisplayLink.add(to:forMode:) takes. `run()` is omitted because a browser's
// event loop is not one a page can enter or leave.
export class RunLoop extends NSObject {

    // Apple's RunLoop has no public init: the loops come from `main`.
    constructor() {
        super()
        if (!_isConstructing) { throw new TypeError("RunLoop has no initializer: use RunLoop.main.") }
    }

    static get Mode() {
        return runLoopMode
    }

    // The loop of the calling thread, and a page has one thread: the main loop.
    static get current() {
        return RunLoop.main
    }

    static get main() {
        if (_main) { return _main }
        _isConstructing = true
        _main = new RunLoop()
        _isConstructing = false
        return _main
    }
}
