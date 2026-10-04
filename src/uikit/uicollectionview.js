import { UIView } from "./uiview.js"
import { IndexPath } from "../foundation/indexpath.js"
import { rejectRetiredDelegateNames } from "../utils/delegateNames.js"


const retiredDataSourceNames = {numberOfItemsInSection: "collectionViewNumberOfItemsInSection"}
const retiredDelegateNames = {collectionViewDidSelectItemAt: "collectionViewDidSelectItemAtIndexPath"}


export class UICollectionView extends UIView {

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._delegate = null
        this._registeredNibs = {}
    }

    set dataSource(dataSource) {
        rejectRetiredDelegateNames(dataSource, retiredDataSourceNames, "UICollectionView.dataSource")
        this._dataSource = dataSource
        this.reloadData()
    }

    get dataSource() {
        return this._dataSource
    }

    set delegate(delegate) {
        rejectRetiredDelegateNames(delegate, retiredDelegateNames, "UICollectionView.delegate")
        this._delegate = delegate
    }

    get delegate() {
        return this._delegate
    }

    // register(CellClass, {forCellWithReuseIdentifier}) or register({nib, identifier})
    register(cellClassOrNib, options) {
        if (options === undefined) {
            this._registeredNibs[cellClassOrNib.identifier] = cellClassOrNib.nib
            return
        }
        this._registeredNibs[options.forCellWithReuseIdentifier] = typeof cellClassOrNib === "string" ? cellClassOrNib : cellClassOrNib.nib
    }

    reloadData() {
        var dataSource = this._dataSource
        if (dataSource === null) { return }
        // numberOfSections(in:) is optional in Apple's protocol and defaults to one.
        var numberOfSections = dataSource.numberOfSectionsInCollectionView ? dataSource.numberOfSectionsInCollectionView(this) : 1
        if (!(numberOfSections > 0)) { return }
        this.$el.empty()
        for (var section = 0; section < numberOfSections; section++) {
            this._loadItems(section, dataSource.collectionViewNumberOfItemsInSection(this, section))
        }
        this._bindItems()
    }

    // The item's element is already in place, empty: the registered nib goes
    // in here, before the cell is constructed, so its awakeFromNib binds to it.
    dequeueReusableCell({withReuseIdentifier, for: indexPath}) {
        var element = this.$el.find("> #" + _cellId(indexPath))
        if (element.length > 0 && element.html() === "") {
            element.html(this._registeredNibs[withReuseIdentifier] || "")
        }
        return new UICollectionViewCell(withReuseIdentifier, indexPath)
    }

    indexPath({for: cell}) {
        return cell._indexPath || null
    }

    // Items are appended in index-path order and the data source is asked once
    // per item, with the element in place; a cell the data source made without
    // dequeuing still gets the nib registered for its identifier.
    _loadItems(section, numberOfItems) {
        for (var row = 0; row < numberOfItems; row++) {
            var indexPath = new IndexPath({section: section, row: row})
            this.$el.append("<collection-view-cell id=\"" + _cellId(indexPath) + "\"></collection-view-cell>")
            var item = this._dataSource.collectionViewCellForItemAtIndexPath(this, indexPath)
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


export class UICollectionViewCell extends UIView {

    constructor(identifier, indexPath) {
        if (typeof identifier === "object" && identifier !== null) {
            indexPath = identifier.indexPath
            identifier = identifier.identifier
        }
        super(identifier)
        this.reuseIdentifier = identifier
        this._indexPath = indexPath
        this.awakeFromNib()
    }
}
