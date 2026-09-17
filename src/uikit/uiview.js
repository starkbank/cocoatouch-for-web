import { UIResponder } from "./uiresponder.js"
import { CALayer } from "../coreanimation/calayer.js"
import { Bind } from "../utils/bind.js"


export class UIView extends UIResponder {

    nib = this.constructor.nib || ""

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

    set isHidden(bool) {
        this.$el.css("display", bool ? "none" : "")
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

    mask(mask, bool) {
        this.$el.mask(mask, { reverse: bool })
    }

    toggle(cls) {
        this.$el.toggleClass(cls)
    }

    layoutSubviews() {

    }

    addSubview(view) {
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

    insertSubview(view) {
        this.$el.append(view)
    }

    removeFromSuperview() {
        this.$el.empty().show()
    }

    static loadFromNib(nib) {
        var view = new UIView()
        view.nib = nib
        return view
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
