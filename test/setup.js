// The framework talks to the page through jQuery. The tests cover lifecycle,
// responder chain and observer bookkeeping, which only need a chainable
// stand-in that remembers the html it was given, plus event targets standing
// in for window and document.
function fakeJQuery() {
    function stub(html) {
        var el = {length: 0, _html: typeof html === "string" && html[0] === "<" ? html : ""}
        el.css = function() { return arguments.length > 1 ? el : "" }
        el.attr = function() { return arguments.length > 1 ? el : "" }
        el.prop = function() { return el }
        el.addClass = el.removeClass = el.append = el.empty = el.show = el.off = el.on = el.each = function() { return el }
        el.html = function(value) {
            if (value === undefined) { return el._html }
            el._html = value
            return el
        }
        el.ready = function(callback) {
            callback()
            return el
        }
        el.find = function() { return stub() }
        el.innerHeight = el.innerWidth = function() { return 0 }
        return el
    }
    return stub
}

globalThis.$ = fakeJQuery()
globalThis.document = new EventTarget()
globalThis.window = new EventTarget()

export function keydown(key) {
    var event = new Event("keydown")
    event.key = key
    event.metaKey = event.shiftKey = event.altKey = event.ctrlKey = false
    event.preventDefault = function() {}
    document.dispatchEvent(event)
}
