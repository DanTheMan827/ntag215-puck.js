import type { Plugin } from 'vite'
import pug from 'pug'
import path from 'path'
import { execSync } from 'child_process'

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Vite plugin that handles Pug templates.
 *
 * – `index.pug` (configurable via `htmlTemplate`): rendered to HTML and used
 *   as the Vite entry via the `transformIndexHtml` hook (runs before Vite's
 *   own HTML processing so the `<script type="module">` tag it contains is
 *   picked up and bundled normally).
 *
 * – All other `*.pug` imports (e.g. slot.pug, board-selector.pug): compiled
 *   to a module that exports a callable pug template function so that
 *   `import template from './templates/slot.pug'` works at runtime.
 */
export function pugPlugin(htmlTemplate?: string): Plugin {
  return {
    name: 'pug-plugin',

    // ------------------------------------------------------------------ HTML
    transformIndexHtml: {
      // 'pre' ensures this runs before Vite processes <script> / <link> tags
      order: 'pre',
      handler(_html, _ctx) {
        const templatePath = htmlTemplate
          ?? path.resolve(process.cwd(), 'src/templates/index.pug')

        return pug.renderFile(templatePath, {
          pretty: false,
          filename: templatePath,
          gitCommit: getGitCommit(),
        })
      },
    },

    // --------------------------------------------------------- Runtime modules
    transform(src, id) {
      if (!id.endsWith('.pug')) return undefined

      // Skip the HTML entry template — handled above
      const htmlTemplatePath = htmlTemplate
        ?? path.resolve(process.cwd(), 'src/templates/index.pug')
      if (path.resolve(id) === path.resolve(htmlTemplatePath)) return undefined

      // Compile the pug file to a client-side template function
      const compiled = pug.compileClient(src, {
        filename: id,
        compileDebug: false,
        inlineRuntimeFunctions: false,
      })

      return {
        // pug.compileClient emits a function named `template`; re-export it
        // as the default so consumers can do:
        //   import slotTemplate from './templates/slot.pug'
        //   const html = slotTemplate({ slot, uid })
        code: `import pug from 'pug-runtime';\n${compiled}\nexport default template;`,
        map: null,
      }
    },
  }
}
