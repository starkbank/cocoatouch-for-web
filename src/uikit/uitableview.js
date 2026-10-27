import { UIScrollView } from "./uiscrollview.js"
import { UIControl } from "./uicontrol.js"
import { UITableViewCell } from "./uitableviewcell.js"
import { IndexPath } from "../foundation/indexpath.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { Bind } from "../utils/bind.js"
import { resolvePendingUnhides } from "../utils/pendingunhides.js"
import { ownElement, ownerOf } from "../utils/elementowner.js"
import { automaticDimension, createRowHeights, offsetOf, firstRowAt, totalHeight, effectiveHeight, insert, measure, reset } from "../utils/rowheights.js"
import { clipAncestors, visibleClip, scroller } from "../utils/scrollclip.js"
import { createColumnWidths, reset as resetColumns, insert as insertColumns, noteSignature, skeleton, otherSignatures, need, record, invalidate, pending, pendingCount, settle, aggregate, replaySpans, finiteWidth } from "../utils/columnwidths.js"
import { UITableViewScrollPosition } from "./uitableviewscrollposition.js"
import { UITableViewRowAnimation } from "./uitableviewrowanimation.js"
import { UITableViewCellEditingStyle } from "./uitableviewcelleditingstyle.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { required, typed, enumeration, optional, arrayOf, Bool, Int, Float, IndexPathType } from "../utils/required.js"


const retiredDelegateNames = {tableViewCommitEditingStyleForRowAt: "tableViewCommitEditingStyleForRowAtIndexPath"}

// What a document without layout, or a table without an element, has for a viewport: jsdom's window height.
const layoutlessViewportHeight = 768
// Extra batches of rows one layout pass may add when the rows it measured cover less than the area.
const maxExtensions = 3
// Scrolls scrollToRow may correct after its first, once the rows it reached are measured.
const maxCorrections = 2
// A colSpan beyond this is no structure a table has; the skeleton falls back to 1.
const maxColSpan = 1000
// The rows one measuring chunk asks the data source for, and the least the reuse queue may hold, since it is the pool they are measured in.
const measuringBatch = 100
// An anchor row that moved less than this on screen is not compensated.
const anchorTolerance = 0.5


// Rows are <tr id="cell-<row>"> children of the table's tbody, but only the rows in or near the visible area exist: a cell that
// leaves that area waits in a hidden tbody, in the document, under a reusable-<n> id, and serves the next row that comes into view,
// as UITableView's reuse queue does. A spacer row above and one below, as tall as the rows they stand for, keep the page's height.
// A cell class registered for a reuse identifier supplies the row html through its nib, the .xib of the same name, and is
// instantiated bound to that row so its outlets work like any other view's.
export class UITableView extends UIScrollView {

    static get ScrollPosition() {
        return UITableViewScrollPosition
    }

    static get RowAnimation() {
        return UITableViewRowAnimation
    }

    static get automaticDimension() {
        return automaticDimension
    }

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._delegate = null
        this._isEditing = false
        this._allowsSelection = true
        this._allowsMultipleSelection = false
        this._selectedRows = new Set()
        this._registeredCells = {}
        this._heights = createRowHeights({count: 0})
        this._first = 0
        this._visible = []
        this._queues = new Map()
        this._queueBody = null
        this._maxWindow = 0
        this._serial = 0
        this._reusableCells = new Map()
        this._staleCells = []
        this._unbound = []
        this._isReconfiguring = false
        this._isLaying = false
        this._scrollObserver = {}
        this._clipAncestors = null
        this._isObserving = false
        this._resizeObserver = null
        this._observedWidth = null
        this._frame = null
        this._topSpacer = null
        this._bottomSpacer = null
        this._insertion = null
        this._columns = createColumnWidths()
        this._measuring = false
        this._measured = []
        this._measureFrame = null
        this._isMeasured = false
        this._lastWidth = 0
        this._mode = null
        this._innerWidth = null
        this._needAll = false
        this._aggregateKey = ""
        this._fonts = null
        this._onFonts = null
        this._readyGeneration = -1
        this._replayReport = new Map()
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
    // is the scroll view's own, over the same delegate. A delegate's
    // estimates change every unmeasured row's height, so replacing it dirties
    // them all and schedules a pass.
    set delegate(delegate) {
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UITableView.delegate", "1.6.0")
        super.delegate = delegate
        var estimates = delegate && typeof delegate.tableViewEstimatedHeightForRowAtIndexPath === "function"
        this._heights.estimatedHeightForRow = estimates ? (row) => this._delegateEstimate(row) : null
        this._dirtyAndSchedule()
    }

    get delegate() {
        return this._delegate
    }

    // The height an unmeasured row is given before it is displayed: UITableView.automaticDimension, the default, estimates from the
    // cells already measured; a number is the estimate of every row the delegate does not answer for.
    /** @param {number} height */
    set estimatedRowHeight(height) {
        typed(height, "estimatedRowHeight", Float, "UITableView.estimatedRowHeight", "Apple's is var estimatedRowHeight: CGFloat; write tableView.estimatedRowHeight = UITableView.automaticDimension.")
        this._heights.estimatedRowHeight = height
        this._dirtyAndSchedule()
    }

    get estimatedRowHeight() {
        return this._heights.estimatedRowHeight
    }

    // Rows are sized automatically in this version, so Apple's default is all there is to read.
    get rowHeight() {
        return automaticDimension
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
        return Array.from(this._selectedRows, function(row) { return new IndexPath({row: row}) })
    }

    get indexPathForSelectedRow() {
        if (this._selectedRows.size === 0) { return null }
        return new IndexPath({row: this._selectedRows.values().next().value})
    }

    // The cells that exist: the rows in or near the visible area, from willDisplay to didEndDisplaying.
    /** @returns {UITableViewCell[]} */
    get visibleCells() {
        return this._visible.slice()
    }

    get indexPathsForVisibleRows() {
        return this._visible.map((cell, index) => new IndexPath({row: this._first + index}))
    }

