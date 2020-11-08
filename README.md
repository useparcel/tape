**Important note:** This is in it's very early days and you probably don't want to use it

# Tape

Tape is an HTML build tool that runs entirely in the browser.


## Key Features
* Works with a lightweight file interface
* Discovers and compiles dependencies
* Rebuilds the minimum number of files on updates


## Example

Let's walk through how to use tape. We are going to create a new tape instance and configure it to use the css inlining plugin. We are also going to give it 2 files, and tell it that `index.html` is the entry file where it should start looking for dependencies.

We can get production results either by calling `build()`. We can also call `dev()` to get a development manager where we can wait for the `ready` event when it finishes with the first compilation.

```js
import Tape from '@useparcel/tape'
import cssInline from '@useparce/plugin-css-inline'

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

// when dev mode is ready
manager.on('ready', (results) => {
})

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

* `Tape` constructor
* `tape.build` - One time build, doesn't use cache.
* `tape.update` - Updates a file.
* `tape.dev` - Creates a new dev manager.
* `manager.on` - Added an event listener. See events below.
`manager.close` - Closes the dev worker.

### Events

* `*` - Listens to all events
* `init` - starting dev setup
* `ready` - dev set up complte
* `start` - dev build started
* `end` - dev build complete


### Lifecycle

```
transform > package > optimize > write
```

## Plugins

### Building a plugin

### Previous art
* https://www.npmjs.com/package/smooshpack
* https://github.com/snowpackjs/snowpack
* https://github.com/parcel-bundler/parcel