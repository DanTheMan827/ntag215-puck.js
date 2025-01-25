import SecureDfu from "web-bluetooth-dfu"
import { SecureDfuPackage } from "./SecureDfuPackage"

const CRC32 = require("crc-32")

export enum EspruinoBoards {
  PuckJS = "PUCKJS",
  PuckJSMinimal = "PUCKJS_MINIMAL",
  PixlJS = "PIXLJS",
  BangleJS = "BANGLEJS",
  BangleJS2 = "BANGLEJS2",
  MDBT42Q = "MDBT42Q"
}

export interface SecureDfuUpdateProgress {
  object: string
  totalBytes: number
  currentBytes: number
}

export interface SecureDfuUpdateMessage {
  message: string
  final?: boolean
}

function getFirmware(board: EspruinoBoards): Promise<ArrayBuffer> {
  switch (board) {
    case EspruinoBoards.BangleJS:
      return require("./firmware/espruino_2v15.767_banglejs.zip")

    case EspruinoBoards.BangleJS2:
      return require("./firmware/espruino_2v15.767_banglejs2.zip")

    case EspruinoBoards.PuckJS:
      return require("./firmware/espruino_2v25.7_puckjs.zip")

    case EspruinoBoards.PuckJSMinimal:
      return require("./firmware/espruino_2v25.7_puckjs_minimal.zip")

    case EspruinoBoards.PixlJS:
      return require("./firmware/espruino_2v15.767_pixljs.zip")

    default: throw new Error(`Invalid board: ${board}`)
  }
}

export class SecureDfuUpdate {
  static EVENT_LOG = "log"
  static EVENT_PROGRESS = "progress"
  static EVENT_STATUS = "status"

  dfu: SecureDfu
  logCallback: (message: SecureDfuUpdateMessage) => Promise<any>
  progressCallback: (message: SecureDfuUpdateProgress) => Promise<any>
  statusCallback: (message: SecureDfuUpdateMessage) => Promise<any>

  constructor(statusCallback: (message: SecureDfuUpdateMessage) => Promise<any>, logCallback: (message: SecureDfuUpdateMessage) => Promise<any>, progressCallback: (message: SecureDfuUpdateProgress) => Promise<any>) {
    this.logCallback = logCallback
    this.statusCallback = statusCallback
    this.progressCallback = progressCallback
    this.dfu = new SecureDfu(CRC32.buf)
    this.dfu.addEventListener(SecureDfu.EVENT_LOG, logCallback)
    this.dfu.addEventListener(SecureDfu.EVENT_PROGRESS, progressCallback)
  }

  private async loadPackage(board: EspruinoBoards): Promise<SecureDfuPackage> {
    return new SecureDfuPackage(await getFirmware(board))
  }

  async update(board: EspruinoBoards) {
    const updatePackage = this.loadPackage(board)

    await this.statusCallback({ message: "Connecting to device" })
    const device = await this.dfu.requestDevice(false, null)

    await this.statusCallback({ message: `Loading firmware: ${board}`})
    const baseImage = await (await updatePackage).getBaseImage()
    const appImage = await (await updatePackage).getAppImage()

    for (const image of [baseImage, appImage]) {
      if (image) {
        await this.statusCallback({ message: `Updating ${image.type}: ${image.imageFile}...` })
        await this.dfu.update(device, image.initData, image.imageData);
      }
    }

    await this.statusCallback({ message: "Update complete!", final: true })
  }
}
