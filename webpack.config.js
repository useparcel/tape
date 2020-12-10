const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");

const bundle = (dir) => (env, argv) => {
  return {
    entry: `${__dirname}/packages/${dir}/index.js`,
    devtool: argv.mode === "development" ? "source-map" : false,
    output: {
      path: `${__dirname}/packages/${dir}/dist`,
      filename: "index.js",
      libraryTarget: "commonjs2",
    },
    plugins: [
      // node polyfills
      new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }),
      new webpack.ProvidePlugin({ process: ["process"] }),
      new webpack.ProvidePlugin({ url: ["url"] }),
      new webpack.ProvidePlugin({ util: ["util"] }),
    ],
    resolve: {
      // node polyfills
      fallback: {
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
        path: require.resolve("path-browserify"),
        fs: false,
      },
      alias: {
        "node-fetch": "isomorphic-fetch",
      },
    },
    externals: [
      nodeExternals({
        allowlist: ["juice"],
      }),
      nodeExternals({
        modulesDir: `${__dirname}/packages/${dir}/node_modules`,
        allowlist: ["juice"],
      }),
    ],
    module: {
      rules: [
        // Since we are using nodeExternals, webpack resolve.alias doesn't work.
        // To get around that, we do a straight replace on the import.
        {
          test: /index\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: "string-replace-loader",
          options: {
            search: `from "sass"`,
            replace: `from "sass.js"`,
          },
        },
        {
          test: /index\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: "string-replace-loader",
          options: {
            search: `from "sass"`,
            replace: `from "sass.js"`,
          },
        },
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
          },
        },
        // force web-resource-inliner to support blob urls
        // https://github.com/jrit/web-resource-inliner/blob/96ab4c594746f5337fc662a19135092fb4f4b2a1/src/util.js#L46
        {
          test: /util\.js$/,
          loader: "string-replace-loader",
          options: {
            search: `^'?https?:\\/\\/|^\\/\\/`,
            replace: `^(?:blob:)?'?https?:\\/\\/|^\\/\\/`,
          },
        },
      ],
    },
  };
};

module.exports = [
  bundle("css-select-codsen-parser"),
  bundle("find-css-dependencies"),
  bundle("find-embedded-documents"),
  bundle("find-html-dependencies"),
  bundle("plugin-css"),
  bundle("plugin-css-inline"),
  bundle("plugin-html"),
  bundle("plugin-html-minify"),
  bundle("plugin-html-prettify"),
  bundle("plugin-sass"),
  bundle("tape"),
];
