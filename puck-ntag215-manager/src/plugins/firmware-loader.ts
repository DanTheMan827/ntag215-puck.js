import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'fs'
import path from 'path'

export interface FirmwareLoaderOptions {
  /** When true, zip files are emitted as assets and downloaded at runtime.
   *  When false (default), zip files are inlined as base64 ArrayBuffers. */
  download?: boolean
}

function toArrayBufferCode(base64: string): string {
  return `
function __toArrayBuffer(base64) {
  const binary = typeof window !== 'undefined' && typeof window.atob === 'function'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
export default Promise.resolve(__toArrayBuffer(${JSON.stringify(base64)}));
`.trimStart()
}

export function firmwareLoaderPlugin(options: FirmwareLoaderOptions = {}): Plugin {
  const { download = false } = options
  let config: ResolvedConfig

  return {
    name: 'firmware-loader',
    configResolved(resolved) {
      config = resolved
    },
    transform(_src, id) {
      if (!id.endsWith('.zip')) return undefined

      if (!download) {
        // Dev / inline mode: base64-encode the zip and resolve to Promise<ArrayBuffer>
        const content = fs.readFileSync(id)
        return { code: toArrayBufferCode(content.toString('base64')), map: null }
      }

      // Production / download mode: emit as an asset and return a module that
      // downloads it at runtime using the same XMLHttpRequest helper.
      const source = fs.readFileSync(id)
      const referenceId = this.emitFile({
        type: 'asset',
        name: path.basename(id),
        source,
      })

      // import.meta.ROLLUP_FILE_URL_<referenceId> is replaced by Rollup/Vite at
      // bundle-finalisation time with the actual relative URL of the emitted asset.
      return {
        code: `
function __downloadArrayBuffer(url) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) resolve(xhr.response);
        else reject('HTTP ' + xhr.status);
      }
    };
    xhr.send();
  });
}
export default __downloadArrayBuffer(import.meta.ROLLUP_FILE_URL_${referenceId});
`.trimStart(),
        map: null,
      }
    },
  }
}
