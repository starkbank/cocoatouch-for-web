import { UIViewController } from "../uikit/uiviewcontroller.js"
import { AVPlayerLayer } from "./avplayerlayer.js"


// Shows a player's video. Bound to a <video> element it plays there;
// bound to any other element it appends the <video> it plays in.
export class AVPlayerViewController extends UIViewController {

    get player() {
        return this._playerLayer ? this._playerLayer.player : null
    }

    set player(player) {
        this._layer().player = player
    }

    get showsPlaybackControls() {
        var element = this._layer()._element
        return !!element && element.controls
    }

    set showsPlaybackControls(shows) {
        var element = this._layer()._element
        if (element) { element.controls = shows }
    }

    get videoGravity() {
        return this._layer().videoGravity
    }

    set videoGravity(gravity) {
        this._layer().videoGravity = gravity
    }

    get isReadyForDisplay() {
        return this._layer().isReadyForDisplay
    }

    _layer() {
        if (this._playerLayer) { return this._playerLayer }
        var $host = this._$el || this.view.$el
        var host = $host[0]
        var $video = host && /^(video|audio)$/i.test(host.tagName) ? $host : $host.children("video, audio").first()
        if ($video.length === 0) {
            $video = $("<video></video>")
            $host.append($video)
        }
        this._playerLayer = new AVPlayerLayer()
        this._playerLayer._boundElement = $video[0] || null
        if ($video[0] && $video[0].id) { this._playerLayer.selector = "#" + $video[0].id }
        return this._playerLayer
    }

    _dispose() {
        if (this._playerLayer) { this._playerLayer.player = null }
        super._dispose()
    }
}
