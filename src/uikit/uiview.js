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

    viewWillAppear() {

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

    get isHidden() {
        return this.$el.css("display") === "none"
    }

    get height() {
        return this.$el.innerHeight()
    }

    get width() {
        return this.$el.innerWidth()
    }

    set style(style) {
        this.$el.attr("class", style)
    }

    set isEnabled(bool) {
        this.$el.css("pointer-events", bool ? "" : "none")
    }

    set backgroundColor(color) {
        this.$el.css("background-color", color.hex)
    }

    set textColor(color) {
        this.$el.css("color", color.hex)
    }

    set borderColor(color) {
        this.$el.css("border-color", color.hex)
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

    mask(mask, bool) {
        this.$el.mask(mask, { reverse: bool })
    }

    toggle(cls) {
        this.$el.toggleClass(cls)
    }

    layoutSubviews() {

    }

    addSubview(view) {
        if (_isControllerRootView(view)) {
            view.next._embed(this)
            return
        }
        view.layoutSubviews()
        var id = view.identifier
        var nib = `<div id="${id}">${view.nib}</div>`
        this.$el.append(nib)
        var $viewEl = $(view.selector)
        $viewEl.prop("style", this.$el.attr("style")).addClass(this.$el.attr("class"))
        view._$el = $viewEl
        this._link(view)
        Bind.ibOutlet(view)
        view.awakeFromNib()
        Bind.ibAction(view)
    }

    addSubviews(views) {
        var html = ""
        for (var view of views) {
            view.layoutSubviews()
            html += `<div id="${view.identifier}">${view.nib}</div>`
        }
        this.$el.append(html)
        var style = this.$el.attr("style")
        var cls = this.$el.attr("class")
        for (var view of views) {
            view._$el = $(view.selector)
            view._$el.prop("style", style).addClass(cls)
            this._link(view)
            Bind.ibOutlet(view)
            view.awakeFromNib()
            Bind.ibAction(view)
        }
    }

    // Places a view's nib at an index of this view (appended by default)
    // without restyling it, and links it into the responder chain. A markup
    // string is appended as it is.
    insertSubview(view, {at} = {}) {
        if (!(view instanceof UIView)) {
            this.$el.append(view)
            return
        }
        view.layoutSubviews()
        var $viewEl = $(`<div id="${view.identifier}">${view.nib}</div>`)
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
