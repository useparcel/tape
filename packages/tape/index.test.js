import { tape } from "./index.ts";

const validConfig = {
  entry: "/index.html",
  files: {
    "/index.html": {
      content: "test",
    },
  },
};

describe("validation", () => {
  test("should work with valid config", () => {
    expect(() => tape(validConfig)).toBeTruthy();
  });

  describe("validation", () => {
    test("should catch missing entry", () => {
      expect(() => tape()).toThrow(/entry/);
    });

    test("should catch missing files", () => {
      expect(() =>
        tape({
          entry: "/index.html",
        })
      ).toThrow(/files/);
    });

    test("should catch an invalid entry path", () => {
      expect(() =>
        tape({
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
      expect(() =>
        tape({
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
      expect(() =>
        tape({
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
      expect(() =>
        tape({
          entry: "valid-path",
          files: {
            "/index.html": {},
            "/another.html": null,
          },
        })
      ).toBeTruthy();
    });

    test("should make sure all plugins are functions", () => {
      expect(() =>
        tape({
          ...validConfig,
          plugins: [null],
        })
      ).toThrow(/invalid plugin/i);
    });

    test("should make sure all plugins return objects", () => {
      expect(() =>
        tape({
          ...validConfig,
          plugins: [() => "woops"],
        })
      ).toThrow(/invalid plugin/i);
    });

    test("should make sure all plugins have names", () => {
      expect(() =>
        tape({
          ...validConfig,
          plugins: [() => ({})],
        })
      ).toThrow(/name/);
    });

    test("should make sure all plugin names are unique", () => {
      expect(() =>
        tape({
          ...validConfig,
          plugins: [
            () => ({ name: "pluginName" }),
            () => ({ name: "aDifferentPluginName" }),
            () => ({ name: "pluginName" }),
          ],
        })
      ).toThrow(/pluginName/);
    });
  });
});

describe("build", () => {
  test("should throw an error when entry path does not exist", async () => {
    await expect(
      tape({
        ...validConfig,
        entry: "na.html",
      })
    ).rejects.toThrow(/not found/);
  });

  test("should throw an error when a dependency does not exist", async () => {
    await expect(
      tape({
        entry: "/index.html",
        files: {
          "/index.html": {
            content: '<link href="/style.css"/>',
          },
        },
      })
    ).rejects.toThrow(/not found/);
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

    const results = await tape(config);

    expect(results).toMatchSnapshot();
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

    await expect(tape(config)).rejects.toThrow(/cycle/i);
  });

  test("should work with async file loader", async () => {
    /**
     * This config has the following important features:
     * - entry file
     * - embedded asset (the style tag)
     * - dependency from entry (/style.css)
     * - dependency from depencency (/reset.css)
     */
    const files = {
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
    };

    const config = {
      entry: "/index.html",
      files: function (path) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(files[path]), 500);
        });
      },
    };

    const results = await tape(config);

    expect(results).toMatchSnapshot();
  });
});

describe.skip("dev", () => {
  test("should work for a complex example that includes a bunch of dependencies and embedded documents", (done) => {
    /**
     * This config has the following important features:
     * - entry file
     * - embedded asset (the style tag)
     * - dependency from entry (/style.css)
     * - dependency from depencency (/reset.css)
     */
    const transform = jest.fn(({ asset }) => asset);
    const transformerPlugin = () => ({
      name: "transformerPlugin",
      transform: transform,
    });
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

    manager.once("end", ({ startedAt, endedAt, ...results }) => {
      expect(results).toMatchSnapshot();
      expect(transform).toHaveBeenCalledTimes(4);
      transform.mockClear();

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

      /**
       * From the update triggered above, we should only retransform 4 out
       * of the 5 assets:
       * - style.css - the file we updated
       * - new.css - the file we created
       * - index.html - the file that depends on style.css
       * - style tag  in index.html - all embedded documents should be processed
       */
      manager.once("end", async ({ startedAt, endedAt, ...results }) => {
        expect(results).toMatchSnapshot();
        expect(transform).toHaveBeenCalledTimes(4);
        await manager.close();
        done();
      });
    });

    manager.on("error", console.log);
  });

  test("should succeed, then throw an error, then succeed again", (done) => {
    const transform = jest.fn(({ asset }) => {
      if (asset.source.path.includes("error")) {
        throw new Error("failed!");
      }
      return asset;
    });
    const transformerPlugin = () => ({
      name: "transformerPlugin",
      transform: transform,
    });

    const config = {
      entry: "/succeed1.html",
      plugins: [transformerPlugin],
      files: {
        "/succeed1.html": { content: `succeed` },
        "/error.html": { content: `error` },
        "/succeed2.html": { content: `succeed` },
      },
    };

    const tape = new Tape(config);

    const manager = tape.dev();

    manager.once("end", () => {
      expect(transform).toHaveBeenCalledTimes(1);
      transform.mockClear();
      tape.update({ entry: "/error.html" });

      manager.once("error", () => {
        expect(transform).toHaveBeenCalledTimes(1);
        transform.mockClear();

        tape.update({ entry: "/succeed2.html" });

        manager.once("end", () => {
          expect(transform).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  // TODO: test out of order results
  // TODO: test error
  // TODO: test close
});

describe.skip("update", () => {
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

describe("plugin system", () => {
  test("loads plugins with the given config", async () => {
    // run only on txt (0 times)
    const plugin = jest.fn(() => ({
      name: "ok-plugin",
    }));

    await tape({
      ...validConfig,
      plugins: [[plugin, "config goes here"]],
    });

    expect(plugin).toHaveBeenCalledWith("config goes here");
  });

  test("runs all transform functions", async () => {
    // run only on txt (0 times)
    const transform1 = jest.fn(({ asset }) => asset);
    const transformPlugin1 = () => ({
      name: "transformPlugin1",
      exts: [".txt"],
      transform: transform1,
    });

    // run only on html (1 time)
    const transform2 = jest.fn(({ asset }) => asset);
    const transformPlugin2 = () => ({
      name: "transformPlugin2",
      exts: [".html"],
      transform: transform2,
    });

    // run on all (3 times)
    const transform3 = jest.fn(({ asset }) => asset);
    const transformPlugin3 = () => ({
      name: "transformPlugin3",
      transform: transform3,
    });

    await tape({
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

    expect(transform1).toHaveBeenCalledTimes(0);
    expect(transform2).toHaveBeenCalledTimes(1);
    expect(transform3).toHaveBeenCalledTimes(3);
  });

  test("runs all package plugins (no exts)", async () => {
    const package1 = jest.fn(({ asset }) => asset);
    const packagePlugin1 = () => ({
      name: "packagePlugin1",
      package: package1,
    });

    const package2 = jest.fn(({ asset }) => asset);
    const packagePlugin2 = () => ({
      name: "packagePlugin2",
      package: package2,
    });

    await tape({
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

    expect(package1).toHaveBeenCalledTimes(2);
    expect(package2).toHaveBeenCalledTimes(2);
  });

  test("runs just the first package plugin (with exts)", async () => {
    const package1 = jest.fn(({ asset }) => asset);
    const packagePlugin1 = () => ({
      name: "packagePlugin1",
      exts: [".txt"],
      package: package1,
    });

    const package2 = jest.fn(({ asset }) => asset);
    const packagePlugin2 = () => ({
      name: "packagePlugin2",
      package: package2,
    });

    await tape({
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

    expect(package1).toHaveBeenCalledTimes(1);
    expect(package2).toHaveBeenCalledTimes(2);
  });

  test("runs all optimizer functions", async () => {
    const optimizer1 = jest.fn(({ asset }) => asset);
    const optimizerPlugin1 = () => ({
      name: "optimizerPlugin1",
      optimize: optimizer1,
    });

    // run only for matching assets
    const optimizer2 = jest.fn(({ asset }) => asset);
    const optimizerPlugin2 = () => ({
      name: "optimizerPlugin2",
      exts: [".css"],
      optimize: optimizer2,
    });

    await tape({
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

    expect(optimizer1).toHaveBeenCalledTimes(2);
    expect(optimizer2).toHaveBeenCalledTimes(1);
  });

  test("runs just the first write plugin", async () => {
    const write1 = jest.fn();
    const writePlugin1 = () => ({
      name: "writePlugin1",
      write: write1,
    });

    const write2 = jest.fn();
    const writePlugin2 = () => ({
      name: "writePlugin2",
      write: write2,
    });

    await tape({
      ...validConfig,
      plugins: [writePlugin1, writePlugin2],
    });

    expect(write1).toHaveBeenCalled();
    expect(write2).toHaveBeenCalledTimes(0);
  });

  test("should not run clean up functions", async () => {
    const cleanup1 = jest.fn();
    const cleanupPlugin1 = () => ({
      name: "cleanupPlugin1",
      cleanup: cleanup1,
    });
    const cleanup2 = jest.fn();
    const cleanupPlugin2 = () => ({
      name: "cleanupPlugin2",
      cleanup: cleanup2,
    });

    await tape({
      ...validConfig,
      plugins: [cleanupPlugin1, cleanupPlugin2],
    });

    expect(cleanup1).toHaveBeenCalledTimes(0);
    expect(cleanup2).toHaveBeenCalledTimes(0);
  });

  test("should run clean up functions on dispose", async () => {
    const cleanup1 = jest.fn();
    const cleanupPlugin1 = () => ({
      name: "cleanupPlugin1",
      cleanup: cleanup1,
    });
    const cleanup2 = jest.fn();
    const cleanupPlugin2 = () => ({
      name: "cleanupPlugin2",
      cleanup: cleanup2,
    });

    await tape.dispose({
      ...validConfig,
      plugins: [cleanupPlugin1, cleanupPlugin2],
    });

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  test("returns all diagnostics", async () => {
    function reportStage(stage) {
      return ({ asset, report }) => {
        report({
          type: "warning",
          message: `In stage: ${stage}`,
        });

        report.info({
          message: `In stage using shortcut: ${stage}`,
        });
        return asset;
      };
    }
    const reportStages = () => ({
      name: "reportStages",
      transform: reportStage("transform"),
      package: reportStage("package"),
      optimize: reportStage("optimize"),
      write: reportStage("write"),
    });

    const { diagnostics } = await tape({
      entry: "/index.html",
      files: {
        "/index.html": {
          content: `
            just html
          `,
        },
      },
      plugins: [reportStages],
    });

    expect(diagnostics).toHaveLength(8);
  });

  test.skip("[dev] should trigger onChange on dependents and embedded dependencies", async (done) => {
    const onChange = jest.fn();
    const onChangePlugin = () => ({
      name: "onChangePlugin",
      onChange,
    });

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

    manager.on("update", (updatedIds) => {
      expect(updatedIds).toHaveLength(1);
    });

    let first = true;
    manager.on("end", async () => {
      if (first) {
        first = false;
        tape.update({
          files: {
            "/reset.css": {
              content: `updated`,
            },
          },
        });
      } else {
        expect(onChange).toHaveBeenCalledTimes(4);
        await manager.close();
        done();
      }
    });
  });
});
