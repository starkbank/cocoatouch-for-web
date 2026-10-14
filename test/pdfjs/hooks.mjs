var standIns = {
    "pdfjs-dist/build/pdf.min.mjs": new URL("./lib.mjs", import.meta.url).href,
    "pdfjs-dist/web/pdf_viewer.mjs": new URL("./viewer.mjs", import.meta.url).href,
}

// src/PDFKit.js imports pdf_viewer.css for the bundler, and node cannot load a
// .css file; the stylesheet itself is jsdom's to fake, in the test that needs it.
var emptyModule = "data:text/javascript,export {}"

export function resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".css")) { return {url: emptyModule, shortCircuit: true} }
    if (!Object.hasOwn(standIns, specifier)) { return nextResolve(specifier, context) }
    return {url: standIns[specifier], shortCircuit: true}
}
