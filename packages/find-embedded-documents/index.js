import parse from "codsen-parser";
import { selectAll } from "css-select";
import { prepare, adapter } from "css-select-codsen-parser";

const defaultType = {
  style: "css",
  script: "javascript",
};

export default function findEmbeddedDocuments(str) {
  const ast = typeof str === "string" ? parse(str) : str;
  const nodes = selectAll("style, script", prepare(ast), { adapter });

  let documents = [];
  for (let node of nodes) {
    const tagName = node.tagName;
    const typeAttr = adapter.getAttributeValue(node, "type");
    const type = typeAttr ? last(typeAttr.split("/")) : defaultType[tagName];
    const content = getRawContent(node.children);

    if (
      tagName === "script" &&
      (adapter.hasAttrib(node, "src") ||
        adapter.hasAttrib(node, "href") ||
        adapter.hasAttrib(node, "xlink:href"))
    ) {
      continue;
    }

    const start = node.end;
    const end = node.end + content.length;

    documents.push({
      tagName,
      type,
      content,
      range: [start, end],
      openTag: node,
    });
  }

  return documents;
}

function last(arr) {
  return arr[arr.length - 1];
}

function getRawContent(node) {
  if (Array.isArray(node)) {
    return node.map(getRawContent).join("");
  }

  return (
    (node.value || "") + adapter.getChildren(node).map(getRawContent).join("")
  );
}
