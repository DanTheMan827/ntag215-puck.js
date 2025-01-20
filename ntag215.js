// #region Constants
/**
 * Set this to true if you want to save the tags to flash memory.
 */
const SAVE_TO_FLASH = false;

/**
 * Idle time before automatically going to sleep.
 */
const AUTO_SLEEP_TIME = 600000;

/**
 * How many miliseconds you have to hold the button to power on the puck
 */
const POWER_ON_TIME = 5000;

/**
 * How many miliseconds you have to hold the button to power off the puck
 */
const POWER_OFF_TIME = 5000;

/**
 * Enable or disable debug messages.
 */
const ENABLE_LOG = false;

/**
 * Target console device that is set when calling {@link fastMode}.
 */
const FAST_MODE_CONSOLE = null;

/**
 * The name of the script.
 */
const FIRMWARE_NAME = "dtm-2.2.0";

/**
 * The file name in flash used to store the bluetooth device name.
 */
const PUCK_NAME_FILE = "puck-name";

/**
 * This string is sent when {@link fastMode} has finished, and {@link fastRx} is ready to receive data.
 */
const FAST_MODE_STRING = "DTM_PUCK_FAST";

/**
 * The board that the script is running on.  Used to determine various features.
 * @type {string}
 */
const BOARD = process.env.BOARD;
// #endregion

// #region Commands
/**
 * Tests BLE packet transmission.
 * @value 0x00
 * @param {number} [bytes] - An optional byte indicating the number of bytes to send back.
 * @returns The number of bytes requested, or 255 if not specified.
 */
const COMMAND_BLE_PACKET_TEST = 0x00;

/**
 * A dual-purpose command that can be used to get a subset of data for identifying the tag, or to get the current slot number and the total number of slots.
 * @value 0x01
 * @param {number} [slot] - An optional byte indicating the slot number.  If the slot is out of range, the current slot is used.
 * @returns If the slot is not specified, returns one byte indicating the command, the current slot number, and the total number of slots.
 *
 *          If the slot is specified, returns one byte indicating the command, the slot number used, and then 80 bytes of data made from the following code:
 *          ```javascript
 *          var output = Uint8Array(80);
 *          output.set(tags[slot].buffer.slice(0, 8), 0);
 *          output.set(tags[slot].buffer.slice(16, 24), 8);
 *          output.set(tags[slot].buffer.slice(32, 52), 20);
 *          output.set(tags[slot].buffer.slice(84, 92), 40);
 *          output.set(tags[slot].buffer.slice(96, 128), 48);
 *          ```
 */
const COMMAND_SLOT_INFORMATION = 0x01;

/**
 * Reads data from a slot. Expects slot number, start page, and page count bytes.
 * @value 0x02
 * @param {number} slot - A byte indicating the slot number.  If the slot is out of range, the current slot is used.
 * @param {number} startPage - A byte indicating the start page.
 * @param {number} pageCount - A byte indicating the number of pages to read.
 * @returns One byte indicating the command, the slot number used, the start page, the page count, and then the data.
 *
 *          Total number of bytes: 4 + (pageCount * 4)
 */
const COMMAND_READ = 0x02;

/**
 * Writes data to a slot. Expects slot number, start page, and data bytes.
 * @value 0x03
 * @param {number} slot - A byte indicating the slot number.  If the slot is out of range, the current slot is used.
 * @param {number} startPage - A byte indicating the start page.
 * @param {Uint8Array} data - The data to write.
 * @returns Bytes indicating the command, the slot number used, and the start page.
 *
 *          Total number of bytes: 3
 */
const COMMAND_WRITE = 0x03;

/**
 * Saves the slot.  If {@link SAVE_TO_FLASH} is true, this will save the slot to flash, otherwise it will do nothing.
 *
 * This always should be called after {@link COMMAND_WRITE} or {@link COMMAND_FULL_WRITE}.
 * @value 0x04
 * @param {number} [slot] - A byte indicating the slot number.  If out of range, the current slot is used.
 * @returns The initial command data sent.  This can be ignored and is only sent to acknowledge the command.
 */
