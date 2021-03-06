# Tape

HTML build tool that runs entirely in the browser 🎁

[![codecov](https://codecov.io/gh/useparcel/tape/branch/main/graph/badge.svg)](https://codecov.io/gh/useparcel/tape)

[![npm package](https://img.shields.io/npm/v/@useparcel/tape.svg)](https://www.npmjs.com/package/@useparcel/tape)

[![Twitter Follow](https://img.shields.io/twitter/follow/useparcel.svg?style=social)](https://twitter.com/useparcel)

  
## Features

* Works with a lightweight file interface
* Compiles dependencies
* Rebuilds the minimum number of files on updates
* Runs in the browser and server

## Install

```sh
npm install @useparcel/tape
```

## Example

Let's walk through how to use tape. We are going to run `tape()` and configure it to use the css inlining plugin. We are also going to give it 2 files, and tell it that `index.html` is the entry file where it should start looking for dependencies.
  
```js
import { tape } from '@useparcel/tape'
import { cssInline } from '@useparcel/tape-css-inline'

const results = await tape({
  entry: '/index.html',
  plugins: [
    [cssInline, { applyStyleTags: false }]
  ],
  files: {
    '/index.html': {
      content: `
      <!DOCTYPE html>
        <html>
          <head>
            <title>Hello world</title>
            <link rel="stylesheet" href="/style.css">
          </head>
          <body>
          </body>
        </html>`
    }
    '/style.css': {
      content: `
        body {
          background: blue;
        }`
    }
  }
})
```

## API

### tape()
  
```js
const results = await tape({ entry, files, plugins, cache, signal })
```

#### `entry`
> `String` | required

The entry file to be built. It must be a valid file given to the `files` object.

#### `files`
> `Object` or `Function` | required

Either an object or a function.

If it is an object, it should contain the files themselves. Each entry key should be the file path and each value should be an object with an entry with a key of `content` and contain the content of the file.

```js
const files = {
  '/index.html': {
    content: '<html>hello world</html>'
  }
}
``` 

If it is an function it should take a path as the only parameter and return the file as a result. The function can be asynchronous.

```js
import { readFile } from 'fs/promises';

const getFileForTape(path) {
  const content = await readFile(path, 'utf8');
  return { content }
}
```

#### `plugins`
> `Array` | defaults to `[]`

An optional array of additional plugins to run. To provide the plugin with configuration, pass in array with the plugin as the first value and the configuration as the second.

```js
const plugins = [
  myTapePlugin,
  [myTapePluginWithConfig, { option: true }]
]
```

#### `cache`
> `Map` | optional

Cache from a previous build result. Will be used to only rebuild the changed files.

#### `signal`
> `AbortSignal` | optional

The `AbortSignal` from an `AbortController`. Passing this in allows you to abort the build. This is useful if a file was changed and you want to stop the build immediately.

```js
const controller = new AbortController();
const signal = controller.signal;

const results = await tape({ entry, files, signal });

// stops the build if it took more than 500ms
setTimeout(() => {
  controller.abort();
}, 500)

```


**Return value**

Returns a Promise which resolves an object with the following keys:
*  `entry` (`String`) - Entry path for outputted files
*  `files` (`Object`) - Contains built file objects. See [file definition](#file) for more.
*  `diagnostics` (`Array`) - Contains a list of diagnostic messages. [See diagnostic definition](#diagnostic) for more.
*  `cache` (`Map`) - Cache from the build results. Can be passed into future builds to only rebuild changed files.

**Error handling**

It will reject the promise if it runs into a fatal error or if the build is aborted. Otherwise all errors will be returned inside the `diagnostics` array.

**Example**

```js
try {
  const { entry, files, diagnostics } = await tape({ entry, files, plugins, cache, signal })

  console.log(`Here is the output:\n${files[entry]}`)  

  console.log(`You should probably fix these problems: ${
    JSON.stringify(diagnostics, null, 2)
  }`)
}
catch(error) {
  console.log(`The build failed. You *must fix this problem*:`, error)
}
```

### tape.dispose()

Runs the `cleanup()` function for each plugin. Should be called after each session you are done running tape. For example, when the user navigates to a new page, you should run it then.

It should be given the same exact configuration as `tape()`.

  
## Plugins  

### Lifecycle

Each build goes through the following lifecycle:

* Transforming
* Packaging
* Optimizing
* Writing

During the **transforming** step, all assets are loaded, converted into usable types (i.e. MJML converted HTML), and added to a dependency graph. Inline assets such as CSS in `<style/>` tag are extracted here.

Next, dependencies are **packaging**. Here inline assets are re-inserted and dependency references are replaced with their final output path.

After each file is packaged, it can be **optimized**. This can be any modification of the final content from HTML minification to CSS inlining.

Lastly, the files are **written** to some output. For example: a target output could be the file system, an in-memory object, a [series of object URLs](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL).

  
Plugins can hook into each step of the lifecycle.

### Building a plugin

Each plugin is a function that accepts a config object and returns an object with the following plugin structure:

* name (`String` | `required`) - The unique name of the plugin.
* exts (`Array` | `optional`) - An array of extensions that the plugin should be run against.
* transform (`Function` | `optional`)
* package (`Function` | `optional`)
* optimize (`Function` | `optional`)
* write (`Function` | `optional`)
* onChange (`Function` | `optional`)
  
```js
function  myTapePlugin(config) {
  return {
    name: 'my-tape-plugin',
    exts: ['.css', '.scss', '.less', '.sass'],
    transform({ asset }) {
      return {
        ...asset,
        content: `/** my css comment */\n${asset.content}`
      }
    }
  }
}
```

#### `transform({ asset, addDependency, report, cache })`

Transform assets, add dependencies, and extract inline assets.
In the following example we are going to transform pug, a template language.

**Transform assets**

When transforming assets to a different type, you should update both the `ext` property and the `content`. In the following example we will convert pug to HTML.

```js

const pug = require("pug");


function pugPlugin() {
  return {
    name: "transform-pug",
    exts: [".pug"],
    transform({ asset }) {
      // return the transformed asset
      return {
        ...asset,
        ext: ".html",
        content: pug.render(asset.content);
      }
    }
  }
}
```

  
**Add dependencies**

Use the `addDependency` function to add an asset as a dependency. You can provide a file path or the asset ID. The path can be a relative path or absolute. Note that if the asset does not exit the build will fail.

In the following example we will we adding dependencies for included files in pug.

```js

const INCLUDE_REGEX = /^\s*include\s+(.*)/gm;

const isAbsoluteUrl = require("is-absolute-url");

function pugPlugin() {
  return {
    name: "transform-pug",
    exts: [".pug"],
    transform({ asset, addDependency }) {
      // Add included dependencies
      let match;

      while ((match = INCLUDE_REGEX.exec(asset.content))) {
        const path = match[1];
        if (!isAbsoluteUrl(path)) {
          addDependency({ path });
        }
      }

      // return the transformed asset
      ...
    }
  }
}
```
  

**Extracting inline assets**

Sometimes files include more than one asset type. For example, HTML includes CSS inside of `<style>` tags. You can return an array of assets from your `transform` function. Each of these embedded assets should have the flag `embedded: true` as well as an `offset` with a `start` and `stop` index where it exists in the source.

In the example below we will extract embedded CSS inside of pug files. This is **not** necessary in practice since the pug file will be converted to HTML and then the HTML transformer handle extracting the CSS.

```js

const  STYLE_REGEX  =  /^(\s*)style(\n\1  .*)*/g

function pugPlugin() {
  return {
    name: "transform-pug",
    exts: [".pug"],
    transform({ asset, addDependency }) {
      // Add included dependencies
      ...

      // Extract style embedded assets
      let match;
      let assets = []

      while ((match  =  STYLE_REGEX.exec(asset.content))) {
        const id = `${asset.id}:${assets.length}`
        const content = match[2];
        const startIndex = match.index + match[0].indexOf(content);
        const endIndex = startIndex + path.length;

        // gather the assets and add them as dependencies
        assets.push({
          id,
          ext: `.css`,
          content: content,
          embedded: true,
          offset: {
            start: startIndex,
            end: endIndex
          }
        })
        
        addDependency({ id });
      }

      return [
        {
          ...asset,
          ext: ".html",
          content: pug.render(asset.content);
        },
        ...assets
      ]
    }
  }
}
```

#### `package({ asset, resolveAsset, getAssetContent, report, cache })`

After all transformations are done, `package` should reinsert the processed embedded assets and replace the original references to dependencies.

Odds are you should not be using this method since HTML and CSS are already packaged.

For an example, check out the [HTML plugin](https://github.com/useparcel/tape/blob/main/packages/plugin-html/index.js#L23).  

#### `optimize({ asset, resolveAsset, getAssetContent, report, cache })`

`optimize` is similar to transformer in that it arbitrarily modifies the file contents however it runs after paths have already been packaged, right before the file is written.

This step is where you can run the final code through a last optimization process.

In the following example we are going to prettify our HTML using `pretty`. We will pass the config the plugin accepts directly to `pretty`.

```js
const pretty = require("pretty");

function prettifyHTMLPlugin(config) {
  return {
    name: "prettify-html",
    exts: ".html",
    optimize({ asset }) {
      return {
        ...asset,
        content: pretty(asset.content, config),
      };
    } 
  }
}
```

#### `write({ asset, resolveAsset, getAssetContent, report, cache })`

The `write` function should output the file contents to the target. Unlike all the other plugin methods only one plugin with a `write` method will be run for each file.

The function should return the absolute path to the file.

Below we will write the files to the file system. After each write save the absolute path to the cache so on the next build we don't have to rebuild it unless there is a change.

```js
const fs = require('fs-extra')
const path = require('path')

function writeFSPlugin({ buildDir  =  '.tape' }) {
  return {
    name: 'write-fs',
    async write({ asset, cache }) {
      if (cache.has(asset.path)) {
        return cache.get(asset.path);
      }
      
      const dir = path.join(buildDir, asset.source.dir)
      const absolutePath = path.join(dir, `${asset.source.name}${asset.ext}`)

      await fs.ensureDir(dir)
      await fs.write(absolutePath, asset.content)
      
      cache.set(asset.path, absolutePath)
      return  absolutePath;
    }
  }
}
```
 

#### `onChange({ asset, report, cache })`

`onChange` is only called when a file is changed and a build is triggered with a previous cache.
  
In the `write` example above we saved the absolute file path to the cache. When the file changes we should delete that file and remove that path from the cache.  

```js
const fs = require('fs-extra')
  
function writeFSPlugin({ buildDir }) {
  return {
    name: 'write-fs',
    async write() {...},
    async onChange({ asset, cache }) {
      if (cache.has(asset.path)) {
        const absolutePath = cache.get(asset.path)
        await fs.unlink(absolutePath)

        cache.delete(asset.path)
      }
    }
  }
}
```

#### `cleanup({ report })`

`cleanup` is called when `tape.dispose()` is called. It has a similar purpose to `onChange` - it is for managing the side effects and cache from a build.

Continuing with the previous example we want to clean up the files after we are done using tape.

```js
const fs = require('fs-extra')

function writeFSPlugin({ buildDir }) {
  return {
    name: 'write-fs',
    async write() {...},
    async onChange() {...},
    async cleanup() {
      await fs.emptyDir(buildDir)
    }
  }
}
```


#### Diagnostic reporting

During every step of the build, plugins can report diagnostic messages using the `report` function.

It takes an object with the following properties:

* type (`String` | defaults to `"error"`) - Must be one of `error`,`warning`, `info`. If it `error`, an error will be thrown.
* message (`String` | defaults to `"An unknown error occurred."`) –
* loc (`Object` | defaults to `null`) – The location in the code that generated this error. If `loc` is provided, `start.line` and `start.column` are required.
* start (`Object` | required)
* line (`Number` | required) - The 1-indexed line of the start of the problem.
* column (`Number` | required) - The 1-indexed column of the start of the problem.
* end (`Object` | defaults to `undefined`)
* line (`Number`) - The 1-indexed line of the end of the problem.
* column (`Number`) - The 1-indexed column of the end of the problem.
* fix (`String` | optional) - The string to replace the given location in order to resolve the problem.

It also had 3 shortcuts for reporting: 
* `report.info(diagnostic)`
* `report.warning(diagnostic)`
* `report.error(diagnostic)`
  
Here we will add an `info` diagnostic report for when the cache missed in our `write-fs` plugin.

```js
const fs = require('fs-extra')

function writeFSPlugin({ buildDir }) {
  return {
    name: 'write-fs',
    async write({ asset, cache, report }) {
      if (cache.has(asset.path)) {
        return  cache.get(asset.path)
      }
  
      // Report the cache missed
      report({
        type: 'info',
        message: 'No cache was found. Writing to file system.'
      })


      const dir = path.join(buildDir, asset.dir)
      const absolutePath = path.join(dir, `${asset.name}${asset.ext}`)

      await fs.ensureDir(dir)
      await fs.write(absolutePath, asset.content)
      cache.set(asset.path, absolutePath)

      return absolutePath;
    }
    async onChange() {...},
    async cleanup() {...}
  }
}
```

## Definitions

Definition of objects used by tape.

### asset

Each asset is an object with the following properties:

* id (`String`) - Unique asset ID.
* ext (`String`) - The extension of the asset.
* content (`String`) - Asset contents.
* embedded (`Boolean`) - Whether or not the asset is embedded.
* source (`Object`) - The original asset data.
* path (`String`) - Path of the asset. Will not be set if `embedded` is `true`.
* dir (`String`) - Directory that contains the asset.
* name (`String`) - Name of the asset. Will not be set if `embedded` is `true`.
* ext (`String`) - The original asset extension.

### file

Each file is represented by an object in a containing object. The key in the containing object should be the file path. In the file object itself there should be a single key named `content` which holds the file contents.

```js
const files = {
  '/index.html': {
    content: '<html>hello world</html>'
  }
}
```

### diagnostic

Each diagnostic is a object that has the following keys:

#### type
> `String` | required

Must be one of `error`, `warning`, `info`

#### source
> `String` | required

Plugin source of the diagnostic. Will be `"internal"` if it came from the tape instance.

#### message
> `String` | required

General explanation of the error.
  
#### path
`String` | defaults to `null`

Path of the file that generated the error. Will be `null` if the diagnostic did not originate from a file.
  
#### loc
`Object` | optional

The location of the source of the diagnostic. If there is a location given, it will contain a start line and column. It may also contain and end line and column.

The `loc` object will have the following keys:
* start (`Object` | required)
* line (`Number`) - The 1-indexed line of the start of the problem.
* column (`Number`) - The 1-indexed column of the start of the problem.
* end (`Object` | optional)
* line (`Number`) - The 1-indexed line of the end of the problem.
* column (`Number`) - The 1-indexed column of the end of the problem.
* fix (`String` | optional) - The string to replace the given location in order to resolve the problem.
  
## Previous art
* https://www.npmjs.com/package/smooshpack
* https://github.com/snowpackjs/snowpack
* https://github.com/parcel-bundler/parcel