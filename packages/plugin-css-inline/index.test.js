import { tape } from "../tape/index.ts";
import { cssInline } from "./index.js";

describe("CSS inline plugin", () => {
  test("should inline the css", async () => {
    const results = await tape({
      entry: "/index.html",
      plugins: [cssInline],
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
          content: "nothing should happen to me",
        },
      },
    });

    expect(results).toMatchSnapshot();
  });
});