const COMMAND_SAVE = 0x04;

/**
 * Writes a full slot. The command should be sent as one BLE packet, then an acknowledgement will be sent back consisting of the command and the slot.
 *
 * After the acknowledgement, exactly 572 bytes should be sent.
 *
 * This command will wait until all data has been received before more commands can be executed.
 * @value 0x05
 * @param {number} slot - The slot number to write to.
 * @param {number} crc32 - The CRC32 checksum of the data encoded as four bytes in little-endian format.  If not specified, the data won't be validated.  If this is incorrect, the data will be rejected.
 * @returns Bytes indicating the command, slot, and the CRC32 checksum of the received data encoded as four bytes in little-endian format.
 */
const COMMAND_FULL_WRITE = 0x05;

/**
 * Sets the slot to a blank NTAG215 with a random UID.
 * @value 0xF9
 * @param {number} slot - A byte indicating the slot number.
 * @returns The command, slot, and the nine byte UID of the generated tag.
 *
 *          Total number of bytes: 11
 */
const COMMAND_CLEAR_SLOT = 0xF9;

/**
 * Requests the Bluetooth name. Returns the name followed by a null terminator.
 * @value 0xFA
 * @returns The name, and a null terminator.
 */
const COMMAND_GET_BLUETOOTH_NAME = 0xFA;

/**
 * Sets the Bluetooth name. Expects the name bytes followed by a null terminator.
 * @value 0xFB
 * @returns The command data sent.
 */
const COMMAND_SET_BLUETOOTH_NAME = 0xFB;

/**
 * Requests the firmware name
 * @value 0xFC
 * @returns The firmware name, and a null terminator.
 */
const COMMAND_GET_FIRMWARE = 0xFC;

/**
 * Moves one slot to another slot.
 * @value 0xFD
 * @param {number} from - A byte indicating the slot to move from.
 * @param {number} to - A byte indicating the slot to move to.
 */
const COMMAND_MOVE_SLOT = 0xFD;

/**
 * Immediately enables the BLE UART console. Any data received after should be processed as the espruino console.
 * @value 0xFE
 */
const COMMAND_ENABLE_BLE_UART = 0xFE;

/**
 * Restarts NFC. This should be called after a tag has been written if it was written to the currently active slot.
 * @value 0xFF
 * @param {number} [slot] - An optional byte indicating the slot number.  If the slot is out of range, the current slot is used.
 * @returns The command byte and the slot used.
 */
const COMMAND_RESTART_NFC = 0xFF;
// #endregion

// #region Modules
/**
 * The `Storage` module.
 */
const storage = require("Storage");
// #endregion

// #region Mangle Helper
const _BTN = this.BTN;
const _LED1 = this.LED1;
const _LED2 = this.LED2;
const _LED3 = this.LED3;
const _NTAG215 = this.NTAG215;
const _clearTimeout = clearTimeout;
const _setTimeout = setTimeout;
const _setWatch = setWatch;
const _clearWatch = clearWatch;
const _consoleLog = console.log;
const _Math = Math;
const _MathRound = _Math.round;
const _MathRandom = _Math.random;
const _Rising = "rising";
const _Falling = "falling";
const _Bluetooth = this.Bluetooth;
const _Data = "data";
const _Disconnect = "disconnect";
const _Connect = "connect";

// #endregion

// #region Features
/**
 * Whether to enable code that changes LEDs
 */
const ENABLE_LED1 = this.LED1 != null;
const ENABLE_LED2 = this.LED2 != null;
const ENABLE_LED3 = this.LED3 != null;
const ENABLE_LEDS = ENABLE_LED1 || ENABLE_LED2 || ENABLE_LED3;
// #endregion

// #region Variables
/**
 * The active tag index.
 */
var currentTag = 0;

/**
 * Contains the timeout between changing tags.
 */
var changeTagTimeout = null;

/**
 * A buffer used by the NTAG215 emulator.
 */
var txBuffer = new Uint8Array(32);

/**
 * An array of the in-memory tags, unused if {@link SAVE_TO_FLASH} is true
 */
var tags = [];

