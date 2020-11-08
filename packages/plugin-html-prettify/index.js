import pretty from "pretty";

export default function (config) {
  return {
    name: "@useparcel/tape-html-prettify",
    async optimize({ asset }) {
      if (asset.ext !== ".html") {
        return asset;
      }

      return {
        ...asset,
        content: pretty(asset.content, config),
      };
    },
  };
}
