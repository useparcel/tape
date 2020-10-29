const tape = require('..')()

const manager = tape('/emails/index.html', {
  files: {
    '/reset.scss': {
      content: `body {margin: 0;}`
    },
    '/emails/index.html': {
      content: `<!DOCTYPE html>
 <html lang="en">
 <head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>Document</title>
   <link rel="stylesheet" href="/reset.scss">
   <style>
    body {
      padding: 0;
    }
   </style>
 </head>
 <body>
   
 </body>
 </html>`
    }
  }
})

;(async function() {
  console.log(await manager.compile())
})();


// const tape = require('tape')({
//   plugins: []
// })

// const files = {
//   'index.html': {
//     content: `<!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Document</title>
// </head>
// <body>
//   ok
// </body>
// </html>`
//   }
// }


// const manager = tape('index.html', {
//   files,
// })



// const { entry, files } = manager.update()



// /**
//  * tape - a html-focused bundler with support for custom resolution, loaders, and transformers
//  */

// /**
//  * a html hot-reloader
//  */