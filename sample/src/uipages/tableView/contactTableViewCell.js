import "UIKit"


// The table renders one row per index from the cell's html fragment and gives
// it the id `cell-<indexPath>`, so the cell's labels are scoped to that row.
export class ContactTableViewCell extends UITableViewCell {

    constructor({identifier, indexPath}) {
        super({identifier, indexPath})
        var row = `#cell-${indexPath}`
        this.nameLabel = new UILabel(`${row} #contact-name`)
        this.emailLabel = new UILabel(`${row} #contact-email`)
        this.roleLabel = new UILabel(`${row} #contact-role`)
    }

    set contact(contact) {
        this.nameLabel.text = contact.name
        this.emailLabel.text = contact.email
        this.roleLabel.text = contact.role
    }
}
