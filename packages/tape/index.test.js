import Tape from "./index.js";

const validConfig = {
  entry: "/index.html",
  files: {
    "/index.html": {
      content: "test",
    },
  },
};

describe("constructor", () => {
  test("should work with valid config", () => {
    expect(() => new Tape(validConfig)).toBeTruthy();
  });

  describe("validation", () => {
    test("should catch missing entry", () => {
      expect(() => new Tape({})).toThrow(/entry/);
    });

    test("should catch missing files", () => {
      expect(
        () =>
          new Tape({
            entry: "/index.html",
          })
      ).toThrow(/files/);
    });

    test("should catch an invalid entry path", () => {
      expect(
        () =>
          new Tape({
            entry: "invalid-pat!h",
            files: {
              "/index.html": {
                content: "test",
              },
            },
          })
      ).toThrow(/invalid/);
    });

    test("should catch an invalid file path", () => {
      expect(
        () =>
          new Tape({
            entry: "valid-path",
            files: {
              "/ind*ex.html": {
                content: "test",
              },
            },
          })
      ).toThrow(/invalid/);
    });

    test("should catch a file with a bad key", () => {
      expect(
        () =>
          new Tape({
            entry: "valid-path",
            files: {
              "/index.html": {
                bad: "key",
              },
            },
          })
      ).toThrow(/invalid/);
    });

    test("should allow empty files", () => {
      expect(
        () =>
          new Tape({
            entry: "valid-path",
            files: {
              "/index.html": {},
              "/another.html": null,
            },
          })
      ).toBeTruthy();
    });

    test("should make sure all plugin are objects", () => {
      expect(
        () =>
          new Tape({
            ...validConfig,
            plugins: [null],
          })
      ).toThrow(/plain object/);
    });

    test("should make sure all plugin have names", () => {
      expect(
        () =>
          new Tape({
            ...validConfig,
            plugins: [{}],
          })
      ).toThrow(/name/);
    });

    test("should make sure all plugin names are unique", () => {
      expect(
        () =>
          new Tape({
            ...validConfig,
            plugins: [
              { name: "pluginName" },
              { name: "aDifferentPluginName" },
              { name: "pluginName" },
            ],
          })
      ).toThrow(/pluginName/);
    });
  });
});

