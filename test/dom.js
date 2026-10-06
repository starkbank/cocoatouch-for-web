// A real document for the tests that bind outlets, resolve nib roots or walk
// table rows: jsdom stands in for the browser and the real jQuery for `$`.
// `test/setup.js` keeps the chainable stand-in for the lifecycle tests; node
// runs each test file in its own process, so a file picks one or the other.
import { JSDOM } from "jsdom"
import jqueryFactory from "jquery"

// A real origin, so the History API a navigation stack binds to accepts relative urls.
var dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {pretendToBeVisual: true, url: "http://localhost/"})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.$ = jqueryFactory(dom.window)

// A detached element reads back as unstyled in every real browser — Chrome
// and Safari both return an empty declaration for one that was never
// attached. jsdom does not draw that distinction on its own, so a probe built
// but never appended would read as styled here and nowhere else, which would
// hide exactly the bug PDFKit's stylesheet probe exists to catch (finding 8).
var _realGetComputedStyle = dom.window.getComputedStyle.bind(dom.window)
var _emptyDeclaration = new Proxy({}, {get: function(target, property) {
    return property === "getPropertyValue" ? function() { return "" } : ""
}})
globalThis.getComputedStyle = function(element, pseudoElement) {
    if (element && element.isConnected === false) { return _emptyDeclaration }
    return _realGetComputedStyle(element, pseudoElement)
}

// Replaces the body with `html` and returns it, so a test starts from a page of its own.
export function page(html) {
    document.body.innerHTML = html
    return $(document.body)
}

export function keydown(key) {
    var event = new window.KeyboardEvent("keydown", {key: key, bubbles: true, cancelable: true})
    document.dispatchEvent(event)
}
