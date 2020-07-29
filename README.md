# NTAG215 for Puck.js
This repository contains code for an NTAG215 emulator for the Puck.js

Some notes about the script:
- The code currently allows for 5 different tags to be cycled through by pressing the button.
- The script does not fully implement page locking or password protection.
- You can activate a backdoor for fully writing the tag by using the FAST_READ command on pages 133-134
  - Once activated, you can write pages 0-134 in their entirety with the standard WRITE command and without any restrictions, pages 135-141 contain the 32-byte tag signature.

Things to be implemented:
- Support for reading / writing over BLE
- Full implementation of page locking
- Password protection
