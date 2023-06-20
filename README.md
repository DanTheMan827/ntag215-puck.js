# NTAG215 for Puck.js

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/W7W7ECXQ9)

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

**BLE Service:** `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
**Command Characteristic:** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
**Return Characteristic:** `6e400003-b5a3-f393-e0a9-e50e24dcca9e`

If you do not see the following services or characteristics, see the [documentation for the previous version](https://github.com/DanTheMan827/ntag215-puck.js/blob/4811e102dc455a03cd27f76d37483def81cd272d/README.md).

Upon connecting, the Espruino REPL console will be attached.  To exit this, send the bytes `0x66, 0x61, 0x73, 0x74, 0x4D, 0x6F, 0x64, 0x65, 0x28, 0x29, 0x0A` (`fastMode()\n`) to the command characteristic, and wait for the response of `DTM_PUCK_FAST`.  At that point, you can use the binary commands in the list below.

The Bluetooth packet size can vary depending on hardware capabilities, so it's recommended to use the 0x00 command to send the requested number of bytes back to determine the largest packet size.

### Commands

#### 0x00 - BLE Packet Test \<Count>

Returns the number of 0x00 bytes requested.  This can be useful for determining the max BLE packet size.

If no count is given, 255 bytes will be returned.

#### 0x01 - Slot Information \<Slot>

If a slot is specified, a subset of the tag will be returned that can be reconstructed and decrypted to get the amiibo information (like nickname and character).

These 80 bytes are sliced from the full tag with the following code.
```javascript
var output = Uint8Array(80);
output.set(tags[slot].buffer.slice(0, 8), 0);
output.set(tags[slot].buffer.slice(16, 24), 8);
output.set(tags[slot].buffer.slice(32, 52), 20);
output.set(tags[slot].buffer.slice(84, 92), 40);
output.set(tags[slot].buffer.slice(96, 128), 48);
```

Example: `0x01, Slot, <80 bytes>`

If a slot is not specified, it will return `0x01, Current Slot, Slot Count`

#### 0x02 - Read \<Slot> \<StartPage> \<PageCount> \<Data...>
This is used to read the raw tag data from the puck memory, one page is 4 bytes, an entire tag is 143 pages.

Data returned is `0x02, Slot, Start Page, Page Count, Data...`

#### 0x03 - Write \<Slot> \<StartPage>, \<Data...>
The start page can be anything between 0-142, the maximum amount of data that can be sent at once is 16 bytes, this does not need to be divisible by 4.

Data returned is `0x03, Slot, Start Page, Data...`

#### 0x04 - Save \<Slot>
If SAVE_TO_FLASH is enabled in the script, this function will write the data in that slot to flash storage.  You probably want to run this after writing a tag.

Data returned is `0x04, Slot`

#### 0x05 - Full Write \<Slot>

This command is used as a faster alternative to 0x03.  Upon sending the command, the puck will echo it back as acknowledgement, and then wait for 572 bytes of tag data.

Do not send any bytes until receiving the acknowledgement.

572 bytes must be sent for the puck to return to normal operation.

#### 0xFA - Get Bluetooth Name

Returns the puck name as a null-terminated string.

#### 0xFB - Set Bluetooth Name \<Data...> 0x00

Sets the puck name as a null-terminated string.

As of version 2.0.0, this command must fit within a single BLE packet.

#### 0xFC - Get Firmware Version

Returns the firmware version as a null-terminated string.

#### 0xFD - Move \<Source Slot> \<Destination Slot>
This moves the slot from the source to the desination index.

Data returned is `0xFD, Source Slot, Destination Slot`

#### 0xFE - Enable UART
This method enables UART so that the Espruino IDE can connect again, you need to disconnect after calling this.

#### 0xFF - Restart NFC \<Slot>
This restarts the NFC with the slot specified, or the current slot if none was provided.

This is required if the current slot has been overwritten.

Data returned is `0xFF, Slot`
