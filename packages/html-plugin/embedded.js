import walk from "./walk";

export default ({ asset, addDependency, content }) => {
  let index = 0;
  let parts = [];
  walk(
    asset.content,
    "style",
    ({ attrs, raw, startIndex, content: { value, offset } }) => {
      let type = "css";
      if (attrs && attrs.type) {
        type = attrs.type.value.split("/")[1];
      }

      const id = `${asset.id}:${index}`;

      content.appendRight(
        raw.indexOf(">") + startIndex,
        ` data-tape-id="${id}"`
      );

      addDependency({ id });
      parts.push({
        id,
        ext: `.${type}`,
        content: value,
        embedded: true,
        offset,
      });
    }
  );

  return parts;
};
