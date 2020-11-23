import {
  has,
  defaults,
  keys,
  omit,
  mapKeys,
  mapValues,
  castArray,
  compact,
  get,
  isFunction,
  isEmpty,
  cloneDeep,
  pickBy,
  pick,
  uniq,
  isMap,
  isPlainObject,
  isArray,
} from "lodash";
import { DepGraph as Graph } from "dependency-graph";
import { extname, dirname, basename, resolve as resolvePath } from "path";
import md5 from "md5";
import mitt from "mitt";
import HTMLPlugin from "@useparcel/tape-html";
import CSSPlugin from "@useparcel/tape-css";
import WritePlugin from "./default-write-plugin";
import isValidFilename from "valid-filename";

class Tape {
  #cache = new Map();
  #emitter = mitt();
  #idToPathMap = {};

  constructor({ plugins = [], entry, files } = {}) {
    if (!entry) {
      throw new Error("`entry` is required");
    }

    validatePath(entry);

    if (!files) {
      throw new Error("`files` is required");
    }

    for (const [path, file] of Object.entries(files)) {
      validatePath(path);
      validateGivenFile(file);
    }

    this.plugins = loadPlugins(plugins);
    this.entry = entry;
    this.files = mapKeys(
      mapValues(cloneDeep(files), this.#fileDefaults.bind(this)),
      "id"
    );
  }

  update({ entry, plugins, files = {} } = {}) {
    let updatedIds = [];

    if (entry && entry !== this.entry) {
      validatePath(entry);
      this.entry = entry;
      updatedIds.push(this.#pathToId(entry));
    }

    if (plugins) {
      this.plugins = loadPlugins(plugins);

      const context = this.#cache.get("context");
      // Mark everything as updated if we change plugins
      if (context) {
        updatedIds.push(...context.graph.overallOrder());
      }
    }

    for (const [path, file] of Object.entries(files)) {
      validatePath(path);
      validateGivenFile(file);
      const id = this.#pathToId(path);
      // new file
      if (!has(this.files, id)) {
        this.files[id] = this.#fileDefaults(file, path);
        updatedIds.push(id);
      }
      // delete file
      else if (isFalsy(file)) {
        delete this.files[id];
        updatedIds.push(id);
      }
      // update file
      else if (file.content !== this.files[id].content) {
        this.files[id].content = file.content;
        updatedIds.push(id);
      }
      // no change
      else {
        // do nothing
      }
    }

    /**
     * no updates, so skip the event
     */
    if (updatedIds.length === 0) {
      return;
    }

    this.#emitter.emit("update", updatedIds);
  }

  async build() {
    const context = { env: "production" };
    const results = await this.#compile(context);

    const report = generateReporter();
    await this.#cleanup({
      ...context,
      report,
    });

    return pick(
      {
        ...results,
        diagnostics: [...results.diagnostics, ...report.release()],
      },
      ["entry", "files", "diagnostics"]
    );
  }

