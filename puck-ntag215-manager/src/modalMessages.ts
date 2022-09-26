const template = require("./templates/modal-messages.pug")

export enum ModalMessageType {
  SaveToFlash = "save-to-flash",
  DfuInstructions = "dfu-instructions"
}

export function modalMessages(kind: ModalMessageType): JQuery<HTMLElement> {
  return $(template({ kind }))
}
