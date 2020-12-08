import Tape from "../tape/index.js";
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

  const tape = new Tape(config);
  const results = await tape.build();
  expect(results).toMatchSnapshot();
});

test("html plugin should trim asset paths", async () => {
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

  const tape = new Tape(config);
  const results = await tape.build();
  expect(results).toMatchSnapshot();
});

test("html plugin should collect assets even if there aren't quotes around the attribute value", async () => {
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
  await expect(tape.build()).rejects.toThrow(/my-image\.png/);

  tape.update({ entry: "/should-be-slash.html" });

  await expect(tape.build()).rejects.toThrow(/\//);
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

  const tape = new Tape(config);
  const results = await tape.build();
  expect(results).toMatchSnapshot();
});
