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

export default {
  name: "SassPlugin",
  resolve: { input: [".scss", ".sass"], output: ".css" },
  transform({ asset }) {
    return new Promise((resolve, reject) => {
      compile(asset.content, (error, content) => {
        if (error) {
          error.path = asset.path;
          error.loc = {
            line: error.line,
            column: error.column,
          };

          return reject(error);
        }

        return resolve({
          ...asset,
          content,
        });
      });
    });
  },
};
