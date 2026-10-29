import "UIKit"
import "Foundation"
import { MenuView } from "../../uicomponents/menu/menuView.js"
import { ContactTableViewCell } from "./contactTableViewCell.js"


const CONTACTS = [
    {name: "Ada Lovelace", email: "ada@example.com", role: "Engineering"},
    {name: "Grace Hopper", email: "grace@example.com", role: "Compilers"},
    {name: "Alan Turing", email: "alan@example.com", role: "Research"},
    {name: "Margaret Hamilton", email: "margaret@example.com", role: "Flight software"},
    {name: "Dennis Ritchie", email: "dennis@example.com", role: "Systems"},
    {name: "Barbara Liskov", email: "barbara@example.com", role: "Languages"},
]

// A thousand rows, not ten thousand: the data source is also asked for rows
// nobody sees, to measure them, so each one costs a little.
const rowsCount = 1000
const appendedCount = 100

export class TableViewViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#table-view-contacts", UITableView) tableView
    @IBOutlet("#table-view-count", UILabel) countLabel
    @IBOutlet("#table-view-selected", UILabel) selectedLabel
    @IBOutlet("#table-view-rows", UITableView) rowsTableView
    @IBOutlet("#table-view-reuse", UILabel) reuseLabel

    contacts = CONTACTS.slice(0, 3)
    rows = Array.from({length: rowsCount}, (_, index) => ({number: index + 1, isStarred: false}))

    viewDidLoad() {
        this.tableView.register(ContactTableViewCell, {forCellReuseIdentifier: "contact"})
        this.tableView.setEditing(true, {animated: false})
        this.tableView.delegate = this
        // Assigning the data source triggers the first reloadData.
        this.tableView.dataSource = this
        // The rows are starred, not selected.
        this.rowsTableView.allowsSelection = false
        this.rowsTableView.delegate = this
        this.rowsTableView.dataSource = this
        this.updateCount()
    }

    viewDidAppear() {
        this.updateReuse()
    }

    // UITableViewDataSource

    tableViewNumberOfRowsInSection(tableView, section) {
        if (tableView === this.rowsTableView) { return this.rows.length }
        return this.contacts.length
    }

    // Also asked for rows nobody sees, so it only dequeues and configures.
    tableViewCellForRowAtIndexPath(tableView, indexPath) {
        if (tableView === this.rowsTableView) {
            var rowCell = tableView.dequeueReusableCell({withIdentifier: "RowTableViewCell", for: indexPath})
            rowCell.item = this.rows[indexPath.row]
            return rowCell
        }
        var cell = tableView.dequeueReusableCell({withIdentifier: "contact", for: indexPath})
        cell.contact = this.contacts[indexPath.row]
        return cell
    }

    // UITableViewDelegate

    tableViewDidSelectRowAtIndexPath(tableView, indexPath) {
        var contact = this.contacts[indexPath.row]
        this.selectedLabel.text = `Selected row ${indexPath.row}: ${contact.name} (${contact.role})`
    }

    tableViewDidEndDisplayingCellForRowAtIndexPath(tableView, cell, indexPath) {
        if (tableView !== this.rowsTableView) { return }
        this.updateReuse()
    }

    tableViewCommitEditingStyleForRowAtIndexPath(tableView, editingStyle, indexPath) {
        if (editingStyle !== UITableViewCell.EditingStyle.delete) { return }
        this.contacts.splice(indexPath.row, 1)
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

    @IBAction("#table-view-append", UIButton) appendTapped() {
        var first = this.rows.length
        for (var index = 0; index < appendedCount; index++) {
            this.rows.push({number: first + index + 1, isStarred: false})
        }
        var indexPaths = Array.from({length: appendedCount}, (_, index) => new IndexPath({row: first + index, section: 0}))
        this.rowsTableView.insertRows({at: indexPaths, with: UITableView.RowAnimation.automatic})
        this.updateReuse()
    }

    @IBAction("#table-view-star", UIButton) starTapped() {
        var indexPaths = this.rowsTableView.indexPathsForVisibleRows
        for (const indexPath of indexPaths) {
            this.rows[indexPath.row].isStarred = true
        }
        this.rowsTableView.reconfigureRows({at: indexPaths})
        this.updateReuse()
    }

    @IBAction("#table-view-middle", UIButton) middleTapped() {
        var middle = new IndexPath({row: Math.floor(this.rows.length / 2), section: 0})
        this.rowsTableView.scrollToRow(middle, {at: UITableViewScrollPosition.top, animated: false})
        this.updateReuse()
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

    updateReuse() {
        var cells = this.rowsTableView.visibleCells.length
        this.reuseLabel.text = `${this.rows.length.toLocaleString("en-US")} rows, ${cells} cells`
    }
}
