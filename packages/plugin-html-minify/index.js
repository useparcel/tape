import { crush, defaults, version } from "html-crush";
import stripComments from "strip-html-comments";

export default function (config) {
  config = {
    ...defaults,
    ...config,
  };

  return {
    name: "@useparcel/tape-html-minify",
    async optimize({ asset }) {
      if (asset.ext !== ".html") {
        return asset;
      }

      let processedContent = asset.content;

      /**
       * There seems to be a bug in html-crush where the ends of mso comments
       * aren't getting removed. To work around this, I'm using strip-html-comments
       * to remove all comments (when removeHTMLComments is '2')
       */
      if (Number(config.removeHTMLComments) === 2) {
        processedContent = stripComments(processedContent);
      }

      return {
        ...asset,
        content: crush(processedContent, {
          ...config,
          removeHTMLComments: Number(config.removeHTMLComments) === 1 ? 1 : 0,
        }).result,
      };
    },
  };
}
