import { read } from "fs";

const serviceId = "78290001-d52e-473f-a9f4-f03da7c67dd1"
const commandCharacteristicId = "78290002-d52e-473f-a9f4-f03da7c67dd1"
const returnCharacteristicId = "78290003-d52e-473f-a9f4-f03da7c67dd1"
const nameCharacteristicId = "78290004-d52e-473f-a9f4-f03da7c67dd1"
const log = console.log

export class Puck {
  private device: BluetoothDevice
  private server: BluetoothRemoteGATTServer
  private service: BluetoothRemoteGATTService
  private commandCharacteristic: BluetoothRemoteGATTCharacteristic
  private returnCharacteristic: BluetoothRemoteGATTCharacteristic
  private nameCharacteristic: BluetoothRemoteGATTCharacteristic
  private totalSlots: number

  get isConnected(): boolean {
    return this.server && this.server.connected
  }

  async connect(disconnectCallback?: (this: BluetoothDevice, ev: Event) => any) {
    if (this.isConnected) {
      await this.disconnect()
    }

    log('Requesting Bluetooth Device...')
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [serviceId] }]
    })

    if (disconnectCallback != null) {
      this.device.addEventListener("gattserverdisconnected", disconnectCallback)
    }

    log('Connecting to GATT Server...')
    this.server = await this.device.gatt.connect()

    log('Getting Puck Service...')
    this.service = await this.server.getPrimaryService(serviceId)

    log('Getting Command Characteristic...')
    this.commandCharacteristic = await this.service.getCharacteristic(commandCharacteristicId)

    log('Getting Return Characteristic...')
    this.returnCharacteristic = await this.service.getCharacteristic(returnCharacteristicId)

    log('Getting Name Characteristic...')
    this.nameCharacteristic = await this.service.getCharacteristic(nameCharacteristicId)

    log('Getting slot information')
    const info = await this.getSlotInformation()
    this.totalSlots = info.totalSlots
  }

  async disconnect() {
    if (this.isConnected) {
      await this.server.disconnect()
    }

    this.device = null
    this.server = null
    this.service = null
    this.commandCharacteristic = null
    this.returnCharacteristic = null
    this.nameCharacteristic = null
  }

  async getName() {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const nameBytes = await this.nameCharacteristic.readValue()

    return new TextDecoder().decode(nameBytes)
  }

  async setName(name = "Puck") {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const nameBytes = new TextEncoder().encode(name)

    await this.nameCharacteristic.writeValueWithResponse(nameBytes)
  }

  private async _read(slot: number, startPage: number, count: number): Promise<Uint8Array> {
    const command = [Puck.Command.Read, slot, startPage, count]

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
    while (true) {
      const response = await this.returnCharacteristic.readValue()
      const responseArray = new Uint8Array((response).buffer)

      if (responseArray[0] === command[0] &&
        responseArray[1] === command[1] &&
        responseArray[2] === command[2] &&
        responseArray[3] === command[3]) {
        return responseArray.slice(4)
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
      const command = [Puck.Command.SlotInformation, slot]

      await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))

      while (true) {
        const response = await this.returnCharacteristic.readValue()
        const responseArray = new Uint8Array((response).buffer)

        if (responseArray.length == 82 && command[0] === responseArray[0] && command[1] === responseArray[1]) {
          return responseArray.slice(2)
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

    if (slot >= 0 && slot < this.totalSlots) {
      const data = new Uint8Array(572)
      const maxPages = 63

      let currentPage = 0

      while (currentPage < 143) {
        const pageCount = Math.min(maxPages, 143 - currentPage)
        const currentData = await this._read(slot, currentPage, pageCount)

        data.set(currentData, currentPage * 4)
        currentPage += pageCount
      }

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

    if (slot >= 0 && slot < this.totalSlots && data != null && data.length <= 572) {
      const paddedArray = new Uint8Array(572)
      paddedArray.set(data, 0)

      for (let i = 0; i < paddedArray.length; i += 16) {
        const dataSlice = paddedArray.slice(i, i + 16)
        const command = new Uint8Array(dataSlice.length + 3)
        command[0] = Puck.Command.Write
        command[1] = slot
        command[2] = i / 4
        command.set(dataSlice, 3)

        await this.commandCharacteristic.writeValueWithResponse(command)
      }

      await this.restartNfc(info.currentSlot)
    } else {
      throw new Error(`Invalid slot: ${slot}`)
    }
  }

  async getSlotInformation(): Promise<Puck.SlotInfo> {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.SlotInformation]

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
    const response = new Uint8Array((await this.returnCharacteristic.readValue()).buffer)

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

  async enableUart() {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.EnableUart]

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
  }

  async restartNfc(slot: number = null) {
    if (!this.isConnected) {
      throw new Error("Puck is not connected")
    }

    const command = [Puck.Command.RestartNFC]

    if (slot != null) {
      if (slot >= 0 && slot < this.totalSlots) {
        command.push(slot)
      } else {
        throw new Error(`Invalid slot: ${slot}`)
      }
    }

    await this.commandCharacteristic.writeValueWithResponse(Uint8Array.from(command))
  }

  async changeSlot(slot: number) {
    return this.restartNfc(slot)
  }
}

// tslint:disable-next-line: no-namespace
export namespace Puck {
  export interface SlotInfo {
    currentSlot: number
    totalSlots: number
    data?: Uint8Array
  }

  export enum Command {
    SlotInformation = 0x01,
    Read = 0x02,
    Write = 0x03,
    MoveSlot = 0xFD,
    EnableUart = 0xFE,
    RestartNFC = 0xFF
  }
}
