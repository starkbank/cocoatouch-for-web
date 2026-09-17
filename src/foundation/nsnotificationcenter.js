

export class NSNotificationCenter {

    static _observers = new Map()

    // `object` is the sender to observe. When it is an event target (window,
    // document, an element) the notification is the DOM event of that name;
    // otherwise it filters in-app notifications by the object that posts them.
    static addObserver(observer, {selector, name, object = null}) {
        var method = typeof selector === "function" ? selector : observer[selector]
        var callback = (notification) => method.call(observer, notification)
        var target = _isEventTarget(object) ? object : null
        if (target) {
            target.addEventListener(name, callback)
        }
        _entriesFor(observer).push({observer, name, object, target, callback})
    }

    static removeObserver(observer, {name, object} = {}) {
        var entries = NSNotificationCenter._observers.get(observer) || []
        var kept = []
        for (var entry of entries) {
            if (name !== undefined && entry.name !== name) {
                kept.push(entry)
                continue
            }
            if (object !== undefined && entry.object !== object) {
                kept.push(entry)
                continue
            }
            if (entry.target) {
                entry.target.removeEventListener(entry.name, entry.callback)
            }
        }
        if (kept.length === 0) {
            NSNotificationCenter._observers.delete(observer)
            return
        }
        NSNotificationCenter._observers.set(observer, kept)
    }

    // Delivery goes to the observers registered when the post starts: one
    // registered by a receiver (a controller presented in response) does not
    // get the same notification, and one removed meanwhile is skipped.
    static postNotification({name, object = null, userInfo = null}) {
        var notification = {name, object, userInfo}
        var recipients = []
        for (var entries of NSNotificationCenter._observers.values()) {
            for (var entry of entries) {
                if (entry.target) { continue }
                if (entry.name !== name) { continue }
                if (entry.object !== null && entry.object !== object) { continue }
                recipients.push(entry)
            }
        }
        for (var recipient of recipients) {
            if (!_isRegistered(recipient)) { continue }
            recipient.callback(notification)
        }
    }
}


function _isEventTarget(object) {
    return object !== null && typeof object.addEventListener === "function"
}

function _entriesFor(observer) {
    var entries = NSNotificationCenter._observers.get(observer)
    if (entries) { return entries }
    entries = []
    NSNotificationCenter._observers.set(observer, entries)
    return entries
}

function _isRegistered(entry) {
    var entries = NSNotificationCenter._observers.get(entry.observer)
    return !!entries && entries.indexOf(entry) !== -1
}
