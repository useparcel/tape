import { tape } from "../tape/index.ts";
import HTMLPlugin from "./index.js";

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

test("html plugin should ignore whitepscape", async () => {
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

test.skip("html plugin should collect assets even if there aren't quotes around the attribute value", async () => {
  const config = {
    entry: "/my-image.html",
    files: {
      "/my-image.html": {
        content: `<img src=my-image.png />`,
      },
      "/should-be-slash.html": {
        content: `<img src= />`,
      },
    },
  };

  const tape = new Tape(config);
  await expect(tape()).rejects.toThrow(/my-image\.png/);

  tape.update({ entry: "/should-be-slash.html" });

  await expect(tape()).rejects.toThrow(/\//);
});

test("html plugin can ignore missing assets", async () => {
  const config = {
    entry: "/index.html",
    files: {
      "/index.html": {
        content: `<img src="my-missing-image.png" />`,
      },
    },
    plugins: [[HTMLPlugin, { ignoreMissingAssets: true }]],
  };

  const results = await tape(config);
  expect(results).toMatchSnapshot();
});
