import { UIView } from "./uiview.js"


export class UIProgressView extends UIView {

    animationLength = 1000

    get progressWrapWidth() {
        return this.$el.width()
    }

    set progressTintColor(color) {
        $(this.selector).css("background", color)
    }

    setProgress(progress, animated) {
        animated ? this.animateProgressBar(progress) : this.updateProgressBar(progress)
    }

    animateProgressBar(progress) {
        var progressTotal = (progress / 100) * this.progressWrapWidth
        $(this.selector).children().stop().animate({
            left: progressTotal
        }, this.animationLength)
    }

    updateProgressBar(progress) {
        var progressTotal = (progress / 100) * this.progressWrapWidth
        $(this.selector).children().css("left", progressTotal)
    }
}