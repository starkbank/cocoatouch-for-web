import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UITraitCollection } from "./uitraitcollection.js"
import { colorComponents, isSixDigitHex, sixDigitHex } from "../utils/colorcomponents.js"
import { typed, optional, Bool, StringType } from "../utils/required.js"


const inputClass = "uicolorwell-input"
const namespace = "change.uicolorwell"
const blank = "#000000"


// UIKit's UIColorWell (iOS 14): selectedColor, supportsAlpha, title and the
// valueChanged control event. It is drawn on a native <input type="color"> the
// well creates inside its element and keeps to itself: the app sees a UIColor
// and never the input. The browser's control has no alpha, so a pick keeps the
// alpha of the color that was selected before it (1 when there was none),
// whatever supportsAlpha says, and a pick at full alpha is the hex color it
// names, so an app that wants the six digits reads them from `hex`; supportsAlpha is stored and read back as set.
// A pick is the input's own change event, so valueChanged is sent once per pick
// and setting selectedColor from code sends nothing, as on Apple. A disabled
// well disables the input and ignores a pick that gets through.
export class UIColorWell extends UIControl {

    init() {
        super.init()
        this._supportsAlpha = true
        this._selectedColor = null
        this._bindInput()
    }

    didMoveToSuperview() {
        super.didMoveToSuperview()
        this._bindInput()
    }

    get selectedColor() {
        return this._selectedColor
    }

    // nil clears it: a color input always holds a value, so it goes back to black.
    /** @param {UIColor|null} color */
    set selectedColor(color) {
        this._selectedColor = color === undefined ? null : color
        this._draw()
    }

    get supportsAlpha() {
        return this._supportsAlpha
    }

    set supportsAlpha(supportsAlpha) {
        typed(supportsAlpha, "supportsAlpha", Bool, "UIColorWell.supportsAlpha", "Apple's is var supportsAlpha: Bool.")
        this._supportsAlpha = supportsAlpha
    }

    get title() {
        return this._title === undefined ? null : this._title
    }

    // The accessible label of the input; plain text, written as an attribute.
    /** @param {string|null} title */
    set title(title) {
        typed(title, "title", optional(StringType), "UIColorWell.title", "Apple's is var title: String?.")
        this._title = title === undefined ? null : title
        this._drawTitle()
    }

    set isEnabled(bool) {
        super.isEnabled = bool
        var input = this._input()
        if (input) { input.disabled = !bool }
    }

    get isEnabled() {
        return super.isEnabled
    }

    // The input is found again by its class, so a second view over the same
    // element, or a rebind after the element was placed, adds none.
    _input() {
        var element = this.$el && this.$el[0]
        if (!element || typeof element.querySelector !== "function") { return null }
        return element.querySelector("input." + inputClass)
    }

    _bindInput() {
        var element = this.$el && this.$el[0]
        if (!element || typeof element.appendChild !== "function") { return }
        var input = this._input()
        if (!input) {
            input = element.ownerDocument.createElement("input")
            input.type = "color"
            input.className = inputClass
            element.appendChild(input)
        }
        $(input).off(namespace).on(namespace, (event) => this._picked(event))
        input.disabled = !this.isEnabled
        this._draw()
        this._drawTitle()
    }

    _draw() {
        var input = this._input()
        if (!input) { return }
        var components = this._selectedColor ? colorComponents(this._concrete(this._selectedColor).cgColor) : null
        input.value = components ? sixDigitHex(components) : blank
    }

    _drawTitle() {
        var input = this._input()
        if (!input) { return }
        if (this._title === null || this._title === undefined) {
            input.removeAttribute("aria-label")
            return
        }
        input.setAttribute("aria-label", this._title)
    }

    // A token color is drawn by the value it resolves to; one that resolves to
    // nothing is returned as it is and cannot be drawn.
    _concrete(color) {
        return color.resolvedColor({with: UITraitCollection.current})
    }

    // The change event of the input is the user's pick. It stops here, so the
    // control's targets hear it only for a pick that was accepted: the value
    // must be exactly #rrggbb, and a disabled well takes nothing.
    _picked(event) {
        var input = event.currentTarget
        if (!this.isEnabled || !isSixDigitHex(input.value)) {
            event.stopPropagation()
            this._draw()
            return
        }
        var components = colorComponents(input.value)
        var previous = this._selectedColor ? colorComponents(this._concrete(this._selectedColor).cgColor) : null
        var alpha = previous ? previous.alpha : 1
        this._selectedColor = alpha === 1 ? new UIColor({hex: input.value.toLowerCase()}) : new UIColor({red: components.red / 255, green: components.green / 255, blue: components.blue / 255, alpha: alpha})
    }
}
