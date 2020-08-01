/* Copyright (c) 2020 Daniel Radtke. See the file LICENSE for copying permission. */
/* Copyright (c) 2018 Andreas Dröscher. See the file LICENSE for copying permission. */
/* Copyright (c) 2013 Gordon Williams, Pur3 Ltd

------------------------------------------------------------------------------

All sections of code within this repository are licensed under an MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

let dbg = false;

function debug(cb) {
  if (dbg) {
    cb();
  }
}

function NFCTag(data) {
  if (data instanceof TagData) {
    this.setData(data.buffer);
    this.tagData = data;
  } else {
    this.setData(data);
  }
  this.authenticated = false;
  this.backdoor = false;
  this.tagWritten = false;
  this.lockedPages = [];
  this.filename = "tag.bin";
  this.led = [LED1];

  var self = this;

  NRF.on('NFCon', () => {
    for (var i = 0; i<self.led.length; i++) {
      digitalWrite(self.led[i], 1);
    }
  });

  NRF.on('NFCoff', () => {
    for (var i = 0; i<self.led.length; i++) {
      digitalWrite(self.led[i], 0);
    }

    self.authenticated = false;
    self.backdoor = false;

    this.lockedPages = self._getLockedPages();

    if (self.tagWritten == true) {
      if (this.tagData) {
        this.tagData.save();
      }
      //console.log("Saving tag to flash");
      //require("Storage").write(filename, this._data);
      self.tagWritten = false;
    }

    if (self._initCard()) {
      NRF.nfcStop();
      NRF.nfcStart(new Uint8Array([self._data[0], self._data[1], self._data[2], self._data[4], self._data[5], self._data[6], self._data[7]]));
    }
  });

  NRF.on('NFCrx', (rx) => {
    if (rx && self._callbacks[rx[0]]) {
      self._callbacks[rx[0]](rx, self);
    } else {
      NRF.nfcSend(0);
    }
  });
}

NFCTag.prototype = {
  _initCard: () => {
    const pwStart = 0x85 * 4;
    this._info.password = new Uint8Array(this._data, pwStart, 4);

    const packStart = 0x86 * 4;
    this._responses.pack = new Uint8Array(this._data, packStart, 2);
    this._fixUid();
  },
  _fixUid: () => {
    var bcc0 = this._data[0] ^ this._data[1] ^ this._data[2] ^ 0x88;
    var bcc1 = this._data[4] ^ this._data[5] ^ this._data[6] ^ this._data[7];

    debug(() => {
      let uidBlock = "";
      for (let i = 0; i < 9; i++) {
        uidBlock += this._data[i].toString(16)+ " ";
      }
      console.log(uidBlock);
      console.log(bcc0.toString(16) + " " + bcc1.toString(16));
    });

    if (this._data[3] != bcc0 || this._data[8] != bcc1) {
      this._data[3] = bcc0;
      this._data[8] = bcc1;

      console.log("Fixed bad bcc");

      return true;
    }

    return false;
  },
  _getLockedPages: () => {
    var locked = [0, 1];

    // Static Lock Bytes
    for (var bit = 0; bit < 8; bit++) {
      if (this._data[11] & (1 << bit)) {
        locked.push(bit + 8);
      }

      if (this._data[10] & (1 << bit)) {
        switch (bit) {
          case 0: //BL-CC
          case 1: //BL-9-4
          case 2: //BL-15-10
          case 3: //L-CC
            break;

          default:
            locked.push(bit + 4);
        }
      }
    }

    if (!this.authenticated) {
      // Dynamic Lock Bytes
      if (this._data[520] & 0b00000001 > 0) {
        locked.push(16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31);
      }

      if (this._data[520] & 0b00000010 > 0) {
        locked.push(32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47);
      }

      if (this._data[520] & 0b00000100 > 0) {
        locked.push(48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63);
      }

      if (this._data[520] & 0b00001000 > 0) {
        locked.push(64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79);
      }

      if (this._data[520] & 0b00010000 > 0) {
        locked.push(80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95);
      }

      if (this._data[520] & 0b00100000 > 0) {
        locked.push(96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111);
      }

      if (this._data[520] & 0b01000000 > 0) {
        locked.push(112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127);
      }

      if (this._data[520] & 0b10000000 > 0) {
        locked.push(128, 129);
      }
    }

    return locked;
  },
  _readPage: (page) => {
    if (this.backdoor == false && (page < 0 || page > 134)) {
      return 0x00;
    }

    if (!this.backdoor && (page == 133 || page == 134)) {
      return new Uint8Array(4);
    }

    //send response
    return new Uint8Array(this._data.buffer, page * 4, 4);
  },
  _responses: {
    version: new Uint8Array([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03]),
    pwdSuccess: new Uint8Array([0x80, 0x80]),
    pwdFail: new Uint8Array([0x04]),
    ack: new Uint8Array([0x0A]),
    puckSuccess: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    puckDeauth: new Uint8Array([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01])
  },
  _info: {
  },
  _callbacks: {
    0x30: function read(rx, self) {
      NRF.nfcSend(self._readPage(rx[1]));
    },
    0xa2: function write(rx, self) {
      if (!this.backdoor && (rx[1] < 0 || rx[1] > 134 || self.lockedPages.indexOf(rx[1]) != -1)) {
        NRF.nfcSend(0x00);
        console.log('write blocked');
        return;
      }

      if (!this.backdoor) {
        if (rx[1] == 2) {
          self._data[10] = self._data[10] | rx[4];
          self._data[11] = self._data[11] | rx[5];
          NRF.nfcSend(0x0A);

          return;
        }

        if (rx[1] == 3) {
          self._data[16] = self._data[16] | rx[2];
          self._data[17] = self._data[17] | rx[3];
          self._data[18] = self._data[18] | rx[4];
          self._data[19] = self._data[19] | rx[5];
          NRF.nfcSend(0x0A);

          return;
        }

        if (rx[1] == 130) {
          // TODO: Dynamic lock bits
        }
      }

      //calculate block index
      var idx = rx[1] * 4;

      //store data if it fits into memory
      if (idx > self._data.length) {
        NRF.nfcSend(0x00);
      } else {
        var view = new Uint8Array(rx, 2, 4);
        self._data.set(view, idx);
        NRF.nfcSend(0x0A);
      }

      self.tagWritten = true;
    },
    0x60: function version(rx, self) {
      NRF.nfcSend(self._responses.version); 
    },
    0x3a: function fastRead(rx, self) {
      if (rx[1] > rx[2] || rx[1] < 0 || rx[2] > 134) {
        NRF.nfcSend(0x00);
        console.log("Invalid fast read command");

        return;
      }

      if (rx[1] == 133 && rx[2] == 134) {
        if (! self.backdoor) {
          NRF.nfcSend(self._responses.puckSuccess);
          self.backdoor = true;
        } else {
          if (self.tagData) {
            NRF.nfcSend(self._responses.puckDeauth);
            self.backdoor = false;
            setTimeout(() => {
              self.tagData.save();
              self._initCard();
            }, 0);
          }
        }
        return;
      }

      NRF.nfcSend(new Uint8Array(self._data.buffer, rx[1] * 4, (rx[2] - rx[1] + 1) * 4));
    },
    0x1b: function pwdAuth(rx, self) {
      for (let i = 0; i < 4; i++) {
        if (self._info.password[i] !== rx[i + 1]) {
          NRF.nfcSend(self._responses.pwdFail);
          return;
        }
      }

      NRF.nfcSend(self._responses.pack);
      self.authenticated = true;
    },
    0x3c: function readSig(rx, self) {
      NRF.nfcSend(new Uint8Array(self._data.buffer, 540, 32));
    },
    0x88: function restartNfc(rx, self) {
      self.setData(self._data);
    },
    0x1a: function keepAlive(rx) {
      NRF.nfcSend();
    },
    0x93: function keepAlive(rx) {
      NRF.nfcSend();
    },
  },
  setData: (data) => {
    //shutdown
    NRF.nfcStop();

    //store data
    this._data = data || new Uint8Array(572);

    // init card and fix bcc0 and bcc1 if needed
    this._initCard();

    //re-start
    var header = NRF.nfcStart(new Uint8Array([data[0], data[1], data[2], data[4], data[5], data[6], data[7]]));
  },
  getData: () => this._data
};


function TagData(led, filename) {
  this.led = led;
  this.filename = filename;
  const storage = require("Storage");
  const buffer = storage.readArrayBuffer(filename);

  if (buffer) {
    const output = new Uint8Array(buffer.length);
    for (var buffPos = 0; buffPos < buffer.length; buffPos++) {
      output[buffPos] = buffer[buffPos];
    }

    this.buffer = output;
  } else {
    this.buffer = new Uint8Array(572);
  }
}

TagData.prototype.save = function() {
  const storage = require("Storage");
  storage.write(this.filename, this.buffer);
};

var tags = (function() {
  const leds = [
    { led: [LED1] },
    { led: [LED1, LED2] },
    { led: [LED2] },
    { led: [LED2, LED3] },
    { led: [LED3] }
  ];

  const data = [];

  for (var i = 0; i < leds.length; i++) {
    const filename = "tag" + i + ".bin";
    data[i] = new TagData(leds[i].led, filename);
  }

  return data;
})();


var currentTag = 0;

var tag = new NFCTag(tags[currentTag]);
tag.filename = tags[currentTag].filename;

setWatch(function() {
  NRF.nfcStop();

  tags[currentTag].save();

  currentTag++;

  if (currentTag > tags.length - 1) {
    currentTag = 0;
  }

  tag.led = tags[currentTag].led;

  LED1.write(0);
  LED2.write(0);
  LED3.write(0);

  for (var i = 0; i<tag.led.length; i++) {
    digitalWrite(tag.led[i], 1);
  }

  setTimeout(() => {
    for (var i = 0; i<tag.led.length; i++) {
      digitalWrite(tag.led[i], 0);
    }

    tag.led = tags[currentTag].led;
    tag.filename = tags[currentTag].filename;
    tag.setData(tags[currentTag].buffer);
  }, 200);
}, BTN, { repeat: true, edge:"rising", debounce:50 });
