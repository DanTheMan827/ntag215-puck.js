import { RegisterEspruinoTerser } from "./EspruinoTerser"
import { hideModal } from "./modal"

// tslint:disable-next-line: variable-name
export const Espruino = require("!espruino-loader!espruino/espruino.js")
Espruino.Core.Status = {
  setStatus: console.log,
  hasProgress: console.log,
  incrementProgress: console.log,
  showStatusWindow: console.log,
  hideStatusWindow: console.log
}

Espruino.Core.Notifications = {
  success(msg: string, setStatus: boolean) {
    console.log("[success] " + msg)
  },
  error(msg: string, setStatus: boolean) {
    console.error("[notify_error] " + msg)
  },
  warning(msg: string, setStatus: boolean) {
    console.warn("[notify_warn] " + msg)
  },
  info(msg: string, setStatus: boolean) {
    console.log("[notify_info] " + msg)
  }
}

require("!espruino-loader!espruino/core/utils.js")
require("!espruino-loader!espruino/core/config.js")
require("!espruino-loader!espruino/core/serial.js")
//require("!espruino-loader!espruino/core/serial_chrome_serial.js")
//require("!espruino-loader!espruino/core/serial_chrome_socket.js")
//require("!espruino-loader!espruino/core/serial_node_serial.js")
//require("!espruino-loader!espruino/core/serial_web_audio.js")
require("!espruino-loader!espruino/core/serial_web_bluetooth.js")
//require("!espruino-loader!espruino/core/serial_web_serial.js")
//require("!espruino-loader!espruino/core/serial_websocket_relay.js")
//require("!espruino-loader!espruino/core/serial_frame.js")
require("!espruino-loader!espruino/core/terminal.js")
require("!espruino-loader!espruino/core/codeWriter.js")
//require("!espruino-loader!espruino/core/modules.js")
require("!espruino-loader!espruino/core/env.js")
require("!espruino-loader!espruino/core/flasher.js")
//require("!espruino-loader!espruino/core/flasherESP8266.js")
//require("!espruino-loader!espruino/plugins/boardJSON.js")
//require("!espruino-loader!espruino/plugins/versionChecker.js")
//require("!espruino-loader!espruino/plugins/compiler.js")
//require("!espruino-loader!espruino/plugins/assembler.js")
require("!espruino-loader!espruino/plugins/getGitHub.js")
require("!espruino-loader!espruino/plugins/unicode.js")
RegisterEspruinoTerser(Espruino)
//require("!espruino-loader!espruino/plugins/minify.js")
require("!espruino-loader!espruino/plugins/pretokenise.js")
require("!espruino-loader!espruino/plugins/saveOnSend.js")
require("!espruino-loader!espruino/plugins/setTime.js")

Espruino.Config.set("MINIFICATION_LEVEL", "ESPRIMA")
Espruino.Config.set("MINIFICATION_Mangle", true)
Espruino.Config.set("PRETOKENISE", true)
Espruino.Config.set("SAVE_ON_SEND", 1)
Espruino.Config.set("SAVE_STORAGE_FILE", "")

Espruino.addProcessor("terminalNewLine", (text: string) => {
  console.log("[TERM] " + text)
})

export interface SemVer {
  major: number
  minor: number
  patch: number
}

export interface GetCodeOptions {
  saveToFlash?: boolean,
  enableDebug?: boolean,
  board?: string,
  enableLed1?: boolean,
  enableLed2?: boolean,
  enableLed3?: boolean
}

export function isConnected(): boolean {
  return Espruino.Core.Serial.isConnected()
}

export function close() {
  if (isConnected()) {
    Espruino.Core.Serial.close()
  }
}

export function open() {
  return new Promise((resolve, reject) => {
    close()

    Espruino.Core.Serial.open("Web Bluetooth", resolve, hideModal)
  })
}

export function executeExpression(expression: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isConnected()) {
      reject(new Error("Device not connected"))

      return
    }

    Espruino.Core.Utils.executeExpression(expression, resolve)
  })
}

export async function getNtagVersion(): Promise<SemVer> {
  if (!isConnected()) {
    throw new Error("Device not connected")
  }

  const ver = parseInt(await executeExpression("typeof this.NTAG215 == \"function\" ? NTAG215.version : 0"), 10)

  return {
    major: (ver >> 16) & 255,
    minor: (ver >> 8) & 255,
    patch: ver & 255
  }
}

export async function getBoard(): Promise<string> {
  if (!isConnected()) {
    throw new Error("Device not connected")
  }

  return JSON.parse(await executeExpression("process.env.BOARD"))
}

export async function checkLed(ledNumber: number): Promise<boolean> {
  if (!isConnected()) {
    throw new Error("Device not connected")
  }

  return (await executeExpression(`this.LED${ledNumber} != null`)).trim() == 'true'
}

export function getCode(options: GetCodeOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const {
      saveToFlash = false, enableDebug = false, board = undefined, enableLed1, enableLed2, enableLed3
    } = options
    let code = $("#code").text() as string

    code = code.replace(
      /(const SAVE_TO_FLASH = )(true|false);/,
      `$1${saveToFlash};`
    ).replace(
      /(const ENABLE_LOG = )(true|false);/,
      `$1${enableDebug};`
    ).replace(
      /(const FAST_MODE_CONSOLE = )([^;]+);/,
      `$1${enableDebug ? '"Serial1"' : null};`
    );

    if (board) {
      code = code.replace(
        /(const BOARD = )(process\.env\.BOARD);/,
        `$1${JSON.stringify(board)};`
      )
    }

    if (enableLed1 != null) {
      code = code.replace(
        /(const ENABLE_LED1 = )(this\.LED1 != null);/,
        `$1${enableLed1};`
      )
    }

    if (enableLed2 != null) {
      code = code.replace(
        /(const ENABLE_LED2 = )(this\.LED2 != null);/,
        `$1${enableLed2};`
      )
    }

    if (enableLed3 != null) {
      code = code.replace(
        /(const ENABLE_LED3 = )(this\.LED3 != null);/,
        `$1${enableLed3};`
      )
    }

    Espruino.callProcessor("transformForEspruino", code, resolve)
  })
}

export function writeCode(options: GetCodeOptions = {}): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (!isConnected()) {
      reject(new Error("Device not connected"))

      return
    }

    Espruino.Core.CodeWriter.writeToEspruino(await getCode(options), resolve)
  })
}
