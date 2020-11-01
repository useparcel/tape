import Sass from "sass.js";

export default {
  name: "SassPlugin",
  resolve: { input: [".scss", ".sass"], output: ".css" },
  transform({ asset }) {
    return new Promise((resolve, reject) => {
      Sass.compile(asset.content, function (result) {
        if (result.status === 0) {
          return resolve({
            ...asset,
            content: result.text || "",
          });
        }

        return reject(new Error(result.formatted));
      });
    });
  },
};
