import { enumeration } from "../utils/required.js"


// UIKit's UIAccessibility namespace: the types of the accessibility properties
// a view carries.
const ExpandedStatus = Object.freeze({unsupported: 0, expanded: 1, collapsed: 2})

export class UIAccessibility {

    static get ExpandedStatus() {
        return ExpandedStatus
    }
}


// What a view's accessibility properties hold, kept on the view and drawn on its
// element: the ARIA attribute is the framework's to write, never the app's.
export function accessibilityStateOf(view) {
    if (!view._accessibilityState) { view._accessibilityState = {expanded: ExpandedStatus.unsupported, value: null} }
    return view._accessibilityState
}

// Draws every property from the stored state, so a view placed again, or whose
// element was re-resolved, gets them back.
export function drawAccessibility(view) {
    var state = view._accessibilityState
    if (!state) { return }
    var $el = view.$el
    if (!$el || $el.length === 0) { return }
    drawExpanded($el, state.expanded)
    drawValue($el, state.value)
}

function drawExpanded($el, status) {
    if (status === ExpandedStatus.unsupported) {
        $el.removeAttr("aria-expanded")
        return
    }
    $el.attr("aria-expanded", status === ExpandedStatus.expanded ? "true" : "false")
}

// The value assistive technology reads for a view whose role has one, as
// aria-valuetext; nil, or an empty text, removes it.
function drawValue($el, value) {
    if (value === null || value === "") {
        $el.removeAttr("aria-valuetext")
        return
    }
    $el.attr("aria-valuetext", value)
}

export const expandedStatusType = enumeration(Object.freeze(Object.values(ExpandedStatus)), "UIAccessibility.ExpandedStatus")
