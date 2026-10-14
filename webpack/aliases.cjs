var path = require("path")


// resolve.alias entries so a file can write `import "UIKit"` the way a Swift
// file does. Spread them into the consumer's webpack resolve.alias.
module.exports = {
    UIKit: path.join(__dirname, "../src/UIKit.js"),
    Foundation: path.join(__dirname, "../src/Foundation.js"),
    CoreGraphics: path.join(__dirname, "../src/CoreGraphics.js"),
    CoreAnimation: path.join(__dirname, "../src/CoreAnimation.js"),
    CoreMedia: path.join(__dirname, "../src/CoreMedia.js"),
    AVKit: path.join(__dirname, "../src/AVKit.js"),
    PDFKit: path.join(__dirname, "../src/PDFKit.js")
}
