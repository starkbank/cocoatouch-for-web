import { UIScrollView } from "./uiscrollview.js"
import { UIControl } from "./uicontrol.js"
import { UITableViewCell } from "./uitableviewcell.js"
import { IndexPath } from "../foundation/indexpath.js"
import { Bind } from "../utils/bind.js"
import { resolvePendingUnhides } from "../utils/pendingunhides.js"
import { ownElement, ownerOf } from "../utils/elementowner.js"
import { UITableViewScrollPosition } from "./uitableviewscrollposition.js"
import { UITableViewRowAnimation } from "./uitableviewrowanimation.js"
import { UITableViewCellEditingStyle } from "./uitableviewcelleditingstyle.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { required, enumeration, optional, arrayOf, Bool, Int, IndexPathType } from "../utils/required.js"


const retiredDelegateNames = {tableViewCommitEditingStyleForRowAt: "tableViewCommitEditingStyleForRowAtIndexPath"}


// Rows are <tr id="cell-<row>"> children of the table's tbody. A cell class
// registered for a reuse identifier supplies the row html through its nib,
// the .xib of the same name, and is instantiated bound to that row so its
// outlets work like any other view's.
export class UITableView extends UIScrollView {

    static get ScrollPosition() {
        return UITableViewScrollPosition
    }

    static get RowAnimation() {
        return UITableViewRowAnimation
    }

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
        this._reusableCells = []
        this._isReconfiguring = false
        this._insertion = null
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

