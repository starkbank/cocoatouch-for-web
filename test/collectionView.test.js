import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UICollectionView, UICollectionViewCell } from "../src/index.js"


function collectionWith(dataSource) {
    page("<div id=\"grid\"></div>")
    var collection = new UICollectionView("#grid")
    collection.register("<span class=\"item\"></span>", {forCellWithReuseIdentifier: "item"})
    collection.dataSource = dataSource
    return collection
}

test("a data source with only the required methods renders one section without throwing", function() {
    var collection = collectionWith({
        numberOfItemsInSection: function() { return 2 },
        collectionViewCellForItemAtIndexPath: function(collectionView, indexPath) { return collectionView.dequeueReusableCell({withReuseIdentifier: "item", for: indexPath}) },
    })
    assert.equal($("#grid collection-view-cell").length, 2)
    assert.equal($("#grid #cell-section-0-row-1").length, 1)
})
