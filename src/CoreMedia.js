import * as CoreMedia from "./coremedia/index.js"


// Swift's `import CoreMedia` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, CoreMedia)

export * from "./coremedia/index.js"
