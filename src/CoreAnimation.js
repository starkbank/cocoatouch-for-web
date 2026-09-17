import * as CoreAnimation from "./coreanimation/index.js"


// Swift's `import CoreAnimation` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, CoreAnimation)

export * from "./coreanimation/index.js"
