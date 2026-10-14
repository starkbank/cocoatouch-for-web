// Foundation's NSNotification.Name: the namespace every framework hangs its
// notification constants off, as Swift's `extension NSNotification.Name {
// static let ... }` does. A framework publishes its names by importing its own
// module, which calls defineNotificationNames; Foundation alone publishes none.
//
// Three limits, on purpose:
//  - The posted notification stays the plain {name, object, userInfo} that
//    NotificationCenter already delivers. Making NSNotification the posted
//    type would touch NotificationCenter, UIKit and AVKit, which is a
//    different task from naming constants.
//  - A name is a plain string, not a rawValue struct: a JavaScript string
//    gives exactly the value equality Apple's Name has, and the raw values
//    keep the strings observers already match on.
//  - There is deliberately no `Notification` typealias. Notification is the
//    browser's Web Notifications global, and Object.assign(globalThis,
//    Foundation) in src/Foundation.js would clobber it.
const _names = {}


export class NSNotification {

    static get Name() {
        return _names
    }
}


// Framework-internal, not re-exported from foundation/index.js: only a
// framework's own module declares its names. Swift cannot redeclare a static
// let, so a different value for a declared name throws; the same value, which
// is a module evaluated twice, is a no-op.
export function defineNotificationNames(names) {
    for (var key of Object.keys(names)) {
        if (Object.prototype.hasOwnProperty.call(_names, key)) {
            if (_names[key] === names[key]) { continue }
            throw new TypeError(`NSNotification.Name.${key} is already declared as "${_names[key]}"; it cannot be redeclared as "${names[key]}".`)
        }
        Object.defineProperty(_names, key, {value: names[key], enumerable: true, writable: false, configurable: false})
    }
}
