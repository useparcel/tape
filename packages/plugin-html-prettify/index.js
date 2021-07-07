import pretty from "pretty";

export function htmlPrettify(config) {
  return {
    name: "@useparcel/tape-html-prettify",
    exts: [".html"],
    async optimize({ asset }) {
      return {
        ...asset,
        content: pretty(asset.content, config),
      };
    },
  };
}
