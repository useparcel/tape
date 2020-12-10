const url = require("url");

/**
 * Node url resolve doesn't support blob url's by default
 */
const resolve = url.resolve;
url.resolve = (fromUrl, toUrl) => {
  if (toUrl.startsWith("blob:")) return toUrl;

  return resolve(fromUrl, toUrl);
};

/**
 * Specify index.js so we get the non-browser version which supports
 * juiceResources. Then we fight with webpback a bunch to make it work
 * in the browser.
 */
import juice from "juice/index.js";

export default function (config) {
  return {
    name: "@useparcel/tape-css-inline",
    exts: [".html"],
    async optimize({ asset }) {
      return new Promise((resolve, reject) => {
        juice.juiceResources(
          asset.content,
          {
            webResources: {
              relativeTo: asset.source.path,
            },
          },
          (err, content) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                ...asset,
                content,
              });
            }
          }
        );
      });
    },
  };
}
