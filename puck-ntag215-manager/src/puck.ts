import { sleep } from "./sleep"
import { NORDIC_RX, NORDIC_SERVICE, NORDIC_TX } from "./uart/nordic"

export const PUCK_SERVICE = "78290001-d52e-473f-a9f4-f03da7c67dd1"
export const PUCK_TX = "78290002-d52e-473f-a9f4-f03da7c67dd1"
export const PUCK_RX = "78290003-d52e-473f-a9f4-f03da7c67dd1"
export const PUCK_NAME = "78290004-d52e-473f-a9f4-f03da7c67dd1"
export const PUCK_FIRMWARE = "78290005-d52e-473f-a9f4-f03da7c67dd1"

interface CharacteristicEvent extends Event {
  target: BluetoothRemoteGATTCharacteristic;
}

export class Puck {
  private device: BluetoothDevice
  private server: BluetoothRemoteGATTServer
  private service: BluetoothRemoteGATTService
  private commandCharacteristic: BluetoothRemoteGATTCharacteristic
  private returnCharacteristic: BluetoothRemoteGATTCharacteristic
  private nameCharacteristic: BluetoothRemoteGATTCharacteristic
  private totalSlots: number
  private _firmwareName: string
  private nordicUart: boolean
  private previousRx: DataView = new DataView(new ArrayBuffer(0))
  private packetSize = 20

  private static dummyFunc: (...data: any[]) => void = () => undefined

  log: (...data: any[]) => void
  error: (...data: any[]) => void
  warn: (...data: any[]) => void

  constructor(log?: (...data: any[]) => void, warn?: (...data: any[]) => void, error?: (...data: any[]) => void) {
    this.log = log ?? Puck.dummyFunc
    this.warn = warn ?? Puck.dummyFunc
    this.error = error ?? Puck.dummyFunc
  }

  get isConnected(): boolean {
    return this.server && this.server.connected
  }

  get firmwareName(): string {
    return this._firmwareName
  }

  get isUart(): boolean {
    return this.nordicUart
  }

  private async readValue() {
    if (this.nordicUart) {
      await sleep(100)
      return this.previousRx
    }

    return await this.returnCharacteristic.readValue()
  }

  private saveLastValue(ev: CharacteristicEvent) {
    this.previousRx = ev.target.value
    if (ev.target.value.byteLength > this.packetSize) {
      this.packetSize = ev.target.value.byteLength
      console.log(`New packet size: ${this.packetSize}`)
    }
  }

  /**
   *
   * @param bytes The bytes to send
   * @param count The number of bytes to read back.  If the count is 0, the next packet will be read.
   * @param timeout The timeout period, this is reset on each packet received.
   * @returns
   */
  private sendAndReadNext(bytes: Uint8Array, count: number = 0, timeout: number = 5000): Promise<DataView> {
    return new Promise(async (resolve, reject) => {
      const instance = this
      let errorTimer: NodeJS.Timeout = undefined
      const storage = new Uint8Array(count)
      let currentOffset = 0

      const resetTimeout = () => {
        if (timeout > 0) {
          if (errorTimer) {
            clearInterval(errorTimer)
          }

          errorTimer = setTimeout(() => {
            clearTimeout
            reject(new Error("Read timeout."))
          }, timeout)
        }
      }

      const cleanupTimer = () => {
        this.returnCharacteristic.removeEventListener("characteristicvaluechanged", finishName)

        if (errorTimer) {
          clearTimeout(errorTimer)
        }
      }

      const finishName = (ev: CharacteristicEvent) => {
        if (count > 0) {
          const response = new Uint8Array(this.returnCharacteristic.value.buffer)

          resetTimeout()

          for (var i = 0; i < response.length; i++){
            storage[currentOffset++] = response[i]

            if (currentOffset >= count) {
              // We have all the data we wanted
              cleanupTimer()
              resolve(new DataView(storage.buffer))

              return
            }
          }
        } else {
          cleanupTimer()

          resolve(this.returnCharacteristic.value)
        }
      }

      this.returnCharacteristic.addEventListener("characteristicvaluechanged", finishName)

      for (var i = 0; i < bytes.length; i = i + this.packetSize) {
        resetTimeout()
        await this.commandCharacteristic.writeValueWithResponse(bytes.slice(i, i + this.packetSize))
      }
    })
  }

  private async getFirmwareName(): Promise<string> {
    var firmware = await this.sendAndReadNext(Uint8Array.from([Puck.Command.GetFirmware]))

    return new TextDecoder().decode(firmware.buffer).slice(0, -1)
  }

  private initFastMode(timeout: number = 0): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const instance = this
      var errorTimer: NodeJS.Timeout = undefined

      function finishName(this: BluetoothRemoteGATTCharacteristic, ev: CharacteristicEvent) {
        var text = new TextDecoder().decode(ev.target.value)

        if (text == "DTM_PUCK_FAST") {
          this.removeEventListener("characteristicvaluechanged", finishName)

          if (errorTimer) {
            clearTimeout(errorTimer)
          }

          resolve()
        }
      }

