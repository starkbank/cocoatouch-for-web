import { UIView } from "./uiview.js"


const SOURCE_ELEMENTS = /^(img|video|audio|source|iframe|lottie-player)$/i


export class UIImageView extends UIView {

    // An element that loads media takes the image as its source; any other
    // element, a decorated box, is painted with it as a CSS background. A
    // <lottie-player> only reads src on its first render, so it is told to load.
    set image(image) {
        var element = this.$el[0]
        if (element && typeof element.tagName === "string" && !SOURCE_ELEMENTS.test(element.tagName)) {
            this.$el.css("background-image", `url(${image.named})`)
            return
        }
        this.$el.attr("src", image.named)
        if (element && typeof element.load === "function") {
            element.load(image.named)
        }
    }

}
