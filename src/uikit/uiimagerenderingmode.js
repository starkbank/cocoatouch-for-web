// UIImage.RenderingMode's cases. A view draws an image as a template, filling
// its shape with the view's tintColor, only for alwaysTemplate; automatic is
// what the image's own kind decides (see UIImage).
export class UIImageRenderingMode {

    /** @returns {"automatic"} */
    static get automatic() {
        return "automatic"
    }

    /** @returns {"alwaysOriginal"} */
    static get alwaysOriginal() {
        return "alwaysOriginal"
    }

    /** @returns {"alwaysTemplate"} */
    static get alwaysTemplate() {
        return "alwaysTemplate"
    }
}
