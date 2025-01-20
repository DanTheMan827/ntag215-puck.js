# NTAG215 for Puck.js

**[💖 Become a GitHub Sponsor](https://github.com/sponsors/DanTheMan827)**


This repository contains code for an NTAG215 emulator for the Puck.js

You can put the puck.js to sleep by holding the button for 5 seconds, to wake it just hold for another 5 seconds.

Some notes about the script:
- The code currently allows for 14 different tags with the first 7 able to be cycled through by pressing the button.
- The script does not fully implement page locking or password protection.
- You can activate a backdoor for fully writing the tag by using the FAST_READ command on pages 133-134
  - Once activated, you can write pages 0-134 in their entirety with the standard WRITE command and without any restrictions, pages 135-141 contain the 32-byte tag signature.

Things to be implemented:
- Full implementation of page locking
- Password protection

You can find a web app for managing the tags at https://dantheman827.github.io/ntag215-puck.js/

## Bluetooth Protocol

The Bluetooth protocol involves sending commands to one characteristic, while reading the data from another. The command and return characteristics.

- **BLE Service:** `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **Command Characteristic:** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **Return Characteristic:** `6e400003-b5a3-f393-e0a9-e50e24dcca9e`

If you do not see the following services or characteristics, see the [documentation for the previous version](https://github.com/DanTheMan827/ntag215-puck.js/blob/4811e102dc455a03cd27f76d37483def81cd272d/README.md).

Upon connecting, the Espruino REPL console will be attached.  To exit this, send the bytes `0x66, 0x61, 0x73, 0x74, 0x4D, 0x6F, 0x64, 0x65, 0x28, 0x29, 0x0A` (`fastMode()\n`) to the command characteristic, and wait for a response consisting of or ending with the string `DTM_PUCK_FAST`.  At that point, you can use the binary commands in the list below.

The Bluetooth packet size can vary depending on hardware capabilities, so it's recommended to use the 0x00 command to send the requested number of bytes back to determine the largest packet size.

### Commands

#### 0x00 - BLE Packet Test

Tests BLE packet transmission.

**Parameters:**
- `bytes` (optional): The number of bytes to send back.

**Returns:**
- The number of bytes requested, or 255 if not specified.

---

#### 0x01 - Slot Information

A dual-purpose command that can be used to get a subset of data for identifying the tag, or to get the current slot number and the total number of slots.

If the slot is specified, returns one byte indicating the command, the slot number used, and then 80 bytes of data made from the following code:
```javascript
var output = Uint8Array(80);
output.set(tags[slot].buffer.slice(0, 8), 0);
output.set(tags[slot].buffer.slice(16, 24), 8);
output.set(tags[slot].buffer.slice(32, 52), 20);
output.set(tags[slot].buffer.slice(84, 92), 40);
output.set(tags[slot].buffer.slice(96, 128), 48);
```

**Parameters:**
- `slot` (optional): The slot number. If the slot is out of range, the current slot is used.
- `count` (optional): The number of slots to read.  This requires that the slot also be specified.

**Returns:**
- If the slot is not specified, returns one byte indicating the command, the current slot number, and the total number of slots.
- If the slot is specified, returns one byte indicating the command, the slot number used, and then 80 bytes of data. This will be repeated for the number of slots requested, or through the last slot available if the number requested is more than available.

---

#### 0x02 - Read

Reads data from a slot.

**Parameters:**
- `slot`: The slot number. If the slot is out of range, the current slot is used.
- `startPage`: The start page.
- `pageCount`: The number of pages to read.

**Returns:**
- One byte indicating the command, the slot number used, the start page, the page count, and then the data.
- Total number of bytes: 4 + (pageCount * 4).

---

#### 0x03 - Write

Writes data to a slot.

**Parameters:**
- `slot`: The slot number. If the slot is out of range, the current slot is used.
- `startPage`: The start page.
- `data`: The data to write.

**Returns:**
- Bytes indicating the command, the slot number used, and the start page.
- Total number of bytes: 3.

---

#### 0x04 - Save

Saves the slot. If `SAVE_TO_FLASH` is true, this will save the slot to flash, otherwise it will do nothing. This should always be called after `COMMAND_WRITE`.

**Parameters:**
- `slot` (optional): The slot number. If out of range, the current slot is used.

**Returns:**
- The initial command data sent. This can be ignored and is only sent to acknowledge the command.

---

#### 0x05 - Full Write

Writes a full slot. The command should be sent as one BLE packet, then an acknowledgement will be sent back consisting of the command and the slot. After the acknowledgement, exactly 572 bytes should be sent. This command will wait until all data has been received before more commands can be executed.

**Parameters:**
- `slot`: The slot number to write to.
- `crc32`: The CRC32 checksum of the data encoded as four bytes in little-endian format. If not specified, the data won't be validated. If this is incorrect, the data will be rejected.

**Returns:**
- Bytes indicating the command, slot, and the CRC32 checksum of the received data encoded as four bytes in little-endian format.

---

#### 0x06 - Full Read

Reads a full slot at a time along with calculated CRC32.

**Parameters:**
- `slot` (optional): The slot number. If the slot is out of range, the current slot is used.
- `count` (optional): The number of slots to read.  This requires that the slot also be specified.

**Returns:**
- The command, slot number, CRC32 checksum of the data encoded as four bytes in little-endian format, and 572 bytes of tag data.  This will be repeated for the number of slots requested, or through the last slot available if the number requested is more than available.

---

#### 0xF9 - Clear slot

Sets the slot to a blank NTAG215 with a random UID.

**Parameters:**
- `slot`: The slot to clear.

**Returns:**
- The command, slot, and the nine byte UID of the generated tag.

---

#### 0xFA - Get Bluetooth Name

Requests the Bluetooth name.

**Returns:**
- The name, and a null terminator.

---

#### 0xFB - Set Bluetooth Name

Sets the Bluetooth name.

**Parameters:**
- `data`: The name bytes followed by a null terminator.

**Returns:**
- The command data sent.

---

#### 0xFC - Get Firmware

Requests the firmware name.

**Returns:**
- The firmware name, and a null terminator.

---

#### 0xFD - Move Slot

Moves one slot to another slot.

**Parameters:**
- `from`: The slot to move from.
- `to`: The slot to move to.

---

#### 0xFE - Enable BLE UART

Immediately enables the BLE UART console. Any data received after should be processed as the Espruino console.

---

#### 0xFF - Restart NFC

Restarts NFC. This should be called after a tag has been written if it was written to the currently active slot.

**Parameters:**
- `slot` (optional): The slot number. If the slot is out of range, the current slot is used.
