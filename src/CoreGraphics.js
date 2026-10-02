import * as CoreGraphics from "./coregraphics/index.js"


// Swift's `import CoreGraphics` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, CoreGraphics)

export * from "./coregraphics/index.js"
