import { createElement, type ReactNode } from 'react'
import { ModalMessages, type ModalMessagesProps } from './components/ModalMessages'

export enum ModalMessageType {
  SaveToFlash = 'save-to-flash',
  DebugMode = 'debug-mode',
  DfuInstructions = 'dfu-instructions',
  FirmwareUpdate = 'firmware-update',
}

export function modalMessages(
  kind: ModalMessageType,
  options: Omit<ModalMessagesProps, 'kind'> = {}
): ReactNode {
  return createElement(ModalMessages, { kind, ...options })
}
