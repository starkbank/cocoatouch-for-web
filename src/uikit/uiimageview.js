import { UIView } from "./uiview.js"
import { imageSource } from "./uiimage.js"
import { drawTint, templateTargets, currentColorTargets } from "../utils/tint.js"


const sourceElements = /^(img|video|audio|source|iframe|lottie-player)$/i


export class UIImageView extends UIView {

    // An element that loads media takes the image as its source; any other
    // element, a decorated box, is painted with it as a CSS background. A
    // <lottie-player> only reads src on its first render, so it is told to load.
    set image(image) {
        this._image = image
        _drawPicture(this, image)
        drawTint(this)
    }

    // A template image is drawn in the effective tintColor. A view over an
    // inline svg that draws with currentColor, and was given no image, is the
    // template image itself.
    _templateImages() {
        var element = this.$el[0]
        return this._image ? templateTargets(this._image, element) : currentColorTargets(element)
    }

    // A symbol image swaps the icon font's classes and leaves the element's own in place.
    _setSymbol(systemName) {
        if (this._symbolClasses) { this.$el.removeClass(this._symbolClasses) }
        this._symbolClasses = systemName
        this.$el.addClass(systemName)
    }

}


function _drawPicture(view, image) {
    if (image && image.systemName !== undefined) {
        view._setSymbol(image.systemName)
        return
    }
    var source = imageSource(image)
    var element = view.$el[0]
    if (element && typeof element.tagName === "string" && !sourceElements.test(element.tagName)) {
        view.$el.css("background-image", `url(${source})`)
        return
    }
    view.$el.attr("src", source)
    if (element && typeof element.load === "function") {
        element.load(source)
    }
}
