/**
 * Declaration for markdown imports processed by the markdown Vite plugin.
 * Each .md file compiles to an HTML string.
 */
declare module '*.md' {
  const html: string
  export default html
}
