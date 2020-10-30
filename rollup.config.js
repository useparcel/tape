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
    name,
  },
  plugins: [
    sourcemaps(),
    resolve(),
    babel({ babelHelpers: "bundled" }),
    terser(),
  ],
});

export default [
  bundle("tapeCSSInlinePlugin", "packages/css-inline-plugin"),
  bundle("tapeCSSPlugin", "packages/css-plugin"),
  bundle("tapeHTMLPlugin", "packages/html-plugin"),
  bundle("tape", "packages/tape"),
];
