/**
 * Formats a Uint8Array into a string of hex data, 16 bytes per line.
 *
 * @param data - The Uint8Array to format.
 * @returns A string where each line contains 16 bytes in hexadecimal format.
 * @throws Will throw an error if the input is not a Uint8Array.
 */
export function formatHexData(data: Uint8Array): string {
    if (!(data instanceof Uint8Array)) {
        throw new Error("Input should be a Uint8Array");
    }

    let result = '';
    for (let i = 0; i < data.length; i += 16) {
        let line = '';
        for (let j = 0; j < 16 && i + j < data.length; j++) {
            line += data[i + j].toString(16).padStart(2, '0').toUpperCase() + ' ';
        }
        result += line.trim() + '\n';
    }
    return result.trim();
}
