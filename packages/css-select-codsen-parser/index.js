export function prepare(ast) {
  function walkWithParent(node, cb, parent = null) {
    if (Array.isArray(node) && node.length > 0) {
      node.forEach((n) => walkWithParent(n, cb, parent));
    } else if (node) {
      cb(node, parent);

      walkWithParent(node.children, cb, node);
    }
  }

  walkWithParent(ast, (node, parent) => {
    node.parent = parent;
  });

  return ast;
}

export const adapter = {
  isTag,
  existsOne,
  getAttributeValue,
  getChildren,
  getName,
  getParent,
  getSiblings,
  getText,
  hasAttrib,
  removeSubsets,
  findAll,
  findOne,
};

function isTag(node) {
  return node.type === "tag" && node.closing === false;
}

function existsOne(test, nodes) {
  return nodes.some(function (node) {
    return isTag(node)
      ? test(node) || existsOne(test, getChildren(node))
      : false;
  });
}

function getAttributeValue(node, name) {
  const attribute = node.attribs.find(({ attribName }) => attribName === name);

  if (attribute) {
    return attribute.attribValueRaw;
  }
}

function getChildren(node) {
  return node.children || [];
}

function getName(node) {
  return (node.tagName || "").toLowerCase();
}

function getParent(node) {
  return node.parent;
}

function getSiblings(node) {
  const parent = getParent(node);
  return parent ? getChildren(parent) : [node];
}

function getText(node) {
  if (isTag(node)) return getChildren(node).map(getText).join("");

  if (node.type === "text") {
    return node.value;
  }

  return "";
}

function hasAttrib(node, name) {
  return !!node.attribs.find(({ attribName }) => attribName === name);
}

function removeSubsets(nodes) {
  const filtered = new Set(nodes);
  for (const node of [...filtered]) {
    if (findAncestor((ancestor) => filtered.has(ancestor), node)) {
      filtered.delete(node);
    }
  }
  return [...filtered];
}

function findAncestor(test, node) {
  do {
    node = getParent(node);
    if (node && test(node)) {
      return node;
    }
  } while (node);

  return undefined;
}

function findAll(test, nodes) {
  let matchedNodes = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!isTag(node)) {
      continue;
    }

    if (test(node)) {
      matchedNodes.push(node);
    }

    matchedNodes = matchedNodes.concat(findAll(test, getChildren(node)));
  }

  return matchedNodes;
}

function findOne(test, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const matched = test(node) ? node : findOne(test, getChildren(node));

    if (matched) {
      return matched;
    }
  }

  return null;
}