  dev() {
    const emitter = this.#emitter;
    const cache = this.#cache;
    const compile = this.#compile.bind(this);
    const cleanup = this.#cleanup.bind(this);
    const onChangeAsset = this.#onChangeAsset.bind(this);
    const idToPath = this.#idToPath.bind(this);
    const pathToId = this.#pathToId.bind(this);

    /**
     * Triggers a compliation using cache
     * @param  {Array}  updatedIds    an array of inputed files changes
     * @param  {String} events.start  event to emit at the start
     * @param  {String} events.end    event to emit at the end
     */
    async function triggerCompile(
      updatedIds,
      { start = "start", end = "end" } = {}
    ) {
      updatedIds = [...updatedIds];
      const startedAt = Date.now();
      emitter.emit(start, { startedAt });

      const context = cache.get("context");

      const report = generateReporter();

      if (context) {
        for (let id of updatedIds) {
          /********************************
           * onChange
           *******************************/
          if (has(context.transformedAssets, id)) {
            onChangeAsset({
              env: "development",
              asset: context.transformedAssets[id],
              report,
            });
          }

          // remove related diagnostics
          context.diagnostics = context.diagnostics.filter(
            ({ path }) => pathToId(path) === id
          );

          if (context.graph.hasNode(id)) {
            // mark all dependents and embedded assets as updated
            updatedIds.push(
              ...context.graph.dependantsOf(id),
              ...context.graph.directDependenciesOf(id).filter((id) => {
                return (
                  context.transformedAssets[id] &&
                  context.transformedAssets[id].embedded
                );
              })
            );

            // TODO: avoid having to retransform dependents - we should only repackage them not retransform them

            // clean up cache
            context.graph.removeNode(id);
            keys(omit(context, "graph")).map((part) => {
              delete context[part][id];
            });
          }
        }

        /**
         * Add all the new diagonstics added by the onChange plugins
         */
        context.diagnostics = [...context.diagnostics, ...report.release()];
      }

      try {
        const results = await compile({ env: "development", context });
        /** only save newer caches */
        const isLatest =
          !cache.has("context") || startedAt > cache.get("context").timestamp;
        if (isLatest) {
          cache.set("context", {
            timestamp: startedAt,
            ...results.context,
          });
        }

        const endedAt = Date.now();
        emitter.emit(end, {
          ...pick(results, ["entry", "files", "diagnostics"]),
          startedAt,
          endedAt,
          isLatest,
        });
      } catch (error) {
        const endedAt = Date.now();
        emitter.emit("error", {
          startedAt,
          endedAt,
          // TODO: isLatest
          error,
        });
      }
    }

    const onUpdate = (updatedIds) => triggerCompile(updatedIds);

    emitter.on("update", onUpdate);

    /**
     * on next tick, run the build
     *
     * this gives the event handlers a chance to be attached
     */
    setTimeout(() => {
      triggerCompile([]);
    });

    return {
      _listeners: [],
      async close() {
        emitter.off("update", onUpdate);
        this._listeners.forEach(({ event, func }) => {
          emitter.off(event, func);
        });

        const report = generateReporter();
        await cleanup({ env: "development", report });

        return { diagnostics: report.release() };
      },
      on(event, func) {
        this._listeners.push({ event, func });
        emitter.on(event, func);
      },
    };
  }

  /**
   * Runs the cleanup function of all plugins
   * @return {[type]} [description]
   */
  async #cleanup(props) {
    const plugins = this.plugins.filter((plugin) => isFunction(plugin.cleanup));

