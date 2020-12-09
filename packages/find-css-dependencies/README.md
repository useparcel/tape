# find-css-dependencies

Finds all dependencies within a CSS string. A dependency in this case is a resource referenced from the CSS including external CSS files and images.

## Install

```
$ npm install find-css-dependencies
```

## Usage

```js
const findCSSDependencies = require("find-css-dependencies");

const dependencies = findCSSDependencies(`
  @import 'reset.css';
`);
// => [ { path: 'reset.css', range: [ 12, 21 ] } ]
```
