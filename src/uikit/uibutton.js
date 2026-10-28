import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"
import { UIButtonConfiguration, configurationOwnedBy, configurationTitle, edgeName } from "./uibuttonconfiguration.js"
import { imageSource } from "./uiimage.js"
import { drawTint, templateTargets } from "../utils/tint.js"
import { required, typed, enumeration, optional, instance } from "../utils/required.js"


const stateType = enumeration(UIControlState, "UIControl.State")
const colorType = instance(UIColor, "UIColor")
const attributedType = instance(NSAttributedString, "NSAttributedString")
const configurationType = optional(instance(UIButtonConfiguration, "UIButton.Configuration"))
const retiredIndicator = "UIButton.showsActivityIndicator was removed: Apple's is UIButton.Configuration.showsActivityIndicator; write button.configuration.showsActivityIndicator = true."

// The spinner is out of flow: an overlay that fills the button and centres the
// icon with flex, so it takes no room and the title stays where it is. Whether
// the title is hidden meanwhile is the site's stylesheet's, from the
// activity-indicator attribute the button carries, as on Apple the indicator
// does not hide the title. Font Awesome's fa-spin animates transform on the
// icon, and a running animation overrides the icon's own transform, so the icon
// is never positioned; only the overlay, which does not spin, is.
const activityIndicator = "<span class=\"uibutton-activity-indicator\" style=\"position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;\"><i class=\"fas fa-circle-notch fa-spin\"></i></span>"


export class UIButton extends UIControl {

    static get Configuration() {
        return UIButtonConfiguration
    }

    // setTitle(_:for:) keeps a title per state and draws the current state's;
    // title(for:) and currentTitle fall back to the normal title when none was
    // set for the state asked about, as Apple's do.
    /**
     * @param {string|null} title
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setTitle(title, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setTitle", "Apple's is setTitle(_:for:); write setTitle(title, {for: UIControlState.normal}).")
        _setTitle(this, title, state)
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    title({for: state} = {}) {
        var title = _title(this, required(state, "for", stateType, "UIButton.title", "Apple's is title(for:); write title({for: UIControlState.normal})."))
        if (title === null) { return _markupTitle(this) }
        return title instanceof NSAttributedString ? title.string : title
    }

    get currentTitle() {
        var title = _title(this, _drawnState(this))
        if (title === null) { return this.$el.text() }
        return title instanceof NSAttributedString ? title.string : title
    }

    // The control's own svg, if it holds one, and the picture of its image.
    _templateImages() {
        var picture = this._drawnImage ? this.$el.children(".uibutton-image").children()[0] : undefined
        return super._templateImages().concat(templateTargets(this._drawnImage, picture))
    }

    _stateDidChange() {
        this._drawTitle()
    }

    // Nothing is drawn when no title was ever set, so a title written in the
    // nib stands.
    /**
     * setAttributedTitle(_:for:): markup for a state, through NSAttributedString's
     * html document type, trusted input only; plain attributed strings draw as text.
     * @param {NSAttributedString|null} attributedTitle
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setAttributedTitle(attributedTitle, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setAttributedTitle", "Apple's is setAttributedTitle(_:for:); write setAttributedTitle(attributedTitle, {for: UIControlState.normal}).")
        typed(attributedTitle, "attributedTitle", optional(attributedType), "UIButton.setAttributedTitle", "Apple's is setAttributedTitle(_:for:); the title is an NSAttributedString, or null to clear it.")
        if (!this._titles) { this._titles = {} }
        this._titles[state] = attributedTitle
        this._drawTitle()
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     * @returns {NSAttributedString|null}
     */
    attributedTitle({for: state} = {}) {
        var title = _title(this, required(state, "for", stateType, "UIButton.attributedTitle", "Apple's is attributedTitle(for:); write attributedTitle({for: UIControlState.normal})."))
        if (title === null) { return null }
        return title instanceof NSAttributedString ? title : new NSAttributedString({string: title})
    }