    // UITableViewDelegate is a UIScrollViewDelegate, so the scroll observation
    // is the scroll view's own, over the same delegate.
    set delegate(delegate) {
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UITableView.delegate", "1.6.0")
        super.delegate = delegate
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

    // setEditing(_:animated:): animated is required and recorded; editing does not animate here.
    /**
     * @param {boolean} editing
     * @param {object} options
     * @param {boolean} options.animated
     */
    setEditing(editing, {animated} = {}) {
        required(animated, "animated", Bool, "UITableView.setEditing", "Apple's is setEditing(_:animated:); write setEditing(editing, {animated: false}).")
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

    /**
     * @param {Function} cellClass
     * @param {object} options
     * @param {string} options.forCellReuseIdentifier
     */
    register(cellClass, {forCellReuseIdentifier}) {
        this._registeredCells[forCellReuseIdentifier] = cellClass
    }

    /**
     * @param {object} options
     * @param {number} options.inSection
     */
    numberOfRows({inSection} = {}) {
        required(inSection, "inSection", Int, "UITableView.numberOfRows", "Apple's is numberOfRows(inSection:); write numberOfRows({inSection: 0}).")
        if (this._dataSource === null) { return 0 }
        return this._dataSource.tableViewNumberOfRowsInSection(this, inSection)
    }

    /**
     * @param {object} options
     * @param {IndexPath|number} options.at
     * @returns {UITableViewCell|null}
     */
    cellForRow({at}) {
        return this._cells[_row(at)] || null
    }

    /**
     * @param {object} options
     * @param {UITableViewCell} options.for
     * @returns {IndexPath|null}
     */
    indexPath({for: cell}) {
        var row = this._cells.indexOf(cell)
        if (row === -1) { return null }
        return new IndexPath({row: row})
    }

    // The previous pass's cells leave the subviews before the new pass, so a
    // table reloaded on every filter does not retain every cell it ever made;
    // a cell the data source dequeues again for its row is handed back, and
    // the rest are released once the pass is over.
    reloadData() {
        if (this._dataSource === null) { return }
        var numberOfRows = this.numberOfRows({inSection: 0})
        var body = this._body()
        body.find("> tr[id^=cell-]").each(function() {
            if (Number(this.id.slice("cell-".length)) >= numberOfRows) { $(this).remove() }
        })
        this._reusableCells = this._cells
        this._cells = []
        this._unlinkCells(this._reusableCells)
        this._selectedRows = this._selectedRows.filter(function(row) { return row < numberOfRows })
        for (var row = 0; row < numberOfRows; row++) {
            this._cells[row] = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row: row}))
        }
        for (var cell of this._reusableCells) {
            if (cell && this._cells.indexOf(cell) === -1) { cell._dispose() }
        }
        this._reusableCells = []
        this._bindRows()
    }

    // insertRows(at:with:): the data source already holds the new rows, as on
    // Apple, so only the inserted rows are asked for a cell; the rows after them
    // are renumbered in place and keep their cells, elements and selection. The
    // animation is recorded and not acted on, as setEditing's animated is.
    /**
     * @param {object} options
     * @param {IndexPath[]} options.at
     * @param {"fade"|"right"|"left"|"top"|"bottom"|"none"|"middle"|"automatic"} options.with
     */
    insertRows({at, with: animation} = {}) {
        var signature = "Apple's is insertRows(at:with:); write insertRows({at: [indexPath], with: UITableViewRowAnimation.none})."
        required(at, "at", arrayOf(IndexPathType), "UITableView.insertRows", signature)
        required(animation, "with", rowAnimationType, "UITableView.insertRows", signature)
        if (this._dataSource === null) { return }
        var count = this.numberOfRows({inSection: 0})
        var inserted = _rowsOf(at, {count, method: "insertRows"})
        if (count !== this._cells.length + inserted.length) {
            throw new Error(`Invalid update: invalid number of rows in section 0. The number of rows contained in an existing section after the update (${count}) must be equal to the number of rows contained in that section before the update (${this._cells.length}), plus or minus the number of rows inserted or deleted (${inserted.length} inserted, 0 deleted).`)
        }
        var shifts = _shifts(inserted, count)
        for (var i = shifts.length - 1; i >= 0; i--) {
            this._renumber(shifts[i].from, shifts[i].to)
            this._cells[shifts[i].to] = this._cells[shifts[i].from]
        }
        var moved = new Map(shifts.map((shift) => [shift.from, shift.to]))
        this._selectedRows = this._selectedRows.map((row) => moved.has(row) ? moved.get(row) : row)
        this._reusableCells = []
        this._insertion = typeof document.createDocumentFragment === "function" ? document.createDocumentFragment() : null
        try {
            for (var row of inserted) {
                this._cells[row] = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row}))
            }
        } finally {
            this._insertion = null
        }
        this._placeInserted(inserted, count)
    }

    // reconfigureRows(at:), iOS 15: the data source is asked again for the rows,
    // and each row's cell comes back from dequeue as it is, without
    // prepareForReuse(), which is Apple's contract for a reconfigure.
    /**
     * @param {object} options
     * @param {IndexPath[]} options.at
     */
    reconfigureRows({at} = {}) {
        var signature = "Apple's is reconfigureRows(at:); write reconfigureRows({at: [indexPath]})."
        required(at, "at", arrayOf(IndexPathType), "UITableView.reconfigureRows", signature)
        if (this._dataSource === null) { return }
        var rows = _rowsOf(at, {count: this._cells.length, method: "reconfigureRows"})
        this._reusableCells = []
        for (var row of rows) {
            var cell = this._cells[row]
            this._unlinkCells([cell])
            this._reusableCells[row] = cell
            this._isReconfiguring = true
            try {
                this._cells[row] = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row}))
            } finally {
                this._isReconfiguring = false
            }
        }
        this._reusableCells = []
    }

    // Hands back the cell already bound to that row for the identifier, after
    // prepareForReuse(); otherwise reuses the row element when it exists,
    // creates it from the registered cell's nib when not, and binds the cell
    // class to it.
    /**
     * @param {object} options
     * @param {string} options.withIdentifier
     * @param {IndexPath} options.for
     * @returns {UITableViewCell}
     */
    dequeueReusableCell({withIdentifier, for: indexPath}) {
        var cellClass = this._registeredCells[withIdentifier] || UITableViewCell
        var row = _row(indexPath)
        var reusable = this._reusableCells[row]
        if (reusable && reusable.reuseIdentifier === withIdentifier && reusable.constructor === cellClass) {
            this._reusableCells[row] = null
            if (!this._isReconfiguring) { reusable.prepareForReuse() }
            this._link(reusable)
            return reusable
        }
        var id = "cell-" + row
        var element = _childRow(this._body(), id)
        if (reusable && reusable.constructor.nib !== cellClass.nib) {
            element = this._replaceRow(reusable, {cellClass, id, row})
        }
        if (element.length === 0) {
            element = $(cellClass.nib || "<tr></tr>").first()
            element.attr("id", id)
            if (this._insertion) { this._insertion.appendChild(element[0]) } else { this._body().append(element) }
        }
        var cell = Bind.construct(cellClass, this.selector + " #" + id, element, indexPath)
        cell.reuseIdentifier = withIdentifier
        cell._$el = element
        ownElement(element, cell)
        this._link(cell)
        Bind.ibOutlet(cell)
        Bind.ibAction(cell)
        Bind.ibInspectable(cell)
        cell.awakeFromNib()
        return cell
    }

    // A reuse identifier maps to one class, so a row whose previous cell is not
    // of the class registered now gets a new cell over the new class's own nib,
    // not the old cell's element bound to another class. The old cell is
    // disposed, which releases its outlets, targets and observers, and its
    // element is replaced in place so the rows keep their order. A class with
    // the same nib takes the element over, as it always did, and the old cell is
    // disposed when the reload ends.
    _replaceRow(stale, {cellClass, id, row}) {
        this._reusableCells[row] = null
        var old = stale.$el
        stale._dispose()
        var element = $(cellClass.nib || "<tr></tr>").first()
        element.attr("id", id)
        old.first().before(element)
        old.remove()
        return element
    }

    // selectRow(at:animated:scrollPosition:): at: null clears the selection, as
    // Apple's nil does; scrollPosition scrolls the row to the edge or middle it
    // names, animated is recorded and not acted on.
    /**
     * @param {object} options
     * @param {IndexPath|number|null} options.at
     * @param {boolean} options.animated
     * @param {"none"|"top"|"middle"|"bottom"} options.scrollPosition
     */
    selectRow({at, animated, scrollPosition} = {}) {
        var signature = "Apple's is selectRow(at:animated:scrollPosition:); write selectRow({at: indexPath, animated: false, scrollPosition: UITableViewScrollPosition.none})."
        required(at, "at", optional(rowType), "UITableView.selectRow", signature)
        required(animated, "animated", Bool, "UITableView.selectRow", signature)
        required(scrollPosition, "scrollPosition", scrollPositionType, "UITableView.selectRow", signature)
        if (at === null) {
            this._selectedRows.slice().forEach((selected) => this._deselect(selected))
            return
        }
        var row = _row(at)
        if (this._selectedRows.indexOf(row) !== -1) { return }
        if (!this._allowsMultipleSelection) {
            this._selectedRows.slice().forEach((selected) => this._deselect(selected))
        }
        this._selectedRows.push(row)
        var $row = this._rowElement(row)
        $row.addClass("selected").find("[id^=table-cell-selected] :input").prop("checked", true)
        _scroll($row[0], scrollPosition)
    }

    /**
     * @param {object} options
     * @param {IndexPath|number} options.at
     * @param {boolean} options.animated
     */
    deselectRow({at, animated} = {}) {
        var signature = "Apple's is deselectRow(at:animated:); write deselectRow({at: indexPath, animated: false})."
        required(at, "at", rowType, "UITableView.deselectRow", signature)
        required(animated, "animated", Bool, "UITableView.deselectRow", signature)
        this._deselect(_row(at))
    }

    _deselect(row) {
        var index = this._selectedRows.indexOf(row)
        if (index === -1) { return }
        this._selectedRows.splice(index, 1)
        this._rowElement(row).removeClass("selected").find("[id^=table-cell-selected] :input").prop("checked", false)
    }

    _unlinkCells(cells) {
        var gone = new Set(cells)
        this._subviews = this.subviews.filter(function(view) { return !gone.has(view) })
    }

    // The element's id and every selector the framework fixed under it at bind
    // time follow the row to its new number, or an outlet would re-resolve to
    // the row that now has the old number. The prefix match is exact, so a
    // nested table's own cell ids are left alone.
    _renumber(from, to) {
        var cell = this._cells[from]
        var element = cell.$el[0]
        var oldPrefix = this.selector + " #cell-" + from
        var newPrefix = this.selector + " #cell-" + to
        var views = new Set()
        _collectSubviews(cell, views)
        for (var descendant of element.querySelectorAll("*")) {
            var owner = ownerOf(descendant)
            if (owner) { _collectSubviews(owner, views) }
        }
        element.id = "cell-" + to
        for (var view of views) {
            if (view.selector === oldPrefix || view.selector.startsWith(oldPrefix + " ")) {
                view.selector = newPrefix + view.selector.slice(oldPrefix.length)
            }
        }
        cell._identifier = "cell-" + to
    }

    // Each contiguous run of inserted rows joins the page in one insertBefore of
    // a fragment, its anchor the element of the row after the run, so the
    // observers of the page see one record per run and not one per row and
    // write. Dequeue built the new rows detached, so an append is one run.
    // A document without createDocumentFragment, the lifecycle tests' stand-in,
    // gets the rows appended at dequeue and moved before their successor one by
    // one, as before.
    _placeInserted(inserted, count) {
        var body = this._body()[0]
        var isInserted = new Set(inserted)
        var anchor = null
        if (typeof document.createDocumentFragment !== "function") {
            for (var at = count - 1; at >= inserted[0]; at--) {
                var element = this._cells[at].$el[0]
                if (isInserted.has(at) && element.nextSibling !== anchor) { body.insertBefore(element, anchor) }
                if (isInserted.has(at)) { this._bindRow(element) }
                anchor = element
            }
            return
        }
        var row = count - 1
        while (row >= inserted[0]) {
            if (!isInserted.has(row)) {
                anchor = this._cells[row].$el[0]
                row--
                continue
            }
            var first = row
            while (first - 1 >= inserted[0] && isInserted.has(first - 1)) { first-- }
            var run = document.createDocumentFragment()
            for (var member = first; member <= row; member++) { run.appendChild(this._cells[member].$el[0]) }
            body.insertBefore(run, anchor)
            for (member = first; member <= row; member++) { this._bindRow(this._cells[member].$el[0]) }
            anchor = this._cells[first].$el[0]
            row = first - 1
        }
    }

    // The table's own last tbody, found through the element's tBodies: a
    // descendant search would also reach a table nested in a row, and scans the
    // whole table on every dequeue.
    _body() {
        var table = this.$el[0]
        if (table && table.tagName === "TABLE" && table.tBodies && table.tBodies.length > 0) {
            return $(table.tBodies[table.tBodies.length - 1])
        }
        var body = this.$el.find("tbody")
        if (body.length === 0) { return this.$el }
        return body.last()
    }

    _rowElement(row) {
        return this._body().find("> #cell-" + row)
    }

    // Each purpose binds under its own namespace and removes only that, so a
    // reload or an editing change leaves a cell's recognizers and targets alone.
    // A row's index path is read from its id when the event fires, so renumbering
    // a row in insertRows needs no rebinding.
    _bindRows() {
        this._body().find("> tr[id^=cell-]").each((index, element) => this._bindRow(element))
    }

    _bindRow(element) {
        var tableView = this
        var $row = $(element)
        $row.off("click.uitableview").on("click.uitableview", function(event) {
            event.stopImmediatePropagation()
            if (!tableView._allowsSelection) { return }
            if (_isInsideControl(event.target, this)) { return }
            var indexPath = _indexPathOf(this)
            if (!tableView._allowsMultipleSelection) {
                tableView._selectOnly(indexPath)
                return
            }
            tableView._toggle(indexPath)
        })
        var deleteButton = $row.find("[id^=delete-button]").off("click.uitableviewdelete")
        if (this._isEditing) {
            deleteButton.on("click.uitableviewdelete", (event) => {
                event.stopImmediatePropagation()
                this._delegateCall("tableViewCommitEditingStyleForRowAtIndexPath", UITableViewCellEditingStyle.delete, _indexPathOf(element))
            })
        }
        var selection = $row.find("[id^=table-cell-selected]")
        selection.off("click.uitableviewselect").on("click.uitableviewselect", function(event) { event.stopImmediatePropagation() })
        selection.find(":checkbox").off("change.uitableviewselect").on("change.uitableviewselect", (event) => {
            if (event.target.checked) {
                this._userSelect(_indexPathOf(element))
                return
            }
            this._userDeselect(_indexPathOf(element))
        })
    }

    // A single selection's tap selects the row, as Apple's does: the row that
    // was selected before it is told it was deselected, then the tapped row is
    // told it was selected. A tap on the selected row is told again and
    // deselects nothing.
    _selectOnly(indexPath) {
        var previous = this.indexPathForSelectedRow
        this.selectRow({at: indexPath, animated: false, scrollPosition: UITableViewScrollPosition.none})
        if (previous !== null && previous.row !== indexPath.row) { this._delegateCall("tableViewDidDeselectRowAtIndexPath", previous) }
        this._delegateCall("tableViewDidSelectRowAtIndexPath", indexPath)
    }

    // With allowsMultipleSelection a tap toggles, as on Apple: it selects an
    // unselected row and deselects a selected one, each followed by its delegate
    // call, through the same path the selection checkbox takes so the two agree.
    _toggle(indexPath) {
        if (this._selectedRows.indexOf(indexPath.row) !== -1) {
            this._userDeselect(indexPath)
            return
        }
        this._userSelect(indexPath)
    }

    _userSelect(indexPath) {
        this.selectRow({at: indexPath, animated: false, scrollPosition: UITableViewScrollPosition.none})
        this._delegateCall("tableViewDidSelectRowAtIndexPath", indexPath)
    }

    _userDeselect(indexPath) {
        this.deselectRow({at: indexPath, animated: false})
        this._delegateCall("tableViewDidDeselectRowAtIndexPath", indexPath)
    }

    _delegateCall(method) {
        var delegate = this._delegate
        if (!delegate || typeof delegate[method] !== "function") { return }
        var args = Array.prototype.slice.call(arguments, 1)
        delegate[method].apply(delegate, [this].concat(args))
    }
}


