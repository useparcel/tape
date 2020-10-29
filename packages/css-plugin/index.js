const MagicString = require('magic-string')
const isAbsoluteUrl = require('is-absolute-url')
const IMPORT_REGEX = /\@import\s*(?:url\()?['"](.*?)['"]\)?/g

const CSSPlugin = {
  name: 'CSSPlugin',
  resolve: {input: ['.css'], output: '.css'},
  async transform({ asset, addDependency }) {
    while (match = IMPORT_REGEX.exec(asset.content)) {
      const path = match[1]
      if (!isAbsoluteUrl(path)) {
        addDependency({ path })
      }
    }

    return {
      ...asset,
      content: `/* modified */${asset.content}`
    }
  },
  async package({ asset, resolveDependency }) {
    const content = new MagicString(asset.content);
    while (match = IMPORT_REGEX.exec(asset.content)) {
      const path = match[1]
      if (!isAbsoluteUrl(path)) {
        const startIndex = match.index + match[0].indexOf(path)
        const endIndex = startIndex + path.length
        content.overwrite(startIndex, endIndex, resolveDependency({ path }))
      }
    }

    return {
      ...asset,
      content: content.toString()
    }
  }
}

module.exports = CSSPlugin