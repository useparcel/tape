import cheerio from "cheerio";
import isFunction from "lodash.isfunction";
import memoize from "lodash.memoize";
import mapValues from "lodash.mapvalues";
const load = memoize((html) =>
  cheerio.load(html, { withStartIndices: true, withEndIndices: true })
);
const isEmpty = (obj) => Object.keys(obj).length === 0;

export default function walk(html, query = "*", walk = () => {}) {
  if (isFunction(query)) {
    walk = query;
    query = "*";
  }

  const $ = load(html);

  return $(query)
    .toArray()
    .forEach((node) => {
      const { startIndex, endIndex } = node;
      const raw = html.substring(startIndex, endIndex + 1);
      const content = $(node).text();
      return walk({
        tag: node.name,
        attrs: isEmpty(node.attribs)
          ? undefined
          : mapValues(node.attribs, (value, key) => {
              return {
                value,
                offset: getAttributeOffsets(raw, key, value, startIndex),
              };
            }),
        startIndex,
        endIndex,
        raw,
        content: {
          offset: {
            start: startIndex + raw.indexOf(content),
            end: startIndex + raw.indexOf(content) + content.length - 1,
          },
          value: content,
        },
      });
    });
}

function getAttributeOffsets(raw, key, value, baseIndex = 0) {
  let lookingFor = "key";
  let i = 0;
  const offset = {
    start: null,
    stop: null,
    key: {
      start: null,
      end: null,
    },
    value: {
      start: null,
      end: null,
    },
  };

  while (i < raw.length) {
    // skip whitespace
    if (/\s/.test(raw.charAt(i))) {
      i++;
      continue;
    }

    // find key
    if (lookingFor === "key" && raw.substr(i, key.length) === key) {
      offset.start = baseIndex + i;
      offset.key.start = baseIndex + i;
      offset.key.end = baseIndex + i + key.length - 1;
      lookingFor = "equal";
      i = i + key.length;
      continue;
    }

    // find equal
    if (lookingFor === "equal") {
      if (raw.charAt(i) === "=") {
        lookingFor = "value";
        i++;
        continue;
      }

      if (value === "") {
        offset.end = baseIndex + i + value.length - 1;
        break;
      }

      throw new Error(`Expected "=", found ${raw.charAt(i)}`);
    }

    // find value
    if (
      lookingFor === "value" &&
      raw.substr(i, value.length).toLowerCase() === value.toLowerCase()
    ) {
      offset.value.start = baseIndex + i;
      offset.value.end = baseIndex + i + value.length - 1;

      if ([`"`, `'`].includes(raw.charAt(i + value.length))) {
        offset.end = baseIndex + i + value.length;
      } else {
        offset.end = baseIndex + i + value.length - 1;
      }

      break;
    }

    i++;
  }

  return offset;
}
