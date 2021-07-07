import MagicString from "magic-string";
import findHTMLDependencies from "find-html-dependencies";
import findEmbeddedDocuments from "find-embedded-documents";
import isAbsoluteUrl from "is-absolute-url";
import { cparser as parse } from "codsen-parser";

export function html({ ignoreMissingAssets = false } = {}) {
  return {
    name: "@useparcel/tape-html",
    exts: [".html"],
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
      const content = new MagicString(asset.content);
      const ast = parse(asset.content);

      /**
       * Add external dependencies
       */
      const dependencies = findHTMLDependencies(ast);
      for (let { path, range } of dependencies) {
        if (isAbsoluteUrl(path)) {
          continue;
        }

        if (assetExists({ path })) {
          addDependency({ path });
        }
      }

      /**
       * Add embedded dependencies
       */
      const documents = findEmbeddedDocuments(ast);
      let parts = [];
      let i = 0;
      for (let doc of documents) {
        const id = `${asset.id}:${i}`;
        parts.push({
          id,
          ext: `.${doc.type}`,
          content: doc.content,
          embedded: true,
        });
        addDependency({ id: id });
        content.appendRight(doc.openTag.end - 1, ` data-tape-id="${id}"`);
        i++;
      }

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
      const ast = parse(asset.content);
      /**
       * Resolve external dependencies
       */
      const dependencies = findHTMLDependencies(ast);
      for (let { path, range } of dependencies) {
        const replacement = resolveAsset({ path });
        if (replacement) {
          content.overwrite(range[0], range[1], replacement);
        }
      }

      /**
       * Resolve embedded dependencies
       */
      const documents = findEmbeddedDocuments(ast);
      for (let doc of documents) {
        const attribute = doc.openTag.attribs.find(
          ({ attribName }) => attribName === "data-tape-id"
        );
        if (!attribute) {
          continue;
        }
        const id = attribute.attribValueRaw;

        const styleContent = getAssetContent({ id });
        content.remove(attribute.attribStarts - 1, attribute.attribEnds);
        content.overwrite(doc.range[0], doc.range[1], styleContent);
      }

      return {
        ...asset,
        content: content.toString(),
      };
    },
  };
}
