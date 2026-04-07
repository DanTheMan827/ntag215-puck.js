export interface ModalTemplateButton {
  value: ModalResult
  label: string
}

export interface ModalTitleOptions {
  title?: string
  htmlEscapeTitle?: boolean
}

export interface ModalMessageOptions {
  message?: import('react').ReactNode
  /**
   * When true and message is a plain string, wraps it in a <p> tag.
   * React auto-escapes string children so there is no XSS risk.
   * @default true
   */
  htmlEscapeBody?: boolean
}

export interface ModalSetOptions extends ModalTitleOptions, ModalMessageOptions {}

export interface ModalShowOptions extends ModalTitleOptions, ModalMessageOptions {
  title: string
  message: import('react').ReactNode
  preventClose?: boolean
  /** When true, waits for user dismissal before resolving. */
  dialog?: boolean
  buttons?: ModalButtonTypes
}

export enum ModalButtonTypes {
  None,
  Close,
  YesNo,
  YesNoCancel,
  Next,
}

export enum ModalResult {
  /** Returned when dialog is false and the modal is shown. */
  ModalShown,
  /** Returned when the modal is dismissed programmatically via hideModal(). */
  ScriptDismiss,
  /** Returned when the user clicks the backdrop or presses Escape. */
  BackgroundClick,
  ButtonClose,
  ButtonYes,
  ButtonNo,
  ButtonCancel,
  ButtonNext,
  /** Returned when the user clicks the × button. */
  ButtonCloseX = 255,
}
