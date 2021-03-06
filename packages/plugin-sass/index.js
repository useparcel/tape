import Sass from "sass";

/**
 * For some reason Sass.js isn't working in node when testing
 *
 * This isn't great because our test is running against different code
 * then the bundle, but it is better than nothing.
 */
const compile = (content, cb) =>
  Sass.render
    ? Sass.render({ data: content }, handler(cb))
    : Sass.compile(content, handler(cb));

const handler = (cb) => (err, result) => {
  if (Sass.render) {
    return cb(err, result && result.css && result.css.toString());
  } else {
    result = err;
    if (result.status === 0) {
      return cb(null, result.text || "");
    }

    /** Make `sass.js` error compatiable with `sass` error */
    const error = new Error(result.message);
    error.status = result.status;
    error.line = result.line;
    error.column = result.column;

    return cb(error);
  }
};

export function sass() {
  return {
    name: "@useparcel/tape-sass",
    exts: [".scss", ".sass"],
    transform({ asset, report }) {
      return new Promise((resolve, reject) => {
        compile(asset.content, (error, content) => {
          if (error) {
            reject(error);
          }

          return resolve({
            ...asset,
            ext: ".css",
            content,
          });
        });
      }).catch((error) => {
        report({
          message: error.message,
          loc: {
            start: {
              line: error.line,
              column: error.column,
            },
          },
        });
      });
    },
  };
}