/**
 * If {@link fastRx} should process data.
 */
var rxPaused = false;

/**
 * Auto-sleep timeout reference.
 */
var autoSleepTimeout = null;

/**
 * If bluetooth is currently connected.
 */
var bluetoothConnected = false;
// #endregion

// #region Tag initialization
while (tags.length < 50 && process.memory().free > 1024) {
  tags.push(new Uint8Array(572));
}

if (ENABLE_LOG) {
  _consoleLog("Tag count: " + tags.length);
}
// #endregion

/**
 * This function clears any pending auto-sleep timeout.
 */
function clearAutoSleep() {
  if (autoSleepTimeout) {
    clearTimeout(autoSleepTimeout);
    autoSleepTimeout = null;
  }
}

/**
 * This function is called during activity to reset the auto-sleep timer.
 */
function resetAutoSleep() {
  clearAutoSleep();
  autoSleepTimeout = setTimeout(powerOff, AUTO_SLEEP_TIME);
}



/**
 * This function will repair a damaged UID for an NTAG215 while ignoring everything else.
 * @returns {boolean} - Whether anything was changed with the tag data.
 */
function fixUid() {
  const tag = getTag(currentTag);

  if (tag[0] == 0x04 && tag[9] == 0x48 && _NTAG215.fixUid()) {
    if (ENABLE_LOG) {
      _consoleLog("Fixed UID");
    }
    return true;
  }

  return false;
}

/**
 * This function takes an array `inputData` as input and converts its elements into hexadecimal format, displaying them in a formatted way for better visualization.
 *
 * Terser will optimize the function away because it's not used, but it's useful to have for debugging.
 * @param {Uint8Array} inputData
 */
function hexDump(inputData) {
  // Initialize an empty string `line`, which will be used to build the output lines containing the hexadecimal values.
  var line = "";

  // Iterate through each element of the `inputData` array.
  for (let i = 0; i < inputData.length; i++) {
    /*
      Convert the decimal value of the current element to a two-digit hexadecimal string.
      If the hexadecimal string is less than two digits, pad it with leading zeros.
      Convert the result to uppercase for consistency.
    */
    const hex = inputData[i].toString(16).padStart(2, '0').toUpperCase();

    // Append the hexadecimal value followed by a space to the `line` string.
    line = line + hex + ' ';

    // Check if the current index is a multiple of 8 (i.e., the end of a line).
    if ((i + 1) % 8 === 0) {
      // If 8 elements have been added to the `line` string, log the current `line` to the console.
      console.log(line.trim());

      // Reset the `line` string to an empty state, to start building the next line.
      line = '';
    }
  }

  /*
    After the loop, there might be remaining elements in the `line` string that were not enough to form a complete line of 8 elements.
    In that case, log the remaining `line` to the console.
  */
  if (line != '') {
    console.log(line.trim());
  }
}

/**
 * Generates a random UID.
 * @returns  {Uint8Array} The UID.
 */
function generateUid() {
  var uid = new Uint8Array(9);
  uid[0] = 0x04;
  uid[1] = _MathRound(_MathRandom() * 255);
  uid[2] = _MathRound(_MathRandom() * 255);
  uid[3] = uid[0] ^ uid[1] ^ uid[2] ^ 0x88;
  uid[4] = _MathRound(_MathRandom() * 255);
  uid[5] = _MathRound(_MathRandom() * 255);
  uid[6] = _MathRound(_MathRandom() * 255);
  uid[7] = _MathRound(_MathRandom() * 255);
  uid[8] = uid[4] ^ uid[5] ^ uid[6] ^ uid[7];

  return uid;
}

/**
 * Generates a blank NTAG215 tag with a random UID.
 * @returns {Uint8Array} - The generated tag.
 */
function generateTag() {
  var tag = new Uint8Array(572);

  // Generate blank NTAG215 tags with random, but valid UID.
  tag.set(generateUid(), 0);

  // Set extra data present in blank tags.
  tag.set([0x48, 0x00, 0x00, 0xE1, 0x10, 0x3E, 0x00, 0x03, 0x00, 0xFE], 0x09);
  tag.set([0xBD, 0x04, 0x00, 0x00, 0xFF, 0x00, 0x05], 0x20B);

  return tag;
}

