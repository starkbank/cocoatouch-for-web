import * as AVKit from "./avkit/index.js"


// Swift's `import AVKit` makes the framework's names ambient. Importing this
// module for its side effect does the same, so classes are used unqualified.
Object.assign(globalThis, AVKit)

export * from "./avkit/index.js"
