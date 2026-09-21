import "UIKit"


// The row html is the .xib of the same name. The table view creates the row
// from it and binds the cell's outlets inside that row, so several rows do
// not collide even though they share ids.
export class ContactTableViewCell extends UITableViewCell {

    @IBOutlet("#contact-name", UILabel) nameLabel
    @IBOutlet("#contact-email", UILabel) emailLabel
    @IBOutlet("#contact-role", UILabel) roleLabel

    set contact(contact) {
        this.nameLabel.text = contact.name
        this.emailLabel.text = contact.email
        this.roleLabel.text = contact.role
    }
}
