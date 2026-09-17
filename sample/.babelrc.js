// `@IBOutlet` and `@IBAction` are legacy decorators on class fields, which is
// what the framework's binder reads. The framework itself is plain ES2022.
module.exports = {
    presets: ["@babel/preset-env"],
    plugins: [
        ["@babel/plugin-proposal-decorators", {legacy: true}],
        ["@babel/plugin-proposal-class-properties"],
    ],
}
