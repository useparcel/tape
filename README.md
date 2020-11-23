# Tape

HTML build tool that runs entirely in the browser 🎁


## Key Features
* Works with a lightweight file interface
* Discovers and compiles dependencies
* Rebuilds the minimum number of files on updates
* Runs in the browser and server


## Example

Let's walk through how to use tape. We are going to create a new tape instance and configure it to use the css inlining plugin. We are also going to give it 2 files, and tell it that `index.html` is the entry file where it should start looking for dependencies.

We can get production results either by calling `build()`. We can also call `dev()` to get a development manager where we can wait for the `ready` event when it finishes with the first compilation.

```js
import Tape from '@useparcel/tape'
import cssInline from '@useparcel/tape-css-inline'

const tape = new Tape({
  entry: '/index.html',
  plugins: [
    [cssInline, { applyStyleTags: false }]
  ],
  files: {
    '/index.html': {
      content: `<!DOCTYPE html>
        <html>
        <head>
          <title>Hello world</title>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
        
        </body>
      </html>
      `
    }
    '/style.css': {
      content: `
        body {
          background: blue;
        }
      `
    }
  }
})

// get production results
const results = await tape.build()

// run tape in development mode
const manager = await tape.dev()

// when a new build starts
manager.on('start', ({ startedAt }) => {
})

// when a new build finishes
manager.on('end', (results) => {
})

// when there is an error
manager.on('error', ({ error }) => {
})
```

## API

### Tape()

The `Tape()` constructor create a new `Tape` object.


### Constructor

```js
const tape = new Tape({ entry, files, plugins })
```

#### `entry`
> `String` | required

The entry file to be built. It must be a valid file given to the `files` object.

#### `files`
> `Object` | required

An object of files. Each entry key should be the file path and each value should be an object with an entry with a key of `content` and contain the content of the file.

```js
const files = {
  '/index.html': {
    content: '<html>hello world</html>'
  }
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

### Methods

#### build() => Promise<Object>

Starting with `entry`, this builds and returns the files. 

* `Tape` constructor
* `tape.build` - One time build, doesn't use cache.
* `tape.update` - Updates a file.
* `tape.dev` - Creates a new dev manager.
* `manager.on` - Added an event listener. See events below.
`manager.close` - Closes the dev worker.


**Return value**
Returns a Promise which resolves an object with the following keys:
* `entry` (`String`) - Entry path for outputted files 
* `files` (`Object`) - Contains built file objects. See [file definition](TODO) for more.
* `diagnostics` (`Array`) - Contains a list of diagnostic messages. [See diagnostic definition](TODO) for more.

**Error handling**
It will reject the promise if it runs into a fatal error. Otherwise all errors will be returned inside the `diagnostics` array.

**Example**
```js
try {
  const { entry, files, diagnostics } = await tape.build()

  console.log(`Here is the output:\n${files[entry]}`)

  console.log(`You should probably fix these problems: ${JSON.stringify(diagnostics, null, 2)}`)
}
catch(error) {
  console.log(`The build failed. You *must fix this problem*:`, error)
}
```

#### update({ entry, files, plugins }) => undefined

Updates the tape configuration. It accepts the same options as the tape constructor.

**Create or update a file**
To create or update a file, pass in the file object to the `update` call.

```js
tape.update({
  files: {
    'index.html': {
      content: 'my new value'
    }
  }
})
```

**Delete a file**
To delete a file, set it's value in the `files` object to `null` or an empty object (`{}`).

```js
tape.update({
  files: {
    'delete-me.html': {},
    'delete-me-too.html': null
  }
})
```

**Plugins**
When calling `update` with `plugins`, the given plugins completely replace the existing ones.

```js
// remove all plugins
tape.update({ plugins: [] })
```

If there are any open [development managers](TODO), a rebuild is triggered if any of the following happen: 
* The `entry` changes
* A file that is the entry or depended upon by the entry is changed
* `plugins` is set

If the update results in none of the previous conditions, no rebuild is triggered.

#### dev() => manager

Starts a development manager. It watches for updates and automatically rebuilds only the necessary files. When called, it returns a `manager`.

```js
const tape = new Tape({
  entry: 'index.html',
  files: {
    'index.html': {
      content: 'my content'
    }
  }
})

