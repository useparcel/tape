const DefaultWritePlugin = {
  name: "default-write-plugin",
  async write({ asset, cache }) {
    const path = `${asset.source.path.replace(
      new RegExp(`${asset.source.ext}$`),
      asset.ext
    )}`;

    return path;
  },
};

export default DefaultWritePlugin;