// A control in a cell handles its own touch, as on iOS: its action fires and
// the row stays unselected. The walk stops at the row, whose owner is the cell.
function _isInsideControl(target, row) {
    for (var element = target; element && element !== row; element = element.parentElement) {
        if (ownerOf(element) instanceof UIControl) { return true }
    }
    return false
}

function _row(indexPath) {
    if (indexPath instanceof IndexPath) { return indexPath.row }
    return indexPath
}

function _indexPathOf(rowElement) {
    return new IndexPath({row: Number(rowElement.id.slice("cell-".length))})
}

// The row element with that id among the body's own children. A browser's
// getElementById answers a missing id without a search, which is every row an
// append is about to create; a detached body, or an id another element of the
// page carries, takes the children scan, which still never walks descendants.
// Without a real body (the lifecycle tests' stand-in) the selector stays.
function _childRow(body, id) {
    var element = body[0]
    if (!element || !element.children) { return body.find("> #" + id) }
    if (element.isConnected === true && typeof document.getElementById === "function" && document.getElementById(id) === null) { return $() }
    for (var i = 0; i < element.children.length; i++) {
        if (element.children[i].id === id) { return $(element.children[i]) }
    }
    return $()
}

// The rows an update names, validated before anything changes: this table has
// one section, a row is named once, and it lies inside the table.
function _rowsOf(indexPaths, {count, method}) {
    var rows = []
    var seen = new Set()
    for (var indexPath of indexPaths) {
        if (indexPath.section !== 0) {
            throw new Error(`UITableView.${method}: this table view has one section, so every index path must be in section 0, got section ${indexPath.section}.`)
        }
        if (seen.has(indexPath.row)) {
            throw new Error(`UITableView.${method}: row ${indexPath.row} is named more than once; each row must be unique.`)
        }
        if (!Number.isInteger(indexPath.row) || indexPath.row < 0 || indexPath.row >= count) {
            throw new Error(`UITableView.${method}: row ${indexPath.row} is out of range 0...${count - 1}.`)
        }
        seen.add(indexPath.row)
        rows.push(indexPath.row)
    }
    return rows.sort((a, b) => a - b)
}

// Where each old row lands once the inserted rows are in: the rows below the
// lowest inserted one keep their place, so only the rest are walked.
function _shifts(inserted, count) {
    var isInserted = new Set(inserted)
    var shifts = []
    var old = inserted[0]
    for (var row = inserted[0]; row < count; row++) {
        if (isInserted.has(row)) { continue }
        if (row !== old) { shifts.push({from: old, to: row}) }
        old += 1
    }
    return shifts
}

function _collectSubviews(view, views) {
    if (views.has(view)) { return }
    views.add(view)
    for (var subview of view.subviews) { _collectSubviews(subview, views) }
}

// A row is an IndexPath or, as the framework has always accepted, a bare row number.
const rowType = Object.freeze({kind: "row", name: "IndexPath"})
const scrollPositionType = enumeration(UITableViewScrollPosition, "UITableView.ScrollPosition")
const rowAnimationType = enumeration(UITableViewRowAnimation, "UITableView.RowAnimation")

var _blocks = {top: "start", middle: "center", bottom: "end"}

function _scroll(element, scrollPosition) {
    var block = _blocks[scrollPosition]
    if (!block || !element || typeof element.scrollIntoView !== "function") { return }
    resolvePendingUnhides()
    element.scrollIntoView({block: block})
}