/**
 * Returns a {@link Uint8Array} for the slot requested.
 * @param {Number} slot - The requested slot.
 * @returns {Uint8Array} - A read / write array in memory.
 */
function getTag(slot) {
  return tags[slot];
}

/**
 * This function returns a select subset of information that can be used to indentify an amiibo character and nickname.
 * @param {number} slot - The desired slot.
 * @returns  {Uint8Array} - A subset of tag tag from 0x00 - 0x08, 0x10 - 0x18, 0x20 - 0x34, 0x54 - 0x5C, 0x60 - 0x80.
 *
 *                          Total number of bytes: 80
 */
function getTagInfo(slot) {
  const output = Uint8Array(80);
  const tag = getTag(slot);

  output.set(tag.slice(0, 8), 0);
  output.set(tag.slice(16, 24), 8);
  output.set(tag.slice(32, 52), 20);
  output.set(tag.slice(84, 92), 40);
  output.set(tag.slice(96, 128), 48);

  return output;
}

/**
 * Changes the active slot to the one chosen.
 * @param {number} slot - The slot to change to
 * @param {boolean} immediate - If this is falsy there will be a 200ms delay, otherwise there will be none.
 */
function changeTag(slot, immediate) {
  if (changeTagTimeout) {
    _clearTimeout(changeTagTimeout);
    changeTagTimeout = null;
  }

  _NTAG215.nfcStop();

  currentTag = slot;

  if (ENABLE_LEDS && currentTag < 7) {
    if (ENABLE_LED1) {
      _LED1.write(currentTag + 1 & 1);
    }

    if (ENABLE_LED2) {
      _LED2.write(currentTag + 1 & 2);
    }

    if (ENABLE_LED3) {
      _LED3.write(currentTag + 1 & 4);
    }
  }

  function innerChangeTag() {
    if (ENABLE_LEDS) {
      if (ENABLE_LED1) {
        _LED1.write(0);
      }

      if (ENABLE_LED2) {
        _LED2.write(0);
      }

      if (ENABLE_LED3) {
        _LED3.write(0);
      }
    }

    _NTAG215.setTagData(getTag(slot).buffer);
    fixUid();
    _NTAG215.nfcStart();
  }

  if (immediate) {
    innerChangeTag();
  } else {
    changeTagTimeout = _setTimeout(innerChangeTag, 200);
  }
}

/**
 * This will cycle through the first 7 slots.
 * @see - {@link changeTag} If you want to change to a specific slot.
 */
function cycleTags() {
  if (AUTO_SLEEP_TIME > 0) {
    if (!bluetoothConnected) {
      resetAutoSleep();
    }
  }

  changeTag(++currentTag >= 7 ? 0 : currentTag);
}

/**
 * Copies the input into a new {@link Uint8Array}
 * @param {Uint8Array} buffer - The input {@link Uint8Array}
 * @returns - A copy of the input.
 */
function getBufferClone(buffer) {
  if (buffer) {
    var output = new Uint8Array(buffer.length);
    output.set(buffer);

    return output;
  }
}

/**
 * Saves the tag to flash.
 * @param {number | undefined} [slot] - The desired slot.  If not set, this will be the currently active slot.
 * @returns
 */
function saveTag(slot) {
  if (slot == undefined) {
    slot = currentTag;
  }

  if (slot < 0 || slot >= tags.length) {
    return;
  }

  if (ENABLE_LOG) {
    _consoleLog("Saving tag " + slot);
  }
  storage.write("tag" + slot + ".bin", getTag(slot));
}

/**
 * Saves all tags to flash.
 */
function saveAllTags() {
  for (var i = 0; i < tags.length; i++) {
    saveTag(i);
  }
}

/**
 * Flashes an LED
 * @param {PIN} led The LED to flash
 * @param {number} interval The time the LED stays on and off
 * @param {number} times The number of times to flash
 * @param {(() => void)} callback The callback that gets called after the sequence is complete.
 * @returns
 */
