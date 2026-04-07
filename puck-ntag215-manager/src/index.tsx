import "./style/main.scss"

import { StrictMode, createElement, Fragment } from 'react'
import { hydrateRoot, createRoot, type Root } from 'react-dom/client'
import { App } from "./components/App"
import { getBlankNtag } from "./ntag215"
import { Puck } from "./puck"
import { showModal, hideModal, setModal, ModalButtonTypes, ModalResult } from "./modal"
import { saveData, readFile } from "./fileHelpers"
import { supportsBluetooth, bluetoothOrError } from "./browserCheck"
import { EspruinoBoards, SecureDfuUpdate, SecureDfuUpdateMessage, SecureDfuUpdateProgress } from "./SecureDfuUpdate"
import * as EspruinoHelper from "./espruino"
import { ModalMessageType, modalMessages } from "./modalMessages"
import { selectText } from "./selectText"
import { Slot } from "./components/Slot"
import { BoardSelector } from "./components/BoardSelector"

const anyWindow = (window as any)
const puck = anyWindow.puck = new Puck(console.log, console.warn, console.error)

function qs<T extends HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!
}

// In production the root div is pre-rendered server-side; use hydrateRoot to
// attach React to the existing DOM without discarding the pre-rendered HTML.
// In development there is no pre-rendered content, so fall back to createRoot.
const rootEl = document.getElementById('root')!
const app = createElement(StrictMode, null, createElement(App))
if (__PRODUCTION__) {
  hydrateRoot(rootEl, app)
} else {
  createRoot(rootEl).render(app)
}

