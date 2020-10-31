import MagicString from "magic-string";
import isAbsoluteUrl from "is-absolute-url";
const IMPORT_REGEX = /\@import\s*(?:url\()?['"](.*?)['"]\)?/g;

const CSSPlugin = {
  name: "CSSPlugin",
  resolve: { input: [".css"], output: ".css" },
  async transform({ asset, addDependency }) {
    let match;
    while ((match = IMPORT_REGEX.exec(asset.content))) {
      const path = match[1];
      if (!isAbsoluteUrl(path)) {
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
        content.overwrite(startIndex, endIndex, resolveAsset({ path }));
      }
    }

    return {
      ...asset,
      content: content.toString(),
    };
  },
};

export default CSSPlugin;
