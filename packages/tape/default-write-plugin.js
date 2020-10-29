const DefaultWritePlugin = {
  name: 'DefaultWritePlugin',
  async write({ asset, cache }) {

    if (cache.has(asset.id)) {
      console.log(`${asset.path || asset.id} from cache`)
      return cache.get(asset.id)
    }

    console.log(`${asset.path || asset.id} new`)

    const path = `${asset.path.replace(new RegExp(`${asset.originalExt || asset.ext}$`), asset.ext)}?${Math.random()}`
    cache.set(asset.id, path)

    return path
  },
  async onChange({ asset, cache }) {
    if (cache.has(asset.id)) {
      cache.delete(asset.id)
    }
  }
}

module.exports = DefaultWritePlugin;