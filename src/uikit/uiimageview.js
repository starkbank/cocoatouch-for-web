import { UIView } from "./uiview.js"


const sourceElements = /^(img|video|audio|source|iframe|lottie-player)$/i


export class UIImageView extends UIView {

    // An element that loads media takes the image as its source; any other
    // element, a decorated box, is painted with it as a CSS background. A
    // <lottie-player> only reads src on its first render, so it is told to load.
    set image(image) {
        if (image && image.systemName !== undefined) {
            this._setSymbol(image.systemName)
            return
        }
        var element = this.$el[0]
        if (element && typeof element.tagName === "string" && !sourceElements.test(element.tagName)) {
            this.$el.css("background-image", `url(${image.named})`)
            return
        }
        this.$el.attr("src", image.named)
        if (element && typeof element.load === "function") {
            element.load(image.named)
        }
    }

    // A symbol image swaps the icon font's classes and leaves the element's own in place.
    _setSymbol(systemName) {
        if (this._symbolClasses) { this.$el.removeClass(this._symbolClasses) }
        this._symbolClasses = systemName
        this.$el.addClass(systemName)
    }

}
