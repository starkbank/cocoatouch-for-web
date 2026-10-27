// The page's one window, made on first use by the maker UIWindow registers:
// UIView reads it for `window` and cannot import UIWindow, which extends it.
var _window = null
var _make = null

export function registerWindowMaker(make) {
    _make = make
}

export function keyWindow() {
    if (!_window && _make && typeof document !== "undefined") { _window = _make() }
    return _window
}
