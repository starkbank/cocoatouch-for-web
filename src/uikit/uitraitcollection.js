import { NSObject } from "../foundation/nsobject.js"
import { UIUserInterfaceSizeClass } from "./uiuserinterfacesizeclass.js"
import { UIUserInterfaceStyle } from "./uiuserinterfacestyle.js"


// UIKit's UITraitCollection, reduced to the size classes and the light or dark
// style a page can report.
export class UITraitCollection extends NSObject {

    /**
     * @param {object} [options]
     * @param {"unspecified"|"compact"|"regular"} [options.horizontalSizeClass]
     * @param {"unspecified"|"compact"|"regular"} [options.verticalSizeClass]
     * @param {"unspecified"|"light"|"dark"} [options.userInterfaceStyle]
     */
    constructor({horizontalSizeClass = UIUserInterfaceSizeClass.unspecified, verticalSizeClass = UIUserInterfaceSizeClass.unspecified, userInterfaceStyle = UIUserInterfaceStyle.unspecified} = {}) {
        super()
        this._horizontalSizeClass = horizontalSizeClass
        this._verticalSizeClass = verticalSizeClass
        this._userInterfaceStyle = userInterfaceStyle
    }

    // The page's own collection: its style is the page's, read when asked, so
    // it follows a theme change that no event announces.
    static get current() {
        return currentTraitCollection()
    }

    get userInterfaceStyle() {
        if (this._isPage) { return _pageInterfaceStyle() }
        return this._userInterfaceStyle
    }

    get horizontalSizeClass() {
        return this._horizontalSizeClass
    }

    get verticalSizeClass() {
        return this._verticalSizeClass
    }
}


// This framework's mapping of the viewport to Apple's classes, not an Apple
// threshold: Apple's size classes come from the device and its orientation,
// a page only has its width and height.
export function traitCollectionForSize({width, height}) {
    var collection = new UITraitCollection({
        horizontalSizeClass: width < 768 ? UIUserInterfaceSizeClass.compact : UIUserInterfaceSizeClass.regular,
        verticalSizeClass: height < 500 ? UIUserInterfaceSizeClass.compact : UIUserInterfaceSizeClass.regular,
    })
    collection._isPage = true
    return collection
}

export function sameTraits(a, b) {
    return a.horizontalSizeClass === b.horizontalSizeClass && a.verticalSizeClass === b.verticalSizeClass
}

// The page is one trait environment: a single window, so a single collection,
// taken from the window as the bundle loads and replaced by the resize dispatch.
var _current = traitCollectionForSize(_windowSize())

export function currentTraitCollection() {
    return _current
}

export function setCurrentTraitCollection(traitCollection) {
    _current = traitCollection
}

function _windowSize() {
    if (typeof window === "undefined") { return {width: 0, height: 0} }
    return {width: window.innerWidth || 0, height: window.innerHeight || 0}
}


// Light or dark is decided by the page's background, the rule a theme that
// sets custom properties on the root already applies (a view background whose
// brightness, (299r + 587g + 114b) / 1000, is under 128 is a dark theme): the
// root's computed background, then the body's when the root has none, and only
// without either the browser's prefers-color-scheme. There is no attribute or
// class to read, since a theme here is custom properties on the root.
const brightnessOfDark = 128
const rgbText = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+(\d*\.?\d+%?))?\s*\)$/

function _pageInterfaceStyle() {
    if (typeof document === "undefined" || typeof getComputedStyle !== "function") { return UIUserInterfaceStyle.light }
    for (var element of [document.documentElement, document.body]) {
        var style = element ? _styleOfBackground(element) : null
        if (style !== null) { return style }
    }
    var prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    return prefersDark ? UIUserInterfaceStyle.dark : UIUserInterfaceStyle.light
}

// null for no opaque background to judge by.
function _styleOfBackground(element) {
    var match = rgbText.exec(String(getComputedStyle(element).backgroundColor || "").trim())
    if (match === null) { return null }
    var alpha = match[4] === undefined ? 1 : Number.parseFloat(match[4]) / (match[4].endsWith("%") ? 100 : 1)
    if (alpha === 0) { return null }
    var brightness = (Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000
    return brightness < brightnessOfDark ? UIUserInterfaceStyle.dark : UIUserInterfaceStyle.light
}
