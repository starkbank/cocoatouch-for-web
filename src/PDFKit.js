import * as PDFKit from "./pdfkit/index.js"


// Swift's `import PDFKit` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, PDFKit)

export * from "./pdfkit/index.js"
