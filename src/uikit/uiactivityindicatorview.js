import { UIView } from "./uiview.js"


export class UIActivityIndicatorView extends UIView {

    startAnimating() {
        this.isHidden = false
    }

    stopAnimating() {
        this.isHidden = true
    }
}