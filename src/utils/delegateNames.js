// A migration diagnostic at the framework's boundary, not a UIKit behaviour:
// a release renamed delegate and data-source methods to the convention, and
// an optional method under a retired name would simply never be called. The
// check runs where the object is assigned and names the replacement and the
// version that retired the name, which each caller passes: 1.6.0 renamed five
// methods and 1.9.0 the ones of the controls and the drag and drop. It is
// removed in the next major after that, when the retired names are old enough
// that a dead hook is the consumer's own business.
export function rejectRetiredDelegateNames(object, renames, owner, since) {
    if (!object) { return }
    for (var retired of Object.keys(renames)) {
        if (typeof object[retired] !== "function") { continue }
        throw new TypeError(`${owner}: ${retired} was renamed ${renames[retired]} in cocoatouch ${since}; implement ${renames[retired]} instead`)
    }
}
