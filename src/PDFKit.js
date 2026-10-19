import * as PDFKit from "./pdfkit/index.js"
// Here and not in pdfkit/index.js: a bundler needs the stylesheet beside the
// pdf.js the framework carries, but node cannot load a .css file, so the
// subpath entry stays loadable by `node --test`. A consumer that imports
// "cocoatouch/pdfkit" and skips this file fails loudly through
// assertTextLayerStylesheet instead of rendering a misaligned text layer.
// Not pdfjs-dist's own pdf_viewer.css: that restyles the host app (.sidebar,
// .page, :root), where this copy of it applies only inside a PDFView's element.
import "../styles/pdf_viewer.scoped.css"


// Swift's `import PDFKit` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, PDFKit)

export * from "./pdfkit/index.js"