    // A title is drawn as text unless it is an NSAttributedString carrying markup.
    // A title already drawn is left alone: a highlight redraw at pointer-down
    // would replace the nodes under the pointer, and the browser, finding no
    // common ancestor of the down and up targets, would never send the click.
    // The element is part of what was drawn: a view re-resolves its element by
    // selector once it is disconnected, so the same title may need drawing again.
    _drawTitle() {
        var title = _title(this, _drawnState(this))
        if (title === null) { return }
        var isMarkup = title instanceof NSAttributedString && title._isMarkup
        var drawn = isMarkup ? title._markup : title instanceof NSAttributedString ? title.string : title
        var key = (isMarkup ? "markup:" : "text:") + drawn
        var element = this.$el[0]
        if (this._drawnTitle === key && this._drawnElement === element) { return }
        this._drawnTitle = key
        this._drawnElement = element
        if (isMarkup) { setMarkup(this.$el, drawn) }
        if (!isMarkup) { setText(this.$el, drawn) }
        _drawDecorations(this)
    }

    // setTitleColor(_:for:): the normal state's color is drawn; others are kept for titleColor(for:).
    /**
     * @param {UIColor|null} color
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    setTitleColor(color, {for: state} = {}) {
        required(state, "for", stateType, "UIButton.setTitleColor", "Apple's is setTitleColor(_:for:); write setTitleColor(color, {for: UIControlState.normal}).")
        typed(color, "color", optional(colorType), "UIButton.setTitleColor", "Apple's is setTitleColor(_:for:); the color is a UIColor, or null to clear it.")
        if (!this._titleColors) { this._titleColors = {} }
        this._titleColors[state] = color
        if (state === UIControlState.normal) { this.$el.css("color", color === null ? "" : color.cgColor) }
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    titleColor({for: state} = {}) {
        required(state, "for", stateType, "UIButton.titleColor", "Apple's is titleColor(for:); write titleColor({for: UIControlState.normal}).")
        var kept = this._titleColors && this._titleColors[state]
        if (kept) { return kept }
        if (state !== UIControlState.normal) { return null }
        return new UIColor({hex: this.$el.css("color")})
    }

    // UIButton.configuration: nil is a classic button. A button starts with a
    // plain configuration whose title is the one its markup holds, as Interface
    // Builder's default style does. What is read is the button's own value, so
    // `button.configuration.showsActivityIndicator = true` writes back, as
    // Swift's `button.configuration?.showsActivityIndicator = true` does; one
    // that is assigned is copied, as a struct is.
    /** @param {UIButtonConfiguration|null} configuration */
    set configuration(configuration) {
        typed(configuration, "configuration", configurationType, "UIButton.configuration", "Apple's is var configuration: UIButton.Configuration?; write button.configuration = UIButton.Configuration.plain(), or null.")
        if (configuration === null) {
            this._configuration = null
            _drawDecorations(this)
            return
        }
        var title = configuration === this._configuration ? null : configurationTitle(configuration)
        this._configuration = configurationOwnedBy(_ownerOf(this), {from: configuration})
        if (title !== null) { _setTitle(this, title, UIControlState.normal) }
        _drawDecorations(this)
    }

    /** @returns {UIButtonConfiguration|null} */
    get configuration() {
        if (this._configuration === undefined) { this._configuration = configurationOwnedBy(_ownerOf(this), {from: UIButtonConfiguration.plain()}) }
        return this._configuration
    }

    // Retired in favour of Apple's own place for it, which is the configuration.
    /** @param {never} bool */
    set showsActivityIndicator(bool) {
        throw new TypeError(retiredIndicator)
    }

    /** @returns {never} */
    get showsActivityIndicator() {
        throw new TypeError(retiredIndicator)
    }
}


