import { UIView } from "./uiview.js"
import { required, typed, Bool, Float } from "../utils/required.js"


// The element is the track and its first child the bar, moved along the track.
export class UIProgressView extends UIView {

    animationDuration = 1

    get progress() {
        return this._progress || 0
    }

    set progress(progress) {
        this.setProgress(progress, {animated: false})
    }

    set progressTintColor(color) {
        this.$el.css("background", color.cgColor)
    }

    /**
     * @param {number} progress
     * @param {object} options
     * @param {boolean} options.animated
     */
    setProgress(progress, {animated} = {}) {
        var signature = "Apple's is setProgress(_:animated:); write setProgress(progress, {animated: false})."
        required(animated, "animated", Bool, "UIProgressView.setProgress", signature)
        typed(progress, "progress", Float, "UIProgressView.setProgress", signature)
        this._progress = progress
        var offset = progress * this.$el.width()
        var bar = this.$el.children().stop()
        if (animated) {
            bar.animate({left: offset}, this.animationDuration * 1000)
            return
        }
        bar.css("left", offset)
    }
}
