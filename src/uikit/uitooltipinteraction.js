import { NSObject } from "../foundation/nsobject.js"
import { UIView } from "./uiview.js"
import { required, typed, optional, instance, StringType } from "../utils/required.js"


const viewType = optional(instance(UIView, "UIView"))


// UIToolTipInteraction: the text a pointer hovering the view shows. Drawn as the
// `tooltip` attribute on the view's element, which the stylesheet reads, the way
// `selected` and `disabled` are drawn: this package owns the attribute and the
// site owns how it looks. Added with view.addInteraction(_:).
export class UIToolTipInteraction extends NSObject {

    _defaultToolTip = null
    _view = null

    /**
     * @param {object} [options]
     * @param {string|null} [options.defaultToolTip]
     */
    constructor({defaultToolTip = null} = {}) {
        super()
        typed(defaultToolTip, "defaultToolTip", optional(StringType), "UIToolTipInteraction", "Apple's is init(defaultToolTip: String?).")
        this._defaultToolTip = defaultToolTip
    }

    get view() {
        return this._view
    }

    get defaultToolTip() {
        return this._defaultToolTip
    }

    set defaultToolTip(text) {
        typed(text, "defaultToolTip", optional(StringType), "UIToolTipInteraction.defaultToolTip", "Apple's is var defaultToolTip: String?.")
        this._defaultToolTip = text
        this._draw()
    }

    // UIInteraction's pair, sent around the move in that order. The view is nil
    // when the interaction leaves one.
    /**
     * @param {object} options
     * @param {UIView|null} options.to
     */
    willMove({to} = {}) {
        required(to, "to", viewType, "UIToolTipInteraction.willMove", "Apple's is willMove(to view: UIView?); write willMove({to: view}).")
        if (to === null) { this._erase() }
    }

    /**
     * @param {object} options
     * @param {UIView|null} options.to
     */
    didMove({to} = {}) {
        required(to, "to", viewType, "UIToolTipInteraction.didMove", "Apple's is didMove(to view: UIView?); write didMove({to: view}).")
        this._view = to
        this._draw()
    }

    _draw() {
        if (!this._view) { return }
        var text = this._defaultToolTip
        if (text === null || text === "") {
            this._erase()
            return
        }
        this._view.$el.attr("tooltip", text)
    }

    _erase() {
        if (this._view) { this._view.$el.removeAttr("tooltip") }
    }
}
