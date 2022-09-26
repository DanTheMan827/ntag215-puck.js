'use strict'

const loaderUtils = require('loader-utils')

module.exports = function (content) {
  if (this.cacheable) { this.cacheable() }

  const toArrayBufferPath =
    loaderUtils.stringifyRequest(this, require.resolve('arraybuffer-loader/lib/to-array-buffer.js'))

  const downloadFilePath =
    loaderUtils.stringifyRequest(this, require.resolve('./download-file-promise.ts'))

  const options = loaderUtils.getOptions(this)

  if (options.download) {
    const base64Data = content.toString('base64')

    return `module.exports = require(${downloadFilePath})("${this.utils.contextify(options.root, this.resourcePath)}")`;
  } else {
    const base64Data = content.toString('base64')

    return `module.exports = Promise.resolve(require(${toArrayBufferPath})("${base64Data}"))`;
  }
}

module.exports.raw = true
