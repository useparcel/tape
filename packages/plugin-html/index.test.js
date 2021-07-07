import { tape } from "../tape/index.ts";
import { html } from "./index.js";

test("html plugin should not collect empty `src` attributes as assets", async () => {
  const config = {
    entry: "/index.html",
    files: {
      "/index.html": {
        content: `
          <img src="" /> 
          <img src= >
        `,
      },
    },
  };

  const results = await tape(config);
  expect(results).toMatchSnapshot();
});

test("html plugin should ignore whitespace", async () => {
  const config = {
    entry: "/index.html",
    files: {
      "/index.html": {
        content: `
          <img src="     my-image.png     " /> 
        `,
      },
      "my-image.png": {
        content: "link to image",
      },
    },
  };

  const results = await tape(config);
  expect(results).toMatchSnapshot();
});

test("html plugin should collect assets even if there aren't quotes around the attribute value", async () => {
  await expect(
    tape({
      entry: "/my-image.html",
      files: {
        "/my-image.html": {
          content: `<img src=my-image.png />`,
        },
        "/should-be-slash.html": {
          content: `<img src= />`,
        },
      },
    })
  ).rejects.toThrow(/my-image\.png/);

  await expect(
    tape({
      entry: "/should-be-slash.html",
      files: {
        "/my-image.html": {
          content: `<img src=my-image.png />`,
        },
        "/should-be-slash.html": {
          content: `<img src= />`,
        },
      },
    })
  ).rejects.toThrow(/\//);
});

test("html plugin can ignore missing assets", async () => {
  const config = {
    entry: "/index.html",
    files: {
      "/index.html": {
        content: `<img src="my-missing-image.png" />`,
      },
    },
    plugins: [[html, { ignoreMissingAssets: true }]],
  };

  const results = await tape(config);
  expect(results).toMatchSnapshot();
});
