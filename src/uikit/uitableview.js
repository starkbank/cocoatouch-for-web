import { UIScrollView } from "./uiscrollview.js"
import { UITableViewCell } from "./uitableviewcell.js"
import { IndexPath } from "../foundation/indexpath.js"
import { Bind } from "../utils/bind.js"


// Rows are <tr id="cell-<row>"> children of the table's tbody. A cell class
// registered for a reuse identifier supplies the row html through its nib,
// the .xib of the same name, and is instantiated bound to that row so its
// outlets work like any other view's.
export class UITableView extends UIScrollView {

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._delegate = null
        this._isEditing = false
        this._allowsSelection = true
        this._allowsMultipleSelection = false
        this._selectedRows = []
        this._registeredCells = {}
        this._cells = []
    }

    set isHidden(bool) {
        this.$el.css("display", bool ? "none" : "table")
    }

    get isHidden() {
        return this.$el.css("display") === "none"
    }

    set dataSource(dataSource) {
        this._dataSource = dataSource
        this.reloadData()
    }

    get dataSource() {
        return this._dataSource
    }

    set delegate(delegate) {
        this._delegate = delegate
    }

    get delegate() {
        return this._delegate
    }

    set allowsSelection(bool) {
        this._allowsSelection = bool
    }

    get allowsSelection() {
        return this._allowsSelection
    }

    set allowsMultipleSelection(bool) {
        this._allowsMultipleSelection = bool
    }

    get allowsMultipleSelection() {
        return this._allowsMultipleSelection
    }

    get isEditing() {
        return this._isEditing
    }

    setEditing(editing, {animated} = {}) {
        this._isEditing = editing
        this._bindRows()
    }

    get indexPathsForSelectedRows() {
        return this._selectedRows.map(function(row) { return new IndexPath({row: row}) })
    }

    get indexPathForSelectedRow() {
        if (this._selectedRows.length === 0) { return null }
        return new IndexPath({row: this._selectedRows[0]})
    }

    register(cellClass, {forCellReuseIdentifier}) {
        this._registeredCells[forCellReuseIdentifier] = cellClass
    }

    numberOfRows({inSection} = {inSection: 0}) {
        if (this._dataSource === null) { return 0 }
        return this._dataSource.tableViewNumberOfRowsInSection(this, inSection)
    }

    cellForRow({at}) {
        return this._cells[_row(at)] || null
    }

    reloadData() {
        if (this._dataSource === null) { return }
        var numberOfRows = this.numberOfRows()
        var body = this._body()
        body.find("> tr[id^=cell-]").each(function() {
            if (Number(this.id.slice("cell-".length)) >= numberOfRows) { $(this).remove() }
        })
        this._cells = []
        this._selectedRows = this._selectedRows.filter(function(row) { return row < numberOfRows })
        for (var row = 0; row < numberOfRows; row++) {
            this._cells[row] = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row: row}))
        }
        this._bindRows()
    }

    // Reuses the row element when it exists and creates it from the registered
    // cell's nib otherwise; the cell class is bound to that element.
    dequeueReusableCell({withIdentifier, for: indexPath}) {
        var cellClass = this._registeredCells[withIdentifier] || UITableViewCell
        var row = _row(indexPath)
        var id = "cell-" + row
        var element = this._body().find("> #" + id)
        if (element.length === 0) {
            element = $(cellClass.nib || "<tr></tr>").first()
            element.attr("id", id)
            this._body().append(element)
        }
        var cell = new cellClass(this.selector + " #" + id, indexPath)
        cell.reuseIdentifier = withIdentifier
        cell._$el = element
        this._link(cell)
        Bind.ibOutlet(cell)
        cell.awakeFromNib()
        Bind.ibAction(cell)
        return cell
    }

    selectRow({at, animated}) {
        var row = _row(at)
        if (this._selectedRows.indexOf(row) !== -1) { return }
        if (!this._allowsMultipleSelection) {
            this._selectedRows.slice().forEach((selected) => this._deselect(selected))
        }
        this._selectedRows.push(row)
        this._rowElement(row).addClass("selected").find("[id^=table-cell-selected] :input").prop("checked", true)
    }

    deselectRow({at, animated}) {
        this._deselect(_row(at))
    }

    selectAllRows() {
        for (var row = 0; row < this.numberOfRows(); row++) {
            this.selectRow({at: row})
        }
    }

    deselectAllRows() {
        this._selectedRows.slice().forEach((row) => this._deselect(row))
    }

    _deselect(row) {
        var index = this._selectedRows.indexOf(row)
        if (index === -1) { return }
        this._selectedRows.splice(index, 1)
        this._rowElement(row).removeClass("selected").find("[id^=table-cell-selected] :input").prop("checked", false)
    }

    _body() {
        var body = this.$el.find("tbody")
        if (body.length === 0) { return this.$el }
        return body.last()
    }

    _rowElement(row) {
        return this._body().find("> #cell-" + row)
    }

    _bindRows() {
        var tableView = this
        var rows = this._body().find("> tr[id^=cell-]")
        rows.off("click").on("click", function(event) {
            event.stopImmediatePropagation()
            if (!tableView._allowsSelection) { return }
            var indexPath = new IndexPath({row: Number(this.id.slice("cell-".length))})
            tableView._delegateCall("tableViewDidSelectRowAtIndexPath", indexPath)
        })
        rows.each((index, element) => {
            var indexPath = new IndexPath({row: index})
            var deleteButton = $(element).find("[id^=delete-button]").off("click")
            if (this._isEditing) {
                deleteButton.on("click", (event) => {
                    event.stopImmediatePropagation()
                    this._delegateCall("tableViewCommitEditingStyleForRowAt", "delete", indexPath)
                })
            }
            var selection = $(element).find("[id^=table-cell-selected]")
            selection.off("click").on("click", function(event) { event.stopImmediatePropagation() })
            selection.find(":checkbox").off("change").on("change", (event) => {
                if (event.target.checked) {
                    this.selectRow({at: indexPath})
                    this._delegateCall("tableViewDidSelectRowAtIndexPath", indexPath)
                    return
                }
                this.deselectRow({at: indexPath})
                this._delegateCall("tableViewDidDeselectRowAtIndexPath", indexPath)
            })
        })
    }

    _delegateCall(method) {
        var delegate = this._delegate
        if (!delegate || typeof delegate[method] !== "function") { return }
        var args = Array.prototype.slice.call(arguments, 1)
        delegate[method].apply(delegate, [this].concat(args))
    }
}


function _row(indexPath) {
    if (indexPath instanceof IndexPath) { return indexPath.row }
    return indexPath
}
