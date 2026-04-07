var fs = require("fs");
module.exports = {
  plugins: {
    'postcss-preset-env': {
      browsers: fs.readFileSync("./.browserslistrc").toString().replace(/\r/g, '').split("\n")
    },
    'cssnano': {}
  }
}