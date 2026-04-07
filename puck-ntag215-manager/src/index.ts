import "./style/main.scss"

import { getBlankNtag } from "./ntag215"
import { Puck } from "./puck"
import { showModal, hideModal, setModal, ModalButtonTypes, ModalResult } from "./modal"
import { saveData, readFile } from "./fileHelpers"
import { supportsBluetooth, bluetoothOrError } from "./browserCheck"
import { EspruinoBoards, SecureDfuUpdate, SecureDfuUpdateMessage, SecureDfuUpdateProgress } from "./SecureDfuUpdate"
import * as EspruinoHelper from "./espruino"
import { ModalMessageType, modalMessages } from "./modalMessages"
import { selectText } from "./selectText"
import slotTemplate from "./templates/slot.pug"
import boardTemplate from "./templates/board-selector.pug"

const anyWindow = (window as any)
const puck = anyWindow.puck = new Puck(console.log, console.warn, console.error)

function qs<T extends HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!
}

document.addEventListener('DOMContentLoaded', () => {
  const mainContainer = qs('#mainContainer')
  const slotsContainer = qs('#slotsContainer')
  const scriptTextArea = qs<HTMLTextAreaElement>('#code')
  const firmwareName = qs('#code').textContent!.match(/const FIRMWARE_NAME = "([^"]+)";/)![1]

  if (supportsBluetooth !== true) {
    showModal({
      title: "Unsupported Browser",
      message: supportsBluetooth,
      htmlEscapeBody: false
    })
  }

  if (__DEVELOPMENT__) {
    anyWindow.debug = {
      ...(anyWindow.debug || { }),
      ...{
        EspruinoHelper,
        hardwareChooser,
        hideModal,
        modalMessages,
        puck,
        readFile,
        saveData,
        setModal,
        showModal,
      }
    }
  }

  async function populateSlots() {
    slotsContainer.innerHTML = ''

    if (puck.isConnected) {
      const info = await puck.getSlotInformation()

      for (let i = 0; i < info.totalSlots; i++) {
        setModal({
          message: `Reading Slot ${i + 1}`
        })
        const slotInfo = await puck.readSlotSummary(i)
        slotsContainer.appendChild(getSlotElement(i, slotInfo))
      }
    }
  }

  function array2hex(data: Uint8Array): string {
    return Array.prototype.map.call(data, (e: number) => ("00" + e.toString(16)).slice(-2)).join("")
  }

  async function updateSlotElement(slot: number, oldElement: HTMLElement) {
    const info = await puck.readSlotSummary(slot)
    const newEl = getSlotElement(slot, info)
    oldElement.parentNode!.insertBefore(newEl, oldElement.nextSibling)
    oldElement.remove()
  }

  async function writeSlot(slot: number, data: Uint8Array, element: HTMLElement) {
    await showModal({
      title: "Please Wait",
      message: `Writing slot ${slot + 1}`,
      preventClose: true
    })
    await puck.writeSlot(slot, data)
    await updateSlotElement(slot, element)
    await hideModal()
  }

  function getSlotElement(slot: number, summary: Uint8Array): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = slotTemplate({
      slot,
      uid: array2hex(summary.slice(0, 8))
    })
    const element = wrapper.firstElementChild as HTMLElement

    element.querySelector('a.slot-download-link')!.addEventListener('click', async (e) => {
      e.preventDefault()

      try {
        await showModal({
          title: "Please Wait",
          message: `Reading slot ${slot + 1}`,
          preventClose: true
        })
        const data = await puck.readSlot(slot)
        await hideModal()
        saveData(data, `slot${slot}.bin`)
      } catch (error) {
        await showModal({
          title: "Error",
          message: error.toString()
        })
      }
    })

    element.querySelector('a.slot-upload-link')!.addEventListener('click', async (e) => {
      e.preventDefault()

      try {
        const file = await readFile(572)
        await writeSlot(slot, file.data, element)
      } catch (error) {
        await showModal({
          title: "Error",
          message: error.toString()
        })
      }
    })

    element.querySelector('a.slot-clear-link')!.addEventListener('click', async (e) => {
      e.preventDefault()

      await writeSlot(slot, getBlankNtag(), element)
    })

    element.querySelector('a.slot-select-link')!.addEventListener('click', async (e) => {
      e.preventDefault()

      try {
        await showModal({
          title: "Please Wait",
          message: `Changing to slot ${slot + 1}`,
          preventClose: true
        })
        await puck.changeSlot(slot)
        await hideModal()
      } catch (error) {
        await showModal({
          title: "Error",
          message: error.toString()
        })
      }
    })

    return element
  }

  async function connectPuck(e: Event) {
    e.preventDefault()

    try {
      await bluetoothOrError()
      await showModal({
        title: "Please Wait",
        message: "Connecting to puck",
        preventClose: true
      })
      await puck.connect(async (ev: Event) => {
        await disconnectPuck(ev)
      })

      if (puck.isConnected) {
        const puckUartBtn = qs('#puckUart')
        if (puck.isUart) {
          puckUartBtn.style.display = 'none'
        } else {
          puckUartBtn.style.display = ''
        }

        await populateSlots()

        mainContainer.classList.add("connected")
      }

      if (firmwareName !== puck.firmwareName) {
        const installUpdatedScript = ModalResult.ButtonYes === await showModal({
          title: "Script Update Available",
          message: "There is a script update available, do you want to update?",
          dialog: true,
          buttons: ModalButtonTypes.YesNo
        })

        if (installUpdatedScript) {
          await enableUart(e)
          await uploadScript(e)
        }
      } else {
        await hideModal()
      }

    } catch (error) {
      await showModal({
        title: "Error",
        message: error.toString()
      })
    }
  }

  async function disconnectPuck(e: Event) {
    e.preventDefault()
    try {
      if (puck.isConnected) {
        await showModal({
          title: "Please Wait",
          message: "Disconnecting from puck",
          preventClose: true
        })
        await puck.disconnect()
      }

      mainContainer.classList.remove("connected")

      await hideModal()
    } catch (error) {
      await showModal({
        title: "Error",
        message: error.toString()
      })
    }
  }

  async function enableUart(e: Event) {
    e.preventDefault()
    try {
      await showModal({
        title: "Please Wait",
        message: "Enabling UART",
        preventClose: true
      })
      await puck.enableUart()
      await disconnectPuck(e)
      await hideModal()
    } catch (error) {
      await showModal({
        title: "Error",
        message: error.toString()
      })
    }
  }

  async function changeName(e: Event) {
    e.preventDefault()
    try {
      await showModal({
        title: "Please Wait",
        message: "Reading puck name",
        preventClose: true
      })
      const currentName = await puck.getName()
      const newName = prompt("Enter a name", currentName)

      if (newName != null) {
        await showModal({
          title: "Please Wait",
          message: "Setting puck name",
          preventClose: true
        })
        await puck.setName(newName)
      }

      await hideModal()
    } catch (error) {
      await showModal({
        title: "Error",
        message: error.toString()
      })
    }
  }

  async function hardwareChooser(): Promise<EspruinoBoards> {
    const boards = [
      {
        name: "Bangle.js",
        value: EspruinoBoards.BangleJS
      },
      {
        name: "Bangle.js 2",
        value: EspruinoBoards.BangleJS2
      },
      {
        name: "Pixl.js",
        value: EspruinoBoards.PixlJS
      },
      {
        name: "Puck.js",
        value: EspruinoBoards.PuckJSMinimal,
        selected: true
      }
    ]

    const wrapper = document.createElement('div')
    wrapper.innerHTML = boardTemplate({ boards })
    const selector = wrapper.querySelector<HTMLSelectElement>('select')!

    const result = await showModal({
      title: "Select your board",
      message: wrapper,
      dialog: true,
      buttons: ModalButtonTypes.Next
    })

    if (result === ModalResult.ButtonNext) {
      return selector.value as EspruinoBoards
    }

    throw new Error("User cancelled board selection.")
  }

  async function uploadScript(e: Event) {
    try {
      await bluetoothOrError()
      await showModal({
        title: "Please Wait",
        message: "Connecting to puck",
        preventClose: true
      })
      await EspruinoHelper.open()

      const board = await EspruinoHelper.getBoard()
      const enableLed1 = await EspruinoHelper.checkLed(1)
      const enableLed2 = await EspruinoHelper.checkLed(2)
      const enableLed3 = await EspruinoHelper.checkLed(3)
      const ver = await EspruinoHelper.getNtagVersion()

      if (!(ver.major === 1 && ver.minor >= 0)) {
        EspruinoHelper.close()

        if (ModalResult.ButtonYes === await showModal({
          title: "Firmware Update",
          message: "To use this script you must install a custom firmware onto your Puck.js, do you want to do that now?",
          preventClose: true,
          buttons: ModalButtonTypes.YesNo,
          dialog: true
        })) {
          await showModal({
            title: "Loading Firmware",
            message: "Downloading firmware",
            preventClose: true
          })
          await updateFirmware(e, true, board as EspruinoBoards)
        } else {
          return
        }
      }

      const modalResult = await showModal({
        title: "Save to Flash?",
        message: modalMessages(ModalMessageType.SaveToFlash),
        htmlEscapeBody: false,
        buttons: ModalButtonTypes.YesNo,
        dialog: true,
        preventClose: true
      })

      const debugModalResult = await showModal({
        title: "Enable Debug Mode?",
        message: modalMessages(ModalMessageType.DebugMode),
        htmlEscapeBody: false,
        buttons: ModalButtonTypes.YesNo,
        dialog: true,
        preventClose: true
      })

      await showModal({
        title: "Please Wait",
        message: "Uploading script file, please wait.",
        preventClose: true
      })

      await EspruinoHelper.writeCode({
        saveToFlash: modalResult === ModalResult.ButtonYes,
        enableDebug: debugModalResult === ModalResult.ButtonYes,
        board,
        enableLed1,
        enableLed2,
        enableLed3
      })

      EspruinoHelper.close()
      await hideModal()
    } catch (error) {
      EspruinoHelper.close()

      await showModal({
        title: "Error",
        message: error.toString()
      })
    }
  }

  async function updateFirmware(e: Event, throwError?: boolean, board?: EspruinoBoards) {
    let modalShown = false
    let canClose = true

    try {
      await bluetoothOrError()

      await showModal({
        title: "Instructions",
        message: modalMessages(ModalMessageType.DfuInstructions),
        dialog: true,
        preventClose: true,
        buttons: ModalButtonTypes.Next
      })

      let previousMessage: string

      async function status(event: SecureDfuUpdateMessage) {
        previousMessage = event.message
        canClose = event.final

        if (modalShown === false || event.final) {
          modalShown = true
          await showModal({
            title: "Updating Firmware",
            message: previousMessage,
            preventClose: event.final !== true
          })
        } else {
          setModal({
            title: "Updating Firmware",
            message: previousMessage
          })
        }
      }

      async function log(event: SecureDfuUpdateMessage) {
        console.log(event)
      }

      async function progress(event: SecureDfuUpdateProgress) {
        setModal({
          title: "Updating Firmware",
          message: modalMessages(ModalMessageType.FirmwareUpdate, {
            message: previousMessage,
            currentBytes: event.currentBytes,
            totalBytes: event.totalBytes
          })
        })
      }

      const dfu = new SecureDfuUpdate(status, log, progress)

      await dfu.update(board || await hardwareChooser())
    } catch (error) {
      if (throwError) {
        throw error
      }

      if (modalShown === false || canClose !== true) {
        await showModal({
          title: "Error",
          message: error.toString()
        })
      } else {
        setModal({
          title: "Error",
          message: error.toString()
        })
      }
    }
  }

  const on = (sel: string, ev: string, fn: EventListener) =>
    qs(sel).addEventListener(ev, fn)

  on('#puckConnect', 'click', connectPuck)
  on('#puckDisconnect', 'click', disconnectPuck)
  on('#puckUart', 'click', enableUart)
  on('#puckName', 'click', changeName)
  on('#uploadScript', 'click', uploadScript)
  on('#updateFirmware', 'click', updateFirmware)

  ;[qs('#code'), ...Array.from(document.querySelectorAll<HTMLAnchorElement>('#readme a[href$="ntag215.js"]'))].forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      selectText(scriptTextArea)
    })
  })

  ;[qs('#puckConnect'), qs('#updateFirmware'), qs('#uploadScript'), qs('#puckDisconnect'), qs('#puckName'), qs('#puckUart')].forEach(btn => {
    (btn as HTMLButtonElement).disabled = false
  })
})
