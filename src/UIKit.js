import * as UIKit from "./uikit/index.js"


// Swift's `import UIKit` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, UIKit)

export * from "./uikit/index.js"