    // A class or nib that changed for an identifier retires that identifier's queue: its cells are of the old class.
    /**
     * @param {Function} cellClass
     * @param {object} options
     * @param {string} options.forCellReuseIdentifier
     */
    register(cellClass, {forCellReuseIdentifier}) {
        var previous = this._registeredCells[forCellReuseIdentifier]
        this._registeredCells[forCellReuseIdentifier] = cellClass
        if (!previous || (previous === cellClass && previous.nib === cellClass.nib)) { return }
        this._discardQueue(forCellReuseIdentifier)
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

    // null for a row that has no cell, as Apple's nil: a row outside the rendered window.
    /**
     * @param {object} options
     * @param {IndexPath|number} options.at
     * @returns {UITableViewCell|null}
     */
    cellForRow({at}) {
        return this._visible[_row(at) - this._first] || null
    }

    /**
     * @param {object} options
     * @param {UITableViewCell} options.for
     * @returns {IndexPath|null}
     */
    indexPath({for: cell}) {
        var index = this._visible.indexOf(cell)
        if (index === -1) { return null }
        return new IndexPath({row: this._first + index})
    }

    // The data source is asked for the rows of the area only. The cell displayed at a row before the reload is handed back to it
    // by dequeue; the cells the reload does not hand back go to the reuse queue, and when no row is left they are all released.
    reloadData() {
        this._assertNotUpdating("reloadData")
        if (this._dataSource === null) { return }
        var count = this.numberOfRows({inSection: 0})
        this._selectedRows = new Set(Array.from(this._selectedRows).filter(function(row) { return row < count }))
        var previous = this._renderedRows()
        reset(this._heights, {count: count, keepEstimates: true})
        this._resetColumns({keepFloor: true})
        this._reusableCells = previous
        this._unlinkCells(Array.from(previous.values()))
        this._visible = []
        this._needAll = true
        this._layoutRows({force: true, retained: new Map()})
    }

    // insertRows(at:with:): the data source already holds the new rows, as on
    // Apple, so only the inserted rows that come into view are asked for a cell;
    // the rendered rows after them are renumbered in place and keep their cells,
    // elements and selection. The animation is recorded and not acted on, as
    // setEditing's animated is.
    /**
     * @param {object} options
     * @param {IndexPath[]} options.at
     * @param {"fade"|"right"|"left"|"top"|"bottom"|"none"|"middle"|"automatic"} options.with
     */
    insertRows({at, with: animation} = {}) {
        var signature = "Apple's is insertRows(at:with:); write insertRows({at: [indexPath], with: UITableViewRowAnimation.none})."
        required(at, "at", arrayOf(IndexPathType), "UITableView.insertRows", signature)
        required(animation, "with", rowAnimationType, "UITableView.insertRows", signature)
        this._assertNotUpdating("insertRows")
        if (this._dataSource === null) { return }
        var count = this.numberOfRows({inSection: 0})
        var inserted = _rowsOf(at, {count, method: "insertRows"})
        var before = this._heights.count
        if (count !== before + inserted.length) {
            throw new Error(`Invalid update: invalid number of rows in section 0. The number of rows contained in an existing section after the update (${count}) must be equal to the number of rows contained in that section before the update (${before}), plus or minus the number of rows inserted or deleted (${inserted.length} inserted, 0 deleted).`)
        }
        var moved = new Map()
        var rendered = Array.from(this._renderedRows())
        for (var i = rendered.length - 1; i >= 0; i--) {
            var [row, cell] = rendered[i]
            var to = _shifted(row, inserted)
            if (to !== row) { this._renumber(cell, "cell-" + row, "cell-" + to) }
            moved.set(to, cell)
        }
        insert(this._heights, inserted)
        insertColumns(this._columns, inserted)
        this._selectedRows = new Set(Array.from(this._selectedRows, (row) => _shifted(row, inserted)))
        this._reusableCells = new Map()
        this._layoutRows({force: true, retained: moved})
        this._needOutsideWindow(inserted)
        this._measureChunk()
        this._replay()
    }

    // reconfigureRows(at:), iOS 15: the data source is asked again for the rows
    // that have a cell, and each row's cell comes back from dequeue as it is,
    // without prepareForReuse(), which is Apple's contract for a reconfigure. A
    // row without a cell is ignored, as Apple ignores an invisible row.
    /**
     * @param {object} options
     * @param {IndexPath[]} options.at
     */
    reconfigureRows({at} = {}) {
        var signature = "Apple's is reconfigureRows(at:); write reconfigureRows({at: [indexPath]})."
        required(at, "at", arrayOf(IndexPathType), "UITableView.reconfigureRows", signature)
        this._assertNotUpdating("reconfigureRows")
        if (this._dataSource === null) { return }
        var rows = _rowsOf(at, {count: this._heights.count, method: "reconfigureRows"})
        this._reusableCells = new Map()
        for (var row of rows) {
            var cell = this.cellForRow({at: row})
            invalidate(this._columns, [row])
            if (!cell) { continue }
            this._unlinkCells([cell])
            this._reusableCells.set(row, cell)
            this._isReconfiguring = true
            try {
                this._visible[row - this._first] = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row}))
                this._noteStructure(row, this._visible[row - this._first])
                this._bindCreated()
            } finally {
                this._isReconfiguring = false
            }
        }
        this._reusableCells = new Map()
        this._layoutRows({force: true})
        this._needOutsideWindow(rows)
        this._measureChunk()
        this._replay()
    }

    // Hands back the cell displayed at that row before a reload, after
    // prepareForReuse(), when it is of the identifier and class asked for;
    // otherwise a cell from the identifier's queue, placed in the rows,
    // renumbered and only then sent prepareForReuse(), so the app sees its own,
    // connected row, once the row's previous cell, of another identifier or
    // class, is disposed and its element removed, so no two rows ever have one
    // id; otherwise creates the row element from the registered cell's nib, or
    // takes the previous cell's over when the nib is the same, and binds the
    // cell class to it.
    /**
     * @param {object} options
     * @param {string} options.withIdentifier
     * @param {IndexPath} options.for
     * @returns {UITableViewCell}
     */
    dequeueReusableCell({withIdentifier, for: indexPath}) {
        var cellClass = this._registeredCells[withIdentifier] || UITableViewCell
        if (this._measuring) { return this._dequeueMeasuring(withIdentifier, cellClass, indexPath) }
        var row = _row(indexPath)
        var reusable = this._reusableCells.get(row)
        if (reusable && reusable.reuseIdentifier === withIdentifier && reusable.constructor === cellClass) {
            this._reusableCells.delete(row)
            if (!this._isReconfiguring) { reusable.prepareForReuse() }
            this._link(reusable)
            return reusable
        }
        var queued = this._takeQueued(withIdentifier, cellClass)
        if (queued && reusable) {
            this._reusableCells.delete(row)
            this._replace(reusable, row)
        }
        if (queued) { return this._reuseQueued(queued, {row, indexPath}) }
        var id = "cell-" + row
        var element = _childRow(this._body(), id)
        if (reusable && reusable.constructor.nib !== cellClass.nib) {
            element = this._replaceRow(reusable, {cellClass, id, row})
        }
        if (reusable && reusable.constructor.nib === cellClass.nib) {
            this._reusableCells.delete(row)
            this._staleCells.push({cell: reusable, row})
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
        this._unbound.push(element[0] || element)
        return cell
    }

    // A cell asked for only to be measured: it comes from the queue, or is built there, and stays there under its reusable-<n> id. It is
    // never bound to touches, drawn selected or sent willDisplay, because it is never displayed.
    _dequeueMeasuring(identifier, cellClass, indexPath) {
        var cell = this._takeQueued(identifier, cellClass)
        if (cell) {
            cell._indexPath = indexPath
            this._link(cell)
            cell.prepareForReuse()
        } else {
            var id = "reusable-" + (++this._serial)
            var element = $(cellClass.nib || "<tr></tr>").first()
            element.attr("id", id)
            this._queueElement().appendChild(element[0])
            cell = Bind.construct(cellClass, this.selector + " #" + id, element, indexPath)
            cell.reuseIdentifier = identifier
            cell._$el = element
            ownElement(element, cell)
            this._link(cell)
            Bind.ibOutlet(cell)
            Bind.ibAction(cell)
            Bind.ibInspectable(cell)
            cell.awakeFromNib()
            measuredOnly.add(cell)
        }
        this._measured.push(cell)
        return cell
    }

    // A reuse identifier maps to one class, so a row whose previous cell is not
    // of the class registered now gets a new cell over the new class's own nib,
    // not the old cell's element bound to another class. The old cell is
    // disposed, which releases its outlets, targets and observers, and its
    // element is replaced in place so the rows keep their order. A class with
    // the same nib takes the element over, as it always did, and the old cell is
    // disposed when the pass ends.
    _replaceRow(stale, {cellClass, id, row}) {
        this._reusableCells.delete(row)
        this._delegateCall("tableViewDidEndDisplayingCellForRowAtIndexPath", stale, new IndexPath({row}))
        var old = stale._$el
        stale._dispose()
        var element = $(cellClass.nib || "<tr></tr>").first()
        element.attr("id", id)
        old.first().before(element)
        old.remove()
        return element
    }

    // selectRow(at:animated:scrollPosition:): at: null clears the selection, as
    // Apple's nil does; a row without a cell is recorded and drawn selected
    // when it appears; scrollPosition scrolls the row to the edge or middle it
    // names, where none does not scroll, as Apple documents for selectRow;
    // animated is recorded and not acted on.
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
        if (scrollPosition !== UITableViewScrollPosition.none) { this._assertNotUpdating("selectRow") }
        if (at === null) {
            Array.from(this._selectedRows).forEach((selected) => this._deselect(selected))
            return
        }
        var row = _row(at)
        if (this._selectedRows.has(row)) { return }
        if (!this._allowsMultipleSelection) {
            Array.from(this._selectedRows).forEach((selected) => this._deselect(selected))
        }
        this._selectedRows.add(row)
        var cell = this.cellForRow({at: row})
        if (cell) { this._drawSelection(cell, row) }
        if (scrollPosition === UITableViewScrollPosition.none) { return }
        this._scrollRowTo(row, scrollPosition)
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

    // scrollToRow(at:at:animated:): the row is brought to the top, middle or
    // bottom of what the page or its scroller shows, or, for none, only far
    // enough to show it whole. A row without a cell is reached through the
    // height model and measured as it is drawn, so the target is corrected
    // after the first scroll; animated is recorded and not acted on.
    /**
     * @param {IndexPath|number} indexPath
     * @param {object} options
     * @param {"none"|"top"|"middle"|"bottom"} options.at
     * @param {boolean} options.animated
     */
    scrollToRow(indexPath, {at, animated} = {}) {
        var signature = "Apple's is scrollToRow(at:at:animated:); write scrollToRow(indexPath, {at: UITableViewScrollPosition.top, animated: false})."
        typed(indexPath, "indexPath", rowType, "UITableView.scrollToRow", signature)
        required(at, "at", scrollPositionType, "UITableView.scrollToRow", signature)
        required(animated, "animated", Bool, "UITableView.scrollToRow", signature)
        this._assertNotUpdating("scrollToRow")
        var section = indexPath instanceof IndexPath ? indexPath.section : 0
        var row = _row(indexPath)
        var count = this.numberOfRows({inSection: 0})
        if (section !== 0 || row < 0 || row >= count) {
            throw new RangeError(`UITableView.scrollToRow: attempt to scroll to invalid index path, section ${section} row ${row} of a table with one section of ${count} rows. ${signature}`)
        }
        this._scrollRowTo(row, at)
    }

    _deselect(row) {
        if (!this._selectedRows.delete(row)) { return }
        var cell = this.cellForRow({at: row})
        if (cell) { this._drawSelection(cell, row) }
    }

    // The selected state is drawn from the selected rows whenever a cell shows a row, so a cell reused from a selected row never
    // shows its selection and a selected row always does.
    _drawSelection(cell, row) {
        var isSelected = this._selectedRows.has(row)
        cell._$el.toggleClass("selected", isSelected).find("[id^=table-cell-selected] :input").prop("checked", isSelected)
    }

    // UIKit raises when an update is asked for while the table view is sending its data source or delegate a message: the update would
    // change the rows the pass is walking.
    _assertNotUpdating(method) {
        if (!this._isLaying) { return }
        throw new Error(`UITableView.${method}: the table view is already updating its rows. Apple's UITableView raises the same when an update is asked for from inside tableView(_:cellForRowAt:) or a delegate method it is sending.`)
    }

    _dirtyAndSchedule() {
        this._heights.dirtyFrom = 0
        this._schedule()
    }

    // One animation frame pass however many estimates changed; nothing runs where there is no frame to wait for.
    _schedule() {
        if (this._frame !== null || typeof requestAnimationFrame !== "function") { return }
        this._frame = requestAnimationFrame(() => {
            this._frame = null
            if (this._isDetached()) { return }
            this._layoutRows({compensate: true})
        })
    }

    // A table whose element left the document is not asked to lay out by what it was listening to: its view would look itself up
    // again by selector and find whatever element has that id now.
    _isDetached() {
        var node = this._cachedElement && this._cachedElement[0]
        return !node || node.isConnected === false
    }

    _delegateEstimate(row) {
        var delegate = this._delegate
        if (!delegate || typeof delegate.tableViewEstimatedHeightForRowAtIndexPath !== "function") { return undefined }
        var height = delegate.tableViewEstimatedHeightForRowAtIndexPath(this, new IndexPath({row}))
        if (typeof height === "number" && !Number.isNaN(height)) { return height }
        throw new TypeError(`UITableView.delegate: tableViewEstimatedHeightForRowAtIndexPath must return a number, got ${typeof height}. Apple's is tableView(_:estimatedHeightForRowAt:) -> CGFloat; return UITableView.automaticDimension for no estimate.`)
    }

    _renderedRows() {
        var rendered = new Map()
        this._visible.forEach((cell, index) => rendered.set(this._first + index, cell))
        return rendered
    }

    _unlinkCells(cells) {
        var gone = new Set(cells)
        this._subviews = this.subviews.filter(function(view) { return !gone.has(view) })
    }

    // The element's id and every selector the framework fixed under it at bind
    // time follow the row to its new id, or an outlet would re-resolve to the
    // row that now has the old id. The prefix match is exact, so a nested
    // table's own cell ids are left alone. Every read goes through the cell's
    // cached element, because a view's $el re-queries by selector once a node
    // has left the document, and the selector is what is being changed.
    // Elements the framework named after the row (a view added in code gets
    // <row id>-<n>) are renamed too, so the next cell to show that row never
    // meets a duplicate id.
    _renumber(cell, fromId, toId) {
        var element = cell._$el[0]
        var oldPrefix = this.selector + " #" + fromId
        var newPrefix = this.selector + " #" + toId
        var views = new Set()
        _collectSubviews(cell, views)
        var named = []
        for (var descendant of element.querySelectorAll("*")) {
            var owner = ownerOf(descendant)
            if (owner) { _collectSubviews(owner, views) }
            if (descendant.id.startsWith(fromId + "-")) { named.push(descendant) }
        }
        for (var view of views) {
            if (typeof view.selector !== "string") { continue }
            if (view.selector === oldPrefix || view.selector.startsWith(oldPrefix + " ")) {
                view.selector = newPrefix + view.selector.slice(oldPrefix.length)
            }
        }
        for (var node of named) { _renameNamed(node, fromId, toId, views) }
        element.id = toId
        cell._identifier = toId
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

    // Each purpose binds under its own namespace and removes only that, so an
    // editing change leaves a cell's recognizers and targets alone. The rows
    // and the queued rows are bound alike, so a cell made while not editing
    // has its delete handler when editing starts. A row's index path is read
    // from its id when the event fires, so renumbering a row needs no rebinding.
    _bindRows() {
        this._body().find("> tr[id^=cell-]").each((index, element) => this._bindRow(element))
        if (this._queueBody) { $(this._queueBody).children("tr").each((index, element) => this._bindRow(element)) }
    }

    // A new row element is bound after the data source has configured its cell, so the recognizers and targets the app adds to the
    // cell run before the row's own tap, which stops the click, as they did when a reload bound the rows once it was over.
    _bindCreated() {
        var created = this._unbound
        this._unbound = []
        for (var element of created) { this._bindRow(element) }
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
        if (this._selectedRows.has(indexPath.row)) {
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

    // The reuse queue ------------------------------------------------------------------------------------------------------------

    // A queued cell's element stays in the document, in a hidden tbody before the rows, because a view whose node left the document
    // looks itself up again by selector and would find the row that now has its old id. The tbody exists only while something waits.
    _queueElement() {
        if (this._queueBody) { return this._queueBody }
        var rows = this._body()[0]
        if (!rows || rows.tagName !== "TBODY" || !rows.parentNode || typeof document.createElement !== "function") { return null }
        var tbody = document.createElement("tbody")
        tbody.style.display = "none"
        rows.parentNode.insertBefore(tbody, rows)
        this._queueBody = tbody
        return tbody
    }

    _takeQueued(identifier, cellClass) {
        var queue = this._queues.get(identifier)
        while (queue && queue.length > 0) {
            var cell = queue.pop()
            if (cell.constructor === cellClass) { return cell }
            this._release(cell)
        }
        return null
    }

    // The cell is configured where it waits, in the queue's tbody, which is in the document, so the app's prepareForReuse runs on a
    // connected row; renumber through the cell's own element; link; then prepare. It joins the rows when the pass ends, together with
    // the rest of its run, so the rows tbody is written once per run and not once per cell.
    _reuseQueued(cell, {row, indexPath}) {
        var element = cell._$el[0]
        if (measuredOnly.delete(cell)) { this._unbound.push(element) }
        this._renumber(cell, element.id, "cell-" + row)
        cell._indexPath = indexPath
        this._link(cell)
        cell.prepareForReuse()
        return cell
    }

    // A cell leaving its row: told so while its element is still the row, then renumbered out of the way, its drawn selection
    // cleared, and queued; or released, while still connected, when its queue is already as long as the largest window seen.
    _retire(cell, row) {
        this._delegateCall("tableViewDidEndDisplayingCellForRowAtIndexPath", cell, new IndexPath({row}))
        var queue = this._queues.get(cell.reuseIdentifier)
        var queueElement = cell._$el && cell._$el[0] && cell.reuseIdentifier !== null ? this._queueElement() : null
        if (!queueElement) {
            this._release(cell)
            return
        }
        // The queue is the pool the rows are measured in as well, so it may hold measuringBatch cells; when it is full the oldest
        // waits no longer, because the cell that just left a row has been bound and drawn and is the one that serves the next.
        if (queue && queue.length >= Math.max(this._maxWindow, measuringBatch)) { this._release(queue.shift()) }
        this._renumber(cell, cell._$el[0].id, "reusable-" + (++this._serial))
        cell._$el.removeClass("selected").find("[id^=table-cell-selected] :input").prop("checked", false)
        queueElement.appendChild(cell._$el[0])
        if (!queue) { this._queues.set(cell.reuseIdentifier, queue = []) }
        queue.push(cell)
    }

    // A row's previous cell, of an identifier or class other than the one now asked for, is told it left, then released: it does not go
    // to the queue, which holds cells of the identifier's registered class only.
    _replace(cell, row) {
        this._delegateCall("tableViewDidEndDisplayingCellForRowAtIndexPath", cell, new IndexPath({row}))
        this._release(cell)
    }

    // Disposed while its element is still in the document, so its outlets release their own nodes, and only then removed.
    _release(cell) {
        var element = cell._$el
        cell._dispose()
        if (element) { element.remove() }
    }

    _discardQueue(identifier) {
        for (var cell of this._queues.get(identifier) || []) { this._release(cell) }
        this._queues.delete(identifier)
    }

    _discardQueues() {
        for (var identifier of Array.from(this._queues.keys())) { this._discardQueue(identifier) }
        if (this._queueBody) { this._queueBody.remove() }
        this._queueBody = null
    }

    // The layout pass -------------------------------------------------------------------------------------------------------------

    // Brings the rendered window to the rows in the area, which is the visible clip and one clip above and below it. It reads once,
    // writes the window, reads once more to measure, and repeats while the measured rows still leave the area uncovered. The scroll
    // that heights above the first visible row moved is taken back through the page's scroller, so what the user sees does not jump.
    // `retained` is the cells that stay as they are when their row is in the window, which a reload empties and an insert shifts.
    _layoutRows({force = false, compensate = false, retained = null} = {}) {
        if (this._dataSource === null || this._isLaying) { return }
        this._isLaying = true
        try {
            this._runPass({force, compensate, retained})
        } finally {
            this._isLaying = false
        }
    }

    _runPass({force, compensate, retained}) {
        if (this._heights.count === 0) {
            this._empty()
            return
        }
        var cells = retained ? Array.from(retained).sort((a, b) => a[0] - b[0]) : Array.from(this._renderedRows())
        var read = this._read(cells)
        this._lastWidth = read.width
        this._noteEnvironment(read)
        if (read.clip.bottom - read.clip.top <= 0 && !force) { return }
        // A table whose scroller is out of the viewport has an empty clip; the viewport stands in for it for the whole pass, the reads
        // that follow included, or the second round would find an empty area and take back the rows the first one drew.
        var isClipEmpty = read.clip.bottom - read.clip.top <= 0
        if (isClipEmpty) { read.clip = visibleClip(this.$el[0], []) }
        this._record(read, cells)
        var anchor = compensate ? _anchorOf(read, cells) : null
        var extension = null
        for (var round = 0; round <= maxExtensions; round++) {
            var range = this._rangeFor(read, extension)
            if (round > 0 && range.a === this._first && range.b === this._first + this._visible.length) { break }
            this._setWindow(range, round === 0 ? retained : null)
            cells = Array.from(this._renderedRows()).sort((a, b) => a[0] - b[0])
            read = this._read(cells)
            if (isClipEmpty) { read.clip = visibleClip(this.$el[0], []) }
            this._record(read, cells)
            extension = this._extensionFor(read)
        }
        if (this._arrange()) {
            read = this._read(cells)
            if (isClipEmpty) { read.clip = visibleClip(this.$el[0], []) }
            this._record(read, cells)
        }
        this._observe(read)
        if (anchor) { this._compensate(anchor, read, cells) }
        this._settleColumns()
    }

    // The rows to render: those that end past the top of the area through the one that contains its bottom edge, plus the rows
    // an extension asks for when what is measured does not cover it. A window starts at firstRowAt, never at rowAt, because rows
    // with no height make equal offsets and only the first of them is where the unmeasured rows begin.
    _rangeFor(read, extension) {
        var heights = this._heights
        var count = heights.count
        var clipHeight = read.clip.bottom - read.clip.top
        var areaTop = read.clip.top - clipHeight - read.origin
        var areaBottom = read.clip.bottom + clipHeight - read.origin
        if (areaBottom <= 0) { return {a: 0, b: 0} }
        var a = firstRowAt(heights, areaTop)
        var b = firstRowAt(heights, areaBottom)
        if (b < count && offsetOf(heights, b) < areaBottom) { b += 1 }
        if (extension !== null) { b = Math.max(b, extension) }
        return {a: a, b: Math.max(a, Math.min(count, b))}
    }

    // Where the window must end to cover the area when the rows measured so far fall short of it, sized by what a row is believed to
    // measure; null when the area is covered or the rows have run out.
    _extensionFor(read) {
        var heights = this._heights
        var end = this._first + this._visible.length
        if (end >= heights.count) { return null }
        var clipHeight = read.clip.bottom - read.clip.top
        var uncovered = read.clip.bottom + clipHeight - read.origin - offsetOf(heights, end)
        if (uncovered <= anchorTolerance) { return null }
        return end + Math.ceil(uncovered / this._batchHeight())
    }

    // Only sizes a batch of rows to add, never a row: the estimate if there is one, else the mean of what was measured, else 44.
    _batchHeight() {
        var heights = this._heights
        if (heights.estimatedRowHeight > 0) { return heights.estimatedRowHeight }
        var dominant = heights.estimates.get(heights.dominantIdentifier)
        return dominant ? dominant.sum / dominant.count : effectiveHeight(heights, 0) || 44
    }

    // One batch of reads: the clip, where row 0 begins, and the top of every rendered row and of what follows the last, so a row's
    // height is the distance to the next top, borders and spacing included. Anything unhidden since the last read is resolved first.
    _read(cells) {
        var element = this.$el[0]
        if (!element || typeof element.getBoundingClientRect !== "function") {
            return {clip: {top: 0, bottom: layoutlessViewportHeight}, origin: 0, tops: null, terminal: 0, width: 0}
        }
        resolvePendingUnhides()
        if (this._clipAncestors === null) { this._clipAncestors = clipAncestors(element) }
        var body = this._body()[0]
        var tops = cells.map(function(entry) { return entry[1]._$el[0].getBoundingClientRect().top })
        var last = body.lastElementChild
        var terminal = cells.length > 0 && last === this._bottomSpacer ? last.getBoundingClientRect().top : body.getBoundingClientRect().bottom
        var first = body.firstElementChild
        var origin = first ? first.getBoundingClientRect().top : body.getBoundingClientRect().top
        return {clip: visibleClip(element, this._clipAncestors), origin: origin, tops: tops, terminal: terminal, width: element.getBoundingClientRect().width}
    }

    _record(read, cells) {
        if (read.tops === null) { return }
        for (var i = 0; i < cells.length; i++) {
            var next = i + 1 < cells.length ? read.tops[i + 1] : read.terminal
            measure(this._heights, cells[i][0], next - read.tops[i], cells[i][1].reuseIdentifier)
        }
    }

    // Writes: the cells whose row left the window are retired first, so they can serve the rows that come in; the rows that have no
    // cell are asked of the data source, in order, and each is drawn selected or not and told it will display.
    _setWindow(range, retained) {
        var rendered = retained || this._renderedRows()
        var leaving = []
        for (var [row, cell] of rendered) {
            if (row < range.a || row >= range.b) { leaving.push([row, cell]) }
        }
        for (var [row, cell] of this._reusableCells) {
            if (row < range.a || row >= range.b) { leaving.push([row, cell]) }
        }
        this._unlinkCells(leaving.map((entry) => entry[1]))
        for (var [row, cell] of leaving) {
            this._reusableCells.delete(row)
            this._retire(cell, row)
        }
        need(this._columns, leaving.map((entry) => entry[0]))
        var next = []
        // A row that has no element yet is built into a fragment, and _arrange moves each run of new rows into the page with one write.
        this._insertion = typeof document.createDocumentFragment === "function" ? document.createDocumentFragment() : null
        try {
            for (var row = range.a; row < range.b; row++) {
                if (rendered.has(row)) {
                    next.push(rendered.get(row))
                    continue
                }
                var indexPath = new IndexPath({row})
                var cell = this._dataSource.tableViewCellForRowAtIndexPath(this, indexPath)
                this._noteStructure(row, cell)
                this._bindCreated()
                this._drawSelection(cell, row)
                this._delegateCall("tableViewWillDisplayCellForRowAtIndexPath", cell, indexPath)
                next.push(cell)
            }
        } finally {
            this._insertion = null
        }
        this._finishReload()
        this._first = range.a
        this._visible = next
        this._maxWindow = Math.max(this._maxWindow, next.length)
        this._arrange()
    }

    // What a reload did not hand back: the cells whose row is in the window but were not dequeued again leave, and a cell another
    // class's nib took the element of is released.
    _finishReload() {
        var unclaimed = Array.from(this._reusableCells)
        this._reusableCells = new Map()
        for (var [row, cell] of unclaimed) { this._retire(cell, row) }
        var stale = this._staleCells
        this._staleCells = []
        for (var entry of stale) {
            this._delegateCall("tableViewDidEndDisplayingCellForRowAtIndexPath", entry.cell, new IndexPath({row: entry.row}))
            entry.cell._dispose()
        }
    }

    // The rows' order and the two spacers, from the model. A node already in its place is not touched, so a pass that changes
    // nothing writes nothing. Returns whether anything changed.
    _arrange() {
        var body = this._body()[0]
        if (!body || typeof body.insertBefore !== "function" || typeof document.createElement !== "function") { return false }
        var heights = this._heights
        var end = this._first + this._visible.length
        var top = offsetOf(heights, this._first)
        var bottom = totalHeight(heights) - offsetOf(heights, end)
        var changed = false
        var desired = []
        if (top > 0) { desired.push(this._spacer("_topSpacer")) }
        for (var cell of this._visible) { desired.push(cell._$el[0]) }
        if (bottom > 0) { desired.push(this._spacer("_bottomSpacer")) }
        for (var key of ["_topSpacer", "_bottomSpacer"]) {
            var spacer = this[key]
            if (spacer && spacer.parentNode && desired.indexOf(spacer) === -1) {
                spacer.parentNode.removeChild(spacer)
                changed = true
            }
        }
        var cursor = body.firstElementChild
        var run = []
        for (var node of desired) {
            if (node !== cursor) {
                run.push(node)
                continue
            }
            if (run.length > 0) { this._insertRun(body, run, cursor) }
            changed = changed || run.length > 0
            run = []
            cursor = cursor.nextElementSibling
        }
        if (run.length > 0) { this._insertRun(body, run, cursor) }
        changed = changed || run.length > 0
        return this._sizeSpacers(top, bottom) || changed
    }

    // The nodes of one run go in front of `anchor` in one write, so the observers of the page see one record per run. A document
    // without createDocumentFragment, the lifecycle tests' stand-in, takes them one by one.
    _insertRun(body, nodes, anchor) {
        if (nodes.length === 1 || typeof document.createDocumentFragment !== "function") {
            for (var node of nodes) { body.insertBefore(node, anchor) }
            return
        }
        var fragment = document.createDocumentFragment()
        for (var member of nodes) { fragment.appendChild(member) }
        body.insertBefore(fragment, anchor)
    }

    _sizeSpacers(top, bottom) {
        var changed = false
        for (var [key, height] of [["_topSpacer", top], ["_bottomSpacer", bottom]]) {
            var spacer = this[key]
            if (!spacer || height <= 0 || spacer._height === height) { continue }
            spacer.style.setProperty("height", height + "px", "important")
            spacer._height = height
            changed = true
        }
        return changed
    }

    // A spacer stands in for the rows it replaces: a row with the cells of the skeleton, the structure most rows have, and nothing
    // else, so sibling selectors keep their meaning and the first row of a fixed layout gives the columns row 0 would. It belongs to
    // no cell, has no id and is never bound. Its vertical box is zero, whatever the page's rules say for those cells; the horizontal
    // box is the page's, so a column keeps its padding and its declared width.
    _spacer(key) {
        var structure = _structureOf(skeleton(this._columns))
        var spacer = this[key]
        if (spacer && spacer._structure === structure) { return spacer }
        if (spacer && spacer.parentNode) { spacer.parentNode.removeChild(spacer) }
        var row = document.createElement("tr")
        row.setAttribute("aria-hidden", "true")
        _zeroVertical(row)
        for (var spec of JSON.parse(structure)) {
            var cell = document.createElement(spec[0] === "th" ? "th" : "td")
            cell.className = spec[1]
            cell.colSpan = spec[2]
            _zeroVertical(cell)
            cell.style.setProperty("height", "0", "important")
            row.appendChild(cell)
        }
        row._structure = structure
        this[key] = row
        return row
    }

    // The row's cell structure, noted for the majority the spacers copy: tag, class and colSpan of each cell, nothing else.
    _noteStructure(row, cell) {
        var element = cell._$el && cell._$el[0]
        if (!element || !element.children) { return }
        noteSignature(this._columns, row, _signatureOf(element))
    }

    // How many rows have a cell structure other than the skeleton's: the rows the spacers cannot stand in for. A hook for the tests
    // and the browser pass.
    _otherSignatureCount() {
        return otherSignatures(this._columns)
    }

    // Nothing to render: every cell is released, the queued ones too, which is what keeps a rule such as :has(> tbody > tr) from
    // matching rows that wait hidden after the last one is gone.
    _empty() {
        var leaving = Array.from(this._renderedRows())
        for (var entry of Array.from(this._reusableCells)) { leaving.push(entry) }
        this._reusableCells = new Map()
        this._unlinkCells(leaving.map((entry) => entry[1]))
        for (var [row, cell] of leaving) {
            this._delegateCall("tableViewDidEndDisplayingCellForRowAtIndexPath", cell, new IndexPath({row}))
            this._release(cell)
        }
        this._finishReload()
        this._discardQueues()
        for (var key of ["_topSpacer", "_bottomSpacer"]) {
            if (this[key] && this[key].parentNode) { this[key].parentNode.removeChild(this[key]) }
        }
        this._first = 0
        this._visible = []
        this._needAll = false
        this._cancelMeasuring()
        this._resetColumns({keepFloor: false})
        this._unwatchFonts()
    }

    // The first rendered row whose bottom is below the clip's top keeps its place on screen: what the pass measured above it moves
    // it by the difference, and the page's scroller is scrolled by that, unless a browser's own scroll anchoring already did.
    _compensate(anchor, read, cells) {
        var index = cells.findIndex(function(entry) { return entry[0] === anchor.row })
        if (index === -1 || read.tops === null) { return }
        var drift = read.tops[index] - anchor.top
        if (Math.abs(drift) < anchorTolerance) { return }
        this._scrollBy(drift)
    }

    _scrollBy(delta) {
        var target = scroller(this.$el[0])
        if (!target) { return }
        if (typeof target.scrollBy === "function") {
            target.scrollBy({top: delta, behavior: "instant"})
            return
        }
        target.scrollTop += delta
    }

    // Column widths --------------------------------------------------------------------------------------------------------------

    // A new generation of column records: the rows are new data, or the page's layout changed. The aggregate the table had stays as a
    // floor for a reload, so the columns do not shrink to the rows measured so far while the rest are still to come.
    _resetColumns({keepFloor}) {
        var floor = null
        if (keepFloor) {
            var all = aggregate(this._columns, {from: 0, to: 0})
            if (all.max.length > 0 || all.min.length > 0) { floor = all }
        }
        resetColumns(this._columns, {floor})
        this._isMeasured = false
        this._cancelMeasuring()
    }

    // Every row the update names that is not rendered has to be measured, as the rows it does not name that are rendered will be when
    // they leave. With no rows named it is all of them.
    _needOutsideWindow(rows = null) {
        var end = this._first + this._visible.length
        var candidates = rows
        if (candidates === null) {
            candidates = []
            for (var row = 0; row < this._heights.count; row++) { candidates.push(row) }
        }
        need(this._columns, candidates.filter((row) => row < this._first || row >= end))
        if (pendingCount(this._columns) === 0) { settle(this._columns) }
    }

    // What a pass reads about the page that changes what a cell asks of its column: the window's width, which media queries answer to,
    // and whether the table is laid out fixed, where content cannot change a column. A switch from auto to fixed only rewrites the
    // replay, because the records hold both widths; any other change starts a new generation with no floor.
    _noteEnvironment(read) {
        var element = this.$el[0]
        if (!element || read.tops === null || typeof getComputedStyle !== "function") { return }
        var mode = getComputedStyle(element).getPropertyValue("table-layout") === "fixed" ? "fixed" : "auto"
        var inner = typeof window === "object" && window ? window.innerWidth : null
        var modeChanged = this._mode !== null && mode !== this._mode
        var innerChanged = this._innerWidth !== null && inner !== this._innerWidth
        this._mode = mode
        this._innerWidth = inner
        if (modeChanged && mode === "fixed") {
            this._forgetReplay()
            return
        }
        if (!modeChanged && !innerChanged) { return }
        this._resetColumns({keepFloor: false})
        this._needAll = true
    }

    // The pass has placed the window: the rows that wait to be measured are asked for, the first chunk now so a page of up to
    // measuringBatch rows is exact before the next paint, and the replay in the spacers follows what is known.
    _settleColumns() {
        if (this._needAll) {
            this._needAll = false
            this._needOutsideWindow()
        }
        this._measureChunk()
        this._replay()
    }

    // One chunk: the nearest rows that have no record are asked of the data source with measuring on, which serves them from the
    // queue, and each cell's smallest and widest width is read in the queue's tbody, written as a box of its own; every write is
    // undone before the chunk returns, whatever the data source did. Reads are two, one after each width keyword, and one when the
    // table is laid out fixed, where only the smallest can reach beyond a column.
    _measureChunk() {
        var columns = this._columns
        if (this._measuring || this._isDetached() || this._dataSource === null || this._lastWidth <= 0 || this._mode === null) { return }
        if (pendingCount(columns) === 0) {
            settle(columns)
            return
        }
        var rows = pending(columns, {from: this._first, to: this._first + this._visible.length, limit: measuringBatch})
        if (rows.length === 0 || !this._queueElement()) { return }
        var generation = columns.generation
        var owned = !this._isLaying
        this._isLaying = true
        this._measuring = true
        this._measured = []
        var entries = []
        try {
            for (var row of rows) {
                var cell = this._dataSource.tableViewCellForRowAtIndexPath(this, new IndexPath({row}))
                entries.push({row: row, element: cell && cell._$el ? cell._$el[0] : null})
            }
            this._recordChunk(entries, generation)
        } finally {
            this._measuring = false
            this._returnMeasured()
            if (owned) { this._isLaying = false }
        }
        this._isMeasured = true
        this._watchFonts()
        if (pendingCount(columns) > 0) { this._scheduleMeasuring() } else { settle(columns) }
    }

    _recordChunk(entries, generation) {
        var fixed = this._mode === "fixed"
        var reads = this._readWidths(entries.map((entry) => entry.element).filter((element) => element !== null), fixed)
        for (var entry of entries) {
            if (entry.element === null) { continue }
            var widths = reads.get(entry.element)
            record(this._columns, {row: entry.row, generation: generation, signature: _signatureOf(entry.element), min: widths.min, max: fixed ? widths.min : widths.max})
        }
    }

    // The queue's tbody becomes a box with no size and no paint whose rows and cells size themselves to their content, and the
    // widths are read from it: the cells' border boxes at max-content, then at min-content. Collapsed borders are counted by the
    // table at half, and the replay adds the cell's own padding and border back, so what is read here is the border box.
    _readWidths(elements, fixed) {
        var reads = new Map()
        var tbody = this._queueBody
        resolvePendingUnhides()
        var written = []
        try {
            for (var [property, value] of measuringBox) { _write(tbody, property, value, written) }
            for (var element of elements) {
                _write(element, "display", "block", written)
                for (var cell of Array.from(element.children)) {
                    _write(cell, "display", "inline-block", written)
                    _write(cell, "min-width", "0", written)
                    _write(cell, "max-width", "none", written)
                }
            }
            var max = new Map()
            if (!fixed) {
                for (element of elements) {
                    for (cell of Array.from(element.children)) { _write(cell, "width", "max-content", written) }
                }
                for (element of elements) { max.set(element, Array.from(element.children).map((cell) => finiteWidth(cell.getBoundingClientRect().width))) }
            }
            for (element of elements) {
                for (cell of Array.from(element.children)) { _write(cell, "width", "min-content", written) }
            }
            for (element of elements) {
                var min = Array.from(element.children).map((cell) => finiteWidth(cell.getBoundingClientRect().width))
                reads.set(element, {min: min, max: max.get(element) || min})
            }
        } finally {
            for (var entry of written.reverse()) { _unwrite(entry) }
        }
        return reads
    }

    // The cells that were measured go back to the queue they came from, or are released when it is full.
    _returnMeasured() {
        var cells = this._measured
        this._measured = []
        this._unlinkCells(cells)
        for (var cell of cells) {
            var queue = this._queues.get(cell.reuseIdentifier)
            if (!queue) { this._queues.set(cell.reuseIdentifier, queue = []) }
            if (queue.length >= Math.max(this._maxWindow, measuringBatch)) {
                this._release(cell)
                continue
            }
            queue.push(cell)
        }
    }

    // The rows still to measure go one chunk per frame, nearest the window first. A frame that outlives its generation, or its
    // table, does nothing and asks the data source nothing.
    _scheduleMeasuring() {
        if (this._measureFrame !== null || typeof requestAnimationFrame !== "function") { return }
        var generation = this._columns.generation
        this._measureFrame = requestAnimationFrame(() => {
            this._measureFrame = null
            if (generation !== this._columns.generation || this._isDetached()) { return }
            this._measureChunk()
            this._replay()
        })
    }

    _cancelMeasuring() {
        if (this._measureFrame !== null && typeof cancelAnimationFrame === "function") { cancelAnimationFrame(this._measureFrame) }
        this._measureFrame = null
    }

    // Web fonts change what a cell asks of its column when they arrive, so a table that has measured starts over when the page says
    // fonts finished loading, keeping what it knows as the floor. One listener per table, released with it.
    _watchFonts() {
        var fonts = typeof document === "object" && document ? document.fonts : null
        if (!fonts || typeof fonts.addEventListener !== "function") { return }
        if (!this._onFonts) {
            this._onFonts = () => this._fontsLoaded()
            this._fonts = fonts
            fonts.addEventListener("loadingdone", this._onFonts)
        }
        var generation = this._columns.generation
        if (fonts.status !== "loading" || this._readyGeneration === generation || !fonts.ready || typeof fonts.ready.then !== "function") { return }
        this._readyGeneration = generation
        fonts.ready.then(() => {
            if (generation === this._columns.generation) { this._fontsLoaded() }
        })
    }

    _unwatchFonts() {
        if (this._fonts && this._onFonts) { this._fonts.removeEventListener("loadingdone", this._onFonts) }
        this._fonts = null
        this._onFonts = null
    }

    _fontsLoaded() {
        if (this._isDetached() || !this._isMeasured) { return }
        this._resetColumns({keepFloor: true})
        this._needOutsideWindow()
        this._measureChunk()
        this._replay()
        this._dirtyAndSchedule()
    }

    // The spacers carry what the rows that are not rendered ask of each column, so the browser lays the columns out as it would
    // with every row in the table. Under auto layout a cell holds spans that add up to its widest content and whose widest is its
    // narrowest content. Under fixed layout content cannot change a column, but it can reach beyond it, so the cell holds one span
    // as wide as the narrowest content, and one pixel tall because a box with no height adds no scrollable overflow; a spacer of
    // less than one pixel is left without, since the span would grow the row. The spans are rewritten only when what they say changes.
    _replay() {
        var spacers = [this._topSpacer, this._bottomSpacer].filter((spacer) => spacer && spacer.parentNode)
        if (spacers.length === 0 || this._mode === null) { return }
        var fixed = this._mode === "fixed"
        var known = aggregate(this._columns, {from: this._first, to: this._first + this._visible.length})
        var key = known.max.concat(known.min).every((width) => !width) ? "" : JSON.stringify([fixed ? known.min : known.max, known.min])
        var extras = null
        for (var spacer of spacers) {
            var spacerKey = key + "|" + fixed + "|" + (spacer._height >= 1) + "|" + spacer._structure
            if (spacer._replay === spacerKey) { continue }
            spacer._replay = spacerKey
            if (key === "" && !spacer._spanned) { continue }
            if (extras === null) { extras = _cellExtras(spacer) }
            var written = _writeReplay(spacer, known, extras, {fixed: fixed, tall: spacer._height >= 1})
            spacer._spanned = written.some((entry) => entry.k > 0)
            this._noteReplay(written)
        }
        if (key === this._aggregateKey) { return }
        this._aggregateKey = key
        reset(this._heights, {count: this._heights.count, keepEstimates: false})
        this._schedule()
    }

    // The largest span count a replay asked for, and every column whose spans were widened to stay within the span ceiling, with the
    // count that triggered it: the browser pass reports them.
    _noteReplay(columns) {
        for (var entry of columns) { this._replayReport.set(entry.column, entry) }
    }

    // What the latest replay of each column asked for, from the models alone, with no read of the page: numbers only, one entry per
    // column whose spans the ceiling widened, with the span width it replaced the true min with.
    _replayStatistics() {
        var ceiled = []
        var largestK = 0
        for (var [column, entry] of this._replayReport) {
            largestK = Math.max(largestK, entry.k)
            if (entry.ceiled) { ceiled.push({column: column, k: entry.k, w: entry.w, minReplayed: entry.w, minTrue: entry.minTrue}) }
        }
        ceiled.sort((a, b) => a.column - b.column)
        return {largestK: largestK, ceiled: ceiled}
    }

    _forgetReplay() {
        for (var spacer of [this._topSpacer, this._bottomSpacer]) {
            if (spacer) { spacer._replay = null }
        }
    }

    // Scroll events and width reports ------------------------------------------------------------------------------------------

    _observe(read) {
        if (this._isObserving || read.tops === null) { return }
        this._isObserving = true
        this._observeScrollers()
        if (typeof ResizeObserver !== "function") { return }
        this._observedWidth = read.width > 0 ? null : 0
        this._resizeObserver = new ResizeObserver((entries) => this._widthReported(entries))
        this._resizeObserver.observe(this.$el[0])
    }

    // Scroll events do not bubble: the document's is observed for the page, and each ancestor that scrolls for itself. The
    // observer is its own object, so releasing it never takes the delegate's scroll observation with it.
    _observeScrollers() {
        NotificationCenter.default.removeObserver(this._scrollObserver)
        this._clipAncestors = clipAncestors(this.$el[0])
        var targets = [document].concat(this._clipAncestors.filter(function(ancestor) { return ancestor.scrolls }).map(function(ancestor) { return ancestor.element }))
        for (var target of targets) {
            NotificationCenter.default.addObserver(this._scrollObserver, {name: "scroll", object: target, selector: () => this._scrolled()})
        }
    }

    // Reports that leave the width as it was are the table's own spacer writes changing its height, which would be a loop to act on.
    // A new width changes every height, so they are dropped, and the pass waits for the next frame: a pass inside the callback would
    // resize what is being observed. A ResizeObserver reports the content box, which padding and borders make narrower than the box the
    // table was measured at, so the first report of a table that has a width only records the content width it will be compared with;
    // a table hidden when it began to be observed has 0 recorded, and its first report, the unhide, is a change.
    _widthReported(entries) {
        if (this._isDetached()) { return }
        var entry = entries[entries.length - 1]
        var box = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize
        var width = box ? box.inlineSize : entry.contentRect.width
        if (this._observedWidth === null) {
            this._observedWidth = width
            return
        }
        if (width === this._observedWidth) { return }
        this._observedWidth = width
        reset(this._heights, {count: this._heights.count, keepEstimates: false})
        this._observeScrollers()
        this._schedule()
    }

    // One read for the clip and where the rows begin, and a pass only when the clip extended by half an overscan has left the
    // rendered rows, so a scroll step inside them touches nothing.
    _scrolled() {
        if (this._isDetached()) { return }
        var read = this._read([])
        var clipHeight = read.clip.bottom - read.clip.top
        var heights = this._heights
        if (clipHeight <= 0 || heights.count === 0) { return }
        var end = this._first + this._visible.length
        var needTop = read.clip.top - read.origin - clipHeight / 2
        var needBottom = read.clip.bottom - read.origin + clipHeight / 2
        var topCovered = this._first === 0 || offsetOf(heights, this._first) <= needTop
        var bottomCovered = end === heights.count || offsetOf(heights, end) >= needBottom
        if (this._visible.length > 0 && topCovered && bottomCovered) { return }
        this._layoutRows({compensate: true})
    }

    // scrollToRow's and selectRow's scroll: the row's place comes from the height model, so it is estimated until the rows around it
    // are drawn and measured; each scroll draws them, and what is left of the distance is scrolled again, a bounded number of times.
    _scrollRowTo(row, position) {
        var heights = this._heights
        if (row < 0 || row >= heights.count) { return }
        for (var attempt = 0; attempt <= maxCorrections; attempt++) {
            var read = this._read([])
            var top = read.origin + offsetOf(heights, row)
            var bottom = top + effectiveHeight(heights, row)
            var delta = _distance({top, bottom}, read.clip, position)
            if (Math.abs(delta) < anchorTolerance) { return }
            this._scrollBy(delta)
            this._layoutRows({force: true})
        }
    }

    // Tear-down ---------------------------------------------------------------------------------------------------------------

    // The scroll and width observation and the queued cells belong to the table, so they go with it; the rendered cells are the
    // subviews, which UIView's disposal releases.
    _dispose() {
        if (this._resizeObserver) { this._resizeObserver.disconnect() }
        this._resizeObserver = null
        if (this._frame !== null && typeof cancelAnimationFrame === "function") { cancelAnimationFrame(this._frame) }
        this._frame = null
        this._cancelMeasuring()
        this._resetColumns({keepFloor: false})
        this._unwatchFonts()
        NotificationCenter.default.removeObserver(this._scrollObserver)
        this._discardQueues()
        super._dispose()
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

// Cells built to be measured and never displayed yet: they are bound to touches when a row first shows them.
const measuredOnly = new WeakSet()

const measuringBox = [["display", "block"], ["position", "absolute"], ["width", "0"], ["height", "0"], ["overflow", "hidden"], ["visibility", "hidden"], ["contain", "strict"]]

// An important CSSOM write, remembering what the element had so the measuring leaves nothing behind.
function _write(element, property, value, written) {
    var style = element.style
    written.push({element: element, property: property, value: style.getPropertyValue(property), priority: style.getPropertyPriority(property), hadStyle: element.hasAttribute("style")})
    style.setProperty(property, value, "important")
}

function _unwrite(entry) {
    var style = entry.element.style
    if (entry.value === "") { style.removeProperty(entry.property) } else { style.setProperty(entry.property, entry.value, entry.priority) }
    if (!entry.hadStyle && entry.element.getAttribute("style") === "") { entry.element.removeAttribute("style") }
}

// The cell's own horizontal padding and border, which the browser adds around the spans.
function _cellExtras(spacer) {
    var extras = []
    for (var cell of Array.from(spacer.children)) {
        var style = getComputedStyle(cell)
        var total = 0
        for (var property of ["padding-left", "padding-right", "border-left-width", "border-right-width"]) { total += finiteWidth(parseFloat(style.getPropertyValue(property))) }
        extras.push(total)
    }
    return extras
}

function _writeReplay(spacer, known, extras, {fixed, tall}) {
    var report = []
    for (var index = 0; index < spacer.children.length; index++) {
        var cell = spacer.children[index]
        while (cell.firstChild) { cell.removeChild(cell.firstChild) }
        if (fixed && !tall) { continue }
        var min = Math.max(0, (known.min[index] || 0) - (extras[index] || 0))
        var max = Math.max(0, (known.max[index] || 0) - (extras[index] || 0))
        var spans = fixed ? {widths: min > 0 ? [Math.min(min, 10000)] : [], k: min > 0 ? 1 : 0, ceiled: false, w: min, minTrue: min} : replaySpans(min, max)
        report.push({column: index, k: spans.k, ceiled: spans.ceiled, w: spans.w, minTrue: spans.minTrue})
        if (spans.widths.length === 0) { continue }
        var wrapper = document.createElement("div")
        wrapper.style.setProperty("font-size", "0", "important")
        wrapper.style.setProperty("line-height", "0", "important")
        wrapper.style.setProperty("height", "0", "important")
        for (var i = 0; i < spans.widths.length; i++) {
            if (i > 0) { wrapper.appendChild(document.createTextNode(" ")) }
            var span = document.createElement("span")
            span.style.setProperty("display", "inline-block", "important")
            span.style.setProperty("height", fixed ? "1px" : "0", "important")
            span.style.setProperty("width", spans.widths[i] + "px", "important")
            wrapper.appendChild(span)
        }
        cell.appendChild(wrapper)
    }
    return report
}

// The cell structure of a row element as a signature: the tag, class and colSpan of each cell, as JSON so that nothing in a class
// name can be taken for a separator.
function _signatureOf(element) {
    var cells = []
    for (var i = 0; i < element.children.length; i++) {
        var cell = element.children[i]
        var colSpan = cell.colSpan
        cells.push([cell.tagName.toLowerCase() === "th" ? "th" : "td", typeof cell.className === "string" ? cell.className : "", Number.isInteger(colSpan) && colSpan >= 1 && colSpan <= maxColSpan ? colSpan : 1])
    }
    return JSON.stringify(cells)
}

// What the skeleton is when no row has been noted: one cell, as the spacer was before.
function _structureOf(signature) {
    return signature === null ? JSON.stringify([["td", "", 1]]) : signature
}

// The vertical box of a spacer row or cell is zero and what draws outside the box is off, over any page rule.
function _zeroVertical(element) {
    for (var property of ["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]) {
        element.style.setProperty(property, "0", "important")
    }
    element.style.setProperty("box-shadow", "none", "important")
    element.style.setProperty("outline", "none", "important")
    element.style.setProperty("background", "transparent", "important")
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

// Where a row that was at `old` is once the rows at `inserted` (ascending, final positions) are in.
function _shifted(old, inserted) {
    var row = old
    for (var position of inserted) {
        if (position <= row) { row += 1 }
    }
    return row
}

function _collectSubviews(view, views) {
    if (views.has(view)) { return }
    views.add(view)
    for (var subview of view.subviews) { _collectSubviews(subview, views) }
}

function _renameNamed(node, fromId, toId, views) {
    var oldId = node.id
    var newId = toId + oldId.slice(fromId.length)
    node.id = newId
    var owner = ownerOf(node)
    if (!owner || typeof owner.selector !== "string") { return }
    for (var view of views) {
        if (view.selector === "#" + oldId || (typeof view.selector === "string" && view.selector.startsWith("#" + oldId + " "))) {
            view.selector = "#" + newId + view.selector.slice(oldId.length + 1)
        }
    }
    if (owner._identifier === oldId) { owner._identifier = newId }
}

// The first rendered row whose bottom is below the top of the clip, with where it was.
function _anchorOf(read, cells) {
    if (read.tops === null) { return null }
    for (var i = 0; i < cells.length; i++) {
        var bottom = i + 1 < cells.length ? read.tops[i + 1] : read.terminal
        if (bottom > read.clip.top) { return {row: cells[i][0], top: read.tops[i]} }
    }
    return null
}

// How far to scroll, positive down, to put the row where the position says; none shows it whole by the shortest scroll.
function _distance(rect, clip, position) {
    if (position === UITableViewScrollPosition.top) { return rect.top - clip.top }
    if (position === UITableViewScrollPosition.middle) { return (rect.top + rect.bottom) / 2 - (clip.top + clip.bottom) / 2 }
    if (position === UITableViewScrollPosition.bottom) { return rect.bottom - clip.bottom }
    if (rect.top < clip.top) { return rect.top - clip.top }
    return Math.max(0, rect.bottom - clip.bottom)
}

// A row is an IndexPath or, as the framework has always accepted, a bare row number.
const rowType = Object.freeze({kind: "row", name: "IndexPath"})
const scrollPositionType = enumeration(UITableViewScrollPosition, "UITableView.ScrollPosition")
const rowAnimationType = enumeration(UITableViewRowAnimation, "UITableView.RowAnimation")
