// The framework talks to the page through jQuery. The tests cover lifecycle,
// responder chain and observer bookkeeping, which only need a chainable
// stand-in that remembers the html it was given, plus event targets standing
// in for window and document.
function fakeJQuery() {
    function stub(html) {
        var el = {length: 1, _html: typeof html === "string" && html[0] === "<" ? html : ""}
        el.css = function() { return arguments.length > 1 ? el : "" }
        el.attr = function() { return arguments.length > 1 ? el : "" }
        el.prop = function() { return el }
        el._handlers = {}
        el._classes = []
        el.addClass = function(c) { el._classes.push(c); return el }
        el.removeClass = function(c) { el._classes = el._classes.filter(function(x) { return x !== c }); return el }
        el.hasClass = function(c) { return el._classes.indexOf(c) !== -1 }
        el.toggleClass = el.append = el.prepend = el.before = el.show = el.remove = el.each = el.removeAttr = el.siblings = el.parent = function() { return el }
        el.empty = function() { el._html = ""; return el }
        el.off = function() { return el }
        el.on = function(event, handler) { el._handlers[event.split(".")[0]] = handler; return el }
        el.trigger = function(event) { var h = el._handlers[event]; if (h) { h({stopImmediatePropagation: function() {}, preventDefault: function() {}, target: el}) } return el }
        el.click = function() { return el.trigger("click") }
        el.first = el.last = el.children = function() { return el }
        el.is = function() { return false }
        el.val = function() { return "" }
        el.text = function() { return el._html.replace(/<[^>]*>/g, "") }
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
