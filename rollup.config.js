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
  },
  plugins: [
    nodePolyfills(),
    json(),
    babel({ babelHelpers: "bundled" }),
    commonjs(),
    sourcemaps(),
    resolve(),
    terser(),
  ],
});

export default [
  bundle("tapeCSSInlinePlugin", "packages/css-inline-plugin"),
  bundle("tapeCSSPlugin", "packages/css-plugin"),
  bundle("tapeHTMLPlugin", "packages/html-plugin"),
  bundle("Tape", "packages/tape"),
];
