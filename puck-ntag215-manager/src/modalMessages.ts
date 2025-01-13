const template = require("./templates/modal-messages.pug")

export enum ModalMessageType {
  SaveToFlash = "save-to-flash",
  DebugMode = "debug-mode",
  DfuInstructions = "dfu-instructions",
  FirmwareUpdate = "firmware-update"
}

export function modalMessages(kind: ModalMessageType, options: any = { }): JQuery<HTMLElement> {
  return $(template({
    kind,
    ...options
  }))
}