describe("build", () => {
  test("should throw an error when entry path does not exist", async () => {
    const tape = new Tape({
      ...validConfig,
      entry: "na.html",
    });

    await expect(tape.build()).rejects.toThrow(/not found/);
  });

  test("should throw an error when a dependency does not exist", async () => {
    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: '<link href="/style.css"/>',
        },
      },
    });

    await expect(tape.build()).rejects.toThrow(/not found/);
  });

  test("should work for a complex example that includes a bunch of dependencies and embedded documents", async () => {
    /**
     * This config has the following important features:
     * - entry file
     * - embedded asset (the style tag)
     * - dependency from entry (/style.css)
     * - dependency from depencency (/reset.css)
     */
    const config = {
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            <html>
              <head>
                <style>
                  body.this-is-an-embedded-asset {
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
            @import 'reset.css'
          `,
        },
        "/reset.css": {
          content: `
            body {
              margin: 0;
            }
          `,
        },
      },
    };

    const tape = new Tape(config);

    const results = await tape.build();

    expect(results).toMatchSnapshot();
  });

  // TODO: build after update
});

describe("dev", () => {
  // TODO: update
});

// TODO: duplicate all tests for dev mode too
describe("plugin system", () => {
  test("[build] runs all transform functions", async () => {
    // run only on txt
    const transformPlugin1 = {
      name: "transformPlugin1",
      resolve: { input: [".txt"], output: ".txt" },
      transform: jest.fn(({ asset }) => asset),
    };

    // run only on html
    const transformPlugin2 = {
      name: "transformPlugin2",
      resolve: { input: [".html"], output: ".html" },
      transform: jest.fn(({ asset }) => asset),
    };

    // run on all
    const transformPlugin3 = {
      name: "transformPlugin3",
      transform: jest.fn(({ asset }) => asset),
    };

    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            <style>
              body.this-is-an-embedded-asset {
                margin: 0;
              }
            </style>
            <link rel="stylesheet" href="/style.css">
          `,
        },
        "/style.css": {
          content: "body { margin: 0; }",
        },
      },
      plugins: [transformPlugin1, transformPlugin2, transformPlugin3],
    });
    await tape.build();

    expect(transformPlugin1.transform).toHaveBeenCalledTimes(0);
    expect(transformPlugin2.transform).toHaveBeenCalledTimes(1);
    expect(transformPlugin3.transform).toHaveBeenCalledTimes(3);
  });

  test("[build] runs just the first package plugin (no resolve)", async () => {
    const packagePlugin1 = {
      name: "packagePlugin1",
      package: jest.fn(({ asset }) => asset),
    };

    const packagePlugin2 = {
      name: "packagePlugin2",
      package: jest.fn(({ asset }) => asset),
    };

    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: '<link rel="stylesheet" href="/text.txt">',
        },
        "/text.txt": {
          content: "test",
        },
      },
      plugins: [packagePlugin1, packagePlugin2],
    });
    await tape.build();

    expect(packagePlugin1.package).toHaveBeenCalled();
    expect(packagePlugin2.package).toHaveBeenCalledTimes(0);
  });

  test("[build] runs just the first package plugin (with resolve)", async () => {
    const packagePlugin1 = {
      name: "packagePlugin1",
      resolve: { input: [".txt"], output: ".txt" },
      package: jest.fn(({ asset }) => asset),
    };

    const packagePlugin2 = {
      name: "packagePlugin2",
      resolve: { input: [".another-ext"], output: ".another-ext" },
      package: jest.fn(({ asset }) => asset),
    };

    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: '<link rel="stylesheet" href="/text.txt">',
        },
        "/text.txt": {
          content: "test",
        },
      },
      plugins: [packagePlugin2, packagePlugin1],
    });
    await tape.build();

    expect(packagePlugin1.package).toHaveBeenCalled();
    expect(packagePlugin2.package).toHaveBeenCalledTimes(0);
  });

  test("[build] runs all optimizer functions", async () => {
    const optimizerPlugin1 = {
      name: "optimizerPlugin1",
      optimize: jest.fn(({ asset }) => asset),
    };

    // run only for matching assets
    const optimizerPlugin2 = {
      name: "optimizerPlugin2",
      resolve: { input: [".css"], output: ".css" },
      optimize: jest.fn(({ asset }) => asset),
    };

    const tape = new Tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: '<link rel="stylesheet" href="/style.css">',
        },
        "/style.css": {
          content: "body { margin: 0; }",
        },
      },
      plugins: [optimizerPlugin1, optimizerPlugin2],
    });
    await tape.build();

    expect(optimizerPlugin1.optimize).toHaveBeenCalledTimes(2);
    expect(optimizerPlugin2.optimize).toHaveBeenCalledTimes(1);
  });

  test("[build] runs just the first write plugin", async () => {
    const writePlugin1 = {
      name: "writePlugin1",
      write: jest.fn(),
    };

    const writePlugin2 = {
      name: "writePlugin2",
      write: jest.fn(),
    };

    const tape = new Tape({
      ...validConfig,
      plugins: [writePlugin1, writePlugin2],
    });
    await tape.build();

    expect(writePlugin1.write).toHaveBeenCalled();
    expect(writePlugin2.write).toHaveBeenCalledTimes(0);
  });

  test("[build] runs all clean up functions", async () => {
    const cleanupPlugin1 = {
      name: "cleanupPlugin1",
      cleanup: jest.fn(),
    };

    const cleanupPlugin2 = {
      name: "cleanupPlugin2",
      cleanup: jest.fn(),
    };

    const tape = new Tape({
      ...validConfig,
      plugins: [cleanupPlugin1, cleanupPlugin2],
    });
    await tape.build();

    expect(cleanupPlugin1.cleanup).toHaveBeenCalled();
    expect(cleanupPlugin2.cleanup).toHaveBeenCalled();
  });

  test("[dev] runs update when file changes", async () => {
    // TODO: file, embedded asset, and parent
  });
});