function flashLed(led, interval, times, callback) {
  if (ENABLE_LEDS && led != null) {
    if (times < 1) {
      if (callback) {
        return callback();
      } else {
        return;
      }
    }

    led.write(1);

    _setTimeout(() => {
      led.write(0);

      _setTimeout(() => {
        flashLed(led, interval, times - 1, callback);
      }, interval);
    }, interval);
  } else {
    // No LEDs, run the callback immediately.
    if (callback) {
      return callback();
    } else {
      return;
    }
  }
}

/**
 * Computes the CRC32 checksum of the given data and returns it as a Uint8Array.
 *
 * @param {string|Uint8Array} data - The data to compute the CRC32 checksum for. Can be a string or a Uint8Array.
 * @returns {Uint8Array} A Uint8Array containing the CRC32 checksum bytes in little-endian order.
 */
function getCRC32(data) {
  const crc32 = E.CRC32(data);
  return new Uint8Array([
      crc32 & 0xFF,
      (crc32 >> 8) & 0xFF,
      (crc32 >> 16) & 0xFF,
      (crc32 >> 24) & 0xFF
  ]);
}


/**
 * Compares the sequence of two arrays to check if they are identical.
 *
 * @param {Array} arr1 - The first array to compare.
 * @param {Array} arr2 - The second array to compare.
 * @returns {boolean} True if both arrays have the same sequence of elements, false otherwise.
 */
function compareArrays(arr1, arr2) {
  if (arr1.length !== arr2.length) {
      return false;
  }
  for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
          return false;
      }
  }
  return true;
}

/**
 * The power on sequence started by {@link setInitWatch}.
 */
function powerOn() {
  if (ENABLE_LED2) {
    flashLed(_LED2, 150, 2, () => {
      NRF.wake();
      initialize();
    });
  } else {
    NRF.wake();
    initialize();
  }
}

/**
 * Adds a watch to the main button.  When the button is held for {@link POWER_ON_TIME}, it will call {@link powerOn}.
 */
function setInitWatch() {
  _setWatch(powerOn, _BTN, {
    repeat: false,
    edge: _Rising,
    debounce: POWER_ON_TIME
  });
}

/**
 * Called when bluetooth connected.
 */
function onBluetoothConnect() {
  clearAutoSleep();
  bluetoothConnected = true;
}

/**
 * Called when bluetooth disconnected.
 */
function onBluetoothDisconnect() {
  resetAutoSleep();
  bluetoothConnected = false;
}

/**
 * Adds a watch to the main button.  When the button is held for {@link POWER_OFF_TIME}, it will call {@link setInitWatch}.
 */
function powerOff() {
  _clearWatch();
  setInitWatch();
  NRF.sleep();
  _NTAG215.nfcStop();

  if (ENABLE_LED1) {
    flashLed(_LED1, 150, 2);
  }

  if(AUTO_SLEEP_TIME > 0) {
    clearAutoSleep();
  }

  NRF.removeListener(_Connect, onBluetoothConnect);
  NRF.removeListener(_Disconnect, onBluetoothDisconnect);
}

/**
 * Initializes the button watches, and starts BLE advertising.
 */
function initialize() {
  _clearWatch();

  changeTag(currentTag, true);

  _setWatch(powerOff, _BTN, {
    repeat: false,
    edge: _Rising,
    debounce: POWER_OFF_TIME
  });

  _setWatch(cycleTags, _BTN, {
    repeat: true,
    edge: _Falling,
    debounce: 50
  });

  NRF.setAdvertising({}, {
    name: getBufferClone(storage.readArrayBuffer(PUCK_NAME_FILE))
  });

  if (AUTO_SLEEP_TIME > 0) {
    resetAutoSleep();
  }

  NRF.on(_Connect, onBluetoothConnect);
  NRF.on(_Disconnect, onBluetoothDisconnect);
}

/**
 * Enables "fast mode", the Espruino REPL console is disabled during this mode.
 *
 * The string indicated by {@link FAST_MODE_STRING} will be sent when {@link fastRx} is ready to start receiving data.
 */
