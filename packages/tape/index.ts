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
  isPlainObject,
  isArray,
} from "lodash";
import { DepGraph as Graph } from "dependency-graph";
import { extname, dirname, basename, resolve as resolvePath } from "path";
import md5 from "md5";
import HTMLPlugin from "@useparcel/tape-html";
import CSSPlugin from "@useparcel/tape-css";
import isValidFilename from "valid-filename";
import { generateReporter, addReporterContext, Reporter } from "./reporter";
import WritePlugin from "./default-write-plugin";
import {
  Asset,
  AssetContext,
  Plugin,
  PluginLoader,
  Config,
  PluginConstructor,
  PluginMethod,
} from "./types";

export function tape(config: Config) {
  const instance = new Tape(config);

  return instance.build();
}

class Tape {
  #cache = new Map();
  #idToPathMap = {};
  plugins: Plugin[];
  entry: string;
  files: { [file: string]: { content: string } | null };

  constructor(config: Config) {
    const { plugins, entry, files } = config || {};
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

    this.plugins = loadPlugins(plugins || []);
    this.entry = entry;
    this.files = mapKeys(
      mapValues(cloneDeep(files), this.#fileDefaults.bind(this)),
      "id"
    );
  }

  async build() {
    const results = await this.#compile();

    return pick(results, ["entry", "files", "diagnostics"]);
  }

  /**
   * Does the full compliation
   * @param  {Object} options.context The previous context of a compliation
   *                                  used to skip compiling unchanged files
   */
  async #compile({ context = {} } = {}) {
    const self = this;
    const pathToId = this.#pathToId.bind(self);

    /**
     * Set up build context and utils
     */
    const entryId = pathToId(self.entry);
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

    /**
     * Registers an asset dependency
     *
     * Must provide either `id` or `path` and `dir`
     */
    function addDependency({
      asset,
      id,
      path,
      dir,
    }: {
      asset: Asset;
      id?: string;
      path?: string;
      dir?: string;
    }) {
      id = id || pathToId(path, dir);

      graph.addNode(id);
      graph.addDependency(asset.id, id);
    }

    /**
     * Resolves an asset to it's write path
     *
     * Must provide either `id` or `path` and `dir`
     */
    function resolveAsset({
      id,
      path,
      dir,
    }: {
      id?: string;
      path?: string;
      dir?: string;
    }) {
      id = id || pathToId(path, dir);

      return resolveMap[id];
    }

    /**
     * Get the original content of an asset
     *
     * Must provide either `id` or `path` and `dir`
     */
    function getSourceAssetContent({
      id,
      path,
      dir,
    }: {
      id?: string;
      path?: string;
      dir?: string;
    }) {
      id = id || pathToId(path, dir);

      return self.files[id].content;
    }

    /**
     * Get the package content of an asset
     *
     * Must provide either `id` or `path` and `dir`
     */
    function getPackagedAssetContent({
      id,
      path,
      dir,
    }: {
      id?: string;
      path?: string;
      dir?: string;
    }) {
      id = id || pathToId(path, dir);

      return packagedAssets[id].content;
    }

    const report = generateReporter();

    const generateAssetContext = (
      asset: Asset,
      fields: (
        | "addDependency"
        | "resolveAsset"
        | "getSourceAssetContent"
        | "getPackagedAssetContent"
      )[]
    ) => {
      const context: Partial<AssetContext> & {
        getSourceAssetContent?: ({ id, path }) => string;
        getPackagedAssetContent?: ({ id, path }) => string;
      } = pick(
        {
          asset,
          addDependency: ({ id, path }) =>
            addDependency({ asset, id, path, dir: asset.source.dir }),
          resolveAsset: ({ id, path }) =>
            resolveAsset({ id, path, dir: asset.source.dir }),
          getSourceAssetContent: ({ id, path }) =>
            getSourceAssetContent({ id, path, dir: asset.source.dir }),
          getPackagedAssetContent: ({ id, path }) =>
            getPackagedAssetContent({ id, path, dir: asset.source.dir }),
          report: addReporterContext(report, { path: asset.source.path }),
        },
        ["asset", "report", ...fields]
      );

      /**
       * Alias `getSourceAssetContent` or `getPackagedAssetContent` to
       * `getAssetContent``
       */
      if (context.getSourceAssetContent) {
        context.getAssetContent = context.getSourceAssetContent;
        delete context.getSourceAssetContent;
      }

      if (context.getPackagedAssetContent) {
        context.getAssetContent = context.getPackagedAssetContent;
        delete context.getPackagedAssetContent;
      }

      return context as
        | Pick<AssetContext, "asset" | "report">
        | Partial<AssetContext>;
    };

    /********************************
     * Transform
     *******************************/
    let assets: { [path: string]: Asset } = cloneDeep(
      omit(this.files, keys(transformedAssets))
    );

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
        report.error({
          message: `Transforming: Asset \`${path}\` not found.`,
          path,
        });
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
    const entryDependencies = [entryId, ...graph.dependenciesOf(entryId)];
    const entryGraphOverallOrder = graph
      .overallOrder()
      .filter((id) => entryDependencies.includes(id));

    for (let id of entryGraphOverallOrder) {
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
        report.error({
          message: `Packaging: Asset ${path} not found.`,
          path,
        });
      }

      /**
       * We have the asset already from the given context
       */
      if (packagedAssets[id]) {
        continue;
      }

      packagedAssets[id] = await this.#packageAsset(
        generateAssetContext(asset, ["resolveAsset", "getPackagedAssetContent"])
      );
      packagedAssets[id] = await this.#optimizeAsset(
        generateAssetContext(packagedAssets[id], [
          "resolveAsset",
          "getPackagedAssetContent",
        ])
      );

      if (!asset.embedded) {
        resolveMap[id] = await this.#writeAsset(
          generateAssetContext(packagedAssets[id], [
            "resolveAsset",
            "getPackagedAssetContent",
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
    let packagingAsset = { ...asset };

    const plugins = this.plugins.filter((plugin) =>
      shouldRunPlugin(plugin, "package", asset.ext)
    );

    for (let plugin of plugins) {
      packagingAsset = await this.#runPlugin(plugin, "package", {
        asset: packagingAsset,
        ...props,
      });
    }

    return packagingAsset;
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
   * Runs the given method of a plugin within the plugin namespace
   */
  #runPlugin<T extends PluginMethod>(
    plugin: Plugin,
    method: T,
    { report, ...props }: Parameters<Plugin["transform"]>[0]
  ): ReturnType<Plugin[T]> {
    try {
      return plugin[method]({
        cache: cacheNamespace(this.#cache, plugin.name),
        report: addReporterContext(report, { source: plugin.name }),
        ...props,
      } as any) as ReturnType<Plugin[T]>;
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
  #pathToId(path: string, dir = "/") {
    const absolutePath = resolvePath(dir, path);

    const id = md5(absolutePath);
    this.#idToPathMap[id] = absolutePath;
    return id;
  }

  /**
   * Converts a path to an id
   */
  #idToPath(id: string) {
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

/**
 * Given a value, it forces it to be a compact array
 *
 * 'str' -> ['str']
 * ['a','b', 'c'] -> ['a', 'b', 'c']
 * undefined -> []
 */
function forceArray(value: any): any[] {
  return compact(castArray(value));
}

/**
 * Checks if the given value is falsey
 */
function isFalsy(value: any): boolean {
  return !value || isEmpty(value);
}

/**
 * Validates a string is a valid path or throws an error
 */
function validatePath(path: string): true {
  for (let part of compact(path.split("/"))) {
    if (!isValidFilename(part)) {
      const error = new Error(`"${path}" is an invalid file path.`);
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

  return graph;
}

/**
 * Returns a string preview of the given variable
 */
function variablePreview(v: any): string {
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
function loadPlugins(pluginLoaders: PluginLoader[]) {
  pluginLoaders = [...pluginLoaders];

  let plugins = [];
  for (let input of pluginLoaders) {
    let pluginContructor: PluginConstructor,
      config = {};
    if (isArray(input)) {
      pluginContructor = get(input, 0);
      config = get(input, 1, {});
    } else {
      pluginContructor = input;
    }

    if (!isFunction(pluginContructor)) {
      throw new Error(
        `Invalid plugin. Expected function, given ${typeof pluginContructor} (${variablePreview(
          pluginContructor
        )}).`
      );
    }

    const plugin = pluginContructor(config);

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
    // force HTML support
    ...(plugins.find(({ name }) => name === "@useparcel/tape-html")
      ? []
      : [HTMLPlugin()]),
    // force CSS support
    ...(plugins.find(({ name }) => name === "@useparcel/tape-css")
      ? []
      : [CSSPlugin()]),
    ...plugins,
    // if no write plugin is given, add in the default one
    ...(plugins.find(({ write }) => isFunction(write)) ? [] : [WritePlugin]),
  ];
}
