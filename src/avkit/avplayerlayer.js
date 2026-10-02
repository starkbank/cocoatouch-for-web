import { CALayer } from "../coreanimation/calayer.js"
import { uuid } from "../utils/uuid.js"


export const AVLayerVideoGravity = Object.freeze({
    resizeAspect: "resizeAspect",
    resizeAspectFill: "resizeAspectFill",
    resize: "resize",
})

const OBJECT_FIT = {
    [AVLayerVideoGravity.resizeAspect]: "contain",
    [AVLayerVideoGravity.resizeAspectFill]: "cover",
    [AVLayerVideoGravity.resize]: "fill",
}

const HAVE_CURRENT_DATA = 2


// Where a player draws: a <video> element. A selector binds a layer to one
// already on the page; AVPlayerLayer(player:) makes its own, for a view's
// layer to add as a sublayer.
export class AVPlayerLayer extends CALayer {

    constructor(selectorOrOptions) {
        var options = typeof selectorOrOptions === "object" && selectorOrOptions !== null ? selectorOrOptions : null
        var element = options ? document.createElement("video") : null
        if (element) { element.id = uuid() }
        super(element ? "#" + element.id : selectorOrOptions)
        this._boundElement = element
        this._player = null
        if (options && options.player) { this.player = options.player }
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
        for (var gravity in OBJECT_FIT) {
            if (OBJECT_FIT[gravity] === fit) { return gravity }
        }
        return AVLayerVideoGravity.resizeAspect
    }

    set videoGravity(gravity) {
        if (this._element) { this._element.style.objectFit = OBJECT_FIT[gravity] || "" }
    }

    get isReadyForDisplay() {
        return !!this._element && this._element.readyState >= HAVE_CURRENT_DATA
    }

    get _element() {
        if (this._boundElement) { return this._boundElement }
        var found = $(this.selector)
        return found && found[0] ? found[0] : null
    }
}
