import { createElement, Fragment, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Modal as BsModal } from 'bootstrap'
import { AlertModal } from './components/AlertModal'
import { sleep } from './sleep'
import {
  ModalButtonTypes,
  ModalResult,
  type ModalTemplateButton,
  type ModalSetOptions,
  type ModalShowOptions,
} from './modalTypes'

// Re-export all types/enums so existing imports from './modal' keep working.
export {
  ModalButtonTypes,
  ModalResult,
  type ModalTemplateButton,
  type ModalSetOptions,
  type ModalShowOptions,
} from './modalTypes'
export type {
  ModalTitleOptions,
  ModalMessageOptions,
} from './modalTypes'

// ---------- module state ----------
let container: HTMLDivElement | null = null
let root: Root | null = null
let bsInstance: BsModal | null = null
let modalShowing = false
let modalResolve: ((v: ModalResult) => void) | null = null
let modalReject: ((e: unknown) => void) | null = null

// Current render props (kept so setModal can do partial updates).
let curTitle: string | undefined
let curBody: ReactNode
let curButtons: ModalTemplateButton[]
let curPreventClose: boolean

// ---------- helpers ----------

function ensureRoot(): Root {
  if (!container || !root) {
    container = document.createElement('div')
    container.id = 'react-modal-portal'
    document.body.appendChild(container)
    root = createRoot(container)
  }
  return root
}

function doRender() {
  ensureRoot().render(
    createElement(
      AlertModal,
      {
        title: curTitle,
        buttons: curButtons,
        preventClose: curPreventClose,
        onClose: handleClose,
        onMount: (bs) => { bsInstance = bs },
      },
      curBody,
    ),
  )
}

/** Called by the AlertModal when any close action occurs (button click or X). */
async function handleClose(result: ModalResult) {
  // Resolve the promise before hiding so callers can still read modal-hosted
  // React state (e.g. a <select> ref inside BoardSelector) synchronously.
  const resolve = modalResolve
  modalResolve = null
  modalReject = null

  if (resolve) resolve(result)

  bsInstance?.hide()
  await sleep(300)
  ensureRoot().render(createElement(Fragment, null))
  modalShowing = false
  bsInstance = null
}

function buildButtonList(type: ModalButtonTypes): ModalTemplateButton[] {
  switch (type) {
    case ModalButtonTypes.Close:
      return [{ label: 'Close', value: ModalResult.ButtonClose }]
    case ModalButtonTypes.YesNo:
      return [
        { label: 'Yes', value: ModalResult.ButtonYes },
        { label: 'No', value: ModalResult.ButtonNo },
      ]
    case ModalButtonTypes.YesNoCancel:
      return [
        { label: 'Yes', value: ModalResult.ButtonYes },
        { label: 'No', value: ModalResult.ButtonNo },
        { label: 'Cancel', value: ModalResult.ButtonCancel },
      ]
    case ModalButtonTypes.Next:
      return [{ label: 'Next', value: ModalResult.ButtonNext }]
    case ModalButtonTypes.None:
    default:
      return []
  }
}

function bodyNode(message: ReactNode, htmlEscapeBody: boolean): ReactNode {
  if (typeof message === 'string') {
    return htmlEscapeBody
      ? createElement('p', null, message)                          // React auto-escapes
      : createElement('div', { dangerouslySetInnerHTML: { __html: message } })
  }
  return message
}

// ---------- public API ----------

export async function showModal(options: ModalShowOptions): Promise<ModalResult> {
  if (modalShowing) {
    await hideModal()
  }

  const { title, message, preventClose = false, htmlEscapeBody = true, dialog = false } = options
  const buttonType = options.buttons ?? (preventClose ? ModalButtonTypes.None : ModalButtonTypes.Close)

  curTitle = title
  curBody = bodyNode(message, htmlEscapeBody)
  curButtons = buildButtonList(buttonType)
  curPreventClose = preventClose

  doRender()
  modalShowing = true

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
  curTitle = htmlEscape ? title : title // HTML escaping handled by React; kept for API compat
  doRender()
}

export function setBody(body: ReactNode, htmlEscape = true) {
  curBody = typeof body === 'string' ? bodyNode(body, htmlEscape) : body
  doRender()
}

export function setModal(options: ModalSetOptions) {
  if (options.title !== undefined) curTitle = options.title
  if (options.message !== undefined) {
    curBody = bodyNode(options.message, options.htmlEscapeBody ?? true)
  }
  doRender()
}

export async function hideModal() {
  if (!bsInstance) {
    if (root) ensureRoot().render(createElement(Fragment, null))
    modalShowing = false
    const resolve = modalResolve
    modalResolve = null
    modalReject = null
    if (resolve) resolve(ModalResult.ScriptDismiss)
    return
  }

  bsInstance.hide()
  await sleep(300)
  ensureRoot().render(createElement(Fragment, null))
  modalShowing = false
  bsInstance = null

  const resolve = modalResolve
  modalResolve = null
  modalReject = null
  if (resolve) resolve(ModalResult.ScriptDismiss)
}
