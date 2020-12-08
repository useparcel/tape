import MagicString from "magic-string";
import isAbsoluteUrl from "is-absolute-url";
const IMPORT_REGEX = /\@import\s*(?:url\()?['"](.*?)['"]\)?/g;
const VALUE_URL_REGEX = /[:,].*?(?:url\()['"]?(.*?)['"]?\)/g;

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

      let match;
      while ((match = IMPORT_REGEX.exec(asset.content))) {
        const path = match[1];
        if (!isAbsoluteUrl(path) && assetExists({ path })) {
          addDependency({ path });
        }
      }

      while ((match = VALUE_URL_REGEX.exec(asset.content))) {
        const path = match[1];
        if (!isAbsoluteUrl(path) && assetExists({ path })) {
          addDependency({ path });
        }
      }

      return asset;
    },
    async package({ asset, resolveAsset }) {
      const content = new MagicString(asset.content);
      let match;
      while ((match = IMPORT_REGEX.exec(asset.content))) {
        const path = match[1];
        if (!isAbsoluteUrl(path)) {
          const startIndex = match.index + match[0].indexOf(path);
          const endIndex = startIndex + path.length;
          const replacement = resolveAsset({ path });
          if (replacement) {
            content.overwrite(startIndex, endIndex, replacement);
          }
        }
      }

      while ((match = VALUE_URL_REGEX.exec(asset.content))) {
        const path = match[1];
        if (!isAbsoluteUrl(path)) {
          const startIndex = match.index + match[0].indexOf(path);
          const endIndex = startIndex + path.length;
          const replacement = resolveAsset({ path });
          if (replacement) {
            content.overwrite(startIndex, endIndex, replacement);
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
