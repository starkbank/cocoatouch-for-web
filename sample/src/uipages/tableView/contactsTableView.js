import "UIKit"
import { ContactTableViewCell } from "./contactTableViewCell.js"


// The only job of the subclass is to hand out the app's own cell type.
export class ContactsTableView extends UITableView {

    dequeueReusableCell({identifier, indexPath}) {
        return new ContactTableViewCell({identifier, indexPath})
    }
}