function fastMode() {
  // Move the console to the specified device so it doesn't do anything over Bluetooth.
  E.setConsole(FAST_MODE_CONSOLE);

  // Attach fastRx to the bluetooth data received event.
  _Bluetooth.on(_Data, fastRx);

  // Attach a function to the bluetooth disconnect event.
  NRF.on(_Disconnect, onFastModeDisconnect);

  _setTimeout(function() {
    // Send a message to let the other end know we're ready.
    _Bluetooth.write(FAST_MODE_STRING);
  }, 20);
}

/**
 * Attached by {@link fastMode}, called when Bluetooth disconnects.
 *
 * This will remove the listener for {@link fastRx}, as well as {@link onFastModeDisconnect}.
 */
function onFastModeDisconnect() {
  // Remove the listener from the Bluetooth interface
  _Bluetooth.removeListener(_Data, fastRx);

  // Remove event listener
  NRF.removeListener(_Disconnect, onFastModeDisconnect);

  // Restore Bluetooth console
  E.setConsole("Bluetooth");
}

/**
 * This will receive the number of bytes and add it to a buffer, this buffer will be the argument to {@link callback}.
 *
 * The function will wait indefinitely for the data to be received over the Nordic UART interface.
 * @param {number} count The number of bytes to receive.
 * @param {((buffer: Uint8Array) => void)} callback The callback containing the buffer.
 */
function rxBytes(count, callback) {
  rxPaused = true;

  var buffer = new Uint8Array(count);
  var position = 0;

  function receive(data) {
    buffer.set(new Uint8Array(E.toUint8Array(data), 0, Math.min(data.length, count - position)), position);
    position = position + data.length;

    if (position >= count) {
      var tempBuffer = buffer;
      disconnect();
      callback(tempBuffer);
    }
  }

  function disconnect() {
    _Bluetooth.removeListener(_Data, receive);
    NRF.removeListener(_Disconnect, disconnect);

    buffer = null;
    rxPaused = false;
  }

  _Bluetooth.on(_Data, receive);
  NRF.on(_Disconnect, disconnect);
}

/**
 * This function gets called when serial data has been received after calling {@link fastMode}
 * @param {string} data
 * @returns
 */
