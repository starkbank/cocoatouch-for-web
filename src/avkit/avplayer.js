import { NSObject } from "../foundation/nsobject.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { AVPlayerItem } from "./avplayeritem.js"
import { CMTime } from "../coremedia/cmtime.js"


const Status = Object.freeze({
    unknown: "unknown",
    readyToPlay: "readyToPlay",
    failed: "failed",
})

const TimeControlStatus = Object.freeze({
    paused: "paused",
    waitingToPlayAtSpecifiedRate: "waitingToPlayAtSpecifiedRate",
    playing: "playing",
})

const ActionAtItemEnd = Object.freeze({
    advance: "advance",
    pause: "pause",
    none: "none",
})

const haveFutureData = 3

// Media elements report seconds as floats; AVFoundation keeps them as ticks.
// 600 is the timescale Apple's samples use: it divides 24, 25, 30 and 60 fps evenly.
const preferredTimescale = 600


// Plays one item at a time and reports on it, as AVFoundation's player does.
// It renders through the AVPlayerLayers it is attached to, each wrapping a
// media element; a player with no layer keeps its settings until one arrives.
// Only what the app sets is written to an element, so a <video muted autoplay>
// on the page keeps playing on its own terms until the app says otherwise.
export class AVPlayer extends NSObject {

    static get Status() {
        return Status
    }

    static get TimeControlStatus() {
        return TimeControlStatus
    }

    static get ActionAtItemEnd() {
        return ActionAtItemEnd
    }

    // AVPlayer(), AVPlayer(url:) or AVPlayer(playerItem:)
    constructor({url, playerItem} = {}) {
        super()
        this._item = playerItem || (url ? new AVPlayerItem({url}) : null)
        this._layers = []
        this._settings = {}
        this._listeners = new Map()
        this._status = Status.unknown
        this._error = null
        this.actionAtItemEnd = ActionAtItemEnd.pause
    }

    get currentItem() {
        return this._item
    }

    replaceCurrentItem({with: item}) {
        this._item = item || null
        for (var element of this._elements()) {
            this._load(element)
        }
    }

    play() {
        this.rate = 1
    }

    pause() {
        this.rate = 0
    }

    get rate() {
        var element = this._elements()[0]
        if (!element) { return this._settings.rate || 0 }
        return element.paused ? 0 : element.playbackRate
    }

    set rate(rate) {
        this._settings.rate = rate
        for (var element of this._elements()) {
            _applyRate(element, rate)
        }
    }

    get isMuted() {
        var element = this._elements()[0]
        if (!element) { return this._settings.muted || false }
        return element.muted
    }

    set isMuted(muted) {
        this._settings.muted = muted
        for (var element of this._elements()) {
            element.muted = muted
        }
    }

    get volume() {
        var element = this._elements()[0]
        if (!element) { return this._settings.volume === undefined ? 1 : this._settings.volume }
        return element.volume
    }

    set volume(volume) {
        this._settings.volume = volume
        for (var element of this._elements()) {
            element.volume = volume
        }
    }

    currentTime() {
        if (!this._item) { return CMTime.invalid }
        var element = this._elements()[0]
        if (!element) { return CMTime.zero }
        return new CMTime({seconds: element.currentTime, preferredTimescale: preferredTimescale})
    }

    // seek(to:) or seek(to:completionHandler:); the handler hears whether the seek finished.
    seek({to, completionHandler}) {
        if (!to.isNumeric) {
            if (completionHandler) { completionHandler(false) }
            return
        }
        var elements = this._elements()
        this._settings.currentTime = to.seconds
        if (elements.length === 0) {
            if (completionHandler) { completionHandler(true) }
            return
        }
        if (completionHandler) {
            elements[0].addEventListener("seeked", () => completionHandler(true), {once: true})
        }
        for (var element of elements) {
            element.currentTime = to.seconds
        }
    }

    // The player's own readiness: ready once it can play its first item. An
    // item that fails keeps the player ready for the next one, as in AVFoundation.
    get status() {
        return this._status
    }

    get error() {
        return this._error
    }

    get timeControlStatus() {
        var element = this._elements()[0]
        if (!element || element.paused) { return TimeControlStatus.paused }
        if (element.readyState < haveFutureData) { return TimeControlStatus.waitingToPlayAtSpecifiedRate }
        return TimeControlStatus.playing
    }

    _attach(layer) {
        if (this._layers.indexOf(layer) !== -1) { return }
        this._layers.push(layer)
        var element = layer._element
        if (!element) { return }
        this._listen(element)
        this._load(element)
        if (this._settings.muted !== undefined) { element.muted = this._settings.muted }
        if (this._settings.volume !== undefined) { element.volume = this._settings.volume }
        if (this._settings.currentTime !== undefined) { element.currentTime = this._settings.currentTime }
        if (this._settings.rate !== undefined) { _applyRate(element, this._settings.rate) }
    }

    _detach(layer) {
        var index = this._layers.indexOf(layer)
        if (index === -1) { return }
        this._layers.splice(index, 1)
        this._unlisten(layer._element)
    }

    _elements() {
        var elements = []
        for (var layer of this._layers) {
            if (layer._element) { elements.push(layer._element) }
        }
        return elements
    }

    _load(element) {
        var item = this._item
        if (!item) {
            element.removeAttribute("src")
            return
        }
        item.status = AVPlayerItem.Status.unknown
        element.src = item.asset.url
    }

    _listen(element) {
        if (this._listeners.has(element)) { return }
        var listeners = {
            loadedmetadata: () => this._itemDidLoad(element),
            error: () => this._itemDidFail(element),
            ended: () => this._itemDidEnd(),
        }
        for (var event in listeners) {
            element.addEventListener(event, listeners[event])
        }
        this._listeners.set(element, listeners)
    }

    _unlisten(element) {
        var listeners = this._listeners.get(element)
        if (!listeners) { return }
        for (var event in listeners) {
            element.removeEventListener(event, listeners[event])
        }
        this._listeners.delete(element)
    }

    _itemDidLoad(element) {
        if (!this._item) { return }
        this._item.status = AVPlayerItem.Status.readyToPlay
        this._item.duration = _duration(element.duration)
        if (this._status === Status.unknown) { this._status = Status.readyToPlay }
    }

    _itemDidFail(element) {
        if (!this._item) { return }
        this._item.status = AVPlayerItem.Status.failed
        this._item.error = element.error || null
        NotificationCenter.default.post({name: AVPlayerItem.failedToPlayToEndTimeNotification, object: this._item})
    }

    _itemDidEnd() {
        if (this.actionAtItemEnd !== ActionAtItemEnd.none) { this._settings.rate = 0 }
        NotificationCenter.default.post({name: AVPlayerItem.didPlayToEndTimeNotification, object: this._item})
    }
}


function _duration(seconds) {
    if (Number.isNaN(seconds)) { return CMTime.indefinite }
    if (seconds === Infinity) { return CMTime.positiveInfinity }
    return new CMTime({seconds: seconds, preferredTimescale: preferredTimescale})
}

function _applyRate(element, rate) {
    if (rate === 0) {
        element.pause()
        return
    }
    element.playbackRate = rate
    var playing = element.play()
    if (playing && typeof playing.catch === "function") { playing.catch(function() {}) }
}
