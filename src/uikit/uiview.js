import { UIResponder } from "./uiresponder.js"
import { UIColor } from "./uicolor.js"
import { layerOf } from "../coreanimation/calayer.js"
import { CGAffineTransform } from "../coregraphics/cgaffinetransform.js"
import { CGRect } from "../coregraphics/cgrect.js"
import { Bind } from "../utils/bind.js"
import { ownElement } from "../utils/elementowner.js"
import { keyWindowKey } from "../utils/documentkeys.js"
import { NSUserActivity, NSUserActivityTypeBrowsingWeb } from "../foundation/nsuseractivity.js"
import { currentTraitCollection } from "./uitraitcollection.js"
import { accessibilityStateOf, drawAccessibility, expandedStatusType, traitsType } from "./uiaccessibility.js"
import { required, typed, optional, StringType, Int } from "../utils/required.js"


export class UIView extends UIResponder {

    nib = this.constructor.nib || ""

    constructor(selector) {
        super(selector)
        this.init()
        this._loadNibIfNeeded()
    }

    // Runs once the view object exists, before it is attached to a nib.
    init() {

    }

    awakeFromNib() {

    }

    // Sent once the view's element is in the page: by addSubview after the
    // insertion, and by restore() when a pre-rendered page is rebound. Apple
    // also sends it on removal, when the window becomes nil; this does not.
    didMoveToWindow() {

    }

    // willMove(toSuperview:) and didMoveToSuperview(), around addSubview's
    // insertion and removeFromSuperview's removal.
    /**
     * @param {object} options
     * @param {UIView|null} options.toSuperview
     */
    willMove({toSuperview}) {

    }

    didMoveToSuperview() {
        drawAccessibility(this)
    }

    // The element is looked up again when the cached one left the document: an
    // icon font or a re-rendered nib can replace a node while keeping its id.
    // Only a node that was in the document and left it counts: one built for a
    // superview that is not in the page yet is the view's element until it
    // first joins the page, and a lookup would swap it for an empty set. Whether
    // a node has been in the page is noted when it is adopted, by the _$el
    // setter, and again at every read, so an outlet's node that was in the
    // page when it was bound and is replaced before anyone reads it still
    // counts as having left it.
    // While the framework constructs the view its creator lends the element it
    // already found, so init() and the nib reach it without a document query
    // that a repeated id would answer with the wrong card. An outlet that
    // matched nothing is lent an empty set, which is refused, so a miss still
    // falls through to the document query: the lend is an optimisation for
    // matches, not a guarantee.
    get $el() {
        var node = this._$el && this._$el[0]
        if (node && node.isConnected === true) { this._wasConnected = true }
        var isLost = !this._$el || this._$el.length === 0 || node && node.isConnected === false && this._wasConnected === true
        if (!isLost) { return this._$el }
        var lent = Bind.elementUnderConstruction(this)
        this._$el = lent && lent.length > 0 ? lent : $(this.selector)
        return this._$el
    }

    set _$el(element) {
        this._cachedElement = element
        this._wasConnected = !!element && !!element[0] && element[0].isConnected === true
    }

    get _$el() {
        return this._cachedElement
    }

    // The same layer for the view's whole life, as Apple's. Its field has its
    // own name because a subclass may have a _layer() method, as
    // AVPlayerViewController does.
    get layer() {
        if (!this._viewLayer) { this._viewLayer = layerOf(this) }
        return this._viewLayer
    }

    // A view whose activity is browsing a web page is a link to it: the
    // webpageURL becomes the element's href, so anchors keep working as links.
    // Read back, an anchor that already carries an href reports it as a browsing
    // activity, so a sender created for a tapped link knows where it leads.
    get userActivity() {
        if (this._userActivity) { return this._userActivity }
        var href = this.$el.attr("href")
        if (!href) { return null }
        var activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
        activity.webpageURL = href
        this._userActivity = activity
        return activity
    }

    set userActivity(activity) {
        this._userActivity = activity
        var url = activity && activity.webpageURL
        if (url === null || url === undefined) {
            this.$el.removeAttr("href")
            return
        }
        this.$el.attr("href", String(url))
    }

    // The element id, so tests and stylesheets can address a nib's inner views.
    get accessibilityIdentifier() {
        return this.$el.attr("id") || null
    }

    set accessibilityIdentifier(identifier) {
        this.$el.attr("id", identifier)
        this.selector = "#" + identifier
        this._identifier = identifier
    }

