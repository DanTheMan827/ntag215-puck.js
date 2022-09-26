module.exports = (url: string): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const oReq = new XMLHttpRequest();
    oReq.open("GET", url, true);
    oReq.responseType = "arraybuffer";

    oReq.onreadystatechange = (e) => {
      if (oReq.readyState === 4) {
        if (oReq.status === 200) {
          resolve(oReq.response)
        } else {
          reject(`HTTP response code ${oReq.status}`)
        }
      }
    }

    oReq.send();
  })
}
