/* Copyright (c) 2020 Daniel Radtke. See the file LICENSE for copying permission. */
/* Copyright (c) 2018 Andreas Dröscher. See the file LICENSE for copying permission. */
function NFCTag(data) {
  this.setData(data);
  this.authenticated = false;
  this.tagWritten = false;

  var self = this;

  NRF.on('NFCon', () => {
    LED2.write(true);
  });

  NRF.on('NFCoff', () => {
    LED2.write(false);
    self.authenticated = false;

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
  _responses: {
    version: new Uint8Array([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03]),
    pwdSuccess: new Uint8Array([0x80, 0x80]),
    puckSuccess: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
  },
  _callbacks: {
    0x30: function read(rx, self) {
      //calculate block index
      var idx = rx[1]*4;

      //send response
      NRF.nfcSend(new Uint8Array(self._data.buffer, idx, 4));
    },
    0xa2: function write(rx, self) {
      //calculate block index
      var idx = rx[1]*4;

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
      if (rx[1] == 133 && rx[2] == 134){
        NRF.nfcSend(self._responses.puckSuccess);
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
