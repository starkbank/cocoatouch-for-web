// Preloaded by `npm test` (node --import): PDFKit imports pdfjs-dist, whose
// real entry points need a worker, a canvas and a network that node does not
// have. The hooks send those two specifiers to stand-ins that test/pdfkit.test.js
// configures, and the Worker below is the one global jsdom does not provide.
import { register } from "node:module"


register("./pdfjs/hooks.mjs", import.meta.url)

class FakeWorker {

    constructor(url, options) {
        this.url = url
        this.options = options
        this.listeners = {}
        this.terminated = false
        FakeWorker.instances.push(this)
    }

    addEventListener(type, listener) {
        (this.listeners[type] = this.listeners[type] || []).push(listener)
    }

    postMessage() {}

    terminate() {
        this.terminated = true
    }

    emit(type, event) {
        for (var listener of (this.listeners[type] || []).slice()) { listener(event) }
    }
}

FakeWorker.instances = []

globalThis.Worker = FakeWorker
