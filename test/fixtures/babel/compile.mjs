// Regenerates valueView.js from valueView.source.js.
// Usage: node test/fixtures/babel/compile.mjs <dir holding node_modules with @babel/core and the plugins>
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

var here = path.dirname(fileURLToPath(import.meta.url))
var require = createRequire(path.resolve(process.argv[2], "package.json"))
var babel = require("@babel/core")
var source = path.join(here, "valueView.source.js")
var result = babel.transformSync(fs.readFileSync(source, "utf8"), {
    filename: source,
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("@babel/preset-env"), {modules: false}]],
    plugins: [
        [require.resolve("@babel/plugin-proposal-decorators"), {legacy: true}],
        require.resolve("@babel/plugin-proposal-class-properties"),
    ],
})
fs.writeFileSync(path.join(here, "valueView.js"), "// Compiled from valueView.source.js by compile.mjs; do not edit.\n" + result.code + "\n")
