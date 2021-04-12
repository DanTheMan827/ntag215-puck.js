const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const webpack = require('webpack');
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

const smp = new SpeedMeasurePlugin();
const internalPath = path.resolve(path.join(__dirname, 'node_modules', '.cache', 'dist-temp'));
const publicPath = '/dist/';


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

module.exports = smp.wrap({
  mode: "production",
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
          {
            loader: MiniCssExtractPlugin.loader
          },
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
    minimizer: [
      new UglifyJsPlugin({
        cache: false,
        parallel: true,
        sourceMap: true, // set to true if you want JS source maps
        extractComments: {
          condition: /^\**!|@preserve|@license|@cc_on/i,
          filename(file) {
            return `${file}.LICENSE`;
          },
          banner(licenseFile) {
            return `License information can be found in ${licenseFile}`;
          },
        },
      }),
      new OptimizeCSSAssetsPlugin({})
    ]
  },
  externals: {
    window: "window",
    document: "document",
    location: "location"
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/templates/index.pug'
    }),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[hash].css",
      chunkFilename: "[id]-[hash].css"
    }),
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
      "window.jQuery": "jquery"
    })
  ],
  resolve: {
    alias: {
      jquery: "jquery/src/jquery"
    },
    extensions: [
      '.wasm', '.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'
    ]
  },
  output: {
    path: internalPath,
    //publicPath: publicPath,
    filename: '[hash].js',
    sourceMapFilename: '[hash].map'
  }
});
