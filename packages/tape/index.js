/**
 * - [ ] validate
 * - [x] transform assets
 *   - [x] return assets
 *   - [x] load url dependencies
 * - [x] package
 *   - [x] optimize
 *   - [x] output
 *   - [x] resolve
 * - [ ] dev mode
 *   - [ ] onChange
 *   - [ ] cleanup
 * 
 * - [x] html plugin
 * - [x] css plugin
 * - [x] css inline
 * - [ ] minify
 * - [ ] sass
 * - [ ] email comb
 *
 *
 * - [ ] build for packages - use rollup
 * - [ ] tests
 * - [ ] publish 0.0.1
 */

const { mapKeys, mapValues, castArray, compact, get, isFunction, isEmpty, cloneDeep, pickBy, uniq } = require('lodash')
const { DepGraph: Graph } = require('dependency-graph');
const { extname, dirname, resolve: resolvePath } = require('path')
const HTMLPlugin = require('@useparcel/tape-html-plugin')
const CSSPlugin = require('@useparcel/tape-css-plugin')
const WritePlugin = require('./default-write-plugin')
const md5 = require('md5')

function forceArray(v) {
  return compact(castArray(v))
}

function enhanceFile(file, path) {
  return {
    ...file,
    ext: extname(path),
    dir: dirname(path),
    path,
    id: md5(path)
  }
}

function cacheAccessor(cache, namespace) {
  return {
    get: (key) => cache.get(`${namespace}:${key}`),
    has: (key) => cache.has(`${namespace}:${key}`),
    delete: (key) => cache.delete(`${namespace}:${key}`),
    set: (key, value) => cache.set(`${namespace}:${key}`, value),
    entries: () => [...cache.entries()].filter(([key, value]) => key.startsWith(namespace))
  }
}

/**
 * HTML build tool that runs in the browser
 */
