import template from "./templates/modal.pug"
import { sleep } from "./sleep"
import { Modal } from "bootstrap"

let modalElement: HTMLElement | undefined
let bsModal: Modal | undefined
let modalHeader: HTMLElement | undefined
let modalFooter: HTMLElement | undefined
let modalTitle: HTMLElement | undefined
let modalBody: HTMLElement | undefined
let modalClose: HTMLElement | undefined
let modalResolve: (value: ModalResult | PromiseLike<ModalResult>) => void | undefined
let modalReject: (reason?: any) => void | undefined

let modalShowing = false
let modalCanClose = true

export interface ModalTemplateButton {
  value: ModalResult,
  label: string
}

export interface ModalTemplateOptions {
  buttons?: ModalTemplateButton[]
}

export interface ModalTitleOptions {
  title?: string
  htmlEscapeTitle?: boolean
}

export interface ModalMessageOptions {
  message?: string | HTMLElement

  /**
   * If `message` is an HTMLElement, this will always be false.
   */
  htmlEscapeBody?: boolean
}

export interface ModalSetOptions extends ModalTitleOptions, ModalMessageOptions {}

export interface ModalShowOptions extends ModalTitleOptions, ModalMessageOptions {
  title: string
  message: string | HTMLElement
  preventClose?: boolean

  /**
   * Whether to wait for a dismissal before resolving the promise.
   */
  dialog?: boolean

  /** The button or buttons to present to the user */
  buttons?: ModalButtonTypes
}

/**
 * Does nothing... yet...
 */
export enum ModalButtonTypes {
  None,
  Close,
  YesNo,
  YesNoCancel,
  Next
}

export enum ModalResult {
  /**
   * Returned if dialog is false and the modal is shown.
   */
  ModalShown,

  /**
   * Returned when the modal is dismissed with a call to HideModal.
   */
  ScriptDismiss,

  /**
   * Returned when the user dismisses the dialog by clicking the X, clicking on the background, or using escape.
   */
  BackgroundClick,

  /**
   * User pressed the "Close" button.
   */
  ButtonClose,

  /**
   * User pressed the "Yes" button.
   */
  ButtonYes,

  /**
   * User pressed the "No" button.
   */
  ButtonNo,

  /**
   * User pressed the "Cancel" button.
   */
  ButtonCancel,

  /**
   * User pressed the "Next" button.
   */
  ButtonNext,

  /**
   * User pressed the "X" button in the corner of the window.
   */
  ButtonCloseX = 255
}

async function modalBackgroundClick(e: MouseEvent) {
  if (!modalCanClose) {
    return
  }

  const target = e.target as HTMLElement
  if (target.classList.contains('modal-dialog') || target.closest('.modal-dialog')) {
    return
  }

  const resolve = modalResolve

  modalResolve = undefined
  modalReject = undefined

  await hideModal()

  if (resolve) {
    resolve(ModalResult.BackgroundClick)
  }
}

async function modalButtonClick(this: HTMLElement, _e: Event) {
  const dataValue = this.dataset.closeValue

  const resolve = modalResolve
  const reject = modalReject

  modalResolve = undefined
  modalReject = undefined

  await hideModal()

  if (resolve) {
    if (dataValue && dataValue.match(/^\d+$/)) {
      const intValue = parseInt(dataValue, 10)

      if ([ModalResult.ButtonYes, ModalResult.ButtonNo, ModalResult.ButtonCancel, ModalResult.ButtonClose, ModalResult.ButtonCloseX, ModalResult.ButtonNext].includes(intValue)) {
        resolve(intValue as ModalResult)
      }
    } else {
      reject(new Error(`Unknown button value: ${dataValue}`))
    }
  }
}

function setElementContent(el: HTMLElement, content: string | HTMLElement, htmlEscape: boolean) {
  el.innerHTML = ''
  if (content instanceof HTMLElement) {
    el.appendChild(content)
  } else if (htmlEscape) {
    const p = document.createElement('p')
    p.textContent = content
    el.appendChild(p)
  } else {
    const p = document.createElement('p')
    p.innerHTML = content
    el.appendChild(p)
  }
}

