import * as UniformTypeIdentifiers from "./uniformtypeidentifiers/index.js"


// Swift's `import UniformTypeIdentifiers` makes the framework's names ambient.
// Importing this module for its side effect does the same, so classes are used
// unqualified.
Object.assign(globalThis, UniformTypeIdentifiers)

export * from "./uniformtypeidentifiers/index.js"