const manager = tape.dev()
```

## Development manager

Development manager for tape. Generated by the `tape.dev()` method.

### Methods

#### on(event, (data) => {}) => undefined

Adds an event listener. See [events](TODO) for more.

#### close() => Promise<Object>

Removes all event listeners and cleans up the tape instance. Call this when you no longer want to rebuild when there are updates.

### Events

The following are events emitted:

#### `start`

Emitted when a new build starts. Emits an object with the property `startedAt`, containing a `Date`.

**Example**

```js
manager.on('start', ({ startedAt }) => {
  // build started
})
```

#### `end` 

Emits the same object as build with 3 additional properties:

* `startedAt` (`Date`) - When the build started.
* `endedAt` (`Date`) - When the build ended.
* `isLatest` (`Date`) - Whether this is the most recent build to complete. 

**Example:**

```js
manager.on('end', ({ entry, files, diagnostics, startedAt, endedAt, isLatest }) => {
  // do something here
})
```

## Plugins

### Lifecycle

Each build goes through the following lifecycle:

* Transforming
* Resolving
* Optimizing
* Writing

During the **transforming** step, all assets are loaded, converted into usable types (i.e. MJML converted HTML), and added to a dependency graph. Inline assets such as CSS in `<style/>` tag are extracted here.

Next, dependencies are **resolved**. Here inline assets are re-inserted and dependency references are replaced with their final output path.

After each file is resolved, it can be **optimized**. This can be any modification of the final content from HTML minification to CSS inlining.

Lastly, the files are **written** to some output. For example: a target output could be the file system, an in-memory object, a [series of object URLs](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL).

Plugins can hook into each step of the lifecycle.

### Building a plugin

Each plugin is a function that accepts a config object and returns an object with the following plugin structure:

* name (`String` | `required`) - The unique name of the plugin.
* exts (`Array` | `optional`) - An array of extensions that the plugin should be run against. 
* transform (`Function` | `optional`)
* resolve (`Function` | `optional`)
* optimize (`Function` | `optional`)
* write (`Function` | `optional`)
* onChange (`Function` | `optional`)

```js
function myTapePlugin(config) {
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
 
#### `transform({ asset, addDependency, env, report, cache })`

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
        content:  pug.render(asset.content);
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
const STYLE_REGEX = /^(\s*)style(\n\1  .*)*/g

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
      while ((match = STYLE_REGEX.exec(asset.content))) {
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
          content:  pug.render(asset.content);
        },
        ...assets
      ] 
    }
  }
}
```

#### `resolve({ asset, resolveAsset, getAssetContent, env, report, cache })`

After all transformations are done, `resolve` should reinsert the processed embedded assets and replace the original references to dependencies.

Odds are you should not be using this method since HTML and CSS are already resolved.

For an example, check out the [HTML plugin](https://github.com/useparcel/tape/blob/main/packages/plugin-html/index.js#L23).

#### `optimize({ asset, resolveAsset, getAssetContent, env, report, cache })`

`optimize` is similar to transformer in that it arbitrarily modifies the file contents however it runs after paths have already been resolved, right before the file is written.

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

#### `write({ asset, resolveAsset, getAssetContent, env, report, cache })`

The `write` function should output the file contents to the target. Unlike all the other plugin methods only one plugin with a `write` method will be run for each file.

The function should return the absolute path to the file.

Below we will write the files to the file system. After each write save the absolute path to the cache so on the next build we don't have to rebuild it unless there is a change.

```js
const fs = require('fs-extra')
const path = require('path')

function writeFSPlugin({ buildDir = '.tape' }) {
  return {
    name: 'write-fs',

    async write({ asset, cache }) {
      if (cache.has(asset.path)) {
        return cache.get(asset.path)
      }

      const dir = path.join(buildDir, asset.source.dir)
      const absolutePath = path.join(dir, `${asset.source.name}${asset.ext}`)

      await fs.ensureDir(dir)
      await fs.write(absolutePath, asset.content)

      cache.set(asset.path, absolutePath)

      return absolutePath;
    }
  }
}
```

#### `onChange({ asset, env, report, cache })`

`onChange` is only called in [dev mode](TODO) when a file is changed and a rebuild is triggered.

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


#### `cleanup({ env, report })` 

`cleanup` is called after dev mode is stopped or after `build()` has completed. It has a similar purpose to `onChange` - it is for cleaning up after the build.

Continuing with the previous example we want to clean up the files after we are done in dev mode.

```js
const fs = require('fs-extra')

function writeFSPlugin({ buildDir }) {
  return {
    name: 'write-fs',
    async write() {...},
    async onChange() {...},
    async cleanup({ env }) {
      if (env === 'development') {
        await fs.emptyDir(buildDir)
      }
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


Here we will add an `info` diagnostic report for when the cache missed in our `write-fs` plugin. 
```js
const fs = require('fs-extra')

function writeFSPlugin({ buildDir }) {
  return {
    name: 'write-fs',
    async write({ asset, cache, report }) {
      if (cache.has(asset.path)) {
        return cache.get(asset.path)
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
    async cleanup({ env }) {...}
  }
}
```

### Definitions

Definition of objects used by tape.

#### asset

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

#### file

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

Must be one of `error`,`warning`, `info`

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

The `loc` object will have the following keys
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