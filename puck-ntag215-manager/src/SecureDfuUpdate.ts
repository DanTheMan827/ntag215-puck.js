import SecureDfu from "web-bluetooth-dfu"
import { SecureDfuPackage } from "./SecureDfuPackage"

const CRC32 = require("crc-32")

// @ts-ignore:next-line
const firmware: Promise<{default: ArrayBuffer}> = import("arraybuffer-loader!../espruino_2v15.1_puckjs.zip")

export interface SecureDfuUpdateProgress {
  object: string
  totalBytes: number
  currentBytes: number
}

export interface SecureDfuUpdateMessage {
  message: string
  final?: boolean
}

export class SecureDfuUpdate {
  static EVENT_LOG = "log"
  static EVENT_PROGRESS = "progress"
  static EVENT_STATUS = "status"

  dfu: SecureDfu
  logCallback: (message: SecureDfuUpdateMessage) => any
  progressCallback: (message: SecureDfuUpdateProgress) => any
  statusCallback: (message: SecureDfuUpdateMessage) => any

  constructor(statusCallback: (message: SecureDfuUpdateMessage) => any, logCallback: (message: SecureDfuUpdateMessage) => any, progressCallback: (message: SecureDfuUpdateProgress) => any) {
    this.logCallback = logCallback
    this.statusCallback = statusCallback
    this.progressCallback = progressCallback
    this.dfu = new SecureDfu(CRC32.buf)
    this.dfu.addEventListener(SecureDfu.EVENT_LOG, logCallback)
    this.dfu.addEventListener(SecureDfu.EVENT_PROGRESS, progressCallback)
  }

  private async loadPackage(): Promise<SecureDfuPackage> {
    return new SecureDfuPackage((await firmware).default)
  }

  async update() {
    this.statusCallback({ message: "Loading firmware archive"})
    const updatePackage = await this.loadPackage()

    const baseImage = await updatePackage.getBaseImage()
    const appImage = await updatePackage.getAppImage()

    this.statusCallback({ message: "Connecting to device"})
    const device = await this.dfu.requestDevice(false, null)

    for (const image of [baseImage, appImage]) {
      if (image) {
        this.statusCallback({ message: `Updating ${image.type}: ${image.imageFile}...` })
        await this.dfu.update(device, image.initData, image.imageData);
      }
    }

    this.statusCallback({ message: "Update complete!", final: true })
  }
}
