var path = require("path")


// resolve.alias entries so a file can write `import "UIKit"` the way a Swift
// file does. Spread them into the consumer's webpack resolve.alias.
module.exports = {
    UIKit: path.join(__dirname, "../src/UIKit.js"),
    Foundation: path.join(__dirname, "../src/Foundation.js"),
    CoreAnimation: path.join(__dirname, "../src/CoreAnimation.js"),
    AVKit: path.join(__dirname, "../src/AVKit.js")
}
