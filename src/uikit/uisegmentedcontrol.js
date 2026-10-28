import { UIControl } from "./uicontrol.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { setText } from "../utils/text.js"


// The element's children are the segments; the selected one carries "active".
export class UISegmentedControl extends UIControl {

    static get noSegment() {
        return -1
    }

    // Interface Builder connects a segmented control's action to valueChanged.
    static get _nibEvent() {
        return UIControlEvent.valueChanged
    }

    // A tap on a segment selects it before the action runs, as Apple's does.
    // The handler binds again on every placement, as the targets do: a removed
    // control loses its handlers with its element, and the namespace is cleared
    // first so a control never carries two.
    init() {
        super.init()
        this._bindTap()
    }

    didMoveToSuperview() {
        super.didMoveToSuperview()
        this._bindTap()
    }

    // It neither stops the click nor cancels it: the segments may carry actions
    // of their own, and a segment that already selected itself sends nothing.
    _bindTap() {
        this.$el.off("click.uisegmentedcontrol").on("click.uisegmentedcontrol", (e) => this._tapped(e))
    }

    _tapped(e) {
        if (!this.isEnabled) { return }
        var segments = this.$el.children()
        var segment = $(e.target).closest(segments)
        if (segment.length === 0 || segment[0].hasAttribute("disabled")) { return }
        var index = segments.index(segment)
        if (index === this.selectedSegmentIndex) { return }
        this.selectedSegmentIndex = index
        this.sendActions({for: UIControlEvent.valueChanged})
    }

    get numberOfSegments() {
        return this.$el.children().length
    }

    get selectedSegmentIndex() {
        var index = -1
        this.$el.children().each(function(i) { if ($(this).hasClass("active")) { index = i } })
        return index
    }

    // UISegmentedControl.noSegment clears the selection. Any other index that
    // names no segment is ignored and the selection stays, as Apple's does; it
    // never reaches eq(), whose negative indices count from the end and would
    // select the last segment.
    set selectedSegmentIndex(index) {
        var segments = this.$el.children()
        if (index === UISegmentedControl.noSegment) {
            segments.removeClass("active")
            return
        }
        if (!Number.isInteger(index) || index < 0 || index >= segments.length) { return }
        segments.removeClass("active").eq(index).addClass("active")
    }

    /**
     * @param {string} title
     * @param {object} options
     * @param {number} options.forSegmentAt
     */
    setTitle(title, {forSegmentAt}) {
        var segment = this.$el.children().eq(forSegmentAt)
        var label = segment.children().first()
        var target = label.length ? label : segment
        setText(target, title)
    }

    /**
     * @param {object} options
     * @param {number} options.at
     * @returns {string}
     */
    titleForSegment({at}) {
        var segment = this.$el.children().eq(at)
        var label = segment.children().first()
        return (label.length ? label : segment).text().trim()
    }
}
