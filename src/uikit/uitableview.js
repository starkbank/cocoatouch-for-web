import { UIScrollView } from "./uiscrollview.js"
import { UITableViewCell } from "./uitableviewcell.js"


export class UITableView extends UIScrollView {

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._delegate = null
        this._isEditable = false
        this.indexPath = 0
        this._allowsMultipleSelection = false
        this._allowsSelection = false
        this._indexPathsForSelectedRows = []
    }

    set isHidden(bool) {
        $(this.selector).css("display", bool ? "none" : "table")
    }

    get isHidden() {
        return $(this.selector).css("display") === "none"
    }

    set isEditable(bool) {
        this._isEditable = bool
    }

    get isEditable() {
        return this._isEditable
    }

    set delegate(delegate) {
        this._delegate = delegate
    }

    get delegate() {
        return this._delegate
    }

    set dataSource(dataSource) {
        this._dataSource = dataSource
        this.reloadData()
    }

    get dataSource() {
        return this._dataSource
    }

    set allowsMultipleSelection(bool) {
        this._allowsMultipleSelection = bool
    }

    get allowsMultipleSelection() {
        return this._allowsMultipleSelection
    }

    get indexPathsForSelectedRows() {
        return this._indexPathsForSelectedRows
    }

    set allowsSelection(bool) {
        this._allowsSelection = bool
    }

    get allowsSelection() {
        return this._allowsSelection
    }

    reloadData() {
        var tableView = this
        var dataSource = this._dataSource
        var delegate = this._delegate

        if (dataSource === null) { return }

        this.indexPath = 0

        var newNumberOfRows = dataSource.tableViewNumberOfRowsInSection(tableView, 0)

        if (newNumberOfRows === 0) {
            this._indexPathsForSelectedRows = []
            $(this.selector).find("tbody").empty()
            return
        }

        var identifier = dataSource.tableViewCellForRowAtIndexPath(tableView, 0).identifier

        this._getHtml(identifier, (html) => {
            var oldNumberOfRows = $(this.selector + ' > tbody:last > tr').length
            var maxNumberOfRows = Math.max(newNumberOfRows, oldNumberOfRows)

            for (var indexPath = 0; indexPath < maxNumberOfRows; indexPath++) {
                var id = "cell-" + indexPath

                if (indexPath >= newNumberOfRows && indexPath < oldNumberOfRows) {
                    $(this.selector + ' tbody tr#' + id).remove()
                    continue
                }

                if (indexPath >= oldNumberOfRows && indexPath < newNumberOfRows) {
                    var cell = $(html)
                    cell.attr("id", id)
                    $(this.selector).append(cell)
                }

                var tableViewCell = dataSource.tableViewCellForRowAtIndexPath(tableView, indexPath)
            }

            this.indexPath = newNumberOfRows

            if (delegate === null) { return }

            $(this.selector).find("[id^=cell-]").unbind("click").on("click", function (event) {
                event.stopImmediatePropagation()
                var indexPath = $(this).index()
                delegate.tableViewDidSelectRowAtIndexPath(tableView, indexPath)
            })

            let cells = $(this.selector).find("[id^=cell-]")

            var isEditable = this._isEditable

            if (isEditable) {
                for (let index = 0; index < cells.length; index++) {
                    const element = cells[index]
                    $(element).find("[id^=delete-button]").unbind("click").click(function (event) {
                        event.stopImmediatePropagation()
                        var indexPath = index
                        delegate.deleteRowAt(indexPath, tableView)
                    })
                }
            }

            for (let index = 0; index < cells.length; index++) {
                const element = cells[index]
                const cell = $(element).find("[id^=table-cell-selected]").unbind("click").on("click", (event) => {
                    event.stopImmediatePropagation()
                    const checkbox = cell.find(":input")
                    if ($(checkbox).is(":checked")) {
                        this.updateIndexPathsForSelectedRows(index)
                    }
                })
            }
        })
    }

    selectAllRows(bool) {
        var cells = $(this.selector).find("[id^=table-cell-selected]")
        const checkbox = cells.find(":input")
        $(checkbox).prop('checked', bool)
        this._indexPathsForSelectedRows = []

        if (!bool) {
            this._delegate.tableViewAccessoryButtonTapped()
            return
        }

        var tableView = this
        var dataSource = this._dataSource
        if (dataSource === null) { return }
        this._indexPathsForSelectedRows = []

        var numberOfRows = dataSource.tableViewNumberOfRowsInSection(tableView, 0)

        for (let index = 0; index < numberOfRows; index++) {
            this.updateIndexPathsForSelectedRows(index)
        }
    }

    dequeueReusableCell({identifier, indexPath}) {
        return new UITableViewCell({identifier, indexPath})
    }

    updateIndexPathsForSelectedRows(indexPath) {
        const i = this._indexPathsForSelectedRows.findIndex(_item => _item === indexPath)
        if (i > -1) {
            this._indexPathsForSelectedRows.splice(i, 1)
        } else {
            this._indexPathsForSelectedRows.push(indexPath)
        }
        this._delegate.tableViewAccessoryButtonTapped()
    }

    _getHtml(htmlPath, callback) {
        var tempDiv = $("<div></div>").addClass("hidden")
        tempDiv.load(htmlPath, function() {
            callback(tempDiv.html())
            tempDiv.remove()
        })
    }
}
