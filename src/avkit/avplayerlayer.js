import { CALayer } from "../coreanimation/calayer.js"
import { uuid } from "../utils/uuid.js"


export const AVLayerVideoGravity = Object.freeze({
    resizeAspect: "resizeAspect",
    resizeAspectFill: "resizeAspectFill",
    resize: "resize",
})

const objectFit = {
    [AVLayerVideoGravity.resizeAspect]: "contain",
    [AVLayerVideoGravity.resizeAspectFill]: "cover",
    [AVLayerVideoGravity.resize]: "fill",
}

const haveCurrentData = 2


// Where a player draws: a <video> element of its own, which a view's layer
// adds as a sublayer. AVPlayerViewController hands a layer the element it
// already shows, so nothing is created for a <video> that is on the page.
export class AVPlayerLayer extends CALayer {

    // AVPlayerLayer() or AVPlayerLayer(player:)
    constructor({player} = {}) {
        super("#" + uuid())
        this._boundElement = null
        this._player = null
        if (player) { this.player = player }
    }

    get player() {
        return this._player
    }

    set player(player) {
        if (this._player === player) { return }
        if (this._player) { this._player._detach(this) }
        this._player = player || null
        if (this._player) { this._player._attach(this) }
    }

    get videoGravity() {
        var fit = this._element ? this._element.style.objectFit : ""
        for (var gravity in objectFit) {
            if (objectFit[gravity] === fit) { return gravity }
        }
        return AVLayerVideoGravity.resizeAspect
    }

    set videoGravity(gravity) {
        if (this._element) { this._element.style.objectFit = objectFit[gravity] || "" }
    }

    get isReadyForDisplay() {
        return !!this._element && this._element.readyState >= haveCurrentData
    }

    get _element() {
        if (this._boundElement) { return this._boundElement }
        var element = document.createElement("video")
        element.id = this.selector.slice(1)
        this._boundElement = element
        return element
    }
}
