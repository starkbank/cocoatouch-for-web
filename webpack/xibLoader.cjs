var fs = require("fs")
var path = require("path")


// Webpack loader. A .xib holds only the html of the view whose class lives in the sibling .js
// of the same name: codeView.xib belongs to CodeView in codeView.js. The link
// is a real import emitted at build time, so when the minifier renames the
// class the binding is renamed with it and nothing is looked up by name.
module.exports = function(source) {
    var link = xibLink(this.resourcePath)
    this.addDependency(link.sibling)
    return xibModule(source, link)
}

module.exports.xibLink = xibLink
module.exports.xibModule = xibModule


function xibLink(resourcePath) {
    var base = path.basename(resourcePath, ".xib")
    var className = base.charAt(0).toUpperCase() + base.slice(1)
    var sibling = path.join(path.dirname(resourcePath), base + ".js")
    if (!fs.existsSync(sibling)) {
        throw new Error(base + ".xib has no sibling " + base + ".js to attach its html to")
    }
    var exported = new RegExp("export class " + className + "\\b")
    if (!exported.test(fs.readFileSync(sibling, "utf8"))) {
        throw new Error(base + ".js must export class " + className + " for " + base + ".xib to attach to it")
    }
    return {base: base, className: className, sibling: sibling}
}

function xibModule(html, link) {
    return 'import { ' + link.className + ' } from "./' + link.base + '.js"\n' +
        link.className + ".nib = " + JSON.stringify(html) + "\n"
}
