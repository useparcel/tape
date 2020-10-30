const Tape = require("./packages/tape");

const tape = new Tape({
  plugins: [
    // require('@useparcel/tape-css-inline-plugin')
  ],
  entry: "/emails/index.html",
  files: {
    "/emails/index.html": {
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
       </html>`,
    },
    "/main.css": {
      content: `
        @import './reset.css'
        a {color: red;}
      `,
    },
    "/reset.css": {
      content: `
        body: { margin: 0; }
      `,
    },
    "/another.css": {
      content: `
        body: { margin: 0; }
      `,
    },
  },
});

(async function () {
  block: {
    const manager = tape.dev();
    manager.on("start", () => {
      console.log("start bundle");
    });
    manager.on("end", ({ entry, isLatest, files }) => {
      console.log("end bundle", files[entry]);
    });

    // console.log((await tape.build()).entry)
    setTimeout(async () => {
      tape.update({
        files: {
          "/emails/index.html": {
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
       </html>`,
          },
        },
      });

      // manager.close()

      //   console.log((await tape.build()).entry)
    }, 200);
  }
})();
