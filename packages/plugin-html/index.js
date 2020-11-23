import MagicString from "magic-string";
import walk from "./walk";
import addExternalDependencies from "./external";
import addEmbeddedDependencies from "./embedded";

export default function () {
  return {
    name: "@useparcel/tape-html",
    exts: [".html"],
    async transform({ asset, addDependency }) {
      const content = new MagicString(asset.content);
      addExternalDependencies({ asset, addDependency, content });
      const parts = addEmbeddedDependencies({ asset, addDependency, content });

      return [
        {
          ...asset,
          content: content.toString(),
        },
        ...parts,
      ];
    },
    async package({ asset, resolveAsset, getAssetContent }) {
      const content = new MagicString(asset.content);

      walk(asset.content, ({ tag, attrs, content: c }) => {
        if (!attrs) {
          return false;
        }

        for (let { value, offset } of Object.values(attrs)) {
          if (value.endsWith("|tape-dependency")) {
            content.overwrite(
              offset.value.start,
              offset.value.end + 1,
              resolveAsset({ path: value.replace(/\|tape-dependency$/, "") })
            );
          }
        }

        if (tag === "style" && attrs["data-tape-id"]) {
          const styleContent = getAssetContent({
            id: attrs["data-tape-id"].value,
          });
          content.remove(
            attrs["data-tape-id"].offset.start - 1, // subtract one to remove the space we added
            attrs["data-tape-id"].offset.end + 1
          );
          content.overwrite(c.offset.start, c.offset.end + 1, styleContent);
        }
      });

      return {
        ...asset,
        content: content.toString(),
      };
    },
  };
}
