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

describe("abort controller", () => {
  test("should immediately error the build", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      tape({ ...validConfig, signal: controller.signal })
    ).toThrowError(/abort/i);
  });

  test("should error and stop the build when it is in progress", async () => {
    const controller = new AbortController();
    const packageFn = jest.fn(({ asset }) => asset);
    const packagePlugin = () => ({
      name: "packagePlugin",
      package: packageFn,
    });

    setTimeout(() => {
      controller.abort();
    }, 250);

    await expect(
      tape({
        ...validConfig,
        files: function (path) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(validConfig.files[path]), 500);
          });
        },
        plugins: [packagePlugin],
        signal: controller.signal,
      })
    ).rejects.toThrow(/abort/i);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(packageFn).toHaveBeenCalledTimes(0);
  });

  test("should not do anything if the build finished", async () => {
    const controller = new AbortController();
    const results = await tape({ ...validConfig, signal: controller.signal });
    controller.abort();

    expect(results).toMatchSnapshot();
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
