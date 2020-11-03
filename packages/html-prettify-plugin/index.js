import pretty from "pretty";

export default (config = {}) => {
  return {
    name: "HTMLPrettify",
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
};
