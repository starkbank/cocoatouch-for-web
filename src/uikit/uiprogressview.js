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
        this.$el.css("background", color.hex)
    }

    setProgress(progress, {animated} = {}) {
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