    for (const plugin of plugins) {
      await this.#runPlugin(plugin, "cleanup", props);
    }
  }

  /**
   * Does the full compliation
   * @param  {string} options.env     either `production` or `development`
   *                                  development has a consistent cache while
   *                                  production doesn't use a cache
   * @param  {Object} options.context The previous context of a compliation
   *                                  used to skip compiling unchanged files
   */
  async #compile({ env, context = {} }) {
    const pathToId = this.#pathToId.bind(this);
    if (!env || !["development", "production"].includes(env)) {
      throw new Error(
        `Expected env to be \`development\` or \`production\`. Received "${env}".`
      );
    }

    /**
     * Set up build context and utils
     */
    const entryId = pathToId(this.entry);
    let {
      graph,
      transformedAssets,
      packagedAssets,
      resolveMap,
      diagnostics,
    } = defaults({}, context, {
      graph: newGraph(),
      transformedAssets: {},
      packagedAssets: {},
      resolveMap: {},
      diagnostics: [],
    });

    function addDependency({ asset, id, path, dir }) {
      id = id || pathToId(path, dir);

      graph.addNode(id);
      graph.addDependency(asset.id, id);
    }

    function resolveAsset({ id, path, dir }) {
      id = id || pathToId(path, dir);

      return resolveMap[id];
    }

    function getAssetContent({ id, path, dir }) {
      id = id || pathToId(path, dir);

      return packagedAssets[id].content;
    }

    const report = generateReporter();

    const generateAssetContext = (asset, context) => {
      return pick(
        {
          asset,
          env,
          addDependency: ({ id, path }) =>
            addDependency({ asset, id, path, dir: asset.source.dir }),
          resolveAsset: ({ id, path }) =>
            resolveAsset({ id, path, dir: asset.source.dir }),
          getAssetContent: ({ id, path }) =>
            getAssetContent({ id, path, dir: asset.source.dir }),
          report: (diagnostic) => {
            report({
              ...diagnostic,
              path: asset.source.path,
            });
          },
        },
        ["asset", "env", "report", ...context]
      );
    };

    /********************************
     * Transform
     *******************************/
    let assets = cloneDeep(omit(this.files, keys(transformedAssets)));

    if (has(assets, entryId)) {
      assets[entryId].isEntry = true;
    }

    let dependencies = [entryId];
    while (dependencies.length > 0) {
      const id = dependencies.shift();
      const asset = assets[id];

      /**
       * We have the asset already from the given context
       */
      if (transformedAssets[id]) {
        continue;
      }

      /**
       * require the asset exists
       */
      if (!asset) {
        /**
         * Set the node to missing. This way when the node gets
         * created in the future, the dependent will recompile but
         * if we try to package this node, we know to skip it
         */
        if (graph.hasNode(id)) graph.setNodeData(id, { missing: true });

        const path = this.#idToPath(id);
        const error = new Error(`Transforming: Asset \`${path}\` not found.`);
        error.path = path;

        throw error;
      }

      /**
       * Add the node to the graph
       */
      graph.addNode(asset.id);

      const [transformedAsset, ...embeddedAssets] = await this.#transformAsset(
        generateAssetContext(asset, ["addDependency"])
      );

      /**
       * save the asset
       */
      transformedAssets[id] = transformedAsset;

      /**
       * add the embedded assets to our assets list
       */
      assets = {
        ...assets,
        ...mapKeys(embeddedAssets, "id"),
      };

      /**
       * Add the asset's dependencies to be processed
       */
      dependencies = compact(
        uniq([...dependencies, ...graph.directDependenciesOf(asset.id)])
      );
    }

    /********************************
     * Package, optimize, and write
     *******************************/

    for (let id of graph.overallOrder()) {
      /**
       * The asset was referenced but didn't exist. It was blocking
       * the transform. Now the reference was removed, so we can remove
       * it from the graph.
       */
      if (get(graph.getNodeData(id), "missing")) {
        graph.removeNode(id);
        continue;
      }

      const asset = transformedAssets[id];
      if (!asset) {
        const path = this.#idToPath(id);
        const error = new Error(`Packaging: Asset ${path} not found.`);
        error.path = path;
        throw error;
      }

      /**
       * We have the asset already from the given context
       */
      if (packagedAssets[id]) {
        continue;
      }

      packagedAssets[id] = await this.#packageAsset(
        generateAssetContext(asset, ["resolveAsset", "getAssetContent"])
      );
      packagedAssets[id] = await this.#optimizeAsset(
        generateAssetContext(packagedAssets[id], [
          "resolveAsset",
          "getAssetContent",
        ])
      );

      if (!asset.embedded) {
        resolveMap[id] = await this.#writeAsset(
          generateAssetContext(packagedAssets[id], [
            "resolveAsset",
            "getAssetContent",
          ])
        );
      }
    }

    diagnostics = [...diagnostics, ...report.release()];

    return {
      entry: resolveAsset({ path: this.entry }),
      files: mapValues(
        mapKeys(
          pickBy(packagedAssets, ({ embedded }) => !embedded),
          (asset, id) => {
            return resolveAsset({ id });
          }
        ),
        (asset, id) => {
          return {
            content: asset.content,
          };
        }
      ),
      diagnostics,
      // should use the same keys as the declaration above
      context: {
        graph,
        transformedAssets,
        packagedAssets,
        resolveMap,
        diagnostics,
      },
    };
  }

  /**
   * Runs the asset through transformer plugins
   *
   * Transformers are responsible for converting syntaxes (i.e. mjml to html) as
   * well as for gathering all dependencies.
   */
  async #transformAsset({ asset, ...props }) {
    let transformingAsset = { ...asset };
    let generatedAssets = [];

    /**
     * Run the asset are are tranforming through all matching plugins
     */
    const plugins = this.plugins.filter((plugin) =>
      shouldRunPlugin(plugin, "transform", asset.ext)
    );
    for (let plugin of plugins) {
      /**
       * Get the transformed asset and other embedded assets that should
       * also be transformed.
       */
      const [transformedAsset, ...embeddedAssets] = forceArray(
        await this.#runPlugin(plugin, "transform", {
          asset: transformingAsset,
          ...props,
        })
      );
      generatedAssets.push(...embeddedAssets);

      /**
       * update the asset we are transforming
       */
      transformingAsset = { ...transformedAsset };

      /**
       * if the asset changed types, retransform it
       */
      if (transformingAsset.ext !== asset.ext) {
        return [
          ...(await this.#transformAsset({
            asset: transformingAsset,
            ...props,
          })),
          ...generatedAssets,
        ];
      }
    }

    /**
     * return the asset and all embedded assets
     */
    return [
      transformingAsset,
      ...generatedAssets.map((a) => ({
        ...a,
        source: transformingAsset.source,
      })),
    ];
  }

  /**
   * Runs the asset through the first matching package plugin
   *
   * This is where final dependency urls should be inserted
   */
  async #packageAsset({ asset, ...props }) {
    const plugin = this.plugins.find((plugin) =>
      shouldRunPlugin(plugin, "package", asset.ext)
    );

    if (!plugin) {
      return asset;
    }

    return await this.#runPlugin(plugin, "package", { asset, ...props });
  }

  /**
   * Runs the asset through all optimizer plugins
   */
  async #optimizeAsset({ asset, ...props }) {
    let optimizingAsset = { ...asset };

    const plugins = this.plugins.filter((plugin) =>
      shouldRunPlugin(plugin, "optimize", asset.ext)
    );
    for (let plugin of plugins) {
      optimizingAsset = await this.#runPlugin(plugin, "optimize", {
        asset: optimizingAsset,
        ...props,
      });
    }

    return optimizingAsset;
  }

  /**
   * Run the asset through the first matching write plugin
   */
  async #writeAsset({ asset, ...props }) {
    // we add a default write plugin so we always have one
    let plugin = this.plugins.find((plugin) =>
      shouldRunPlugin(plugin, "write", asset.ext)
    );

    return await this.#runPlugin(plugin, "write", { asset, ...props });
  }

  /**
   * Runs the asset through the onChange plugins
   */
  async #onChangeAsset({ asset, ...props }) {
    const plugins = this.plugins.filter((plugin) =>
      shouldRunPlugin(plugin, "onChange", asset.ext)
    );
    for (let plugin of plugins) {
      await this.#runPlugin(plugin, "onChange", { asset, ...props });
    }
  }

  /**
   * Runs the given method of a plugin within the plugin namespace
   */
  async #runPlugin(plugin, method, { env, report, ...props }) {
    try {
      return await plugin[method]({
        env,
        cache: cacheNamespace(
          env === "development" ? this.#cache : new Map(),
          plugin.name
        ),
        report: (diagnostic) => report({ ...diagnostic, source: plugin.name }),
        ...props,
      });
    } catch (e) {
      if (e.diagnostic) {
        throw e;
      }

      report({
        source: plugin.name,
        message: e.message,
        type: "error",
      });
    }
  }

  /**
   * Converts a file path into a consistent id
   */
  #pathToId(path, dir = "/") {
    const absolutePath = resolvePath(dir, path);

    const id = md5(absolutePath);
    this.#idToPathMap[id] = absolutePath;
    return id;
  }

  /**
   * Converts a path to an id
   */
  #idToPath(id) {
    return get(this.#idToPathMap, id, id);
  }

  /**
   * Sets the default values for a given file and path
   */
  #fileDefaults(file, path) {
    const ext = extname(path);

    return {
      ...file,
      id: this.#pathToId(path),
      ext,
      embedded: false,
      source: {
        ext,
        path,
        name: basename(path, ext),
        dir: dirname(path),
      },
    };
  }
}

