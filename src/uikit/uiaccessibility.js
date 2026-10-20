import { enumeration, arrayOf } from "../utils/required.js"


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
    if (!view._accessibilityState) { view._accessibilityState = {expanded: ExpandedStatus.unsupported, value: null, traits: Object.freeze([]), drawn: []} }
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
    drawTraits(view, $el, state)
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


// UIKit's UIAccessibilityTraits, an option set, reduced to the traits that have an
// ARIA mapping: an array of these cases, and none for the empty set.
export const UIAccessibilityTraits = Object.freeze({
    none: Object.freeze([]),
    button: "button",
    link: "link",
    header: "header",
    selected: "selected",
    notEnabled: "notEnabled",
})


export const traitsType = arrayOf(enumeration(Object.freeze(Object.values(UIAccessibilityTraits).filter((trait) => typeof trait === "string")), "UIAccessibilityTraits"))

// What each trait draws, and where. A trait draws its role only where the
// element's native role is another one, so a <button>, an <a href> and an
// <h1> to <h6> get nothing for the trait they already are. When several traits
// want the role the most specific wins: header, then link, then button.
//
// selected has one rule: an item under a listbox, tablist, grid, treegrid or
// tree is aria-selected; a toggle-like control (a button, native or by role)
// is aria-pressed; anything else has no ARIA state for it and draws nothing.
//
// notEnabled is aria-disabled on a view that is no control: a control's
// isEnabled already draws disabled, and a trait never changes it.
//
// The attributes a set drew are remembered, so the next set removes exactly
// those that left it and no attribute that was never the traits' own.
function drawTraits(view, $el, state) {
    var element = $el[0]
    var wanted = desiredByTraits(view, element, state.traits)
    for (var name of state.drawn) {
        if (!(name in wanted)) { $el.removeAttr(name) }
    }
    for (var name of Object.keys(wanted)) { $el.attr(name, wanted[name]) }
    state.drawn = Object.keys(wanted)
}

const selectableContainers = "[role=listbox],[role=tablist],[role=grid],[role=treegrid],[role=tree]"

function desiredByTraits(view, element, traits) {
    var wanted = {}
    var role = roleFor(element, traits)
    if (role) { wanted.role = role }
    if (traits.includes("selected")) {
        var state = selectedStateFor(element, role)
        if (state) { wanted[state] = "true" }
    }
    if (traits.includes("notEnabled") && !isControl(view)) { wanted["aria-disabled"] = "true" }
    return wanted
}

function roleFor(element, traits) {
    if (traits.includes("header") && !/^H[1-6]$/.test(element.tagName)) { return "heading" }
    if (traits.includes("link") && !isNativeLink(element)) { return "link" }
    if (traits.includes("button") && !isNativeButton(element)) { return "button" }
    return null
}

function selectedStateFor(element, role) {
    var parent = element.parentElement
    if (parent && parent.closest(selectableContainers)) { return "aria-selected" }
    if (isNativeButton(element) || role === "button" || element.getAttribute("role") === "button") { return "aria-pressed" }
    return null
}

function isNativeButton(element) {
    if (element.tagName === "BUTTON") { return true }
    return element.tagName === "INPUT" && ["button", "submit", "reset", "image"].includes(element.type)
}

function isNativeLink(element) {
    return (element.tagName === "A" || element.tagName === "AREA") && element.hasAttribute("href")
}

// UIControl is told by its target-action methods: UIView imports this module,
// so it cannot import the class.
function isControl(view) {
    return typeof view.addTarget === "function" && typeof view.sendActions === "function"
}
