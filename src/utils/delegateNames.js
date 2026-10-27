// A migration diagnostic at the framework's boundary, not a UIKit behaviour:
// 1.6.0 renamed five delegate and data-source methods to the convention, 1.10.0
// three more whose selector had been cut short, and an optional method under
// a retired name would simply never be called. The check runs where the object
// is assigned and names the replacement; it is removed in the next major, when
// the retired names are old enough that a dead hook is the consumer's own business.
export function rejectRetiredDelegateNames(object, renames, owner, version = "1.6.0") {
    if (!object) { return }
    for (var retired of Object.keys(renames)) {
        if (typeof object[retired] !== "function") { continue }
        throw new TypeError(`${owner}: ${retired} was renamed ${renames[retired]} in cocoatouch ${version}; implement ${renames[retired]} instead`)
    }
}