export default Tape;

/**
 * Given a value, it forces it to be a compact array
 *
 * 'str' -> ['str']
 * ['a','b', 'c'] -> ['a', 'b', 'c']
 * undefined -> []
 */
function forceArray(value) {
  return compact(castArray(value));
}

/**
 * Checks if the given value is falsey
 */
function isFalsy(value) {
  return !value || isEmpty(value);
}

/**
 * Validates a string is a valid path or throws an error
 */
function validatePath(path) {
  for (let part of compact(path.split("/"))) {
    if (!isValidFilename(part)) {
      const error = new Error(`"${path}" is an invalid file path.`);
      error.path = path;
      throw error;
    }
  }

  return true;
}

/**
 * Validates an object is a valid file given by the user
 */
function validateGivenFile(file) {
  // falsey values are valid
  if (isFalsy(file)) {
    return true;
  }

  const keys = Object.keys(file);
  if (keys.length === 1 && keys[0] === "content") {
    return true;
  }

  throw new Error(`Given an invalid file: ${JSON.stringify(file)}`);
}

/**
 * Creates namespaced access to a cache
 */
function cacheNamespace(cache, namespace) {
  const prefix = `${namespace}:`;
  return {
    get: (key) => cache.get(`${prefix}${key}`),
    set: (key, value) => cache.set(`${prefix}${key}`, value),
    has: (key) => cache.has(`${prefix}${key}`),
    delete: (key) => cache.delete(`${prefix}${key}`),
    entries: () =>
      [...cache.entries()].filter(([key]) => key.startsWith(prefix)),
  };
}

