import MagicString from "magic-string";
import isAbsoluteUrl from "is-absolute-url";
import findCSSDependencies from "find-css-dependencies";

export default function ({ ignoreMissingAssets = false } = {}) {
  return {
    name: "@useparcel/tape-css",
    exts: [".css"],
    async transform({ asset, addDependency, getAssetContent }) {
      const assetExists = (...args) => {
        if (ignoreMissingAssets === false) {
          return true;
        }

        try {
          getAssetContent(...args);
          return true;
        } catch (e) {
          return false;
        }
      };

      const dependencies = findCSSDependencies(asset.content);

      for (let { path } of dependencies) {
        if (!isAbsoluteUrl(path) && assetExists({ path })) {
          addDependency({ path });
        }
      }

      return asset;
    },
    async package({ asset, resolveAsset }) {
      const content = new MagicString(asset.content);
      const dependencies = findCSSDependencies(asset.content);

      for (let { path, range } of dependencies) {
        if (!isAbsoluteUrl(path)) {
          const replacement = resolveAsset({ path });
          if (replacement) {
            content.overwrite(range[0], range[1], replacement);
          }
        }
      }

      return {
        ...asset,
        content: content.toString(),
      };
    },
  };
}
