import EventEmitter from "events"
import SecureDfu from "web-bluetooth-dfu"
import { EventDispatcher } from "./dispatcher"
import { SecureDfuPackage } from "./SecureDfuPackage"

const CRC32 = require("crc-32")
const firmware: ArrayBuffer = require("arraybuffer-loader!../espruino_2v15.1_puckjs.zip")

export interface SecureDfuUpdateProgress {
  object: string
  totalBytes: number
  currentBytes: number
}

export interface SecureDfuUpdateMessage {
  message: string
  final?: boolean
}

export class SecureDfuUpdate extends EventDispatcher {
  static EVENT_LOG = "log"
  static EVENT_PROGRESS = "progress"
  static EVENT_STATUS = "status"

  dfu: SecureDfu
  logCallback: (message: SecureDfuUpdateMessage) => any
  progressCallback: (message: SecureDfuUpdateProgress) => any
  statusCallback: (message: SecureDfuUpdateMessage) => any

  constructor(statusCallback: (message: SecureDfuUpdateMessage) => any, logCallback: (message: SecureDfuUpdateMessage) => any, progressCallback: (message: SecureDfuUpdateProgress) => any) {
    super()
    this.logCallback = logCallback
    this.statusCallback = statusCallback
    this.progressCallback = progressCallback
    this.dfu = new SecureDfu(CRC32.buf)
    this.dfu.addEventListener(SecureDfu.EVENT_LOG, logCallback)
    this.dfu.addEventListener(SecureDfu.EVENT_PROGRESS, progressCallback)
  }

  private async loadPackage(): Promise<SecureDfuPackage> {
    return new SecureDfuPackage(firmware)
  }

  async update() {
    const device = await this.dfu.requestDevice(false, null)
    const updatePackage = await this.loadPackage()
    const baseImage = await updatePackage.getBaseImage()
    const appImage = await updatePackage.getAppImage()

    for (const image of [baseImage, appImage]) {
      if (image) {
        this.statusCallback({ message: `Updating ${image.type}: ${image.imageFile}...` })
        await this.dfu.update(device, image.initData, image.imageData);
      }
    }

    this.statusCallback({ message: "Update complete!", final: true })
  }
}
