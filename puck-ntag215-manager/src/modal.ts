let body: JQuery<HTMLElement>
let alertModal: JQuery<HTMLElement>
let modalHeader: JQuery<HTMLElement>
let modalFooter: JQuery<HTMLElement>
let modalTitle: JQuery<HTMLElement>
let modalBody: JQuery<HTMLElement>
let modalClose: JQuery<HTMLElement>

let modalShowing = false

import { sleep } from "./sleep"

require("bootstrap")

$(() => {
  const template = require("./templates/modal.pug")
  body = $(document.body)
  alertModal = $(template())
  modalHeader = alertModal.find(".modal-header")
  modalFooter = alertModal.find(".modal-footer")
  modalTitle = alertModal.find(".modal-title")
  modalBody = alertModal.find(".modal-body > p")
  modalClose = alertModal.find(".close-modal")

  $("body").append(alertModal)
})

export async function showModal(title: string, message: string, preventClose = false, htmlEscapeTitle = true, htmlEscapeBody = true) {
  if (modalShowing) {
    await hideModal()
  }

  modalShowing = true
  if (title != null) {
    modalHeader.show()
    if (htmlEscapeTitle) {
      modalTitle.text(title)
    } else {
      modalTitle.html(title)
    }
  } else {
    modalHeader.hide()
  }

  if (htmlEscapeBody) {
    modalBody.text(message)
  } else {
    modalBody.html(message)
  }

  if (preventClose) {
    modalFooter.hide()
    modalClose.hide()
  } else {
    modalFooter.show()
    modalClose.show()
  }

  alertModal.modal({ backdrop: 'static', keyboard: false, show: true })

  if (!preventClose) {
    $("body > .modal-backdrop").on("click", hideModal)
  }

  await sleep(200)
}

export function setTitle(title: string, htmlEscape = true) {
  if (title != null) {
    modalHeader.show()
    if (htmlEscape) {
      modalTitle.text(title)
    } else {
      modalTitle.html(title)
    }
  } else {
    modalHeader.hide()
  }
}

export function setBody(title: string, htmlEscape = true) {
  if (htmlEscape) {
    modalBody.text(title)
  } else {
    modalBody.html(title)
  }
}

export async function hideModal() {
  const backdrop = $("body > .modal-backdrop")
  alertModal.modal("hide")
  await sleep(200)
  backdrop.remove()
  body.removeClass("modal-open").css("padding-right", "")
  modalShowing = false
}

export function setModal(title?: string, message?: string) {
  if (title != null) {
    modalTitle.text(title)
  }

  if (message != null) {
    modalBody.text(message)
  }
}
