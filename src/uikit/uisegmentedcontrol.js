import { UIControl } from "./uicontrol.js"
import { setText } from "../utils/text.js"


// The element's children are the segments; the selected one carries "active".
export class UISegmentedControl extends UIControl {

    static get noSegment() {
        return -1
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
