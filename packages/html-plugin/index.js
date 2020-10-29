const MagicString = require('magic-string')
const walk = require('@useparcel/tape-utils/walk-html')
const external = require('./external.js')

const HTMLPlugin = {
  name: 'HTMLPlugin',
  resolve: { input: '.html', output: '.html' },
  async transform({ file, addDependency }) {

    const content = new MagicString(file.content)
    external({ file, addDependency, content })

    let index = 0
    walk(file.content, 'style', ({ tag, attrs, raw, startIndex }) => {
      let type = 'css'
      if (attrs && attrs.type) {
        type = attrs.type.split('/')[1];
      }

      content.appendRight(raw.indexOf('>') + startIndex, ` data-tape-id="${index}"`)
    })

    return content.toString()
  },
  async package({ file, resolveDependency }) {

    const content = new MagicString(file.content)
    
    walk(file.content, ({ tag, attrs }) => {

      if (!attrs) {
        return false;
      }

      for (let { value, offset } of Object.values(attrs)) {
        if (value.endsWith('|tape-dependency')) {
          content.overwrite(offset.value.start, offset.value.end+1, resolveDependency(value.replace(/\|tape-dependency$/, '')))
        }
      }
    })

    return content.toString()
  }
}

module.exports = HTMLPlugin