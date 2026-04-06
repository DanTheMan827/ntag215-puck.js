import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const PREFIX = 'espruino-loader:'
const VIRTUAL_PREFIX = '\0espruino-loader:'

// Use a CJS-compatible require so that require.resolve works when the plugin
// is loaded as an ES module (Vite's "type":"module" project).
const _require = createRequire(import.meta.url)

function cleanIncludes(source: string): string {
  return source.replace(
    /require(?:\.resolve)?\(('serialport'|'nw\.gui'|"http"|"https"|"fs"|m)\)/g,
    'undefined'
  )
}

function hasModule(mod: string): boolean {
  try {
    _require.resolve(mod)
    return true
  } catch {
    return false
  }
}

export function espruinoLoaderPlugin(): Plugin {
  return {
    name: 'espruino-loader',
    resolveId(id: string) {
      if (id.startsWith(PREFIX)) {
        return VIRTUAL_PREFIX + id.slice(PREFIX.length)
      }
    },
    load(id: string) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return undefined

      const virtualPath = id.slice(VIRTUAL_PREFIX.length) // e.g. "espruino/core/utils.js"
      // Strip the "espruino/" npm package prefix to get the path relative to the package root
      const resourceFile = virtualPath.startsWith('espruino/')
        ? virtualPath.slice('espruino/'.length)
        : virtualPath
      const espruinoPath = path.dirname(_require.resolve('espruino'))

      const filePreOutput: string[] = []
      const filePostOutput: string[] = []
      const output: string[] = []

      const easyRequire = (mod: string | [string, string], ...files: string[]) => {
        const resolveId = Array.isArray(mod) ? mod[1] : mod
        const varName = Array.isArray(mod) ? mod[0] : mod
        if (hasModule(resolveId) && files.includes(resourceFile)) {
          filePreOutput.push(`import * as ${varName} from "${resolveId}";`)
        }
      }

      if (resourceFile !== 'espruino.js') {
        filePreOutput.push(`import Espruino from "${PREFIX}espruino.js";`)
      }

      filePostOutput.push('export default Espruino;')

      easyRequire('acorn', 'plugins/pretokenise.js', 'plugins/compiler.js')
      easyRequire('escodegen', 'plugins/minify.js')
      easyRequire(['esmangle', 'esmangle2'], 'plugins/minify.js')
      easyRequire('esprima', 'plugins/minify.js')
      easyRequire('utf8', 'plugins/unicode.js')

      const fileContent = cleanIncludes(
        fs.readFileSync(path.join(espruinoPath, resourceFile), { encoding: 'utf8' })
      )

      if (filePreOutput.length > 0) output.push(filePreOutput.join('\n'))
      output.push(fileContent)
      if (filePostOutput.length > 0) output.push(filePostOutput.join('\n'))

      return output.join('\n\n')
    },
  }
}