    // UIAccessibility.ExpandedStatus, drawn as aria-expanded on the element:
    // expanded is "true", collapsed "false", and unsupported (the default)
    // removes it. The status is kept and drawn again whenever the view is placed.
    get accessibilityExpandedStatus() {
        return accessibilityStateOf(this).expanded
    }

    /** @param {number} status one of UIAccessibility.ExpandedStatus */
    set accessibilityExpandedStatus(status) {
        typed(status, "accessibilityExpandedStatus", expandedStatusType, "UIView.accessibilityExpandedStatus", "Apple's is var accessibilityExpandedStatus: UIAccessibility.ExpandedStatus; write view.accessibilityExpandedStatus = UIAccessibility.ExpandedStatus.expanded.")
        accessibilityStateOf(this).expanded = status
        drawAccessibility(this)
    }

    // Drawn as aria-valuetext, which assistive technology reads for a role that has
    // a value; nil removes it, and so does an empty text, which reads back as nil.
    get accessibilityValue() {
        var value = accessibilityStateOf(this).value
        return value === "" ? null : value
    }

    /** @param {string|null} value */
    set accessibilityValue(value) {
        var text = value === undefined ? null : value
        typed(text, "accessibilityValue", optional(StringType), "UIView.accessibilityValue", "Apple's is var accessibilityValue: String?.")
        accessibilityStateOf(this).value = text
        drawAccessibility(this)
    }

    // UIAccessibilityTraits, an array of the published cases, drawn as roles and
    // ARIA states where the element needs them (see uiaccessibility.js); the
    // traits never change a control's isEnabled or isSelected.
    get accessibilityTraits() {
        return accessibilityStateOf(this).traits
    }

    /** @param {string[]} traits cases of UIAccessibilityTraits, or UIAccessibilityTraits.none */
    set accessibilityTraits(traits) {
        typed(traits, "accessibilityTraits", traitsType, "UIView.accessibilityTraits", "Apple's is var accessibilityTraits: UIAccessibilityTraits; write view.accessibilityTraits = [UIAccessibilityTraits.button], or UIAccessibilityTraits.none.")
        accessibilityStateOf(this).traits = Object.freeze([...new Set(traits)])
        drawAccessibility(this)
    }

    // The label assistive technology reads: aria-label, or alt on an image,
    // which is the attribute a screen reader reads for one.
    get accessibilityLabel() {
        var label = this.$el.attr(_labelAttribute(this.$el))
        return label === undefined || label === "" ? null : label
    }

    set accessibilityLabel(label) {
        var attribute = _labelAttribute(this.$el)
        if (label === null || label === undefined) {
            this.$el.removeAttr(attribute)
            return
        }
        this.$el.attr(attribute, label)
    }

    get superview() {
        return this._superview || null
    }

    // The page's one window when the view's element is under body, and nil
    // otherwise, as a view outside a window hierarchy has no window on Apple.
    // Read from the page on every use, never remembered: a view's element can be
    // moved out of the page and back without the view hearing of it. The walk up
    // the superviews is for a view that hangs from the window itself.
    get window() {
        if (typeof document === "undefined") { return null }
        var keyWindow = document[keyWindowKey]
        if (!keyWindow) { return null }
        var root = this
        while (root._superview) { root = root._superview }
        if (root === keyWindow) { return keyWindow }
        var element = this.$el[0]
        if (!element || !document.body || !document.body.contains(element)) { return null }
        return keyWindow
    }

    get subviews() {
        if (!this._subviews) { this._subviews = [] }
        return this._subviews
    }

    // Unhiding restores the stylesheet's display; a view the stylesheet keeps
    // hidden until code shows it, like a spinner, gets the display its element
    // has by nature: a cell is a table-cell, a span inline, a div a block. Inside
    // UIView.animate the change fades over the animation's duration.
    set isHidden(bool) {
        if (_animation) {
            var $el = this.$el.stop(true, true).delay(_animation.delay)
            bool ? $el.fadeOut(_animation.duration) : $el.fadeIn(_animation.duration)
            return
        }
        if (bool) {
            this.$el.css("display", "none")
            return
        }
        this.$el.css("display", "")
        if (this.$el.css("display") === "none") { this.$el.css("display", _naturalDisplay(this.$el[0])) }
    }

    set alpha(value) {
        if (_animation) {
            this.$el.stop(true, true).delay(_animation.delay).fadeTo(_animation.duration, value)
            return
        }
        this.$el.css("opacity", value)
    }

