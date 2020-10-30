const DefaultWritePlugin = {
  name: "DefaultWritePlugin",
  async write({ asset, cache }) {
    if (cache.has(asset.id)) {
      return cache.get(asset.id);
    }

    const path = `${asset.path.replace(
      new RegExp(`${asset.originalExt || asset.ext}$`),
      asset.ext
    )}`;
    cache.set(asset.id, path);

    return path;
  },
  async onChange({ asset, cache }) {
    console.log(asset.path || asset.id, "changed");
    if (cache.has(asset.id)) {
      cache.delete(asset.id);
    }
  },
  async cleanup({ cache }) {
    console.log("clean");
  },
};

module.exports = DefaultWritePlugin;
