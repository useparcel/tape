const IMPORT_REGEX = /\@import\s*(?:url\()?(['"])(.*?)\1\)?/g;
const VALUE_URL_REGEX = /[:,](?:.|\n)*?(?:url\()\s*(['"])?(.*?)\1?\s*\)/g;

export default function findCSSDependencies(str) {
  let dependences = [];

  let match;
  while ((match = IMPORT_REGEX.exec(str))) {
    dependences.push(matchToDependency(match));
  }

  while ((match = VALUE_URL_REGEX.exec(str))) {
    dependences.push(matchToDependency(match));
  }

  // filter to remove the nulls
  return dependences.filter(Boolean);
}

function matchToDependency(match) {
  const reference = match[0];
  const path = match[2].trim();

  // Check for data URIs
  if (path.startsWith("data:")) {
    return null;
  }

  // Check for ID references
  if (path[0] === "#") {
    return null;
  }

  // Check for empty paths
  if (path.length === 0) {
    return null;
  }

  const offset = reference.indexOf(path);
  const start = match.index + offset;
  const end = start + path.length;

  return {
    path,
    range: [start, end],
  };
}
