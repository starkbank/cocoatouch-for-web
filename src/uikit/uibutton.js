import { setText, setMarkup } from "../utils/text.js"
import { NSAttributedString } from "../foundation/nsattributedstring.js"
import { UIControl } from "./uicontrol.js"
import { UIColor } from "./uicolor.js"
import { UIControlState } from "./uicontrolstate.js"
import { UIButtonConfiguration } from "./uibuttonconfiguration.js"
import { required, typed, enumeration, optional, instance } from "../utils/required.js"


const stateType = enumeration(UIControlState, "UIControl.State")
const colorType = instance(UIColor, "UIColor")
const attributedType = instance(NSAttributedString, "NSAttributedString")
const configurationType = instance(UIButtonConfiguration, "UIButton.Configuration")

// The spinner is out of flow: an overlay that fills the button and centres
// the icon with flex. Font Awesome's fa-spin animates transform on the icon,
// and a running animation overrides the icon's own transform, so the icon is
// never positioned; only the overlay, which does not spin, is.
const activityIndicator = "<span class=\"uibutton-activity-indicator\" style=\"position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;\"><i class=\"fas fa-circle-notch fa-spin\"></i></span>"


export class UIButton extends UIControl {

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
        if (!this._titles) { this._titles = {} }
        this._titles[state] = title
        this._drawTitle()
    }

    /**
     * @param {object} options
     * @param {"normal"|"highlighted"|"disabled"|"selected"|"focused"} options.for
     */
    title({for: state} = {}) {
        var title = _title(this, required(state, "for", stateType, "UIButton.title", "Apple's is title(for:); write title({for: UIControlState.normal})."))
        return title instanceof NSAttributedString ? title.string : title
    }

    get currentTitle() {
        var title = _title(this, _drawnState(this))
        if (title === null) { return this.$el.text() }
        return title instanceof NSAttributedString ? title.string : title
    }

    _stateDidChange() {
        this._drawTitle()
    }

    // Nothing is drawn while the activity indicator holds the title, nor when
    // no title was ever set, so a title written in the nib stands.
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
        if (this._isShowingActivity) {
            this._titlePending = true
            return
        }
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

    // A button bound to a nib element has Interface Builder's default style,
    // Plain, whose configuration is UIButton.Configuration.plain(); nil is a
    // button without a configuration, as Apple's legacy button is.
    /** @returns {UIButtonConfiguration|null} */
    get configuration() {
        if (this._configuration === undefined) { this._configuration = _adopt(UIButtonConfiguration.plain(), this) }
        return this._configuration
    }

    /** @param {UIButtonConfiguration|null} configuration */
    set configuration(configuration) {
        typed(configuration, "configuration", optional(configurationType), "UIButton.configuration", "Apple's is var configuration: UIButton.Configuration?; write button.configuration = UIButton.Configuration.plain().")
        if (this._configuration) { this._configuration._button = null }
        this._configuration = configuration === null ? null : _adopt(configuration._copy(), this)
        this._configurationDidChange()
    }

    static get Configuration() {
        return UIButtonConfiguration
    }

    _configurationDidChange() {
        var configuration = this._configuration
        _drawActivityIndicator(this, !!configuration && configuration.showsActivityIndicator)
    }
}


function _adopt(configuration, button) {
    configuration._button = button
    return configuration
}

// The indicator is the activity-indicator attribute, for the stylesheet to
// hide the title by (visibility, so the title keeps the button's size and
// leaves the tab order and the accessibility tree), and the spinner overlay,
// a direct child that fills the button. The title's nodes stay where they
// are, so an outlet to one of them and the nodes a click needs are kept. The
// button becomes the overlay's containing block only when nothing already is.
// As Apple's, the indicator does not change isEnabled.
function _drawActivityIndicator(button, shows) {
    if (shows === !!button._isShowingActivity) { return }
    var $el = button.$el
    if (shows) {
        button._isShowingActivity = true
        button._titlePending = false
        button._positionedForActivity = _isStatic($el.css("position"))
        if (button._positionedForActivity) { $el.css("position", "relative") }
        $el.attr("activity-indicator", "")
        $el.append(activityIndicator)
        return
    }
    button._isShowingActivity = false
    $el.removeAttr("activity-indicator")
    $el.children(".uibutton-activity-indicator").remove()
    if (button._positionedForActivity) { $el.css("position", "") }
    button._positionedForActivity = false
    var pending = button._titlePending
    button._titlePending = false
    if (pending) { button._drawTitle() }
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