// What a button's own configuration reaches back through: the title is the
// button's normal title, and a change of image or indicator redraws.
function _ownerOf(button) {
    return {
        title: () => _normalTitle(button),
        setTitle: (title) => _setTitle(button, title, UIControlState.normal),
        redraw: () => _drawDecorations(button),
    }
}

function _setTitle(button, title, state) {
    if (!button._titles) { button._titles = {} }
    button._titles[state] = title
    button._drawTitle()
}

function _normalTitle(button) {
    var title = _title(button, UIControlState.normal)
    if (title === null) { return button.$el.text() }
    return title instanceof NSAttributedString ? title.string : title
}

// What a button nobody titled shows is its markup's text, as a nib's does; null
// when there is none, as Apple's title(for:) is for a button with no title.
function _markupTitle(button) {
    var text = button.$el.text()
    return text.trim() === "" ? null : text
}

// The indicator and the image are what the button draws beside its title, and
// drawing a title replaces its element's children, so this runs after each
// title drawn as well as on each configuration change. It leaves what is
// already right alone: nothing is rebuilt for a highlight redraw.
function _drawDecorations(button) {
    var configuration = button._configuration || null
    _drawIndicator(button, configuration !== null && configuration.showsActivityIndicator)
    _drawImage(button, configuration)
}

// The button becomes the spinner's containing block only when nothing already is.
function _drawIndicator(button, shows) {
    var $el = button.$el
    if (!shows) {
        if (!button._indicatorShown) { return }
        $el.children(".uibutton-activity-indicator").remove()
        $el.removeAttr("activity-indicator")
        if (button._positionedForActivity) { $el.css("position", "") }
        button._positionedForActivity = false
        button._indicatorShown = false
        return
    }
    if (!button._indicatorShown) {
        button._indicatorShown = true
        button._positionedForActivity = _isStatic($el.css("position"))
    }
    if (button._positionedForActivity) { $el.css("position", "relative") }
    $el.attr("activity-indicator", "")
    if ($el.children(".uibutton-activity-indicator").length === 0) { $el.append(activityIndicator) }
}

// A symbol is drawn as its icon classes and any other image as an img, both
// built as nodes, never from markup. Leading and top come before the title.
function _drawImage(button, configuration) {
    var $el = button.$el
    var image = configuration === null ? null : configuration.image
    var placement = image === null ? null : edgeName(configuration.imagePlacement)
    if (image === null && !button._drawnImage) { return }
    var $drawn = $el.children(".uibutton-image")
    if (image === null) {
        $drawn.remove()
        $el.removeAttr("image-placement")
        button._drawnImage = null
        drawTint(button)
        return
    }
    $el.attr("image-placement", placement)
    if ($drawn.length > 0 && button._drawnImage === image && button._drawnPlacement === placement) { return }
    $drawn.remove()
    var $holder = $("<span class=\"uibutton-image\"></span>")
    var $picture = image.systemName !== undefined ? $("<i></i>").addClass(image.systemName) : $("<img>").attr("src", imageSource(image))
    $holder.append($picture)
    var isBeforeTitle = placement === "leading" || placement === "top"
    isBeforeTitle ? $el.prepend($holder) : $el.append($holder)
    button._drawnImage = image
    button._drawnPlacement = placement
    drawTint(button)
}


function _isStatic(position) {
    return position === "static" || position === ""
}

// The drawn title is resolved here rather than through title({for:}): a
// subclass may declare a `title` member of its own, as a Swift subclass may
// beside title(for:), and in JavaScript an instance field shadows the
// prototype method it is named after.
function _title(button, state) {
    var titles = button._titles || {}
    if (titles[state] !== undefined) { return titles[state] }
    return titles[UIControlState.normal] === undefined ? null : titles[UIControlState.normal]
}

// The single state whose title is drawn: disabled wins over selected, as a
// disabled control cannot be interacted with whatever else it is.
function _drawnState(button) {
    if (!button.isEnabled) { return UIControlState.disabled }
    if (button.isSelected) { return UIControlState.selected }
    return UIControlState.normal
}
