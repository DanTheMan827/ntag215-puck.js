import type { Plugin } from 'vite'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

/**
 * Vite plugin that transforms `*.md` imports into modules that export the
 * compiled HTML string as the default export.
 *
 * Usage in source:
 *   import readmeHtml from '../../readme.md'
 */
export function markdownPlugin(): Plugin {
  return {
    name: 'markdown-plugin',
    transform(src, id) {
      if (!id.endsWith('.md')) return undefined
      const html = md.render(src)
      return {
        code: `export default ${JSON.stringify(html)};`,
        map: null,
      }
    },
  }
}
