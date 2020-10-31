import Tape from "../tape/index.js";

describe("CSSPlugin", () => {
  test("should gather imported urls as dependencies", async () => {
    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style>
                  body {
                    background: blue;
                  }
                </style>
                <link rel="stylesheet" href="/style.css">
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
        "/style.css": {
          content: `
            @import '/reset.css';
          `,
        },
      },
    });

    await expect(tape.build()).rejects.toThrow(/reset\.css/);
  });

  test("should gather url('url-in-here') as dependencies", async () => {
    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style>
                  body {
                    background-image: url('found-image.gif'), url(missing-image.gif);
                  }
                </style>
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
        "/found-image.gif": {
          content: "ok",
        },
      },
    });

    await expect(tape.build()).rejects.toThrow(/missing-image\.gif/);
  });

  test("should ignore absolute urls", async () => {
    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style>
                  body {
                    background: url('https://useparcel.com/background.png');
                  }
                </style>
                <link rel="stylesheet" href="/style.css">
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
        "/style.css": {
          content: `
            @import 'https://useparcel.com/reset.css';
          `,
        },
      },
    });

    const results = await tape.build();
    expect(results).toMatchSnapshot();
  });

  test("should for work for this complex example of all the things", async () => {
    /**
     * This changes the output urls. Otherwise the input and output look
     * the same and that isn't a very good test.
     */
    const writeDifferentUrl = {
      name: "writeDifferentUrl",
      write({ asset }) {
        return `different-base${asset.path.replace(
          new RegExp(`${asset.originalExt}$`),
          asset.ext
        )}`;
      },
    };

    /**
     * This config has the following important features:
     * - embedded css asset (the style tag)
     * - external css asset
     * - @import 'absolute url'
     * - @import 'relative url'
     * - url('absolute url')
     * - url('relative url')
     */
    const tape = new Tape({
      entry: "/index.html",
      plugins: [writeDifferentUrl],
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style>
                  body {
                    background: url('https://useparcel.com/background.png');
                  }

                  div {
                    background-image: url('found-image.gif');
                  }

                  @import '/style.css';
                </style>
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
        "/style.css": {
          content: `
            @import 'https://useparcel.com/reset.css';
          `,
        },
        "/found-image.gif": {
          content: "ok",
        },
      },
    });

    const results = await tape.build();
    expect(results).toMatchSnapshot();
  });
});
