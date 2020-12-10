import parse from "codsen-parser";
import { selectAll, selectOne } from "css-select";
import { prepare, adapter } from "css-select-codsen-parser";

// A list of all tags that may produce a dependency
// Based on https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
const TAGS = {
  // Using href with <script> is described here: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/script
  script: ["src", "href", "xlink:href"],
  img: ["src", "srcset"],
  audio: ["src"],
  video: ["src", "poster"],
  source: ["src", "srcset"],
  track: ["src"],
  iframe: ["src"],
  embed: ["src"],
  "amp-img": ["src"],
  link: ["href", "imagesrcset"],
  a: ["href"],
  use: ["href", "xlink:href"],
  image: ["xlink:href"],
  object: ["data"],
  meta: ["content"],
};

// A list of metadata that should produce a dependency
// https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/html/src/dependencies.js#L37
// Based on:
// - http://schema.org/
// - http://ogp.me
// - https://developer.twitter.com/en/docs/tweets/optimize-with-cards/overview/markup
// - https://msdn.microsoft.com/en-us/library/dn255024.aspx
// - https://vk.com/dev/publications
const META = {
  property: [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "og:audio",
    "og:audio:secure_url",
    "og:video",
    "og:video:secure_url",
    "vk:image",
  ],
  name: [
    "twitter:image",
    "msapplication-square150x150logo",
    "msapplication-square310x310logo",
    "msapplication-square70x70logo",
    "msapplication-wide310x150logo",
    "msapplication-TileImage",
    "msapplication-config",
  ],
  itemprop: [
    "image",
    "logo",
    "screenshot",
    "thumbnailUrl",
    "contentUrl",
    "downloadUrl",
  ],
};

/**
 * CSS query for all the elements that point to external dependencies
 */
const QUERY = [
  // filter out meta since we add it in below
  ...Object.keys(TAGS)
    .filter((tag) => tag !== "meta")
    .map((tag) => {
      const attrs = TAGS[tag];
      return attrs.map((attr) => `${tag}[${cssEscape(attr)}]`).join(",");
    }),
  ...Object.keys(META).map((attr) => {
    const values = META[attr];
    return values
      .map((value) => `meta[${attr}="${cssEscape(value)}"][content]`)
      .join(",");
  }),
].join(",");

export default function findHTMLDependencies(str) {
  let dependencies = [];
  const ast = typeof str === "string" ? parse(str) : str;
  const source = typeof str === "string" ? str : getRawContent(str);
  const nodes = selectAll(QUERY, prepare(ast), { adapter });

  for (let node of nodes) {
    const tag = node.tagName;
    const attrs = TAGS[tag];

    for (let attr of attrs) {
      const details = node.attribs.find(
        ({ attribName }) => attribName === attr
      );

      if (!details) {
        continue;
      }

      const attribName = details.attribName;
      let value = details.attribValueRaw;
      let valueStartsAt = details.attribValueStartsAt;

      // Filter out a weird meta tag
      if (
        tag === "meta" &&
        value === "none" &&
        adapter.getAttributeValue(node, "name") === "msapplication-config"
      ) {
        continue;
      }

      // links to something that isn't a file
      if (tag === "a" && value.lastIndexOf(".") < 1) {
        continue;
      }

      /**
       * Bug in codsen where the url ends with an equal sign (=)
       *
       * Check where we have no url and there is an unknown attribue
       */
      if (!value) {
        const raw = source.substring(node.start).split(">")[0];
        // with quotes
        const v1 = new RegExp(
          `${details.attribName}\\s*=\\s*(["'])((?:(\\n|.))*?)\\1`,
          "i"
        ).exec(raw);
        // without quotes
        const v2 = new RegExp(
          `${details.attribName}\\s*=\\s*((?:(\\S))*?)(?:\\s|>|$)`,
          "i"
        ).exec(raw);

        value = v1 ? v1[2] : v2 ? v2[1] : null;
        valueStartsAt = raw.indexOf(value) + node.start;
      }

      // if we still don't have a value, skip it
      if (!value) {
        continue;
      }

      const paths =
        attr === "srcset" || attr === "imagesrcset"
          ? parseSrcSet(value)
          : [value];

      // Gather the dependencies and their range location
      let offset = 0;
      for (let path of paths) {
        path = path.trim();

        // Check for data URIs
        if (path.startsWith("data:")) {
          continue;
        }

        // Check for ID references
        if (path[0] === "#") {
          continue;
        }

        // Check for empty paths
        if (path.length === 0) {
          continue;
        }

        const [start, end] = getRange(value.substring(offset), path);
        const padding = valueStartsAt + offset;
        dependencies.push({
          path,
          range: [start + padding, end + padding],
        });
        offset = end;
      }
    }
  }

  return dependencies;
}

function getRange(str, value) {
  const start = str.indexOf(value);
  const end = start + value.length;
  return [start, end];
}

function parseSrcSet(srcset) {
  let paths = [];
  for (let source of srcset.split(",")) {
    let pair = source.trim().split(" ");
    paths.push(pair[0]);
  }

  return paths;
}

function cssEscape(str) {
  return str.replace(":", "\\:");
}

function getRawContent(node) {
  if (Array.isArray(node)) {
    return node.map(getRawContent).join("");
  }

  return (
    (node.value || "") + adapter.getChildren(node).map(getRawContent).join("")
  );
}
