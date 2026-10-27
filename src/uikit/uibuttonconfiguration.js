// UIButton.Configuration. Swift's is a struct: `button.configuration?.showsActivityIndicator = true`
// reads a copy, changes it and writes it back through the button's setter.
// JavaScript has no write-back, so the configuration a button holds is the
// one its getter returns, and a change to it redraws that button; assigning
// a configuration to a button copies it, so two buttons never share one.
export class UIButtonConfiguration {

    _showsActivityIndicator = false
    _button = null

    static plain() {
        return new UIButtonConfiguration()
    }

    get showsActivityIndicator() {
        return this._showsActivityIndicator
    }

    set showsActivityIndicator(bool) {
        if (typeof bool !== "boolean") {
            throw new TypeError(`UIButton.Configuration.showsActivityIndicator expects a Bool, got ${bool === null ? "null" : typeof bool}. Apple's is var showsActivityIndicator: Bool.`)
        }
        this._showsActivityIndicator = bool
        if (this._button) { this._button._configurationDidChange() }
    }

    _copy() {
        var copy = new UIButtonConfiguration()
        copy._showsActivityIndicator = this._showsActivityIndicator
        return copy
    }
}
