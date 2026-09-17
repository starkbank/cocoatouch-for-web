import { UIView } from "./uiview.js"


export class UITableViewCell extends UIView {

     constructor({identifier, indexPath}) {
        super(identifier)
        this.indexPath = indexPath
    }
}