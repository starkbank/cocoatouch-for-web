// Core Media's CMTime: a rational time, value over timescale, with the flags
// that say whether it is a number at all. Media clocks count in integer ticks
// so that frame boundaries stay exact; seconds are derived, never stored.
const Flags = Object.freeze({
    valid: 1,
    hasBeenRounded: 2,
    positiveInfinity: 4,
    negativeInfinity: 8,
    indefinite: 16,
})


export class CMTime {

    // CMTime(value:timescale:) or CMTime(seconds:preferredTimescale:)
    /**
     * @param {object} options
     * @param {*} [options.value]
     * @param {*} [options.timescale]
     * @param {*} [options.seconds]
     * @param {*} [options.preferredTimescale}]
     */
    constructor({value, timescale, seconds, preferredTimescale} = {}) {
        this.epoch = 0
        if (seconds === undefined) {
            this.value = value === undefined ? 0 : value
            this.timescale = timescale === undefined ? 0 : timescale
            this.flags = this.timescale > 0 ? Flags.valid : 0
            return
        }
        if (preferredTimescale === undefined) {
            throw new TypeError("CMTime(seconds:preferredTimescale:) needs a preferredTimescale, as in Swift")
        }
        this.timescale = preferredTimescale
        if (Number.isNaN(seconds)) {
            this.value = 0
            this.flags = 0
            return
        }
        if (seconds === Infinity || seconds === -Infinity) {
            this.value = 0
            this.flags = Flags.valid | (seconds > 0 ? Flags.positiveInfinity : Flags.negativeInfinity)
            return
        }
        var exact = seconds * preferredTimescale
        this.value = Math.round(exact)
        this.flags = Flags.valid | (this.value === exact ? 0 : Flags.hasBeenRounded)
    }

    static get zero() {
        return new CMTime({value: 0, timescale: 1})
    }

    static get invalid() {
        return new CMTime()
    }

    static get indefinite() {
        return _flagged(Flags.valid | Flags.indefinite)
    }

    static get positiveInfinity() {
        return _flagged(Flags.valid | Flags.positiveInfinity)
    }

    static get negativeInfinity() {
        return _flagged(Flags.valid | Flags.negativeInfinity)
    }

    get seconds() {
        if (!this.isValid || this.isIndefinite) { return NaN }
        if (this.isPositiveInfinity) { return Infinity }
        if (this.isNegativeInfinity) { return -Infinity }
        return this.value / this.timescale
    }

    get isValid() {
        return (this.flags & Flags.valid) !== 0
    }

    get isIndefinite() {
        return this.isValid && (this.flags & Flags.indefinite) !== 0
    }

    get isPositiveInfinity() {
        return this.isValid && (this.flags & Flags.positiveInfinity) !== 0
    }

    get isNegativeInfinity() {
        return this.isValid && (this.flags & Flags.negativeInfinity) !== 0
    }

    get isNumeric() {
        return this.isValid && !this.isIndefinite && !this.isPositiveInfinity && !this.isNegativeInfinity
    }

    get hasBeenRounded() {
        return (this.flags & Flags.hasBeenRounded) !== 0
    }
}


// CMTimeCompare(_:_:): -1, 0 or 1, ordering -∞ < numbers < +∞ < indefinite < invalid.
export function CMTimeCompare(first, second) {
    var a = _rank(first), b = _rank(second)
    if (a !== b) { return a < b ? -1 : 1 }
    if (a !== 0) { return 0 }
    var left = first.value * second.timescale, right = second.value * first.timescale
    if (left === right) { return 0 }
    return left < right ? -1 : 1
}


function _flagged(flags) {
    var time = new CMTime({value: 0, timescale: 1})
    time.flags = flags
    return time
}

function _rank(time) {
    if (!time.isValid) { return 3 }
    if (time.isIndefinite) { return 2 }
    if (time.isPositiveInfinity) { return 1 }
    if (time.isNegativeInfinity) { return -1 }
    return 0
}
