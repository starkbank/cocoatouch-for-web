const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")


module.exports = {
    entry: "./src/index.js",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "main.js",
        publicPath: "/",
        clean: true,
    },
    devServer: {
        port: 8080,
        // Every route is served by index.html; the controller is picked from the path at runtime.
        historyApiFallback: true,
    },
    plugins: [
        new HtmlWebpackPlugin({template: "src/index.html"}),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: "babel-loader",
            },
            {
                // A .xib is the html of the view whose class lives in the sibling .js of the same name.
                test: /\.xib$/,
                use: ["babel-loader", require.resolve("cocoatouch/webpack/xibLoader")],
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                // Table view cells are html fragments fetched by URL when the table reloads.
                test: /\.html$/,
                exclude: /index\.html$/,
                type: "asset/resource",
                generator: {
                    filename: "html/[name][ext]",
                },
            },
        ],
    },
    resolve: {
        // `import "UIKit"` and `import "Foundation"` resolve like Swift framework imports.
        alias: require("cocoatouch/webpack/aliases"),
    },
}