module.exports = function tape({
  plugins = [],
  entry: entryPath,
  files,
  options = {}
} = {}) {

  // add default plugins
  plugins = [HTMLPlugin, CSSPlugin, ...plugins, ...(plugins.find(({ write }) => !!write) ? [] : [WritePlugin])]


  // set up our compile count 
  let compileCount = 0

  // set up our cache
  const cache = new Map()

  // set up our dependency graph
  const graph = new Graph()
  
  // set up our raw and compiled files
  let rawFiles = cloneDeep(mapKeys(mapValues(cloneDeep(files), enhanceFile), 'id'))
  let packagedFiles = {}
  let resolveMap = {}

  function resolveDependency({ id, path }) {
    if (id) {
      return resolveMap[id]
    }
    else {
      return resolveMap[md5(path)]
    }
  }


  function runPlugin(plugin, method, props) {
    return plugin[method]({
      cache: cacheAccessor(cache, plugin.name),
      options,
      ...props
    })
  }

  /**
   * Runs the asset throught transformer plugins
   * 
   * Transformers are responsible for converting syntaxes (i.e. mjml to html) as
   * well as for gathering all dependencies.
   */
  async function transformAsset({ asset, ...props }) {
    let transformingAsset = { ...asset }
    let collectedAssets = []

    for (let plugin of plugins) {
      const exts = forceArray(get(plugin, 'resolve.input'))
      if(isFunction(plugin.transform) && (exts.length === 0 || exts.includes(asset.ext))) {
        const [transformedAsset, ...others] = forceArray(
          await runPlugin(plugin,'transform', { asset: transformingAsset, ...props })
        )
        const newExt = get(plugin, 'resolve.output', asset.ext)
        collectedAssets.push(...others)

        transformingAsset = {
          ...transformedAsset,
          ext: newExt,
          originalExt: transformingAsset.originalExt || transformingAsset.ext
        }

        if (transformingAsset.ext !== asset.ext) {
          return [transformingAsset, ...collectedAssets]
        }
      }
    }

    return [transformingAsset, ...collectedAssets]
  }

  async function onChangeAsset({ asset, ...props }) {
    for (let plugin of plugins) {
      const exts = forceArray(get(plugin, 'resolve.input'))
      if(isFunction(plugin.onChange) && (exts.length === 0 || exts.includes(asset.ext))) {
        await runPlugin(plugin, 'onChange', { asset, ...props })
      }
    }
  }

  /**
   * Runs the asset through the package step
   *
   * This is where final dependency urls should be inserted
   */
  async function packageAsset({ asset, ...props }) {
    const plugin = plugins.find((plugin) => castArray(get(plugin, 'resolve.input')).includes(asset.ext) && isFunction(plugin.package))

    if (!plugin) {
      return asset
    }

    return await runPlugin(plugin, 'package', { asset, ...props })
  }

  /**
   * Runs the file through all optimizer plugins
   */
  async function optimizeAsset({ asset, ...props }) {
    asset = { ...asset }
    for (let plugin of plugins) {
      const exts = forceArray(get(plugin, 'resolve.input'))
      if(isFunction(plugin.optimize) && (exts.length === 0 || exts.includes(asset.ext))) {
        asset = await runPlugin(plugin, 'optimize', { asset, ...props })
      }
    }

    return asset
  }

  /**
   * Runs the asset through the write step 
   *
   * 
   */
  async function writeAsset({ asset, ...props }) {
    let plugin = plugins.find((plugin) => isFunction(plugin.write))

    // never called since we add the write plugin by default
    if (!plugin) {
      throw new Error('No write plugin found')
    }

    return await runPlugin(plugin, 'write', { asset, ...props })
  }

  function outputResults() {
    return {
      entry: resolveDependency({ path: entryPath }),
      files: mapValues(mapKeys(packagedFiles, (asset, id) => {
        return resolveDependency({ id })
      }), (asset, id) => {
        return {
          content: asset.content
        }
      })
    }
  }

  /**
   * One time compile
   */
  async function compile() {
    const transformedAssets = cloneDeep(rawFiles)

    /** remove any that have already been packaged */
    for (let id of Object.keys(transformedAssets)) {
      if (packagedFiles[id]) {
        delete transformedAssets[id]
      }
    }

    const pathToId = {}
    const idToPath = {}
    for (let id of Object.keys(transformedAssets)) {
      pathToId[transformedAssets[id].path] = id
      idToPath[id] = transformedAssets[id].path
    }

    // the change didn't effect the entry so there is no need to update
    if (!pathToId[entryPath]) {
      return outputResults()
    }

    /**
     * Transform the files
     */
    let dependencies = [pathToId[entryPath]]
    while (dependencies.length > 0) {
      const id = dependencies.shift()
      const asset = transformedAssets[id]

      if (!asset) {
        if (!rawFiles[id]) {
          throw new Error(`Asset ${idToPath[id]} not found.`)
        }
        else  {
          continue;
        }
      }

      graph.addNode(asset.id)

      function addDependency({ id, path }) {
        if (id) {
          graph.addNode(id)
          graph.addDependency(asset.id, id)
        } else {
          const absolutePath = resolvePath(asset.dir, path)
          const id = md5(absolutePath)
          pathToId[absolutePath] = id
          idToPath[id] = absolutePath
          graph.addNode(id)
          graph.addDependency(asset.id, md5(absolutePath))
        }
      }

      const previousExt = get(transformedAssets, [id, 'ext'])
      const [transformedAsset, ...newAssets] = await transformAsset({
        asset,
        addDependency,
      })
      transformedAssets[id] = transformedAsset

      for (let newAsset of newAssets) {
        transformedAssets[newAsset.id] = newAsset
      }

      if (previousExt !== transformedAssets[id].ext) {
        dependencies.push(id)
      }

      dependencies.push(...graph.outgoingEdges[asset.id])
      dependencies = compact(uniq(dependencies))
    }

    /**
     * on change handler
     */
    if (compileCount > 0) {
      for (let id of graph.overallOrder()) {
        const asset = transformedAssets[id]
        if (!asset) {
          continue;
        }

        onChangeAsset({ asset })
      } 
    }


    /**
     * Package the assets
     */
    const packagedAssets = {}

    function getAssetContent({ id, path }) {
      if (id) {
        return packagedAssets[id].content
      }
      else {
        const absolutePath = resolvePath(asset.dir, path)
        return packagedAssets[md5(absolutePath)].content
      }
    }

    for (let id of graph.overallOrder()) {
      const asset = transformedAssets[id]
      if (!asset) {
        continue;
      }

      function resolveRelativeDependency({ id, path }) {
        if (id) {
          return resolveDependency({ id })
        }
        else {
          const absolutePath = resolvePath(asset.dir, path)
          return resolveDependency({ path: absolutePath })
        }
      }


      packagedAssets[id] = await packageAsset({
        asset,
        resolveDependency: resolveRelativeDependency,
        getAssetContent,
      })
      packagedAssets[id] = await optimizeAsset({
        asset: packagedAssets[id],
        resolveDependency: resolveRelativeDependency,
        getAssetContent,
      })

      if (!asset.embedded) {
        resolveMap[id] = await writeAsset({
          asset: packagedAssets[id],
          resolveDependency: resolveRelativeDependency,
          getAssetContent,
        })
      }
    }

    packagedFiles = pickBy(packagedAssets, ({ embedded }) => !embedded)

    compileCount++
    return outputResults()
  }

  function update({ files, entry } = {}) {
    if (entry) {
      entryPath = entry
    }

    let updatedIds = []
    // update raw files
    for (let path of Object.keys(files)) {
      const id = md5(path)
      // created
      if (!rawFiles.hasOwnProperty(id)) {
        rawFiles[id] = enhanceFile(cloneDeep(files[path]), path)
      }
      // deleted
      else if (!files[path] || isEmpty(files[path])) {
        updatedIds.push(id)
        delete rawFiles[id]
      }
      // updated
      else if (files[path].content !== rawFiles[id].content) {
        updatedIds.push(id)
        rawFiles[id].content = files[path].content
      }
      // no change
      else {
        // do nothing
      }
    }

    // delete packaged things
    for (let id of updatedIds) {
      delete packagedFiles[id]
      updatedIds.push(...graph.dependantsOf(id))
      graph.removeNode(id)
    }

    return compile()
  }


  return {
    compile,
    update
  }
}



