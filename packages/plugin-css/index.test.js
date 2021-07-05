import { tape } from "../tape/index.js";
import CSSPlugin from "./index.js";

describe("CSSPlugin", () => {
  test("should gather imported urls as dependencies", async () => {
    await expect(
      tape({
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
      })
    ).rejects.toThrow(/reset\.css/);
  });

  test("should gather url('url-in-here') as dependencies", async () => {
    await expect(
      tape({
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
      })
    ).rejects.toThrow(/missing-image\.gif/);
  });

  test("should ignore absolute urls", async () => {
    const results = await tape({
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
    expect(results).toMatchSnapshot();
  });

  test("should for work for this complex example of all the things", async () => {
    /**
     * This changes the output urls. Otherwise the input and output look
     * the same and that isn't a very good test.
     */
    const writeDifferentUrl = () => ({
      name: "write-different-url",
      write({ asset }) {
        return `different-base${asset.source.path.replace(
          new RegExp(`${asset.source.ext}$`),
          asset.ext
        )}`;
      },
    });

    /**
     * This config has the following important features:
     * - embedded css asset (the style tag)
     * - external css asset
     * - @import 'absolute url'
     * - @import 'relative url'
     * - url('absolute url')
     * - url('relative url')
     */
    const results = await tape({
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

    expect(results).toMatchSnapshot();
  });

  test("can ignore missing assets", async () => {
    const config = {
      entry: "/index.css",
      files: {
        "/index.css": {
          content: `@import 'missing-file.css'`,
        },
      },
      plugins: [[CSSPlugin, { ignoreMissingAssets: true }]],
    };

    const results = await tape(config);
    expect(results).toMatchSnapshot();
  });
});
