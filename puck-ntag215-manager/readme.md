# How to use

If you haven't already, you will need to install the custom firmware for the puck.js that adds NTAG215 emulation

To install the updated firmware, you will first need to enter DFU mode. To enter DFU mode, remove the battery and re-insert it while holding the button until a green light turns on.

Once you're in DFU mode, you can click the "Update Firmware" button above.

Once you have the custom firmware installed, you can upload the script file by clicking the "Upload Script".

If you want to manually upload the script, see the section below.

## Manual Script Upload

First you'll need to write [this .js file](https://raw.githubusercontent.com/DanTheMan827/ntag215-puck.js/master/ntag215.js) to your puck.js with the [Espruino IDE](https://www.espruino.com/ide/), then after you do that you'll be able to connect with this page by clicking connect to puck.

If you ever want to put the puck back into programming mode, you can click the enable uart button that appears after connecting.

**Note:** For best compatibility, you'll want to enable code minification, mangle, and pretokenise code before upload in the [Espruino IDE](https://www.espruino.com/ide/)
