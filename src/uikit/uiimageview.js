import { UIView } from "./uiview.js"


export class UIImageView extends UIView {

    // A <lottie-player> only reads src on its first render, so a player that
    // is already on the page is told to load the animation.
    set image(image) {
        this.$el.attr("src", image.named)
        var element = this.$el[0]
        if (element && typeof element.load === "function") {
            element.load(image.named)
        }
    }

}
