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
      expect(() => new Tape()).toThrow(/entry/);
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
            entry: "invalid-pat>h",
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
        "/not-used.css": {
          content: "this isn't in the dependency tree of the entry file",
        },
      },
    };

    const tape = new Tape(config);

    const results = await tape.build();

    expect(results).toMatchSnapshot();
  });

  test("should change the output when built after an update", async () => {
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

    const results1 = await tape.build();
    expect(results1).toMatchSnapshot();

    tape.update({
      files: {
        "/reset.css": {
          content: `
            html {
              margin: 0;
            }

            body {
              margin: 0;
            }
          `,
        },
      },
    });

    const results2 = await tape.build();
    expect(results2).toMatchSnapshot();
  });

  test("should throw an error with recursive dependencies", async () => {
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
            @import 'style.css'
          `,
        },
      },
    };

    const tape = new Tape(config);

    await expect(tape.build()).rejects.toThrow(/cycle/i);
  });
});

describe("dev", () => {
  test("should work for a complex example that includes a bunch of dependencies and embedded documents", (done) => {
    /**
     * This config has the following important features:
     * - entry file
     * - embedded asset (the style tag)
     * - dependency from entry (/style.css)
     * - dependency from depencency (/reset.css)
     */
    const transformerPlugin = {
      name: "transformerPlugin",
      transform: jest.fn(({ asset }) => asset),
    };
    const config = {
      entry: "/index.html",
      plugins: [transformerPlugin],
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

    const manager = tape.dev();

    manager.on("ready", ({ startedAt, endedAt, ...results }) => {
      expect(results).toMatchSnapshot();
      expect(transformerPlugin.transform).toHaveBeenCalledTimes(4);
      transformerPlugin.transform.mockClear();

      /**
       * Trigger an update
       */
      tape.update({
        files: {
          "/style.css": {
            content: `
              @import 'reset.css';
              @import 'new.css';

              body {
                margin: 0;
              }
            `,
          },
          "/new.css": {
            content: `body {
              new: file;
            }`,
          },
        },
      });
    });

    /**
     * From the update triggered above, we should only retransform 4 out
     * of the 5 assets:
     * - style.css - the file we updated
     * - new.css - the file we created
     * - index.html - the file that depends on style.css
     * - style tag  in index.html - all embedded documents should be processed
     */
    manager.on("end", async ({ startedAt, endedAt, ...results }) => {
      expect(results).toMatchSnapshot();
      expect(transformerPlugin.transform).toHaveBeenCalledTimes(4);
      await manager.close();
      done();
    });

    manager.on("error", console.log);
  });

  // TODO: test out of order results
  // TODO: test error
  // TODO: test close
});

describe("update", () => {
  test("should trigger when creating a new file", async (done) => {
    const tape = new Tape({
      entry: "index.html",
      files: {
        "index.html": {
          content: "test",
        },
      },
    });

    const manager = tape.dev();
    manager.on("update", async (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
      await manager.close();
      done();
    });

    tape.update({
      files: {
        "new-file.css": {
          content: "hello world",
        },
      },
    });
  });

  test("should trigger when creating a new file", async (done) => {
    const tape = new Tape({
      entry: "index.html",
      files: {
        "index.html": {
          content: "test",
        },
      },
    });

    const manager = tape.dev();
    manager.on("update", async (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
      await manager.close();
      done();
    });

    tape.update({
      files: {
        "new-file.css": {
          content: "hello world",
        },
      },
    });
  });

  test("should trigger when updating a file", async (done) => {
    const tape = new Tape({
      entry: "index.html",
      files: {
        "index.html": {
          content: "test",
        },
      },
    });

    const manager = tape.dev();
    manager.on("update", async (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
      await manager.close();
      done();
    });

    tape.update({
      files: {
        "index.html": {
          content: "hello world",
        },
      },
    });
  });

  test("should trigger when deleting a file", async (done) => {
    const tape = new Tape({
      entry: "index.html",
      files: {
        "index.html": {
          content: "test",
        },
        "delete.me": {
          content: "ok",
        },
      },
    });

    const manager = tape.dev();
    manager.on("update", async (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
      await manager.close();
      done();
    });

    tape.update({
      files: {
        "delete.me": null,
      },
    });
  });

  test("should trigger when entry file is changed", async (done) => {
    const tape = new Tape({
      entry: "index.html",
      files: {
        "index.html": {
          content: "test",
        },
        "another.html": {
          content: "ok",
        },
      },
    });

    const manager = tape.dev();
    manager.on("update", async (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
      await manager.close();
      done();
    });

    tape.update({
      entry: "another.html",
    });
  });

  test("shouldn't trigger when there is an empty update", async () => {
    const tape = new Tape(validConfig);
    const manager = tape.dev();
    const onUpdate = jest.fn();
    manager.on("update", onUpdate);

    tape.update();
    expect(onUpdate).toHaveBeenCalledTimes(0);

    tape.update({});
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("shouldn't trigger when there aren't any content changes", async () => {
    const tape = new Tape(validConfig);
    const manager = tape.dev();
    const onUpdate = jest.fn();
    manager.on("update", onUpdate);

    tape.update(validConfig);
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });
});

// TODO: duplicate all tests for dev mode too?
describe("plugin system", () => {
  test("[build] runs all transform functions", async () => {
    // run only on txt (0 times)
    const transformPlugin1 = {
      name: "transformPlugin1",
      resolve: { input: [".txt"], output: ".txt" },
      transform: jest.fn(({ asset }) => asset),
    };

    // run only on html (1 time)
    const transformPlugin2 = {
      name: "transformPlugin2",
      resolve: { input: [".html"], output: ".html" },
      transform: jest.fn(({ asset }) => asset),
    };

    // run on all (3 times)
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

  test("[dev] should trigger onChange on dependents and embedded dependencies", async (done) => {
    const onChangePlugin = {
      name: "onChangePlugin",
      onChange: jest.fn(),
    };

    const tape = new Tape({
      entry: "index.html",
      plugins: [onChangePlugin],
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
            @import 'not-triggered.css';

            body {
              margin: 0;
            }
          `,
        },
        "/not-triggered.css": {
          content: `I am not triggered since I'm not dependent on reset.css`,
        },
      },
    });

    const manager = tape.dev();

    manager.on("ready", () => {
      tape.update({
        files: {
          "/reset.css": {
            content: `updated`,
          },
        },
      });
    });

    manager.on("update", (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
    });

    manager.on("end", async () => {
      expect(onChangePlugin.onChange).toHaveBeenCalledTimes(4);
      await manager.close();
      done();
    });
  });
});
