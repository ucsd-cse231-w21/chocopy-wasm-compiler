const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
module.exports = {
  entry: "./webstart.ts",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /(node_modules|tests)/,
      },
    ],
  },
  devtool: "inline-source-map",
  devServer: {
    contentBase: "./build",
  },
  externals: {
    wabt: "wabt",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "webstart.js",
  },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      template: "./index.html",
    }),
  ],
};