    get alpha() {
        var opacity = this.$el.css("opacity")
        return opacity === "" || opacity === undefined ? 1 : Number(opacity)
    }

    // An integer to tell views apart, kept on the element as data-tag.
    set tag(value) {
        this.$el.attr("data-tag", value)
    }

    get tag() {
        var tag = this.$el.attr("data-tag")
        return tag === undefined ? 0 : Number(tag)
    }

    becomeFirstResponder() {
        this.$el.trigger("focus")
    }

    resignFirstResponder() {
        this.$el.trigger("blur")
    }

    get isFirstResponder() {
        return this.$el.is(":focus")
    }

    set isUserInteractionEnabled(bool) {
        this.$el.css("pointer-events", bool ? "" : "none")
    }

    get isUserInteractionEnabled() {
        return this.$el.css("pointer-events") !== "none"
    }

    // The element's rectangle in page coordinates. Read-only on purpose: the
    // stylesheet owns geometry here, and a setter would fight it.
    get frame() {
        var element = this.$el[0]
        if (!element) { return CGRect.zero }
        var rect = element.getBoundingClientRect()
        return new CGRect({x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height})
    }

    get bounds() {
        var frame = this.frame
        return new CGRect({width: frame.width, height: frame.height})
    }

    get isHidden() {
        return this.$el.css("display") === "none"
    }

    // Apple's nil is no value of the view's own: the inline value is removed, so
    // the stylesheet's returns, and reads back as null, which is also what a view
    // nobody colored reads. Anything else must be a UIColor.
    set backgroundColor(color) {
        this.$el.css("background-color", color === null ? "" : color.cgColor)
    }

    get backgroundColor() {
        var element = this.$el[0]
        if (!element || !element.style || element.style.backgroundColor === "") { return null }
        return new UIColor({hex: element.style.backgroundColor})
    }

