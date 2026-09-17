import { UIView } from "./uiview.js"


// A cell subclass keeps its row html in the .xib of the same name and binds
// its @IBOutlets to the row the table view dequeues it for.
export class UITableViewCell extends UIView {

    constructor(selector, indexPath) {
        if (typeof selector === "object" && selector !== null) {
            indexPath = selector.indexPath
            selector = selector.identifier
        }
        super(selector)
        this.reuseIdentifier = null
        this.indexPath = indexPath
    }

    get isSelected() {
        return this.$el.hasClass("selected")
    }
}
