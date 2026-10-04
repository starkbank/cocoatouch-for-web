import { NSObject } from "../foundation/nsobject.js"
import { UIUserInterfaceSizeClass } from "./uiuserinterfacesizeclass.js"


// UIKit's UITraitCollection, reduced to the size classes a page can report.
export class UITraitCollection extends NSObject {

    /**
     * @param {object} [options]
     * @param {"unspecified"|"compact"|"regular"} [options.horizontalSizeClass]
     * @param {"unspecified"|"compact"|"regular"} [options.verticalSizeClass]
     */
    constructor({horizontalSizeClass = UIUserInterfaceSizeClass.unspecified, verticalSizeClass = UIUserInterfaceSizeClass.unspecified} = {}) {
        super()
        this._horizontalSizeClass = horizontalSizeClass
        this._verticalSizeClass = verticalSizeClass
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
    return new UITraitCollection({
        horizontalSizeClass: width < 768 ? UIUserInterfaceSizeClass.compact : UIUserInterfaceSizeClass.regular,
        verticalSizeClass: height < 500 ? UIUserInterfaceSizeClass.compact : UIUserInterfaceSizeClass.regular,
    })
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