    // The view's affine transform, as the element's CSS transform. Inside
    // UIView.animate the element transitions to it over the animation's duration.
    get transform() {
        var matrix = this.$el.css("transform")
        var parsed = /^matrix\(([^)]+)\)$/.exec(matrix || "")
        if (!parsed) { return CGAffineTransform.identity }
        var [a, b, c, d, tx, ty] = parsed[1].split(",").map(Number)
        return new CGAffineTransform({a, b, c, d, tx, ty})
    }

    set transform(transform) {
        var value = transform.isIdentity ? "none" : `matrix(${transform.a}, ${transform.b}, ${transform.c}, ${transform.d}, ${transform.tx}, ${transform.ty})`
        if (!_animation) {
            this.$el.css("transform", value)
            return
        }
        var $el = this.$el
        $el.css("transition", `transform ${_animation.duration}ms ${_animation.delay}ms`)
        $el.css("transform", value)
        setTimeout(() => $el.css("transition", ""), _animation.duration + _animation.delay)
    }

    // The accent for selection and emphasis; defaults to the page's design token.
    set tintColor(color) {
        this._tintColor = color
    }

    get tintColor() {
        if (this._tintColor) { return this._tintColor }
        var element = this.$el[0]
        var token = element ? getComputedStyle(element).getPropertyValue("--action-or-selection-color").trim() : ""
        return {hex: token || "#0070E0"}
    }

    // Each recognizer listens under its own namespace, so adding one never
    // removes another, nor a target or an @IBAction bound to the same element.
    addGestureRecognizer(recognizer) {
        recognizer.view = this
        var events = recognizer.events
        var namespace = ".gesture" + (++_recognizerCount)
        for (const event of Object.keys(events)) {
            this.$el.on(event + namespace, (domEvent) => {
                if (!recognizer._recognizes(domEvent)) { return }
                recognizer.state = events[event]
                return recognizer.action.call(recognizer.target, recognizer)
            })
        }
    }

    // UIInteraction objects the view carries, UIToolTipInteraction among them.
    // The interaction is told it will move to the view and then that it did, and
    // on removal to nil: that is where it draws and erases its own state. The
    // list is a copy, as Swift's array is a value.
    get interactions() {
        return (this._interactions || []).slice()
    }

    addInteraction(interaction) {
        var signature = "Apple's is addInteraction(_ interaction: UIInteraction)."
        if (!interaction || typeof interaction.willMove !== "function" || typeof interaction.didMove !== "function") {
            throw new TypeError(`UIView.addInteraction expects a UIInteraction for interaction, got ${interaction === null ? "null" : typeof interaction}. ${signature}`)
        }
        if (!this._interactions) { this._interactions = [] }
        if (this._interactions.indexOf(interaction) !== -1) { return }
        interaction.willMove({to: this})
        this._interactions.push(interaction)
        interaction.didMove({to: this})
    }

    removeInteraction(interaction) {
        var index = (this._interactions || []).indexOf(interaction)
        if (index === -1) { return }
        interaction.willMove({to: null})
        this._interactions.splice(index, 1)
        interaction.didMove({to: null})
    }

    layoutSubviews() {

    }

    // UITraitEnvironment: the page's traits, and the hook sent after they change.
    get traitCollection() {
        return currentTraitCollection()
    }

    traitCollectionDidChange(previousTraitCollection) {

    }

    // Puts a child controller's view or a view in this view. A view's nib
    // becomes its element when it has one root, and is wrapped otherwise.
    addSubview(view) {
        if (_isControllerRootView(view)) {
            view.next._embed(this)
            return
        }
        this._attach(view, {})
    }

    /**
     * @param {UIView} view
     * @param {object} options
     * @param {number} options.at
     */
    insertSubview(view, {at} = {}) {
        required(at, "at", Int, "UIView.insertSubview", "Apple's is insertSubview(_:at:); write insertSubview(view, {at: index}).")
        this._attach(view, {at})
    }

    // The move hooks surround the insertion, the superview pair before the
    // window one, which is this package's order where Apple documents each
    // hook's trigger but not their interleaving. awakeFromNib follows the
    // insertion, unlike UIKit, so a body may measure or style the element;
    // layoutSubviews comes last, once there is an element to lay out.
    _attach(view, {at}) {
        view.willMove({toSuperview: this})
        var $viewEl = _elementFor(view, this)
        var siblings = this.$el.children()
        if (at !== undefined && at < siblings.length) {
            siblings.eq(at).before($viewEl)
        }
        if (at === undefined || at >= siblings.length) {
            this.$el.append($viewEl)
        }
        view._$el = $viewEl
        ownElement($viewEl, view)
        this._link(view)
        drawAccessibility(view)
        view.didMoveToSuperview()
        view.didMoveToWindow()
        Bind.ibOutlet(view)
        Bind.ibInspectable(view)
        view.awakeFromNib()
        Bind.ibAction(view)
        view.layoutSubviews()
    }

    // A controller's root view leaves its container empty and tears the
    // controller down; any other view takes its element out of the page.
    removeFromSuperview() {
        if (_isControllerRootView(this)) {
            this.next._unembed()
            return
        }
        this.willMove({toSuperview: null})
        this.$el.remove()
        var superview = this._superview
        if (!superview) {
            this.didMoveToSuperview()
            return
        }
        var index = superview.subviews.indexOf(this)
        if (index !== -1) { superview.subviews.splice(index, 1) }
        this._superview = null
        this.didMoveToSuperview()
        this._dispose()
    }

    static loadFromNib(nib) {
        var view = new UIView()
        view.nib = nib
        return view
    }

    // Runs the property changes made in `animations` over `withDuration`
    // seconds: alpha and isHidden fade instead of switching.
    /**
     * @param {object} options
     * @param {number} options.withDuration
     * @param {number} [options.delay]
     * @param {Function} options.animations
     * @param {Function} [options.completion]
     */
    static animate({withDuration, delay = 0, animations, completion}) {
        var previous = _animation
        _animation = {duration: withDuration * 1000, delay: delay * 1000}
        try {
            animations()
        } finally {
            _animation = previous
        }
        if (completion) {
            setTimeout(() => completion(true), (withDuration + delay) * 1000)
        }
    }

    // Swaps one view for another: `from` fades out, then `to` slides in
    // from the side the flip option names, or dissolves in.
    /**
     * transition(from:to:duration:options:completion:); `options` is Apple's own label here.
     * @param {object} parameters
     * @param {UIView} parameters.from
     * @param {UIView} parameters.to
     * @param {number} parameters.duration
     * @param {string[]} [parameters.options]
     * @param {Function} [parameters.completion]
     */
    static transition({from, to, duration, options = [], completion}) {
        var milliseconds = duration * 1000
        var direction = _slideDirection(options)
        from.$el.stop(true, true).fadeOut(Math.min(40, milliseconds), () => {
            var $to = to.$el.stop(true, true).hide()
            var done = () => { if (completion) { completion(true) } }
            if (direction && typeof $to.effect === "function") {
                $to.show("slide", {direction: direction}, milliseconds, done)
                return
            }
            $to.fadeIn(milliseconds, done)
        })
    }

    static get AnimationOptions() {
        return AnimationOptions
    }

    // A view class designed in a .xib fills an empty element it is created
    // on, so `new SecureTextField("#password")` renders like the outlet would.
    // A view the framework is constructing is bound by its creator instead,
    // once `new` has returned and the subclass's fields are initialised.
    _loadNibIfNeeded() {
        var nib = this.constructor.nib
        if (!nib) { return }
        var $el = this.$el
        if ($el.length === 0 || $el.children().length > 0 || $el.html().trim() !== "") { return }
        $el.html(nib)
        if (Bind.isConstructing(this)) { return }
        ownElement($el, this)
        Bind.ibOutlet(this)
        Bind.ibInspectable(this)
        this.awakeFromNib()
        Bind.ibAction(this)
    }

    _link(view) {
        view._superview = this
        view.next = this
        this.subviews.push(view)
    }

    _dispose() {
        for (var interaction of this.interactions) {
            this.removeInteraction(interaction)
        }
        for (var view of this.subviews) {
            view._dispose()
        }
        this._subviews = []
        super._dispose()
    }

}


