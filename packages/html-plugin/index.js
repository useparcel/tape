const MagicString = require('magic-string')
const walk = require('./walk')
const addExternalDependencies = require('./external.js')
const addEmbeddedDependencies = require('./embedded.js')

const HTMLPlugin = {
  name: 'HTMLPlugin',
  resolve: { input: '.html', output: '.html' },
  async transform({ asset, addDependency }) {
    const content = new MagicString(asset.content)
    addExternalDependencies({ asset, addDependency, content })
    const parts = addEmbeddedDependencies({ asset, addDependency, content })

    return [
      {
        ...asset,
        content: content.toString()
      },
      ...parts
    ]
  },
  async package({ asset, resolveAsset, getAssetContent }) {
    const content = new MagicString(asset.content)
    
    walk(asset.content, ({ tag, attrs, content: c }) => {
      if (!attrs) {
        return false;
      }

      for (let { value, offset } of Object.values(attrs)) {
        if (value.endsWith('|tape-dependency')) {
          content.overwrite(offset.value.start, offset.value.end+1, resolveAsset({ path: value.replace(/\|tape-dependency$/, '') }))
        }
      }

      if (tag === 'style' && attrs['data-tape-id']) {
        const styleContent = getAssetContent({ id: attrs['data-tape-id'].value })
        content.remove(attrs['data-tape-id'].offset.start, attrs['data-tape-id'].offset.end+1)
        content.overwrite(c.offset.start, c.offset.end+1, styleContent)
      }
    })

    return {
      ...asset,
      content: content.toString()
    }
  }
}

module.exports = HTMLPlugin