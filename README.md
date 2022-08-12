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