/**
 * Checked if the plugin should run for the given method and extention
 */
function shouldRunPlugin(plugin, method, ext) {
  const exts = forceArray(get(plugin, "exts"));

  if (!isFunction(get(plugin, method))) {
    return false;
  }

  if (!ext || exts.includes(ext)) {
    return true;
  }

  return exts.length === 0;
}

/**
 * Returns a new dependency graph with some extra methods
 */
function newGraph() {
  const graph = new Graph();
  graph.directDependenciesOf = (name) => get(graph.outgoingEdges, name, []);
  graph.directDependantsOf = (name) => get(graph.incomingEdges, name, []);

  return graph;
}

/**
 * Returns a string preview of the given variable
 */
function variablePreview(v) {
  try {
    const str = JSON.stringify(v, null);
    return `${str.slice(0, 50)}${str.length > 50 ? "..." : ""}`;
  } catch (e) {
    return "Unknown";
  }
}

/**
 * Set default plugins
 */
function loadPlugins(pluginLoaders) {
  pluginLoaders = [HTMLPlugin, CSSPlugin, ...pluginLoaders];

  let plugins = [];
  for (let input of pluginLoaders) {
    let pluginLoader,
      config = {};
    if (isArray(input)) {
      pluginLoader = get(input, 0);
      config = get(input, 1, {});
    } else {
      pluginLoader = input;
    }

    if (!isFunction(pluginLoader)) {
      throw new Error(
        `Invalid plugin. Expected function, given ${typeof pluginLoader} (${variablePreview(
          plugin
        )}).`
      );
    }

    const plugin = pluginLoader(config);

    if (!isPlainObject(plugin)) {
      throw new Error(
        `Invalid plugin. Plugin loader returned ${typeof plugin} (${variablePreview(
          plugin
        )}).`
      );
    }

    if (!has(plugin, "name")) {
      throw Error("Plugins must have a name");
    }

    const count = plugins.filter(({ name }) => plugin.name === name).length;

    if (count >= 1) {
      throw new Error(
        `Plugin names must be unique: ${plugin.name} appeared ${count} times`
      );
    }

    plugins.push(plugin);
  }

  return [
    ...plugins,
    ...(plugins.find(({ write }) => isFunction(write)) ? [] : [WritePlugin]),
  ];
}

/**
 * Returns a reporter for plugins
 */
function generateReporter() {
  let diagnostics = [];

  /**
   * diagnostic = {
   *   type               Enum(error | warning | info)
   *   source             String - Plugin source
   *   message            String - General explanation of the error
   *   path               String - The file path
   *   loc.start.line     Number - the 1-indexed line of the start of the problem
   *   loc.start.column   Number - the 1-indexed column of the start of the problem
   *   loc.end.line       Number - the 1-indexed line of the end of the problem
   *   loc.end.column     Number - the 1-indexed column of the end of the problem
   *   fix                String - the string to replace the given location to fix the problem
   * }
   */
  function report(diagnostic) {
    diagnostic = pick(
      {
        type: "error",
        source: "internal",
        message: "An unknown error occurred.",
        path: null,
        ...diagnostic,
      },
      [
        "type",
        "source",
        "message",
        "path",
        "loc.start.line",
        "loc.start.column",
        "loc.end.line",
        "loca.end.column",
        "fix",
      ]
    );

    /**
     * Clean up bad location data
     */
    if (
      diagnostic.loc &&
      (!isPlainObject(diagnostic.loc) ||
        !(
          has(diagnostic, "loc.start.line") &&
          has(diagnostic, "loc.start.column")
        ))
    ) {
      delete diagnostic.loc;
    }

    /**
     * Clean up bad diagonstic type
     */
    if (!["error", "warning", "info"].includes(diagnostic.type)) {
      diagnostic.type = "error";
    }

    if (diagnostic.type === "error") {
      const error = new Error(diagnostic.message);
      error.diagnostic = diagnostic;

      throw error;
    }

    diagnostics.push(diagnostic);
  }

  report.release = () => diagnostics;

  return report;
}
