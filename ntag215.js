/* Copyright (c) 2020 Daniel Radtke. See the file LICENSE for copying permission. */
/* Copyright (c) 2018 Andreas Dröscher. See the file LICENSE for copying permission. */
function NFCTag(data) {
  this.setData(data);
  this.authenticated = false;
  this.backdoor = false;
  this.tagWritten = false;
  this.lockedPages = [];

  var self = this;

  NRF.on('NFCon', () => {
    LED2.write(true);
  });

  NRF.on('NFCoff', () => {
    LED2.write(false);
    self.authenticated = false;
    self.backdoor = false;

    this.lockedPages = self._getLockedPages();

    if(self.tagWritten == true) {
      //console.log("Saving tag to flash");
      //self.writeFile('tag.bin');
      self.tagWritten = false;
    }

    if(self._fixUid()) {
      NRF.nfcStop();
      NRF.nfcStart(new Uint8Array([self._data[0], self._data[1], self._data[2], self._data[4], self._data[5], self._data[6], self._data[7]]));
    }
  });

  NRF.on('NFCrx', (rx) => {
    if(rx && self._callbacks[rx[0]]) {
      self._callbacks[rx[0]](rx, self);
    } else {
      NRF.nfcSend();
      console.log("Unknown command: 0x" + rx[0].toString(16));
    }
  });
}

NFCTag.prototype = {
  _fixUid: () => {
    var bcc0 = this._data[0] ^ this._data[1] ^ this._data[2] ^ 0x88;
    var bcc1 = this._data[4] ^ this._data[5] ^ this._data[6] ^ this._data[7];

    if(this._data[3] != bcc0 || this._data[8] != bcc1) {
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
    if(this.backdoor == false && (page < 0 || page > 134)) {
      return 0x0;
    }

    if(!this.backdoor && (page == 133 || page == 134)) {
      return new Uint8Array(4);
    }

    //calculate block index
    var idx = page * 4;

    //send response
    return new Uint8Array(this._data.buffer, idx, 4);
  },
  _responses: {
    version: new Uint8Array([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03]),
    pwdSuccess: new Uint8Array([0x80, 0x80]),
    puckSuccess: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
  },
  _callbacks: {
    0x30: function read(rx, self) {
      NRF.nfcSend(self._readPage(rx[1]));
    },
    0xa2: function write(rx, self) {
      if(!this.backdoor && (rx[1] < 0 || rx[1] > 134 || self.lockedPages.indexOf(rx[1]) != -1)) {
        NRF.nfcSend(0x0);
        if (rx[1] < 0 || rx[1] > 134) {
          console.log("Attempted write to invalid page: " + rx[1]);
        }

        if (self.lockedPages.indexOf(rx[1]) != -1) {
          console.log("Attempted write to locked page: " + rx[1]);
        }

        return;
      }

      if (!this.backdoor) {
        if (rx[1] == 2) {
          self._data[10] = self._data[10] | rx[4];
          self._data[11] = self._data[11] | rx[5];
          NRF.nfcSend(0xA);
          return;
        }

        if (rx[1] == 3) {
          self._data[16] = self._data[16] | rx[2];
          self._data[17] = self._data[17] | rx[3];
          self._data[18] = self._data[18] | rx[4];
          self._data[19] = self._data[19] | rx[5];
          NRF.nfcSend(0xA);
          return;
        }

        if (rx[1] == 130) {
          // TODO: Dynamic lock bits
        }
      }

      //calculate block index
      var idx = rx[1] * 4;

      //store data if it fits into memory
      if(idx > self._data.length) {
        NRF.nfcSend(0x0);
      } else {
        var view = new Uint8Array(rx, 2, 4);
        self._data.set(view, idx);
        NRF.nfcSend(0xA);
      }
      self.tagWritten = true;
    },
    0x60: function version(rx, self) {
      NRF.nfcSend(self._responses.version); 
    },
    0x3a: function fastRead(rx, self) {
      if (rx[1] > rx[2] || rx[1] < 0 || rx[2] > 134) {
        NRF.nfcSend(0x0);
        console.log("Invalid fast read command");
        return;
      }

      if (rx[1] == 133 && rx[2] == 134){
        NRF.nfcSend(self._responses.puckSuccess);
        this.backdoor = true;
        return;
      }

      var startIdx = rx[1];
      var endIdx = rx[2];
      var dataSize = (endIdx - startIdx + 1) * 4;

      //send response
      NRF.nfcSend(new Uint8Array(self._data.buffer, startIdx * 4, dataSize));
    },
    0x1b: function pwdAuth(rx, self) {
      NRF.nfcSend(self._responses.pwdSuccess);
      self.authenticated = true;
    },
    0x3c: function readSig(rx, self) {
      //send response
      NRF.nfcSend(new Uint8Array(self._data.buffer, 540, 32));
    },
    0x88: function restartNfc(rx, self) {
      self.setData(self._data);
    },
    0x1a: function keepAlive(rx) { NRF.nfcSend(); },
    0x93: function keepAlive(rx) { NRF.nfcSend(); },
  },
  setData: (data) => {
    //shutdown
    NRF.nfcStop();

    //store data
    this._data = data || new Uint8Array(572);

    //fix bcc0 and bcc1 if needed
    this._fixUid();

    //re-start
    var header = NRF.nfcStart(new Uint8Array([data[0], data[1], data[2], data[4], data[5], data[6], data[7]]));

    //store UID/BCC
    //this._data.set(header, 0);
  },
  getData: () => this._data,
  writeFile: () => {
    require("Storage").write(filename, this._data);
  },
  loadFile: () => {
    var data = require("Storage").readArrayBuffer(filename);

    if (data) {
      this.setData(new Uint8Array(data));
    }
  }
};

var tag = new NFCTag(Uint8Array((() => {
  var buffer = require("Storage").readArrayBuffer('tag.bin');

  if (buffer) {
    var output = new Uint8Array(buffer.length);
    for (var i = 0; i < buffer.length; i++)
      output[i] = buffer[i];

    return output;
  }

  return new Uint8Array(572);
})()));
