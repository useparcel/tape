import Tape from "../tape/index.js";
import SassPlugin from "./index.js";

describe("SassPlugin", () => {
  test("should convert an external sass file to css", async () => {
    const tape = new Tape({
      entry: "/index.html",
      plugins: [SassPlugin],
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

    const results = await tape.build();
    expect(results).toMatchSnapshot();
  });

  test("should convert embedded sass to css", async () => {
    const tape = new Tape({
      entry: "/index.html",
      plugins: [SassPlugin],
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

    const results = await tape.build();
    expect(results).toMatchSnapshot();
  });
});
