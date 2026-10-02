import * as UIKit from "./uikit/index.js"
import * as CoreGraphics from "./coregraphics/index.js"


// Swift's `import UIKit` makes the framework's names ambient and brings Core
// Graphics along. Importing this module for its side effect does the same, so
// classes are used unqualified.
Object.assign(globalThis, UIKit, CoreGraphics)

export * from "./uikit/index.js"
export * from "./coregraphics/index.js"
