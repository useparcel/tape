# find-html-dependencies

Finds all dependencies within an HTML string. A dependency in this case is a resource referenced from the HTML including images, CSS files, and JavaScript files.

## Install

```
$ npm install find-html-dependencies
```

## Usage

```js
const findHTMLDependencies = require("find-html-dependencies");

const dependencies = findHTMLDependencies(`
  <img src="my-image.png" />
`);
// => [ { path: 'my-image.png', range: [ 13, 25 ] } ]
```
