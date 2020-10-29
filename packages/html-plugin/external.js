const walk = require('@useparcel/tape-utils/walk-html')

//https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/html/src/dependencies.js#L7
// A list of all attributes that may produce a dependency
// Based on https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
const ATTRS = {
  src: [
    'script',
    'img',
    'audio',
    'video',
    'source',
    'track',
    'iframe',
    'embed',
    'amp-img',
  ],
  // Using href with <script> is described here: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/script
  href: ['link', 'a', 'use', 'script'],
  srcset: ['img', 'source'],
  poster: ['video'],
  'xlink:href': ['use', 'image', 'script'],
  content: ['meta'],
  data: ['object'],
};

// A list of metadata that should produce a dependency
// Based on:
// - http://schema.org/
// - http://ogp.me
// - https://developer.twitter.com/en/docs/tweets/optimize-with-cards/overview/markup
// - https://msdn.microsoft.com/en-us/library/dn255024.aspx
// - https://vk.com/dev/publications
const META = {
  property: [
    'og:image',
    'og:image:url',
    'og:image:secure_url',
    'og:audio',
    'og:audio:secure_url',
    'og:video',
    'og:video:secure_url',
    'vk:image',
  ],
  name: [
    'twitter:image',
    'msapplication-square150x150logo',
    'msapplication-square310x310logo',
    'msapplication-square70x70logo',
    'msapplication-wide310x150logo',
    'msapplication-TileImage',
    'msapplication-config',
  ],
  itemprop: [
    'image',
    'logo',
    'screenshot',
    'thumbnailUrl',
    'contentUrl',
    'downloadUrl',
  ],
};

module.exports = ({ file, addDependency, content }) => {
  let urlDependencyIndexes = []
  walk(file.content, (node) => {
    const { tag, attrs } = node
    if (!attrs) {
      return false;
    }

    if (tag === 'meta') {
      if (
        !Object.keys(attrs).some(attr => {
          let values = META[attr];
          return (
            values &&
            values.includes(attrs[attr]) &&
            attrs.content !== '' &&
            !(attrs.name === 'msapplication-config' && attrs.content === 'none')
          );
        })
      ) {
        return false;
      }
    }

    for (let attr in attrs) {
      // Check for virtual paths
      if (tag === 'a' && attrs[attr].lastIndexOf('.') < 1) {
        continue;
      }

      // Check for id references
      if (attrs[attr][0] === '#') {
        continue;
      }

      let elements = ATTRS[attr];
      if (elements && elements.includes(node.tag)) {
        addDependency(attrs[attr].value, { type: 'url' })
        urlDependencyIndexes.push(
          attrs[attr].offset.value.end + 1
        )
        // urlDependencyIndexes.push(node.startIndex + node.raw.toLowerCase().indexOf(attrs[attr].toLowerCase())) + attrs[attr].length
        return false;
      }
    }

    return false;
  })


  urlDependencyIndexes.forEach((index) => {
    content.appendRight(index, '|tape-dependency')
  })
}