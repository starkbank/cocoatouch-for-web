import * as AVKit from "./avkit/index.js"
import * as CoreMedia from "./coremedia/index.js"


// Swift's `import AVKit` makes the framework's names ambient, and AVFoundation
// brings Core Media's CMTime with it. Importing this module for its side effect
// does the same, so classes are used unqualified.
Object.assign(globalThis, AVKit, CoreMedia)

export * from "./avkit/index.js"
export * from "./coremedia/index.js"
