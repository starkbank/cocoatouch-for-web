// Stands in for pdfjs-dist/build/pdf.min.mjs. Every export forwards to the
// object a test hands to use(), so each test builds its own pdf.js behaviour
// while the module graph, which node links once, stays fixed.
var current = null

export function use(lib) {
    current = lib
}

export const version = "6.4.299"

export function getDocument(options) {
    return current.getDocument(options)
}

export class PDFWorker {

    constructor(options) {
        return new current.PDFWorker(options)
    }
}

export const GlobalWorkerOptions = new Proxy({}, {
    get: function(target, key) { return current.GlobalWorkerOptions[key] },
    set: function(target, key, value) { current.GlobalWorkerOptions[key] = value; return true },
})

export const AnnotationMode = new Proxy({}, {
    get: function(target, key) { return current.AnnotationMode[key] },
})
