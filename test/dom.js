// A real document for the tests that bind outlets, resolve nib roots or walk
// table rows: jsdom stands in for the browser and the real jQuery for `$`.
// `test/setup.js` keeps the chainable stand-in for the lifecycle tests; node
// runs each test file in its own process, so a file picks one or the other.
import { JSDOM } from "jsdom"
import jqueryFactory from "jquery"

var dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {pretendToBeVisual: true})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.$ = jqueryFactory(dom.window)

// Replaces the body with `html` and returns it, so a test starts from a page of its own.
export function page(html) {
    document.body.innerHTML = html
    return $(document.body)
}

export function keydown(key) {
    var event = new window.KeyboardEvent("keydown", {key: key, bubbles: true, cancelable: true})
    document.dispatchEvent(event)
}
