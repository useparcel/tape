const juice = require('juice');
const CSSInlinePlugin = {
  name: 'CSSInlinePlugin',
  async optimize({ asset }) {
    if (asset.ext !== '.html')
      return asset
    
    return {
      ...asset,
      content: juice(asset.content)
    };
  }
}

module.exports = CSSInlinePlugin