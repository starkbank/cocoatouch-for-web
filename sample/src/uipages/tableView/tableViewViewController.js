import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { ContactsTableView } from "./contactsTableView.js"
import contactCellUrl from "./contactTableViewCell.html"


const CONTACTS = [
    {name: "Ada Lovelace", email: "ada@example.com", role: "Engineering"},
    {name: "Grace Hopper", email: "grace@example.com", role: "Compilers"},
    {name: "Alan Turing", email: "alan@example.com", role: "Research"},
    {name: "Margaret Hamilton", email: "margaret@example.com", role: "Flight software"},
    {name: "Dennis Ritchie", email: "dennis@example.com", role: "Systems"},
    {name: "Barbara Liskov", email: "barbara@example.com", role: "Languages"},
]

export class TableViewViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#table-view-contacts", ContactsTableView) tableView
    @IBOutlet("#table-view-count", UILabel) countLabel
    @IBOutlet("#table-view-selected", UILabel) selectedLabel

    contacts = CONTACTS.slice(0, 3)

    viewDidLoad() {
        this.tableView.isEditable = true
        this.tableView.delegate = this
        // Assigning the data source triggers the first reloadData.
        this.tableView.dataSource = this
        this.updateCount()
    }

    // UITableViewDataSource

    tableViewNumberOfRowsInSection(tableView, section) {
        return this.contacts.length
    }

    tableViewCellForRowAtIndexPath(tableView, indexPath) {
        var cell = tableView.dequeueReusableCell({identifier: contactCellUrl, indexPath: indexPath})
        cell.contact = this.contacts[indexPath]
        return cell
    }

    // UITableViewDelegate

    tableViewDidSelectRowAtIndexPath(tableView, indexPath) {
        var contact = this.contacts[indexPath]
        this.selectedLabel.text = `Selected row ${indexPath}: ${contact.name} (${contact.role})`
    }

    deleteRowAt(indexPath, tableView) {
        this.contacts.splice(indexPath, 1)
        this.reload()
    }

    @IBAction("#table-view-add", UIButton) addTapped() {
        var next = CONTACTS[this.contacts.length % CONTACTS.length]
        this.contacts.push(next)
        this.reload()
    }

    @IBAction("#table-view-clear", UIButton) clearTapped() {
        this.contacts = []
        this.reload()
    }

    reload() {
        this.tableView.reloadData()
        this.updateCount()
        this.selectedLabel.text = "Tap a row to select it."
    }

    updateCount() {
        var count = this.contacts.length
        this.countLabel.text = `${count} row${count === 1 ? "" : "s"}`
    }
}
