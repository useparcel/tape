import alias from "@rollup/plugin-alias";
import nodePolyfills from "rollup-plugin-node-polyfills";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import sourcemaps from "rollup-plugin-sourcemaps";
import { terser } from "rollup-plugin-terser";

const bundle = (name, dir) => ({
  input: `${dir}/index.js`,
  output: {
    sourcemap: true,
    file: `${dir}/bundle.js`,
    format: "umd",
    exports: "default",
    name,
    intro: "var global = typeof self !== undefined ? self : this;",
  },
  plugins: [
    alias({
      entries: [
        { find: "sass", replacement: "sass.js" },
        {
          find: "cheerio",
          replacement: `${__dirname}/packages/html-plugin/cheerio-bundle.js`,
        },
        { find: "node-fetch", replacement: "isomorphic-fetch" },
      ],
    }),
    nodePolyfills(),
    json(),
    babel({ babelHelpers: "bundled" }),
    sourcemaps(),
    resolve(),
    commonjs(),
    terser(),
  ],
  watch: {
    exclude: "node_modules/**",
  },
});

export default [
  bundle("tapeCSSInlinePlugin", "packages/css-inline-plugin"),
  bundle("tapeCSSPlugin", "packages/css-plugin"),
  bundle("tapeHTMLPlugin", "packages/html-plugin"),
  // bundle("tapeSassPlugin", "packages/sass-plugin"),
  bundle("Tape", "packages/tape"),
];
