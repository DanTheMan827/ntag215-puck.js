import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const SSR_BUILD_FLAG = '__VITE_PRERENDER_SSR'

/**
 * Vite build plugin that pre-renders the React app at build time.
 *
 * After the client bundle is written, this plugin:
 *   1. Runs a secondary SSR Vite build of `src/entry-server.tsx`
 *   2. Imports the resulting module and calls its `render()` function
 *   3. Injects the pre-rendered HTML into `dist/index.html`
 *   4. Cleans up the temporary SSR output
 *
 * The client uses `hydrateRoot` to attach React to the pre-rendered DOM
 * without discarding and re-building the HTML.
 */
export function prerenderPlugin(): Plugin {
  // Capture define values from the outer build so the SSR sub-build uses the
  // identical __BUILD_DATE__ and __GIT_COMMIT__ constants.  A mismatch between
  // server-rendered and client-rendered text causes React hydration errors.
  let outerDefine: ResolvedConfig['define']

  return {
    name: 'prerender-plugin',
    apply: 'build',

    configResolved(config) {
      if (!process.env[SSR_BUILD_FLAG]) {
        outerDefine = config.define
      }
    },

    async closeBundle() {
      // Guard against infinite recursion: the SSR sub-build triggers
      // closeBundle on a fresh copy of this plugin too.
      if (process.env[SSR_BUILD_FLAG]) return
      process.env[SSR_BUILD_FLAG] = '1'

      const ssrOutDir = path.resolve(
        process.cwd(),
        'node_modules/.cache/prerender-ssr',
      )

      try {
        const { build } = await import('vite')

        // Build the SSR entry using the same vite.config.ts (so all aliases
        // and transform plugins are identical to the client build).  Pass the
        // outer build's define values so __BUILD_DATE__ / __GIT_COMMIT__ are
        // identical in both bundles — a mismatch causes hydration errors.
        // The SSR_BUILD_FLAG env var prevents this nested call from recursing.
        await build({
          configFile: path.resolve(process.cwd(), 'vite.config.ts'),
          mode: 'production',
          logLevel: 'warn',
          // Override define so the SSR bundle encodes the same constants as
          // the client bundle.  Vite merges this with the config-file define,
          // so only the two time-varying keys need to be overridden.
          define: outerDefine,
          build: {
            ssr: path.resolve(process.cwd(), 'src/entry-server.tsx'),
            outDir: ssrOutDir,
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
              output: {
                format: 'esm',
                // Explicit filename so we can import it without globbing.
                entryFileNames: 'entry-server.js',
              },
            },
          },
        })

        // Dynamically import the built SSR module.  Use a unique file name to
        // avoid Node.js's module cache if the build is run more than once in
        // the same process (e.g. watch mode).
        const ssrSrc = path.join(ssrOutDir, 'entry-server.js')
        const ssrDst = path.join(ssrOutDir, `entry-server-${Date.now()}.mjs`)
        fs.renameSync(ssrSrc, ssrDst)

        const { render } = (await import(pathToFileURL(ssrDst).href)) as {
          render: () => string
        }

        const preRendered = render()

        // Patch dist/index.html: replace the empty root div with the
        // pre-rendered HTML.  React's hydrateRoot will attach to this content.
        const htmlFile = path.resolve(process.cwd(), 'dist/index.html')
        let html = fs.readFileSync(htmlFile, 'utf-8')
        html = html.replace(
          '<div id="root"></div>',
          `<div id="root">${preRendered}</div>`,
        )
        fs.writeFileSync(htmlFile, html)

        console.log('\x1b[32m✓\x1b[0m Pre-rendering complete')
      } finally {
        delete process.env[SSR_BUILD_FLAG]
        try {
          fs.rmSync(ssrOutDir, { recursive: true, force: true })
        } catch {
          // Non-fatal: temp directory cleanup failure does not break the build.
        }
      }
    },
  }
}
