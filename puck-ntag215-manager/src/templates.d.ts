/**
 * Declaration for pug template imports processed by the pug Vite plugin.
 * Each .pug file (other than index.pug) compiles to a callable template function.
 */
declare module '*.pug' {
  function template(locals?: Record<string, unknown>): string
  export default template
}
