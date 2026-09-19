import { UIResponder } from "./uiresponder.js"
import { CALayer } from "../coreanimation/calayer.js"
import { Bind } from "../utils/bind.js"


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

    // Runs when a pre-rendered page is restored and the view is bound to its element.
    didMoveToWindow() {

    }

    get $el() {
        if (!this._$el || this._$el.length === 0) {
            this._$el = $(this.selector)
        }
        return this._$el
    }

    get layer() {
        return new CALayer(this.selector)
    }

    get superview() {
        return this._superview || null
    }

    get subviews() {
        if (!this._subviews) { this._subviews = [] }
        return this._subviews
    }

    // Unhiding restores the stylesheet's display; a view the stylesheet keeps
    // hidden until code shows it, like a spinner, becomes a block. Inside
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
        if (this.$el.css("display") === "none") { this.$el.css("display", "block") }
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

    set isUserInteractionEnabled(bool) {
        this.$el.css("pointer-events", bool ? "" : "none")
    }

    get isUserInteractionEnabled() {
        return this.$el.css("pointer-events") !== "none"
    }

    // The element's rectangle in page coordinates.
    get frame() {
        var element = this.$el[0]
        if (!element) { return {x: 0, y: 0, width: 0, height: 0} }
        var rect = element.getBoundingClientRect()
        return {x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height}
    }

    get bounds() {
        var frame = this.frame
        return {x: 0, y: 0, width: frame.width, height: frame.height}
    }

    get isHidden() {
        return this.$el.css("display") === "none"
    }

    set backgroundColor(color) {
        this.$el.css("background-color", color.hex)
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

    addGestureRecognizer(recognizer) {
        recognizer.view = this
        this.$el.off(recognizer.event).on(recognizer.event, () => {
            return recognizer.action.call(recognizer.target, recognizer)
        })
    }

    layoutSubviews() {

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

    insertSubview(view, {at} = {}) {
        this._attach(view, {at})
    }

    _attach(view, {at}) {
        view.layoutSubviews()
        var $viewEl = _elementFor(view)
        var siblings = this.$el.children()
        if (at !== undefined && at < siblings.length) {
            siblings.eq(at).before($viewEl)
        }
        if (at === undefined || at >= siblings.length) {
            this.$el.append($viewEl)
        }
        view._$el = $viewEl
        this._link(view)
        Bind.ibOutlet(view)
        view.awakeFromNib()
        Bind.ibAction(view)
    }

    // A controller's root view leaves its container empty and tears the
    // controller down; any other view takes its element out of the page.
    removeFromSuperview() {
        if (_isControllerRootView(this)) {
            this.next._unembed()
            return
        }
        this.$el.remove()
        var superview = this._superview
        if (!superview) { return }
        var index = superview.subviews.indexOf(this)
        if (index !== -1) { superview.subviews.splice(index, 1) }
        this._superview = null
        this._dispose()
    }

    static loadFromNib(nib) {
        var view = new UIView()
        view.nib = nib
        return view
    }

    // Runs the property changes made in `animations` over `withDuration`
    // seconds: alpha and isHidden fade instead of switching.
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
    _loadNibIfNeeded() {
        var nib = this.constructor.nib
        if (!nib) { return }
        var $el = this.$el
        if ($el.length === 0 || $el.children().length > 0 || $el.html().trim() !== "") { return }
        $el.html(nib)
        Bind.ibOutlet(this)
        this.awakeFromNib()
        Bind.ibAction(this)
    }

    _link(view) {
        view._superview = this
        view.next = this
        this.subviews.push(view)
    }

    _dispose() {
        for (var view of this.subviews) {
            view._dispose()
        }
        this._subviews = []
        super._dispose()
    }

}


function _isControllerRootView(view) {
    var controller = view.next
    return !!controller && typeof controller._embed === "function" && controller._view === view
}


var _animation = null

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


function _elementFor(view) {
    var $nib = $("<div></div>").html(view.nib)
    var roots = $nib.children()
    if (roots.length === 1 && $nib.text().trim() === roots.text().trim()) {
        var $root = roots.first()
        if ($root.attr("id")) {
            view.selector = "#" + $root.attr("id")
            view._identifier = $root.attr("id")
        }
        if (!$root.attr("id")) {
            $root.attr("id", view.identifier)
        }
        return $root
    }
    return $(`<div id="${view.identifier}">${view.nib}</div>`)
}
