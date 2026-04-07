import template from "./templates/modal-messages.pug"

export enum ModalMessageType {
  SaveToFlash = "save-to-flash",
  DebugMode = "debug-mode",
  DfuInstructions = "dfu-instructions",
  FirmwareUpdate = "firmware-update"
}

export function modalMessages(kind: ModalMessageType, options: any = { }): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = template({ kind, ...options })
  return wrapper
}
