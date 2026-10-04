import "UIKit"


// A view the nib configures through @IBInspectable: the page's xib sets
// data-title, data-count, data-tint and data-shows-count on the element the
// outlet names, and a badge created in code reads them off its own nib root.
// The values land after the outlets and before awakeFromNib, so the labels
// are filled from configured properties, never from attributes.
export class BadgeView extends UIView {

    @IBOutlet("#badge-title", UILabel) titleLabel
    @IBOutlet("#badge-count", UILabel) countLabel

    @IBInspectable title = "Badge"
    @IBInspectable(Number) count = 0
    @IBInspectable(UIColor) tint = new UIColor({hex: "#0070e0"})
    @IBInspectable(Boolean) showsCount = true

    awakeFromNib() {
        this.titleLabel.text = this.title
        this.countLabel.text = String(this.count)
        this.countLabel.backgroundColor = this.tint
        this.countLabel.isHidden = !this.showsCount
    }
}