document.addEventListener('app:mounted', () => {
  const mainContainer = qs('#mainContainer')
  const scriptTextArea = qs<HTMLTextAreaElement>('#code')
  const firmwareName = qs('#code').textContent!.match(/const FIRMWARE_NAME = "([^"]+)";/)![1]

  // React root for the slots container — created lazily.
  let slotsRoot: Root | null = null
  // Cache of { slot, summary } so we can re-render after an individual update.
  const slotCache = new Map<number, { slot: number; summary: Uint8Array }>()

  if (supportsBluetooth !== true) {
    showModal({
      title: "Unsupported Browser",
      message: supportsBluetooth,
    })
  }

  if (__DEVELOPMENT__) {
    anyWindow.debug = {
      ...(anyWindow.debug || {}),
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

  // ---------- slot rendering ----------

  function renderSlots() {
    const container = qs('#slotsContainer')
    if (!slotsRoot) slotsRoot = createRoot(container)

    const entries = Array.from(slotCache.values())
    slotsRoot.render(
      createElement(
        Fragment,
        null,
        ...entries.map(({ slot, summary }) =>
          createElement(Slot, {
            key: slot,
            slot,
            uid: array2hex(summary.slice(0, 8)),
            onDownload: () => handleDownload(slot),
            onUpload: () => handleUpload(slot),
            onClear: () => handleClear(slot),
            onSelect: () => handleSelect(slot),
          }),
        ),
      ),
    )
  }

  function array2hex(data: Uint8Array): string {
    return Array.prototype.map
      .call(data, (e: number) => ('00' + e.toString(16)).slice(-2))
      .join('')
  }

  async function refreshSlot(slot: number) {
    const info = await puck.readSlotSummary(slot)
    slotCache.set(slot, { slot, summary: info })
    renderSlots()
  }

  async function writeSlot(slot: number, data: Uint8Array) {
    await showModal({ title: "Please Wait", message: `Writing slot ${slot + 1}`, preventClose: true })
    await puck.writeSlot(slot, data)
    await refreshSlot(slot)
    await hideModal()
  }

  async function handleDownload(slot: number) {
    try {
      await showModal({ title: "Please Wait", message: `Reading slot ${slot + 1}`, preventClose: true })
      const data = await puck.readSlot(slot)
      await hideModal()
      saveData(data, `slot${slot}.bin`)
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function handleUpload(slot: number) {
    try {
      const file = await readFile(572)
      await writeSlot(slot, file.data)
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function handleClear(slot: number) {
    await writeSlot(slot, getBlankNtag())
  }

  async function handleSelect(slot: number) {
    try {
      await showModal({ title: "Please Wait", message: `Changing to slot ${slot + 1}`, preventClose: true })
      await puck.changeSlot(slot)
      await hideModal()
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  // ---------- puck actions ----------

  async function populateSlots() {
    slotCache.clear()
    if (puck.isConnected) {
      const info = await puck.getSlotInformation()
      for (let i = 0; i < info.totalSlots; i++) {
        setModal({ message: `Reading Slot ${i + 1}` })
        const summary = await puck.readSlotSummary(i)
        slotCache.set(i, { slot: i, summary })
      }
      renderSlots()
    }
  }

  async function connectPuck(e: Event) {
    e.preventDefault()
    try {
      await bluetoothOrError()
      await showModal({ title: "Please Wait", message: "Connecting to puck", preventClose: true })
      await puck.connect(async (ev: Event) => { await disconnectPuck(ev) })

      if (puck.isConnected) {
        qs('#puckUart').style.display = puck.isUart ? 'none' : ''
        await populateSlots()
        mainContainer.classList.add("connected")
      }

      if (firmwareName !== puck.firmwareName) {
        const install = ModalResult.ButtonYes === await showModal({
          title: "Script Update Available",
          message: "There is a script update available, do you want to update?",
          dialog: true,
          buttons: ModalButtonTypes.YesNo,
        })
        if (install) { await enableUart(e); await uploadScript(e) }
      } else {
        await hideModal()
      }
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function disconnectPuck(e: Event) {
    e.preventDefault()
    try {
      if (puck.isConnected) {
        await showModal({ title: "Please Wait", message: "Disconnecting from puck", preventClose: true })
        await puck.disconnect()
      }
      mainContainer.classList.remove("connected")
      await hideModal()
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function enableUart(e: Event) {
    e.preventDefault()
    try {
      await showModal({ title: "Please Wait", message: "Enabling UART", preventClose: true })
      await puck.enableUart()
      await disconnectPuck(e)
      await hideModal()
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function changeName(e: Event) {
    e.preventDefault()
    try {
      await showModal({ title: "Please Wait", message: "Reading puck name", preventClose: true })
      const currentName = await puck.getName()
      const newName = prompt("Enter a name", currentName)
      if (newName != null) {
        await showModal({ title: "Please Wait", message: "Setting puck name", preventClose: true })
        await puck.setName(newName)
      }
      await hideModal()
    } catch (error) {
      await showModal({ title: "Error", message: (error as Error).toString() })
    }
  }

  async function hardwareChooser(): Promise<EspruinoBoards> {
    const boards = [
      { name: "Bangle.js",   value: EspruinoBoards.BangleJS },
      { name: "Bangle.js 2", value: EspruinoBoards.BangleJS2 },
      { name: "Pixl.js",     value: EspruinoBoards.PixlJS },
      { name: "Puck.js",     value: EspruinoBoards.PuckJSMinimal, selected: true },
    ]

    // Track selection via onChange; default is the pre-selected board.
    let selectedBoard: EspruinoBoards = EspruinoBoards.PuckJSMinimal

    const result = await showModal({
      title: "Select your board",
      message: createElement(BoardSelector, {
        boards,
        onChange: (v) => { selectedBoard = v as EspruinoBoards },
      }),
      dialog: true,
      buttons: ModalButtonTypes.Next,
    })

    if (result === ModalResult.ButtonNext) return selectedBoard
    throw new Error("User cancelled board selection.")
  }

  async function uploadScript(e: Event) {
    try {
      await bluetoothOrError()
      await showModal({ title: "Please Wait", message: "Connecting to puck", preventClose: true })
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
          preventClose: true, buttons: ModalButtonTypes.YesNo, dialog: true,
        })) {
          await showModal({ title: "Loading Firmware", message: "Downloading firmware", preventClose: true })
          await updateFirmware(e, true, board as EspruinoBoards)
        } else {
          return
        }
      }

      const modalResult = await showModal({
        title: "Save to Flash?",
        message: modalMessages(ModalMessageType.SaveToFlash),
        buttons: ModalButtonTypes.YesNo, dialog: true, preventClose: true,
      })
      const debugModalResult = await showModal({
        title: "Enable Debug Mode?",
        message: modalMessages(ModalMessageType.DebugMode),
        buttons: ModalButtonTypes.YesNo, dialog: true, preventClose: true,
      })

      await showModal({ title: "Please Wait", message: "Uploading script file, please wait.", preventClose: true })
      await EspruinoHelper.writeCode({
        saveToFlash: modalResult === ModalResult.ButtonYes,
        enableDebug: debugModalResult === ModalResult.ButtonYes,
        board, enableLed1, enableLed2, enableLed3,
      })

      EspruinoHelper.close()
      await hideModal()
    } catch (error) {
      EspruinoHelper.close()
      await showModal({ title: "Error", message: (error as Error).toString() })
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
        dialog: true, preventClose: true, buttons: ModalButtonTypes.Next,
      })

      let previousMessage: string

      async function status(event: SecureDfuUpdateMessage) {
        previousMessage = event.message
        canClose = event.final
        if (modalShown === false || event.final) {
          modalShown = true
          await showModal({ title: "Updating Firmware", message: previousMessage, preventClose: event.final !== true })
        } else {
          setModal({ title: "Updating Firmware", message: previousMessage })
        }
      }

      async function log(event: SecureDfuUpdateMessage) { console.log(event) }

      async function progress(event: SecureDfuUpdateProgress) {
        setModal({
          title: "Updating Firmware",
          message: modalMessages(ModalMessageType.FirmwareUpdate, {
            message: previousMessage,
            currentBytes: event.currentBytes,
            totalBytes: event.totalBytes,
          }),
        })
      }

      const dfu = new SecureDfuUpdate(status, log, progress)
      await dfu.update(board || await hardwareChooser())
    } catch (error) {
      if (throwError) throw error
      if (modalShown === false || canClose !== true) {
        await showModal({ title: "Error", message: (error as Error).toString() })
      } else {
        setModal({ title: "Error", message: (error as Error).toString() })
      }
    }
  }

  // ---------- wire up buttons ----------
  const on = (sel: string, fn: EventListener) => qs(sel).addEventListener('click', fn)

  on('#puckConnect', connectPuck)
  on('#puckDisconnect', disconnectPuck)
  on('#puckUart', enableUart)
  on('#puckName', changeName)
  on('#uploadScript', uploadScript)
  on('#updateFirmware', updateFirmware)

  ;[qs('#code'), ...Array.from(document.querySelectorAll<HTMLAnchorElement>('#readme a[href$="ntag215.js"]'))].forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      selectText(scriptTextArea)
    })
  })

  ;[qs('#puckConnect'), qs('#updateFirmware'), qs('#uploadScript'), qs('#puckDisconnect'), qs('#puckName'), qs('#puckUart')].forEach(btn => {
    (btn as HTMLButtonElement).disabled = false
  })
}, { once: true })
