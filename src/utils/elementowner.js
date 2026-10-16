// One element has one owner, the rule restoreRegisteredViews already states and
// follows. The owner is the view the framework bound over the element: an
// outlet, a dequeued cell, a subview placed with addSubview, a view the app
// constructed on its own element, or the sender of the first @IBAction to
// reach an element none of those claimed. A later @IBAction matching an
// element that already has one is a second connection to that view, as it is
// in a nib, not a second view to awake.
//
// A WeakMap, so an element the page drops is forgotten with it, and holding
// the owner rather than a flag is what lets a creator be told from a
// connection: a creator takes the element over, a connection does not.
var _owners = new WeakMap()


// A creator taking an element, replacing whoever held it before: a reloaded
// cell takes back the row element its predecessor was bound to, and that
// element outlives the cell.
export function ownElement($el, view) {
    if (!$el) { return }
    for (var i = 0; i < $el.length; i++) {
        if ($el[i]) { _owners.set($el[i], view) }
    }
}


// The living view bound over the element, or null. A disposed owner holds
// nothing: _dispatchKey drops its key bindings on the same test.
export function ownerOf(element) {
    if (!element) { return null }
    var owner = _owners.get(element)
    return owner && owner._disposed !== true ? owner : null
}
