import { defineConfig } from 'vite'
import path from 'path'
import { execSync } from 'child_process'
import react from '@vitejs/plugin-react'
import { espruinoLoaderPlugin } from './src/plugins/espruino-loader'
import { firmwareLoaderPlugin } from './src/plugins/firmware-loader'
import { markdownPlugin } from './src/plugins/markdown-plugin'

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch (err) {
    console.warn('Could not determine git commit:', (err as Error).message)
    return 'unknown'
  }
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    root: '.',
    base: './',
    publicDir: 'static_files',

    plugins: [
      react(),
      markdownPlugin(),
      espruinoLoaderPlugin(),
      firmwareLoaderPlugin({ download: isProd }),
    ],

    define: {
      __DEVELOPMENT__: !isProd,
      __PRODUCTION__: isProd,
      __BUILD_DATE__: JSON.stringify(new Date().toUTCString()),
      __GIT_COMMIT__: JSON.stringify(getGitCommit()),
      'process.env.NODE_DEBUG': 'undefined',
    },

    resolve: {
      alias: [
        {
          find: 'events',
          replacement: path.resolve(__dirname, 'node_modules/events'),
        },
        {
          find: 'jquery',
          replacement: path.resolve(__dirname, 'node_modules/jquery/dist/jquery.js'),
        },
        {
          find: 'web-bluetooth-dfu',
          replacement: path.resolve(
            __dirname,
            'node_modules/web-bluetooth-dfu/lib/index.js'
          ),
        },
        {
          find: 'acorn',
          replacement: path.resolve(__dirname, 'node_modules/acorn'),
        },
        {
          find: 'esprima',
          replacement: path.resolve(__dirname, 'node_modules/esprima'),
        },
      ],
      extensions: ['.wasm', '.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'],
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      target: 'es2020',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          format: 'es',
          entryFileNames: '[hash].js',
          chunkFileNames: '[hash].js',
          assetFileNames: (assetInfo) => {
            // Keep firmware zips in a dedicated subdirectory
            if (assetInfo.name?.endsWith('.zip')) {
              return 'firmware/[name][extname]'
            }
            return 'assets/[hash][extname]'
          },
        },
      },
    },

    server: {
      open: false,
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
