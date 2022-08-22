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

A full WebBluetooth implementation of everything in TypeScript can be found in [puck.ts](https://github.com/DanTheMan827/ntag215-puck.js/blob/master/puck-ntag215-manager/src/puck.ts)

**BLE Service:** `78290001-d52e-473f-a9f4-f03da7c67dd1`  
**Command Characteristic:** `78290002-d52e-473f-a9f4-f03da7c67dd1`  
**Return Characteristic:** `78290003-d52e-473f-a9f4-f03da7c67dd1`  
**Name Characteristic:** `78290004-d52e-473f-a9f4-f03da7c67dd1`

Writing to the name characteristic will change the bluetooth name the puck.js identifies as.

**Commands Include:**

**0x01 - Slot Information <Slot>**
This returns a subset of the full tag data, just enough for an app to reconstruct that into a "full" tag and decrypt it to get things like the amiibo nickname.

Slot is optional, but if omitted will return info for the currently selected slot.

Data returned is `0x01, Current Slot, Slot Count`

**0x02 - Read <Slot> <StartPage> <PageCount> <Data...>**
This is used to read the raw tag data from the puck memory, one page is 4 bytes, and the most you can request at a time is 64 pages.

Data returned is `0x02, Slot, Start Page, Page Count, Data...`

**0x03 - Write <Slot> <StartPage>, <Data...>**
The start page can be anything between 0-142, the maximum amount of data that can be sent at once is 16 bytes, this does not need to be divisible by 4.

Data returned is `0x03, Slot, Start Page, Data...`

**0x04 - Save <Slot>**
If SAVE_TO_FLASH is enabled in the script, this function will write the data in that slot to flash storage.  You probably want to run this after writing a tag.

Data returned is `0x04, Slot`

**0xFD - Move <Source Slot> <Destination Slot>**
This moves the slot from the source to the desination index.

Data returned is `0xFD, Source Slot, Destination Slot`

**0xFE - Enable UART**
This method enables UART, you need to disconnect after calling this.

**0xFF - Restart NFC <Slot>**
This restarts the NFC with the slot specified, or the current slot if none was provided.

This is required if the current slot has been overwritten.

Data returned is `0xFF, Slot`
