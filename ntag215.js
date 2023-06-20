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
 * The name of the script.
 */
const FIRMWARE_NAME = "dtm-2.0.0";

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

// #endregion

// #region Features
/**
 * Whether to enable code that changes LEDs
 */
const ENABLE_LEDS = BOARD == "PUCKJS";
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
 * @returns  {Uint8Array} - A subset of tag tag from 0x00 - 0x08, 0x10 - 0x18, 0x20 - 0x34, 0x54 - 0x5C, 0x60 - 0x80
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
    _LED1.write(currentTag + 1 & 1);
    _LED2.write(currentTag + 1 & 2);
    _LED3.write(currentTag + 1 & 4);
  }

  function innerChangeTag() {
    if (ENABLE_LEDS) {
      _LED1.write(0);
      _LED2.write(0);
      _LED3.write(0);
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
  if (ENABLE_LEDS) {
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
 * The power on sequence started by {@link setInitWatch}.
 */
function powerOn() {
  if (ENABLE_LEDS) {
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
 * Adds a watch to the main button.  When the button is held for {@link POWER_OFF_TIME}, it will call {@link setInitWatch}.
 */
function powerOff() {
  _clearWatch();
  setInitWatch();
  NRF.sleep();
  _NTAG215.nfcStop();
  if (ENABLE_LEDS) {
    flashLed(_LED1, 150, 2);
  }
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
}

/**
 * Enables "fast mode", the Espruino REPL console is disabled during this mode.
 *
 * The string indicated by {@link FAST_MODE_STRING} will be sent when {@link fastRx} is ready to start receiving data.
 */
function fastMode() {
  // Move the console to Serial1 so it doesn't do anything over Bluetooth.
  Serial1.setConsole();

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
    nullIdx;

  if (data.length > 0) {
    switch (data[0]) {
      case 0x00: //BLE Packet Test
        _Bluetooth.write(new Uint8Array(data.length > 1 ? data[1] : 255));

        return;

      case 0x01: //Slot Information <Slot>
        if (data.length > 1) {
          //Returns a subset of data for identifying
          slot = data[1] < tags.length ? data[1] : currentTag;
          var tagData = getTagInfo(slot);

          _Bluetooth.write(new Uint8Array(data, 0, 2));
          _Bluetooth.write([slot]);
          _Bluetooth.write(tagData);
        } else {
          //Returns 0x01 <Current Slot> <Slot Count>
          _Bluetooth.write([0x01, currentTag, tags.length]);
        }

        return;

      case 0x02: //Read <Slot> <StartPage> <PageCount>
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

      case 0x03: //Write <Slot> <StartPage> <Data>
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

        _Bluetooth.write(new Uint8Array(data, 0, 3));

        return;

      case 0x04: //Save <Slot>
        if (SAVE_TO_FLASH) {
          slot = data[1] < tags.length ? data[1] : currentTag;

          saveTag(slot);
        }

        break;

      case 0x05: //Full Write <Slot>
        slot = data[1];

        _setTimeout(function() {
          rxBytes(572, (rxData) => {
            getTag(slot).set(rxData, 0, 0);

            _Bluetooth.write(data);
          });

          _Bluetooth.write(data);
        }, 0)

        return;

      case 0xFA: //Get Bluetooth Name
        //Returns the bluetooth name, followed by a null terminator.
        _Bluetooth.write(storage.readArrayBuffer(PUCK_NAME_FILE));
        _Bluetooth.write([0]); // Null terminator
        return;

      case 0xFB: //Set Bluetooth Name
        nullIdx = data.indexOf(0);

        if (nullIdx == -1) {
          nullIdx = data.length - 1;
        }

        if (nullIdx > 1) {
          storage.write(PUCK_NAME_FILE, data.slice(1, nullIdx));
        } else {
          storage.erase(PUCK_NAME_FILE);
        }

        NRF.setAdvertising({}, {
          name: getBufferClone(storage.readArrayBuffer(PUCK_NAME_FILE))
        });

        break;

      case 0xFC: //Get Firmware
        if (ENABLE_LOG) {
          _consoleLog("Firmware Name:", FIRMWARE_NAME);
        }

        _Bluetooth.write(FIRMWARE_NAME);
        _Bluetooth.write([0]); // Null terminator

        return;

      case 0xFD: //Move slot <From> <To>
        oldSlot = data[1];
        newSlot = data[2];
        if (oldSlot < tags.length && newSlot < tags.length) {
          tags.splice(newSlot, 0, tags.splice(oldSlot, 1)[0]);
          changeTag(currentTag);
        }

        break;

      case 0xFE: //Enable BLE UART
        _Bluetooth.setConsole();

        break;

      case 0xFF: //Restart NFC <Slot?>
        if (data.length > 1) {
          changeTag(data[1] >= tags.length ? 0 : data[1]);
        } else {
          changeTag(currentTag);
        }

        break;
    }
  }

  _Bluetooth.write(data);
}

// Check if the firmware flashed to the puck contains the needed NTAG emulation code.
if (typeof _NTAG215 !== "undefined") {
  // If no name has been assigned, set a generic one based on the hardware ID.
  if (storage.readArrayBuffer(PUCK_NAME_FILE) == undefined) {
    storage.write(PUCK_NAME_FILE, "Puck.js " + NRF.getAddress().substr(12, 5).split(":").join(""));
  }

  // Set the buffer for the NTAG emulation to use.
  _NTAG215.setTagBuffer(txBuffer.buffer);
  E.on("kill", _NTAG215.nfcStop);

  // Event fired when the NFC field has been activated.
  NRF.on('NFCon', function nfcOn() {
    // Turn on the LEDs as indicated by the bits of the current slot.
    if (ENABLE_LEDS && currentTag < 7) {
      _LED1.write(currentTag + 1 & 1);
      _LED2.write(currentTag + 1 & 2);
      _LED3.write(currentTag + 1 & 4);
    }
  });

  // Event fired when the NFC field becomes inactive.
  NRF.on('NFCoff', function nfcOff() {
    // Turn off all LEDs.
    if (ENABLE_LEDS) {
      _LED1.write(0);
      _LED2.write(0);
      _LED3.write(0);
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
      // Generate blank NTAG215 tags with random, but valid UID.
      tag[0] = 0x04;
      tag[1] = _MathRound(_MathRandom() * 255);
      tag[2] = _MathRound(_MathRandom() * 255);
      tag[3] = tag[0] ^ tag[1] ^ tag[2] ^ 0x88;
      tag[4] = _MathRound(_MathRandom() * 255);
      tag[5] = _MathRound(_MathRandom() * 255);
      tag[6] = _MathRound(_MathRandom() * 255);
      tag[7] = _MathRound(_MathRandom() * 255);
      tag[8] = tag[4] ^ tag[5] ^ tag[6] ^ tag[7];

      // Set extra data present in blank tags.
      tag.set([0x48, 0x00, 0x00, 0xE1, 0x10, 0x3E, 0x00, 0x03, 0x00, 0xFE], 0x09);
      tag.set([0xBD, 0x04, 0x00, 0x00, 0xFF, 0x00, 0x05], 0x20B);
    }
  }

  // Initialize watches and start BLE advertising.
  initialize();
} else {
  // We don't have the custom firmware needed.
  if (ENABLE_LEDS) {
    // Turn on the red LED.
    _LED1.write(1);
  }
}