function fastRx(data) {
  if (rxPaused) {
    return;
  }

  // data is a string, so you want to convert to an array to work with
  data = E.toUint8Array(data);

  // define some variables to use.
  var slot,
    startIdx,
    dataSize,
    sourceData,
    oldSlot,
    newSlot,
    response,
    nullIdx,
    crc32,
    tag;

  if (data.length > 0) {
    switch (data[0]) {
      case COMMAND_BLE_PACKET_TEST: //BLE Packet Test
        _Bluetooth.write(new Uint8Array(data.length > 1 ? data[1] : 255));

        return;

      case COMMAND_SLOT_INFORMATION: //Slot Information <Slot>
        if (data.length > 1) {
          //Returns a subset of data for identifying
          slot = data[1] < tags.length ? data[1] : currentTag;
          var tagData = getTagInfo(slot);

          _Bluetooth.write([COMMAND_SLOT_INFORMATION, slot]);
          _Bluetooth.write(tagData);
        } else {
          //Returns 0x01 <Current Slot> <Slot Count>
          _Bluetooth.write([COMMAND_SLOT_INFORMATION, currentTag, tags.length]);
        }

        return;

      case COMMAND_READ: //Read <Slot> <StartPage> <PageCount>
        //Max pages: 143
        //Returns 0x02 <Slot> <StartPage> <PageCount> <Data>
        startIdx = data[2] * 4;
        dataSize = data[3] * 4;
        slot = data[1] < tags.length ? data[1] : currentTag;
        sourceData = getTag(slot).slice(startIdx, startIdx + dataSize);

        if (ENABLE_LOG) {
          //_consoleLog("Reading from slot: " + slot);
          //_consoleLog("Read from " + startIdx + " - " + (startIdx + dataSize));
        }

        response = Uint8Array(4);
        response.set(Uint8Array(data, 0, 4), 0);
        response[1] = slot;
        _Bluetooth.write(response);
        _Bluetooth.write(sourceData);

        return;

      case COMMAND_WRITE: //Write <Slot> <StartPage> <Data>
        startIdx = data[2] * 4;
        dataSize = data.length - 3;
        slot = data[1] < tags.length ? data[1] : currentTag;

        //store data if it fits into memory
        if ((startIdx + dataSize) <= 572) {
          if (ENABLE_LOG) {
            //_consoleLog("Write to slot: " + slot);
            //_consoleLog("Write to start: " + startIdx);
            //_consoleLog("Write size: " + dataSize);
          }

          getTag(slot).set(new Uint8Array(data.buffer, 3, dataSize), startIdx);
        }

        _Bluetooth.write([COMMAND_WRITE, slot, data[2]]);

        return;

      case COMMAND_SAVE: //Save <Slot>
        if (SAVE_TO_FLASH) {
          slot = data[1] < tags.length ? data[1] : currentTag;

          saveTag(slot);
        }

        _Bluetooth.write([COMMAND_SAVE, data[1]]);

        return;

      case COMMAND_FULL_WRITE: //Full Write <Slot>
        slot = data[1];
        crc32 = null;

        if (data.length == 6) {
          crc32 = data.slice(2, 6);
        }

        _setTimeout(function() {
          rxBytes(572, (rxData) => {
            const receivedCrc32 = getCRC32(rxData);

            // Only store the tag if the target CRC32 is not set, or if the received CRC32 matches the target.
            if (crc32 === null || compareArrays(crc32, receivedCrc32)) {
              getTag(slot).set(rxData, 0, 0);
            }

            _Bluetooth.write([COMMAND_FULL_WRITE, slot, receivedCrc32[0], receivedCrc32[1], receivedCrc32[2], receivedCrc32[3]]);
          });

          _Bluetooth.write(data);
        }, 0);

        return;

      case COMMAND_CLEAR_SLOT: //Clear Slot <Slot>
        slot = data[1];
        tag = generateTag();
        getTag(slot).set(tag);

        if (currentTag == slot) {
          changeTag(slot);
        }

        if (SAVE_TO_FLASH) {
          saveTag(slot);
        }

        _Bluetooth.write([COMMAND_CLEAR_SLOT, slot, tag[0], tag[1], tag[2], tag[3], tag[4], tag[5], tag[6], tag[7], tag[8]]);

        return;

      case COMMAND_GET_BLUETOOTH_NAME: //Get Bluetooth Name
        //Returns the bluetooth name, followed by a null terminator.
        _Bluetooth.write(storage.readArrayBuffer(PUCK_NAME_FILE));
        _Bluetooth.write([0]); // Null terminator

        return;

      case COMMAND_SET_BLUETOOTH_NAME: //Set Bluetooth Name
        // Get the index of the null terminator.
        nullIdx = data.indexOf(0);

        // If the null terminator is not found, set it to the end of the data.
        if (nullIdx == -1) {
          nullIdx = data.length - 1;
        }

        // Write the name to flash.
        if (nullIdx > 1) {
          storage.write(PUCK_NAME_FILE, data.slice(1, nullIdx));
        } else {
          storage.erase(PUCK_NAME_FILE);
        }

        // Update the Bluetooth name.
        NRF.setAdvertising({}, {
          name: getBufferClone(storage.readArrayBuffer(PUCK_NAME_FILE))
        });

        _Bluetooth.write(data);

        return;

      case COMMAND_GET_FIRMWARE: //Get Firmware
        if (ENABLE_LOG) {
          _consoleLog("Firmware Name:", FIRMWARE_NAME);
        }

        _Bluetooth.write(FIRMWARE_NAME);
        _Bluetooth.write([0]); // Null terminator

        return;

      case COMMAND_MOVE_SLOT: //Move slot <From> <To>
        oldSlot = data[1];
        newSlot = data[2];
        if (oldSlot < tags.length && newSlot < tags.length) {
          tags.splice(newSlot, 0, tags.splice(oldSlot, 1)[0]);
          changeTag(currentTag);
        }

        _Bluetooth.write([COMMAND_MOVE_SLOT, oldSlot, newSlot]);

        return;

      case COMMAND_ENABLE_BLE_UART: //Enable BLE UART
        onFastModeDisconnect();

        return;

      case COMMAND_RESTART_NFC: //Restart NFC <Slot?>
        if (data.length > 1) {
          slot = data[1] >= tags.length ? 0 : data[1];
          changeTag(slot);
          _Bluetooth.write([COMMAND_RESTART_NFC, slot]);
        } else {
          changeTag(currentTag);
          _Bluetooth.write([COMMAND_RESTART_NFC, currentTag]);
        }

        return;

      default:
        _Bluetooth.write("Bad Command");

        return;
    }
  }

  _Bluetooth.write(data);
}

