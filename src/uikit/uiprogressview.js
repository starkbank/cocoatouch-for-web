import { UIView } from "./uiview.js"


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

    setProgress(progress, options) {
        var animated = _required(options, "animated", "UIProgressView.setProgress", "setProgress(progress, {animated: false}). Apple's is setProgress(_:animated:)")
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


// Apple requires the label; JavaScript cannot refuse at compile time, so the
// call refuses instead and names what to write.
function _required(options, label, method, signature) {
    if (!options || options[label] === undefined) {
        throw new TypeError(`${method} requires a ${label}: ${signature}`)
    }
    return options[label]
}
