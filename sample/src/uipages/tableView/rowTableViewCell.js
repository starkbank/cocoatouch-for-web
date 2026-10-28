import "UIKit"


// Not registered anywhere: the table view finds this class by the identifier
// "RowTableViewCell", the name of the class whose .xib is beside it.
export class RowTableViewCell extends UITableViewCell {

    @IBOutlet("#row-number", UILabel) numberLabel
    @IBOutlet("#row-title", UILabel) titleLabel
    @IBOutlet("#row-star", UILabel) starLabel

    set item(item) {
        this.numberLabel.text = `${item.number}`
        this.titleLabel.text = `Row ${item.number}`
        this.starLabel.text = item.isStarred ? "★" : ""
    }
}
