/**
 * Declaration for firmware zip imports processed by the firmware-loader Vite plugin.
 * Each .zip file resolves to a Promise<ArrayBuffer> — either inlined as base64
 * (development) or fetched at runtime from the emitted asset URL (production).
 */
declare module '*.zip' {
  const firmware: Promise<ArrayBuffer>
  export default firmware
}
