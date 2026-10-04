import { UIView } from "./uiview.js"
import { IndexPath } from "../foundation/indexpath.js"


export class UICollectionView extends UIView {

    constructor(selector) {
        super(selector)
        this._dataSource = null
        this._delegate = null
        this._registeredNibs = {}
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
            this._loadItems(section, dataSource.numberOfItemsInSection(this, section))
        }
        this._bindItems()
    }

    dequeueReusableCell({withReuseIdentifier, for: indexPath}) {
        return new UICollectionViewCell(withReuseIdentifier, indexPath)
    }

    indexPath({for: cell}) {
        return cell._indexPath || null
    }

    _loadItems(section, numberOfItems) {
        for (var row = 0; row < numberOfItems; row++) {
            var indexPath = new IndexPath({section: section, row: row})
            var item = this._dataSource.collectionViewCellForItemAtIndexPath(this, indexPath)
            var nib = this._registeredNibs[item.reuseIdentifier] || ""
            this.$el.prepend("<collection-view-cell id=\"cell-section-" + section + "-row-" + row + "\">" + nib + "</collection-view-cell>")
            // The cell is dequeued again with its element in place, so its awakeFromNib can bind to it.
            this._dataSource.collectionViewCellForItemAtIndexPath(this, indexPath)
        }
    }

    _bindItems() {
        var collectionView = this
        var delegate = this._delegate
        if (!delegate || typeof delegate.collectionViewDidSelectItemAt !== "function") { return }
        this.$el.find("[id^=cell-]").off("click.uicollectionview").on("click.uicollectionview", function(event) {
            var meta = event.currentTarget.id.match(/cell-section-(\d+)-row-(\d+)/)
            if (!meta) { return }
            delegate.collectionViewDidSelectItemAt(collectionView, new IndexPath({section: Number(meta[1]), row: Number(meta[2])}))
        })
    }
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
