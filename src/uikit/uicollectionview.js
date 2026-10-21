import { UIView } from "./uiview.js"
import { UIScrollView } from "./uiscrollview.js"
import { IndexPath } from "../foundation/indexpath.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"
import { Bind } from "../utils/bind.js"
import { ownElement } from "../utils/elementowner.js"


const retiredDataSourceNames = {numberOfItemsInSection: "collectionViewNumberOfItemsInSection"}
const retiredDelegateNames = {collectionViewDidSelectItemAt: "collectionViewDidSelectItemAtIndexPath"}


export class UICollectionView extends UIScrollView {

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._registeredNibs = {}
        this._registeredClasses = {}
        this._cells = {}
        this._reusableCells = {}
    }

    set dataSource(dataSource) {
        rejectRetiredDelegateNames(dataSource, retiredDataSourceNames, "UICollectionView.dataSource", "1.6.0")
        this._dataSource = dataSource
        this.reloadData()
    }

    get dataSource() {
        return this._dataSource
    }

    set delegate(delegate) {
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UICollectionView.delegate", "1.6.0")
        super.delegate = delegate
    }

    get delegate() {
        return super.delegate
    }

    // A cell class registered for an identifier is instantiated by
    // dequeueReusableCell, as Apple's is; a nib string only supplies the html.
    /**
     * register(_:forCellWithReuseIdentifier:) with a cell class or a nib string, or
     * the legacy register({nib, identifier}) when no options object is given.
     * @param {Function|string|{nib: string, identifier: string}} cellClassOrNib
     * @param {object} [options]
     * @param {string} options.forCellWithReuseIdentifier
     */
    register(cellClassOrNib, {forCellWithReuseIdentifier} = {forCellWithReuseIdentifier: undefined}) {
        if (forCellWithReuseIdentifier === undefined) {
            delete this._registeredClasses[cellClassOrNib.identifier]
            this._registeredNibs[cellClassOrNib.identifier] = cellClassOrNib.nib
            return
        }
        delete this._registeredClasses[forCellWithReuseIdentifier]
        if (typeof cellClassOrNib === "function") { this._registeredClasses[forCellWithReuseIdentifier] = cellClassOrNib }
        this._registeredNibs[forCellWithReuseIdentifier] = typeof cellClassOrNib === "string" ? cellClassOrNib : cellClassOrNib.nib
    }

    reloadData() {
        var dataSource = this._dataSource
        if (dataSource === null) { return }
        // numberOfSections(in:) is optional in Apple's protocol and defaults to one.
        var numberOfSections = dataSource.numberOfSectionsInCollectionView ? dataSource.numberOfSectionsInCollectionView(this) : 1
        if (!(numberOfSections > 0)) { return }
        this._holdCells()
        this.$el.empty()
        for (var section = 0; section < numberOfSections; section++) {
            this._loadItems(section, dataSource.collectionViewNumberOfItemsInSection(this, section))
        }
        this._releaseHeldCells()
        this._bindItems()
    }

    // The item's element is already in place, empty: the registered nib goes
    // in here, before the cell is constructed, so its awakeFromNib binds to it.
    // A registered class is instantiated over that element; the cell the
    // previous reload held for the same item, of the same identifier and class,
    // is handed back with its element and bindings after prepareForReuse().
    /**
     * @param {object} options
     * @param {string} options.withReuseIdentifier
     * @param {IndexPath} options.for
     */
    dequeueReusableCell({withReuseIdentifier, for: indexPath}) {
        var cellClass = this._registeredClasses[withReuseIdentifier]
        if (cellClass) { return this._dequeueInstance(cellClass, withReuseIdentifier, indexPath) }
        this._discardHeld(_cellId(indexPath))
        var element = this.$el.find("> #" + _cellId(indexPath))
        if (element.length > 0 && element.html() === "") {
            element.html(this._registeredNibs[withReuseIdentifier] || "")
        }
        return new UICollectionViewCell(withReuseIdentifier, indexPath)
    }

    /**
     * @param {object} options
     * @param {UICollectionViewCell} options.for
     * @returns {IndexPath|null}
     */
    indexPath({for: cell}) {
        return cell._indexPath || null
    }

    _dequeueInstance(cellClass, identifier, indexPath) {
        var id = _cellId(indexPath)
        var held = this._reusableCells[id]
        if (held && held.reuseIdentifier === identifier && held.constructor === cellClass) {
            delete this._reusableCells[id]
            held._indexPath = indexPath
            held.prepareForReuse()
            this._cells[id] = held
            this._link(held)
            return held
        }
        this._discardHeld(id)
        var element = this.$el.find("> #" + id)
        if (element.length === 0) {
            element = $(_cellMarkup(id))
            this.$el.append(element)
        }
        var cell = Bind.construct(cellClass, this.selector + " #" + id, element, indexPath)
        cell.reuseIdentifier = identifier
        cell._$el = element
        ownElement(element, cell)
        this._cells[id] = cell
        this._link(cell)
        Bind.ibOutlet(cell)
        Bind.ibAction(cell)
        Bind.ibInspectable(cell)
        cell.awakeFromNib()
        return cell
    }

    // A reload keeps the previous pass's cells, their elements detached with
    // every handler still on them, so a cell wired in awakeFromNib stays wired
    // when it is handed back; what the new pass does not claim is released.
    _holdCells() {
        this._reusableCells = this._cells
        this._cells = {}
        var held = new Set(Object.values(this._reusableCells))
        this._subviews = this.subviews.filter(function(view) { return !held.has(view) })
        for (var cell of held) { cell._$el.detach() }
    }

    _discardHeld(id) {
        var held = this._reusableCells[id]
        if (!held) { return }
        delete this._reusableCells[id]
        held._$el.replaceWith(_cellMarkup(id))
        held._dispose()
    }

    _releaseHeldCells() {
        for (var held of Object.values(this._reusableCells)) {
            held._$el.remove()
            held._dispose()
        }
        this._reusableCells = {}
    }

    // Items are appended in index-path order and the data source is asked once
    // per item, with the element in place; a cell the data source made without
    // dequeuing still gets the nib registered for its identifier.
    _loadItems(section, numberOfItems) {
        for (var row = 0; row < numberOfItems; row++) {
            var indexPath = new IndexPath({section: section, row: row})
            var held = this._reusableCells[_cellId(indexPath)]
            this.$el.append(held ? held._$el : _cellMarkup(_cellId(indexPath)))
            var item = this._dataSource.collectionViewCellForItemAtIndexPath(this, indexPath)
            this._discardHeld(_cellId(indexPath))
            var element = this.$el.find("> #" + _cellId(indexPath))
            if (item && element.html() === "") { element.html(this._registeredNibs[item.reuseIdentifier] || "") }
        }
    }

    _bindItems() {
        var collectionView = this
        var delegate = this._delegate
        if (!delegate || typeof delegate.collectionViewDidSelectItemAtIndexPath !== "function") { return }
        this.$el.find("[id^=cell-]").off("click.uicollectionview").on("click.uicollectionview", function(event) {
            var meta = event.currentTarget.id.match(/cell-section-(\d+)-row-(\d+)/)
            if (!meta) { return }
            delegate.collectionViewDidSelectItemAtIndexPath(collectionView, new IndexPath({section: Number(meta[1]), row: Number(meta[2])}))
        })
    }
}


function _cellId(indexPath) {
    return "cell-section-" + indexPath.section + "-row-" + indexPath.row
}


function _cellMarkup(id) {
    return "<collection-view-cell id=\"" + id + "\"></collection-view-cell>"
}


export class UICollectionViewCell extends UIView {

    constructor(identifier, indexPath) {
        if (typeof identifier === "object" && identifier !== null) {
            indexPath = identifier.indexPath
            identifier = identifier.identifier
        }
        super(identifier)
        this.reuseIdentifier = identifier
        this._indexPath = indexPath
        if (!Bind.isConstructing(this)) { this.awakeFromNib() }
    }

    // Sent when the collection view hands the cell out again for an item.
    prepareForReuse() {

    }
}
