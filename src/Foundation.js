import * as Foundation from "./foundation/index.js"


// Swift's `import Foundation` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, Foundation)

export * from "./foundation/index.js"