      if (timeout > 0) {
        errorTimer = setTimeout(() => {
          this.returnCharacteristic.removeEventListener("characteristicvaluechanged", finishName)
          reject(new Error("Read timeout."))
        }, timeout)
      }

      this.returnCharacteristic.addEventListener("characteristicvaluechanged", finishName)
      await this.commandCharacteristic.writeValueWithResponse(new TextEncoder().encode("fastMode()\n"))
    })
  }

  async connect(disconnectCallback?: (this: BluetoothDevice, ev: Event) => any) {
    if (this.isConnected) {
      await this.disconnect()
    }

    this.log('Requesting Bluetooth Device...')
    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [PUCK_SERVICE] },
        { services: [NORDIC_SERVICE] }
      ]
    })

    if (disconnectCallback != null) {
      this.log('Attached disconnect callback...')
      this.device.addEventListener("gattserverdisconnected", disconnectCallback)
    }

    this.log('Connecting to GATT Server...')
    this.server = await this.device.gatt.connect()

    this.log('Getting Primary Service...')
    var services = await this.server.getPrimaryServices()
    this.service = services[0]

    this.nordicUart = this.service.uuid == NORDIC_SERVICE

    this.log('Getting Command Characteristic...')
    this.commandCharacteristic = await this.service.getCharacteristic(this.nordicUart ? NORDIC_TX : PUCK_TX)

    this.log('Getting Return Characteristic...')
    this.returnCharacteristic = await this.service.getCharacteristic(this.nordicUart ? NORDIC_RX : PUCK_RX)
    this.returnCharacteristic.startNotifications()

    if (this.nordicUart) {
      this.log('Connected to UART interface...')
      await this.initFastMode()
      this._firmwareName = await this.getFirmwareName()
      this.returnCharacteristic.addEventListener("characteristicvaluechanged", (ev: CharacteristicEvent) => this.saveLastValue(ev))
    } else {
      try {
        this.log('Getting Name Characteristic...')
        this.nameCharacteristic = await this.service.getCharacteristic(PUCK_NAME)
      } catch (noNameError) { }

      try {
          this.log('Getting Firmware Characteristic...')
          const firmwareCharacteristic = await this.service.getCharacteristic(PUCK_FIRMWARE)
          this._firmwareName = new TextDecoder().decode(await firmwareCharacteristic.readValue())
      } catch (noFirmwareError) { }
    }
    this.log('Getting slot information')
    const info = await this.getSlotInformation()
    this.totalSlots = info.totalSlots
  }

  async disconnect() {
    if (this.isConnected) {
      this.log('Disconnecting...')
      await this.server.disconnect()
    }

    this.device =
    this.server =
    this.service =
    this.commandCharacteristic =
    this.returnCharacteristic =
    this.nameCharacteristic =
    this._firmwareName = undefined
  }

  async getName() {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const nameBytes = this.nordicUart ? await this.sendAndReadNext(Uint8Array.from([Puck.Command.GetName])) : await this.nameCharacteristic.readValue()

    return new TextDecoder().decode(nameBytes)
  }

  async setName(name = "Puck") {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const nameBytes = new TextEncoder().encode(name)

    if (this.nordicUart) {
      let command = new Uint8Array(nameBytes.length + 1)
      command.set(nameBytes, 1)
      command[0] = Puck.Command.SetName
      this.sendAndReadNext(command, command.length)
    } else {
      await this.nameCharacteristic.writeValueWithResponse(nameBytes)
    }
  }

  private async _read(slot: number, startPage: number, count: number): Promise<Uint8Array> {
    const command = [Puck.Command.Read, slot, startPage, count]

    this.log(`Reading slot ${slot}, page ${startPage} through ${startPage + count}...`)

    if (!this.nordicUart) {
      await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
    }

    while (true) {
      const response = this.nordicUart ? await this.sendAndReadNext(Uint8Array.from(command), 576) : await this.readValue()
      const responseArray = new Uint8Array(response.buffer)

      if (responseArray[0] === command[0] &&
        responseArray[1] === command[1] &&
        responseArray[2] === command[2] &&
        responseArray[3] === command[3]) {
        return responseArray.slice(4)
      }

      if (this.nordicUart){
        throw new Error("Unexpected response.")
      }
    }
  }

  async readSlotSummary(slot: number): Promise<Uint8Array> {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    if (slot == null) {
      const info = await this.getSlotInformation()
      slot = info.currentSlot
    }

    if (slot >= 0 && slot < this.totalSlots) {
      this.log(`Reading slot ${slot} summary...`)

      const command = [Puck.Command.SlotInformation, slot]

      if (!this.nordicUart){
        await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
      }

      while (true) {
        const response = this.nordicUart ? await this.sendAndReadNext(Uint8Array.from(command), 82) : await this.readValue()
        const responseArray = new Uint8Array((response).buffer)

        if (responseArray.length === 82 && command[0] === responseArray[0] && command[1] === responseArray[1]) {
          return responseArray.slice(2)
        }

        if (this.nordicUart){
          throw new Error("Unexpected response.")
        }
      }
    } else {
      throw new Error(`Invalid slot: ${slot}`)
    }
  }

  async readSlot(slot: number): Promise<Uint8Array> {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    if (slot == null) {
      const info = await this.getSlotInformation()
      slot = info.currentSlot
    }

    const startTime = new Date()

    if (slot >= 0 && slot < this.totalSlots) {
      this.log(`Reading slot ${slot}...`)

      const data = new Uint8Array(572)
      const maxPages = this.nordicUart ? 143 : 63

      let currentPage = 0

      while (currentPage < 143) {
        const pageCount = Math.min(maxPages, 143 - currentPage)
        const currentData = await this._read(slot, currentPage, pageCount)

        data.set(currentData, currentPage * 4)
        currentPage += pageCount
      }

      const endTime = new Date()
      console.log(`Total time: ${endTime.getMilliseconds() - startTime.getMilliseconds()}ms`)

      return data
    } else {
      throw new Error(`Invalid slot: ${slot}`)
    }
  }

  async writeSlot(slot: number = null, data: Uint8Array = new Uint8Array(572)) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const info = await this.getSlotInformation()

    if (slot == null) {
      slot = info.currentSlot
    }

    const startTime = new Date()
    const maxBytes = Math.floor((this.packetSize - 3) / 4) * 4

    if (slot >= 0 && slot < this.totalSlots && data != null && data.length <= 572) {
      const paddedArray = new Uint8Array(572)
      paddedArray.set(data, 0)

      if (this.nordicUart) {
        await this.sendAndReadNext(Uint8Array.from([Puck.Command.FullWrite, slot]))
        await this.sendAndReadNext(paddedArray);
      } else {
        for (let i = 0; i < paddedArray.length; i += maxBytes) {
          const dataSlice = paddedArray.slice(i, i + maxBytes)
          const command = new Uint8Array(dataSlice.length + 3)
          command[0] = Puck.Command.Write
          command[1] = slot
          command[2] = i / 4
          command.set(dataSlice, 3)

          this.log(`Writing to slot ${slot}, page ${command[2]} for ${dataSlice.length} bytes...`)

          await this.commandCharacteristic.writeValueWithResponse(command)
        }
      }

      const endTime = new Date()
      console.log(`Total time: ${endTime.getMilliseconds() - startTime.getMilliseconds()}ms`)

      await this.restartNfc(info.currentSlot)
      await this.saveSlot(slot)
    } else {
      throw new Error(`Invalid slot: ${slot}`)
    }
  }

  async saveSlot(slot: number = null) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.SaveSlot]

    if (slot != null) {
      this.log(`Saving slot ${slot}`)

      if (slot >= 0 && slot < this.totalSlots) {
        command.push(slot)
      } else {
        throw new Error(`Invalid slot: ${slot}`)
      }
    } else {
      this.log("Saving current slot")
    }

    if (this.nordicUart) {
      await this.sendAndReadNext(Uint8Array.from(command))
    } else {
      await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
    }
  }

  async getSlotInformation(): Promise<Puck.SlotInfo> {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.SlotInformation]

    this.log("Reading slot information...")
    var response: Uint8Array

    if (this.nordicUart) {
      var rawResponse = await this.sendAndReadNext(Uint8Array.from(command))
      response = new Uint8Array(rawResponse.buffer)
    } else {
      await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
      response = new Uint8Array((await this.readValue()).buffer)
    }

    return {
      currentSlot: response[1],
      totalSlots: response[2]
    }
  }

  async moveSlot(from: number, to: number) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    if (from == null || from < 0 || from >= this.totalSlots) {
      throw new Error(`Invalid from slot: ${from}`)
    }

    if (to == null || to < 0 || to >= this.totalSlots) {
      throw new Error(`Invalid to slot: ${from}`)
    }

    if (from === to) {
      return
    }

    const command = [Puck.Command.MoveSlot, from, to]

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
  }

  async enableUart(disconnect = false) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.EnableUart]

    this.log("Enabling UART...")

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))

    if (disconnect) {
      await this.disconnect()
    }
  }

  async restartNfc(slot: number = null) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.RestartNFC]

    if (slot != null) {
      this.log(`Restarting NFC with slot ${slot}`)

      if (slot >= 0 && slot < this.totalSlots) {
        command.push(slot)
      } else {
        throw new Error(`Invalid slot: ${slot}`)
      }
    } else {
      this.log("Restarting NFC")
    }

    if (this.nordicUart) {
      await this.sendAndReadNext(Uint8Array.from(command))
    } else {
      await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
    }
  }

  changeSlot = this.restartNfc
}

// tslint:disable-next-line: no-namespace
export namespace Puck {
  export interface SlotInfo {
    currentSlot: number
    totalSlots: number
    data?: Uint8Array
  }

  export enum Command {
    BlePacketTest = 0x00,
    SlotInformation = 0x01,
    Read = 0x02,
    Write = 0x03,
    SaveSlot = 0x04,
    FullWrite = 0x05,
    GetName = 0xFA,
    SetName = 0xFB,
    GetFirmware = 0xFC,
    MoveSlot = 0xFD,
    EnableUart = 0xFE,
    RestartNFC = 0xFF
  }
}