// What a browser draws an element as when no stylesheet says otherwise.
const naturalDisplays = Object.freeze({
    tr: "table-row", td: "table-cell", th: "table-cell", table: "table",
    thead: "table-header-group", tbody: "table-row-group", tfoot: "table-footer-group",
    li: "list-item",
    span: "inline", a: "inline", b: "inline", i: "inline", em: "inline", strong: "inline", small: "inline",
    label: "inline", code: "inline", abbr: "inline", sub: "inline", sup: "inline", u: "inline", s: "inline", img: "inline",
    input: "inline-block", button: "inline-block", select: "inline-block", textarea: "inline-block",
})

function _naturalDisplay(element) {
    var tag = element && element.tagName ? element.tagName.toLowerCase() : ""
    return naturalDisplays[tag] || "block"
}


function _labelAttribute($el) {
    var element = $el[0]
    var isImage = !!element && typeof element.tagName === "string" && element.tagName.toLowerCase() === "img"
    return isImage ? "alt" : "aria-label"
}


function _isControllerRootView(view) {
    var controller = view.next
    return !!controller && typeof controller._embed === "function" && controller._view === view
}


var _animation = null
var _recognizerCount = 0

const AnimationOptions = Object.freeze({
    transitionFlipFromLeft: "transitionFlipFromLeft",
    transitionFlipFromRight: "transitionFlipFromRight",
    transitionCrossDissolve: "transitionCrossDissolve",
})

function _slideDirection(options) {
    if (options.indexOf(AnimationOptions.transitionFlipFromRight) !== -1) { return "right" }
    if (options.indexOf(AnimationOptions.transitionFlipFromLeft) !== -1) { return "left" }
    return null
}


// A subview whose nib has no id is numbered after its superview, so views
// added in code are addressable without the app naming them. A class nib
// with several roots is refused rather than wrapped: the wrapper would be a
// bare <div> the stylesheet cannot address, and the app would only notice
// when the layout broke. The class name is read for the message alone; under
// a minifier it is mangled, which is why the nib excerpt is there too.
function _elementFor(view, superview) {
    var $nib = $("<div></div>").html(view.nib)
    var roots = $nib.children()
    if (roots.length === 1 && $nib.text().trim() === roots.text().trim()) {
        var $root = roots.first()
        if ($root.attr("id")) {
            view.selector = "#" + $root.attr("id")
            view._identifier = $root.attr("id")
        }
        if (!$root.attr("id")) {
            $root.attr("id", _identify(view, superview))
        }
        return $root
    }
    if (view.nib !== "" && view.nib === view.constructor.nib) {
        var strayText = $nib.contents().filter(function() { return this.nodeType === 3 && this.nodeValue.trim() !== "" })
        var count = roots.length + strayText.length
        throw new Error(`${view.constructor.name}: a view placed with addSubview takes its nib's single root as its element, but this nib has ${count} top-level nodes — ${view.nib.trim().slice(0, 80)}`)
    }
    return $(`<div id="${_identify(view, superview)}">${view.nib}</div>`)
}

function _identify(view, superview) {
    if (!superview) { return view.identifier }
    superview._attachedCount = (superview._attachedCount || 0) + 1
    var id = superview.identifier + "-" + superview._attachedCount
    view.selector = "#" + id
    view._identifier = id
    return id
}
