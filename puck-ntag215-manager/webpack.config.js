const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const internalPath = path.resolve(path.join(__dirname, 'node_modules', '.cache', 'dist-temp'));


const babelLoader = {
  loader: "babel-loader",
  options: {
    presets: [
      '@babel/typescript',
      '@babel/preset-env'
    ],
    plugins: ['@babel/plugin-transform-runtime', '@babel/proposal-class-properties', '@babel/proposal-object-rest-spread'],
    cacheDirectory: true
  }
};

jsEntries = {
  main: './src/index.ts',
}

styleEntries = {
  style: './stylesheets/main.scss'
}

module.exports = (env, argv) => {
  return {
    mode: argv.mode || "development",
    entry: { ...jsEntries },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(?:js|ts)x?$/,
          use: [
            babelLoader
          ],
          exclude: /(node_modules|bower_components)/
        },
        {
          test: /\.s?css$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader", // translates CSS into CommonJS
            "postcss-loader",
            "sass-loader" // compiles Sass to CSS, using Node Sass by default
          ]
        },
        {
          test: /\.(?:pug|jade)$/,
          use: [
            babelLoader,
            'pug-loader'
          ]
        },
        {
          test: /\.(gif|jpe?g|png|woff2?|eot|ttf|svg)$/,
          loader: 'file-loader',
          options: {
            esModule: false,
            outputPath: 'assets/'
          }
        }
      ]
    },
    optimization: {
      minimize: argv.mode == "production",
      minimizer: argv.mode != "production" ? [] : [
        new TerserPlugin(),
        new CssMinimizerPlugin(),
      ]
    },
    externals: {
      window: "window",
      document: "document",
      location: "location"
    },
    plugins: [
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "[contenthash].css",
        chunkFilename: "[contenthash].css"
      }),
      new HtmlWebpackPlugin({
        template: './src/templates/index.pug',
        minify: false
      }),
      new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
        "window.jQuery": "jquery"
      }),
      new webpack.DefinePlugin((() => {
        const mode = argv.mode || "development"

        return {
          '__DEVELOPMENT__': mode === 'development',
          '__PRODUCTION__': mode === 'production'
        }
      })())
    ],
    resolve: {
      alias: {
        jquery: "jquery/src/jquery"
      },
      extensions: [
        '.wasm', '.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'
      ]
    },
    resolveLoader: {
      alias: {
        'espruino-loader': path.join(__dirname, 'espruino-loader.js')
      }
    },
    output: {
      path: internalPath,
      filename: '[contenthash].js',
      devtoolNamespace: 'dantheman827.github.io/ntag215-puck.js',
      devtoolModuleFilenameTemplate: 'https://[namespace]/[resource-path]?[loaders]'
    }
  }
};