// Check if the firmware flashed to the puck contains the needed NTAG emulation code.
if (typeof _NTAG215 !== "undefined") {
  // If no name has been assigned, set a generic one based on the hardware ID.
  if (storage.readArrayBuffer(PUCK_NAME_FILE) == undefined) {
    if (BOARD === "PUCKJS") {
      storage.write(PUCK_NAME_FILE, "Puck.js " + NRF.getAddress().substr(12, 5).split(":").join(""));
    } else if (BOARD === "PIXLJS") {
      storage.write(PUCK_NAME_FILE, "Pixl.js " + NRF.getAddress().substr(12, 5).split(":").join(""));
    } else {
      storage.write(PUCK_NAME_FILE, BOARD.charAt(0).toUpperCase() + BOARD.substring(1).toLowerCase() + " " + NRF.getAddress().substr(12, 5).split(":").join(""));
    }
  }

  // Set the buffer for the NTAG emulation to use.
  _NTAG215.setTagBuffer(txBuffer.buffer);
  E.on("kill", _NTAG215.nfcStop);

  // Event fired when the NFC field has been activated.
  NRF.on('NFCon', function nfcOn() {
    if (AUTO_SLEEP_TIME > 0) {
      if (!bluetoothConnected) {
        clearAutoSleep();
      }
    }

    // Turn on the LEDs as indicated by the bits of the current slot.
    if (ENABLE_LEDS && currentTag < 7) {
      if (ENABLE_LED1) {
        _LED1.write(currentTag + 1 & 1);
      }

      if (ENABLE_LED2) {
        _LED2.write(currentTag + 1 & 2);
      }

      if (ENABLE_LED3) {
        _LED3.write(currentTag + 1 & 4);
      }
    }
  });

  // Event fired when the NFC field becomes inactive.
  NRF.on('NFCoff', function nfcOff() {
    if (AUTO_SLEEP_TIME > 0) {
      if (!bluetoothConnected) {
        resetAutoSleep();
      }
    }

    // Turn off all LEDs.
    if (ENABLE_LEDS) {
      if (ENABLE_LED1) {
        _LED1.write(0);
      }

      if (ENABLE_LED2) {
        _LED2.write(0);
      }

      if (ENABLE_LED3) {
        _LED3.write(0);
      }
    }

    // Fix the tag UID if needed, and restart.
    if (fixUid()) {
      _NTAG215.nfcRestart();
    }

    // If the tag has been written, save it.
    if (_NTAG215.getTagWritten()) {
      if (SAVE_TO_FLASH) {
        saveTag();
      }
      _NTAG215.setTagWritten(false);
    }
  });

  // Initialize the tags in ram, and load any saved tags from flash.
  for (var i = 0; i < tags.length; i++) {
    const filename = "tag" + i + ".bin";
    const buffer = storage.readArrayBuffer(filename);
    const tag = getTag(i);

    if (buffer) {
      if (ENABLE_LOG) {
        _consoleLog("Loaded " + filename);
      }

      tag.set(buffer);
    } else {
      tag.set(generateTag());
    }
  }

  // Initialize watches and start BLE advertising.
  initialize();
} else {
  // We don't have the custom firmware needed.
  if (ENABLE_LED1) {
    // Turn on the red LED.
    _LED1.write(1);
  }
}
