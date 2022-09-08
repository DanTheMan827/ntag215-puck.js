/*
  MIT License

  Copyright (c) 2017 Daniel Radtke

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

module.exports = {
  default: function () {
    var fs = require("fs");
    var path = require("path");

    function loadJS(basePath, displayPath, ...filePaths) {
      var contents = [`\n/* Concatenation of the following files\n\n${(() => {
        var output = [];
        filePaths.forEach(path => {
          output.push("   " + displayPath + path)
        });

        return output.join("\n");
      })()}\n*/`];

      filePaths.forEach(path => {
        console.log("Found " + path);

        contents.push(
          "\n/* --------------------------------------------------------------\n" +
          `   ${displayPath}${path}\n` +
          "   -------------------------------------------------------------- */\n" +
          fs.readFileSync(basePath + path, {encoding:"utf8"})
          );
      });

      return contents;
    }

    var espruinoPath = path.dirname(require.resolve("espruino"));
    console.log(espruinoPath);
    var output = loadJS(espruinoPath, "EspruinoTools",
      "/espruino.js",
      "/core/utils.js",
      "/core/config.js",
      "/core/serial.js",
      //"/core/serial_chrome_serial.js",
      //"/core/serial_chrome_socket.js",
      //"/core/serial_node_serial.js",
      //"/core/serial_web_audio.js",
      "/core/serial_web_bluetooth.js",
      //"/core/serial_web_serial.js",
      //"/core/serial_websocket_relay.js",
      //"/core/serial_frame.js",
      //"/core/terminal.js",
      "/core/codeWriter.js",
      //"/core/modules.js",
      //"/core/env.js",
      "/core/flasher.js",
      //"/core/flasherESP8266.js",
      //"/plugins/boardJSON.js",
      //"/plugins/versionChecker.js",
      //"/plugins/compiler.js",
      //"/plugins/assembler.js",
      "/plugins/getGitHub.js",
      "/plugins/unicode.js",
      "/plugins/minify.js",
      "/plugins/pretokenise.js",
      //"/plugins/saveOnSend.js",
      //"/plugins/setTime.js"
    );

    "acorn,utf8,esprima,esmangle,escodegen".split(",").reverse().forEach(module => {
      if (require.resolve(module)) {
        output.unshift(`var ${module} = require("${module}");`)
      }
    });

    return `${output.join("\n").replace(/require(?:\.resolve)?\(('serialport'|'nw\.gui'|"http"|"https"|"fs")\)/g, 'undefined')}\n\nmodule.exports = Espruino;`;
  }

}
