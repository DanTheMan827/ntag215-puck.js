import { defineConfig } from 'vite'
import path from 'path'
import { espruinoLoaderPlugin } from './src/plugins/espruino-loader'
import { firmwareLoaderPlugin } from './src/plugins/firmware-loader'
import { pugPlugin } from './src/plugins/pug-plugin'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    // Vite entry HTML — the pug plugin will replace its content at
    // transformIndexHtml time before any other processing happens.
    root: '.',
    base: './',
    publicDir: 'static_files',

    plugins: [
      pugPlugin(path.resolve(__dirname, 'src/templates/index.pug')),
      espruinoLoaderPlugin(),
      firmwareLoaderPlugin({ download: isProd }),
    ],

    define: {
      __DEVELOPMENT__: !isProd,
      __PRODUCTION__: isProd,
      'process.env.NODE_DEBUG': 'undefined',
    },

    resolve: {
      alias: [
        {
          find: 'events',
          replacement: path.resolve(__dirname, 'node_modules/events'),
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
  }
})