export async function showModal(options: ModalShowOptions): Promise<ModalResult> {

  const {
    title,
    message,
    preventClose = false,
    htmlEscapeTitle = true,
    dialog = false,
  } = options
  let {
    htmlEscapeBody = true
  } = options
  const buttons = options.buttons || (preventClose ? ModalButtonTypes.None : ModalButtonTypes.Close)

  if (options.message instanceof HTMLElement) {
    htmlEscapeBody = false
  }

  if (modalShowing) {
    await hideModal()
  }

  const buttonList: ModalTemplateButton[] = []

  switch (buttons) {
    case ModalButtonTypes.Close:
      buttonList.push({
        label: "Close",
        value: ModalResult.ButtonClose
      })
      break

    case ModalButtonTypes.YesNo:
      buttonList.push({
        label: "Yes",
        value: ModalResult.ButtonYes
      }, {
        label: "No",
        value: ModalResult.ButtonNo
      })
      break

    case ModalButtonTypes.YesNoCancel:
      buttonList.push({
        label: "Yes",
        value: ModalResult.ButtonYes
      }, {
        label: "No",
        value: ModalResult.ButtonNo
      }, {
        label: "Cancel",
        value: ModalResult.ButtonCancel
      })
      break

    case ModalButtonTypes.Next:
      buttonList.push({
        label: "Next",
        value: ModalResult.ButtonNext
      })

    case ModalButtonTypes.None:
    default:
      break
  }

  const wrapper = document.createElement('div')
  wrapper.innerHTML = template({ buttons: buttonList })
  const newModalEl = wrapper.firstElementChild as HTMLElement

  if (modalElement) {
    modalElement.remove()
  }

  modalElement = newModalEl
  modalHeader = newModalEl.querySelector('.modal-header') as HTMLElement
  modalFooter = newModalEl.querySelector('.modal-footer') as HTMLElement
  modalTitle = newModalEl.querySelector('.modal-title') as HTMLElement
  modalBody = newModalEl.querySelector('.modal-body') as HTMLElement
  modalClose = newModalEl.querySelector('.btn-close.close-modal') as HTMLElement

  newModalEl.querySelectorAll<HTMLElement>('.close-modal[data-close-value]').forEach(btn => {
    btn.addEventListener('click', function(e) { modalButtonClick.call(this, e) })
  })
  newModalEl.addEventListener('click', modalBackgroundClick)

  document.body.appendChild(newModalEl)

  modalShowing = true
  if (title != null) {
    modalHeader.style.display = ''
    if (htmlEscapeTitle) {
      modalTitle.textContent = title
    } else {
      modalTitle.innerHTML = title
    }
  } else {
    modalHeader.style.display = 'none'
  }

  setElementContent(modalBody, message, htmlEscapeBody)

  if (preventClose) {
    if (modalFooter) modalFooter.style.display = 'none'
    if (modalClose) modalClose.style.display = 'none'
  } else {
    if (modalFooter) modalFooter.style.display = ''
    if (modalClose) modalClose.style.display = ''
  }

  if (dialog && buttonList.length > 0) {
    if (modalFooter) modalFooter.style.display = ''
  }

  bsModal = new Modal(newModalEl, { backdrop: 'static', keyboard: false })
  bsModal.show()

  modalCanClose = preventClose !== true

  if (dialog) {
    return new Promise((resolve, reject) => {
      modalResolve = resolve
      modalReject = reject
    })
  }

  await sleep(200)

  return ModalResult.ModalShown
}

export function setTitle(title: string, htmlEscape = true) {
  if (!modalHeader || !modalTitle) {
    throw new Error("Modal is not presenting.")
  }

  if (title != null) {
    modalHeader.style.display = ''
    if (htmlEscape) {
      modalTitle.textContent = title
    } else {
      modalTitle.innerHTML = title
    }
  } else {
    modalHeader.style.display = 'none'
  }
}

export function setBody(body: string | HTMLElement, htmlEscape = true) {
  if (!modalBody) {
    throw new Error("Modal is not presenting.")
  }

  setElementContent(modalBody, body, htmlEscape)
}

export function setModal(options: ModalSetOptions) {
  const {
    title,
    htmlEscapeTitle = true,
    message,
    htmlEscapeBody = true
  } = options

  if (title != null) {
    setTitle(title, htmlEscapeTitle)
  }

  if (message != null) {
    setBody(message, htmlEscapeBody)
  }
}

export async function hideModal() {
  if (!modalElement || !bsModal) {
    return
  }

  bsModal.hide()
  await sleep(300)
  modalElement.remove()
  modalShowing = false

  modalElement =
  bsModal =
  modalHeader =
  modalFooter =
  modalTitle =
  modalBody =
  modalClose = undefined

  if (modalResolve) {
    modalResolve(ModalResult.ScriptDismiss)
    modalResolve = undefined
    modalReject = undefined
  }
}

