const tape = require('@useparcel/tape')

const manager = tape({
  plugins: [
    // require('@useparcel/tape-css-inline-plugin')
  ],
  entry: '/emails/index.html',
  files: {
    '/emails/index.html': {
      content: `<!DOCTYPE html>
       <html lang="en">
       <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>Document</title>
         <link rel="stylesheet" href="https://example.com/reset.css">
         <style>
          @import '/main.css';
          @import '/another.css';
          body {
            padding: 0;
          }
         </style>
       </head>
       <body>
         
       </body>
       </html>`
    },
    '/main.css': {
      content: `
        @import './reset.css'
        a {color: red;}
      `
    },
    '/reset.css': {
      content: `
        body: { margin: 0; }
      `
    },
    '/another.css': {
      content: `
        body: { margin: 0; }
      `
    },
  }
})

;(async function() {
  block: {
    const { entry, files } = await manager.compile()
    console.log(files[entry])
  }

  await new Promise((r) => setTimeout(r, 10))

  block: {
    const { entry, files } = await manager.update({
      files: {
        // '/emails/index.html': {
        //   content: `hello world`
        // },
        '/reset.css': {
          content: 'body { a: change; }'
        }
        // '/new.css': {
        //   content: 'body { a: change; }'
        // }
      }
    })
    console.log(files[entry])
  }
})();


// /**
//  * a html hot-reloader
//  */