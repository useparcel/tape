const DefaultWritePlugin = {
  name: "default-write-plugin",
  async write({ asset, cache }) {
    const path = `${asset.path.replace(
      new RegExp(`${asset.originalExt}$`),
      asset.ext
    )}`;

    return path;
  },
};

export default DefaultWritePlugin;
