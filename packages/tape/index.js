/**
 * - [ ] validate
 * - [x] transform
 *   - [ ] load inline dependencies
 *   - [x] load url dependencies
 * - [x] package
 *   - [x] optimize
 *   - [x] output
 *   - [x] resolve
 * - [ ] clean up for when in dev
 * 
 * - [ ] html plugin
 * - [ ] css plugin
 * - [ ] css inline
 * - [ ] minify
 * - [ ] sass
 * - [ ] email comb
 *
 *
 * - [ ] add configuration access to all plugins
 * - [ ] build for packages 
 * - [ ] tests
 * - [ ] publish 0.0.1
 */

const { mapKeys, mapValues, castArray, get, isFunction, cloneDeep } = require('lodash')
const { DepGraph: Graph } = require('dependency-graph');
const { extname, dirname, resolve: resolvePath } = require('path')
const HTMLPlugin = require('@useparcel/tape-html-plugin')


function enhanceFile(file, path) {
  return {
    ...file,
    ext: extname(path),
    dir: dirname(path),
    path
  }
}

/**
 * HTML build tool that runs in the browser
 */
module.exports = function tape({
  plugins = [HTMLPlugin, SassPlugin, CSSHeaderPlugin, WritePlugin]
} = {}) {
  /**
   * Finds the transformer plugin and  the file with the output content
   * 
   * The loader is responsible for converting syntaxes (i.e. mjml to html) as
   * well as for gathering all dependencies.
   */
  async function transformFile({ file, addDependency }) {
    let tempFile = { ...file }
    for (let plugin of plugins) {
      if (castArray(get(plugin, 'resolve.input')).includes(file.ext)) {
        const newContent = await plugin.transform({ file: tempFile, addDependency })
        const newExt = get(plugin, 'resolve.output', file.ext)

        tempFile = {
          ...tempFile,
          content: newContent,
          path: tempFile.path.replace(new RegExp(`${tempFile.ext}$`), newExt),
          ext: newExt,
        }

        if (tempFile.ext !== file.ext) {
          return tempFile
        }
      }
    }

    return tempFile
  }

  /**
   * Runs the file through the package step of the loader plugins
   *
   * This is where the loaders resolve their dependencies
   */
  async function packageFile({ file, resolveDependency }) {
    const plugin = plugins.find((plugin) => castArray(get(plugin, 'resolve.input')).includes(file.ext) && isFunction(plugin.package))

    if (!plugin) {
      return file
    }

    return {
      ...file,
      content: await plugin.package({ file, resolveDependency })
    }
  }

  /**
   * Runs the file through the package step of the loader plugins
   *
   * This is where the loaders resolve their dependencies
   */
  async function writeFile({ file }) {
    const plugin = plugins.find((plugin) => isFunction(plugin.write))


    if (!plugin) {
      throw new Error('No write plugin found')
    }

    return await plugin.write({ file })
  }

  /**
   * Runs the file through all optimizer plugins
   */
  async function optimizeFile({ file }) {
    file = { ...file }
    for (let plugin of plugins) {
      if (isFunction(plugin.optimize)) {
        file.content = await plugin.optimize({ file })
      }
    }

    return file
  }


  return function tapeInstance(entryPath, { files = {} } = {}) {
    async function compile() {
      const enhancedFiles = mapValues(files, enhanceFile)
      const graph = new Graph()

      const transformedFiles = cloneDeep(enhancedFiles)

      /**
       * Transform the files
       */
      let dependencies = [entryPath]
      while (dependencies.length > 0) {
        const path = dependencies.shift()
        const file = transformedFiles[path]

        if (!file) {
          throw new Error(`File ${path} not found.`)
        }

        graph.addNode(file.path)

        function addDependency(path) {
          const absolutePath = resolvePath(file.dir, path)
          graph.addNode(absolutePath)
          graph.addDependency(file.path, absolutePath)
        }

        const previousExt = get(transformedFiles, [path, 'ext'])
        transformedFiles[path] = await transformFile({ file, addDependency })

        if (previousExt !== transformedFiles[path].ext) {
          dependencies.push(path)
        }
        dependencies.push(...graph.dependenciesOf(file.path))
      }

      const resolveMap = {}
      function resolveDependency(path) {
        return resolveMap[path]
      }

      /**
       * Package the files
      //  */
      let packagedFiles = {}
      for (let path of graph.overallOrder()) {
        const file = transformedFiles[path]
        if (!file) {
          continue;
        }

        packagedFiles[path] = await packageFile({ file, resolveDependency })
        packagedFiles[path] = await optimizeFile({ file: packagedFiles[path] })
        resolveMap[path] = await writeFile({ file })
      }

      return mapValues(mapKeys(packagedFiles, (file, path) => {
        return resolveDependency(path)
      }), (file, path) => {
        return {
          content: file.content
        }
      })
    }


    return { compile }
  }
}





const SassPlugin = {
  name: 'SassPlugin',
  resolve: {input: ['.scss', '.sass'], output: '.css'},
  async transform({ file, addDependency }) {
    return file.content
  }
}

const CSSHeaderPlugin = {
  name: 'CSSHeaderPlugin',
  resolve: {input: '.css', output: '.css'},
  async transform({ file }) {
    return `/**this is a leading comment*/\n${file.content}`
  }
}

const WritePlugin = {
  name: 'WritePlugin',
  async write({ file }) {
    return `/base${file.path}`
  }
}


