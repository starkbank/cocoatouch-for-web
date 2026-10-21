import { UIImage } from "./uiimage.js"
import { typed, optional, instance, enumeration, Bool, StringType } from "../utils/required.js"


// NSDirectionalRectEdge's four edges, with Apple's raw values. The option set's
// empty and all cases are left out: neither is a place an image can sit.
export const NSDirectionalRectEdge = Object.freeze({
    top: 1,
    leading: 2,
    bottom: 4,
    trailing: 8,
})

const edgeType = enumeration(NSDirectionalRectEdge, "NSDirectionalRectEdge")
const imageType = optional(instance(UIImage, "UIImage"))
const owners = new WeakMap()


// UIButton.Configuration: the value a button's look is described by. A
// configuration a button holds is the button's own, as Swift's
// `button.configuration?.showsActivityIndicator = true` writes through to it;
// one made by .plain() and the others is a free value until it is assigned, and
// the button keeps a copy of it, as a struct is copied.
//
// The four factories return the same value: what a plain, a filled, a tinted
// and a gray button look like is the stylesheet's, not this package's.
export class UIButtonConfiguration {

    /** @type {string|null} */
    _title = null
    /** @type {UIImage|null} */
    _image = null
    _showsActivityIndicator = false
    /** @type {1|2|4|8} */
    _imagePlacement = NSDirectionalRectEdge.leading

    static plain() {
        return new UIButtonConfiguration()
    }

    static filled() {
        return new UIButtonConfiguration()
    }

    static tinted() {
        return new UIButtonConfiguration()
    }

    static gray() {
        return new UIButtonConfiguration()
    }

    // On a button's own configuration the title is the button's normal title,
    // so setTitle(_:for:) and this property never disagree.
    /** @param {string|null} title */
    set title(title) {
        typed(title, "title", optional(StringType), "UIButton.Configuration.title", "Apple's is var title: String?.")
        this._title = title
        var owner = owners.get(this)
        if (owner) { owner.setTitle(title) }
    }

    get title() {
        var owner = owners.get(this)
        return owner ? owner.title() : this._title
    }

    /** @param {UIImage|null} image */
    set image(image) {
        typed(image, "image", imageType, "UIButton.Configuration.image", "Apple's is var image: UIImage?.")
        this._image = image
        _redraw(this)
    }

    get image() {
        return this._image
    }

    /** @param {boolean} bool */
    set showsActivityIndicator(bool) {
        typed(bool, "showsActivityIndicator", Bool, "UIButton.Configuration.showsActivityIndicator", "Apple's is var showsActivityIndicator: Bool.")
        this._showsActivityIndicator = bool
        _redraw(this)
    }

    get showsActivityIndicator() {
        return this._showsActivityIndicator
    }

    /** @param {1|2|4|8} edge one of NSDirectionalRectEdge's top, leading, bottom and trailing */
    set imagePlacement(edge) {
        typed(edge, "imagePlacement", edgeType, "UIButton.Configuration.imagePlacement", "Apple's is var imagePlacement: NSDirectionalRectEdge; write configuration.imagePlacement = NSDirectionalRectEdge.trailing.")
        this._imagePlacement = edge
        _redraw(this)
    }

    get imagePlacement() {
        return this._imagePlacement
    }
}


// The button's copy of a configuration, wired back to the button: `owner` is
// {title(), setTitle(title), redraw()}. The title is read live from the button
// and written through setTitle, so the copy keeps none of its own.
export function configurationOwnedBy(owner, {from}) {
    var copy = new UIButtonConfiguration()
    copy._image = from._image
    copy._showsActivityIndicator = from._showsActivityIndicator
    copy._imagePlacement = from._imagePlacement
    owners.set(copy, owner)
    return copy
}

// The title a configuration describes: an owned copy has none of its own and
// asks the button it belongs to, a free value holds it.
export function configurationTitle(configuration) {
    var owner = owners.get(configuration)
    return owner ? owner.title() : configuration._title
}

// The text of an edge, as the attribute the stylesheet reads.
export function edgeName(edge) {
    return Object.keys(NSDirectionalRectEdge).find((name) => NSDirectionalRectEdge[name] === edge)
}


function _redraw(configuration) {
    var owner = owners.get(configuration)
    if (owner) { owner.redraw() }
}
