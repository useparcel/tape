import { tape } from "../tape/index.ts";
import { sass } from "./index.js";

describe("sass plugin", () => {
  test("should convert an external sass file to css", async () => {
    const results = await tape({
      entry: "/index.html",
      plugins: [sass],
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <link rel="stylesheet" href="/style.scss">
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
        "/style.scss": {
          content: `
            $my-color: blue;

            body {
              background: $my-color;
            }
          `,
        },
      },
    });

    expect(results).toMatchSnapshot();
  });

  test("should convert embedded sass to css", async () => {
    const results = await tape({
      entry: "/index.html",
      plugins: [sass],
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style type="text/scss">
                  $my-color: blue;

                  body {
                    background: $my-color;
                  }
                </style>
              </head>
              <body>
                body
              </body>
            </html>
          `,
        },
      },
    });

    expect(results).toMatchSnapshot();
  });

  test("should throw an error with invalid sass", async () => {
    await expect(
      tape({
        entry: "/index.html",
        plugins: [sass],
        files: {
          "/index.html": {
            content: `
            <html>
              <head>
                <link rel="stylesheet" href="/style.scss">
              </head>
              <body>
                body
              </body>
            </html>
          `,
          },
          "/style.scss": {
            content: `
            $my-color: blue // missing a semi-colon

            body {
              background: $my-color;
            }
          `,
          },
        },
      })
    ).rejects.toThrow();
  });
});
