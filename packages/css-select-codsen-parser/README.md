# css-select-codsen-parser

An adapter for [`css-select`](https://www.npmjs.com/package/css-select) to allow querying of [`codsen-parser`](https://www.npmjs.com/package/codsen-parser) generated trees.

## Install

```
$ npm install css-select-codsen-parser
```

## Usage

To use this adapter, first you must run the AST through `prepare`.

```js
const parse = require("codsen-parser");
const CSSselect = require("css-select");
const { prepare, adapter } = require("css-select-codsen-parser");

const ast = prepare(
  parse(`
    <div id="greeting">
      Hello <span class="name">Alice</span>
    </div>
  `)
);

const nodes = cssSelect('#greeting .name', ast, { adapter });
// => [ { type: 'tag', start: 37, end: 56, value: '<span class="name">'... ]
```