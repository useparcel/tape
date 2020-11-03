const url = require("url");

/**
 * Node url resolve doesn't support blob url's by default
 * @type {[type]}
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

const CSSInlinePlugin = {
  name: "CSSInlinePlugin",
  async optimize({ asset }) {
    if (asset.ext !== ".html") return asset;

    return {
      ...asset,
      content: juice(asset.content),
    };

    // return new Promise((resolve, reject) => {
    //   juice.juiceResources(
    //     asset.content,
    //     {
    //       webResources: {
    //         relativeTo: asset.path,
    //       },
    //     },
    //     (err, content) => {
    //       if (err) {
    //         reject(err);
    //       } else {
    //         resolve({
    //           ...asset,
    //           content,
    //         });
    //       }
    //     }
    //   );
    // });
  },
};

export default CSSInlinePlugin;
