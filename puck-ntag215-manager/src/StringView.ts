export interface CharacterStruct {
    bytesRead?: number,
    charVal?: number
}

const encodingUtf8 = "UTF-8";
const encodingAscii = "ASCII";

const defaultEncoding = encodingUtf8;
const replacementChar = 0xFFFD;

const createUtf8Char = function(charCode: number, arr: number[]){
	if(charCode < 0x80){
		//Treat ASCII differently since it doesn't begin with 0x80
		arr.push(charCode);
	}else{
		const limits = [0x7F, 0x07FF, 0xFFFF, 0x1FFFFF];
		let i = 0;
		while(true){
			i++;

			if(i === limits.length){
				console.error("UTF-8 Write - attempted to encode illegally high code point - " + charCode);
				createUtf8Char(replacementChar, arr);
				return;
			}
			if(charCode <= limits[i]){
				//We have enough bits in 'i+1' bytes to encode this character
				i += 1;

				let aByte = 0;
				let j;
				//add i bits of length indicator
				for(j = 0; j < i; j++){
					aByte <<= 1;
					aByte |= 1;
				}
				//Shift length indicator to MSB
				aByte <<= (8 - i);
				//Add 8 - (i  + 1) bits of code point to fill the first byte
				aByte |= (charCode >> (6 * (i - 1)));
				arr.push(aByte);
				//Fist byte already processed, start at 1 rather than 0
				for(j = 1; j < i; j++){
					//Continuation flag
					aByte = 0x80;
					//6 bits of code point
					aByte |= (charCode >> (6 * (i - (j + 1)))) & 0xBF;
					arr.push(aByte);
				}
				return;
			}
		}
	}
};


const utf8ReadChar = function(charStruct: CharacterStruct, buf: DataView, readPos: number, maxBytes: number){
	const firstByte = buf.getUint8(readPos);
	charStruct.bytesRead = 1;
	charStruct.charVal = 0;
	if(firstByte & 0x80){
		let numBytes = 0;
		let aByte = firstByte;
		while(aByte & 0x80){
			numBytes++;
			aByte <<= 1;
		}
		if(numBytes === 1){
			console.error("UTF-8 read - found continuation byte at beginning of character");
			charStruct.charVal = replacementChar;
			return;
		}
		if(numBytes > maxBytes){
			console.error("UTF-8 read - attempted to read " + numBytes + " byte character, " + (maxBytes - numBytes) + " bytes past end of buffer");
			charStruct.charVal = replacementChar;
			return;
		}
		//2 bytes means 3 bits reserved for UTF8 byte encoding, 5 bytes remaining for codepoint, and so on
		charStruct.charVal = firstByte & (0xFF >> (numBytes + 1));
		for(let i = 1; i < numBytes; i++){
			aByte = buf.getUint8(readPos + i);
			//0xC0 should isolate the continuation flag which should be 0x80
			if((aByte & 0xC0) !== 0x80){
				console.error("UTF-8 read - attempted to read " + numBytes + " byte character, found non-continuation at byte " + i);
				charStruct.charVal = replacementChar;
				//Wikipedia (awesomely reliable source of information /sarcasm) suggests
				// parsers should replace first byte of invalid sequence and continue
				charStruct.bytesRead = 1;
				return;
			}
			charStruct.charVal <<= 6;
			//0x3F is the mask to remove the continuation flag
			charStruct.charVal |= (aByte & 0x3F);

			if(i === 1){
				const rshift = (8 - (numBytes + 1)) - 1;
				if((charStruct.charVal >> rshift) === 0){
					console.error("UTF-8 read - found overlong encoding");
					charStruct.charVal = replacementChar;
					charStruct.bytesRead = 1;
					return;
				}
			}
			charStruct.bytesRead++;
		}
		if(charStruct.charVal > 0x10FFFF){
			console.error("UTF-8 read - found illegally high code point " + charStruct.charVal);
			charStruct.charVal = replacementChar;
			charStruct.bytesRead = 1;
			return;
		}

	}else{
		charStruct.charVal = firstByte;
	}
};

const writeStringUtf8 = function(str: string){
	const arr: number[] = [];
	for(let i = 0; i < str.length; i++){
		createUtf8Char(str.charCodeAt(i), arr);
	}
	return arr;
};

const writeStringAscii = function(str: string){
	const arr: number[] = [];
	for(let i = 0; i < str.length; i++){
		let chr = str.charCodeAt(i);
		if(chr > 255){
			chr = "?".charCodeAt(0);
		}
		arr.push(chr);
	}
	return arr;
};

const readStringUtf8 = function(buf: DataView, byteOffset: number, bytesToRead: number, terminator: number){
	const nullTerm = (typeof bytesToRead === "undefined");
	let readPos = byteOffset || 0;
	if(!nullTerm && readPos + bytesToRead > buf.byteLength){
		throw new Error("Attempted to read " + ((readPos + bytesToRead) - buf.byteLength) + " bytes past end of buffer");
	}
	const str = [];
	const charStruct: CharacterStruct = {};
	while(readPos < buf.byteLength && (nullTerm || bytesToRead > (readPos - byteOffset))){
		utf8ReadChar(charStruct, buf, readPos, nullTerm ? buf.byteLength - (readPos + byteOffset) : (bytesToRead - (readPos - byteOffset)));
		readPos += charStruct.bytesRead;
		if(nullTerm && charStruct.charVal === terminator){
			break;
		}
		str.push(String.fromCharCode(charStruct.charVal));
	}
	return {
		str: str.join(""),
		byteLength: (readPos - byteOffset)
	};
};

const readStringAscii = function(buf: DataView, byteOffset: number, bytesToRead: number, terminator: number){
	const str = [];
	let byteLength = 0;
	byteOffset = byteOffset || 0;
	let nullTerm = false;
	if(typeof bytesToRead === "undefined"){
		nullTerm = true;
		bytesToRead = buf.byteLength - buf.byteOffset;
	}
	for(let i = 0; i < bytesToRead; i++){
		const charCode = buf.getUint8(i + byteOffset);
		byteLength++;
		if(nullTerm && charCode === terminator){
			break;
		}
		str.push(String.fromCharCode(charCode));
	}
	return {
		str: str.join(""),
		byteLength: byteLength
	};
};

/**
 * The reader function should return an object with two properties - `str` being the decoded string, and `byteLength` representing the number of bytes consumed in reading the string. The string should not include the terminator character, but the character should be included in the byteLength value.
 * @param buf The DataView object to operate on
 * @param byteOffset The offset in the data buffer to begin reading
 * @param bytesToRead The offset in the data buffer to begin reading
 * @param terminator The char code for the terminator character (if bytesToRead is undefined)
 */
export type ReaderFunction = (buf: DataView, byteOffset?: number, bytesToRead?: number, terminator?: number) => {
    str: string;
    byteLength: number;
}

/**
 * The writer function should accept a single argument - the string to encode, and must return a JavaScript array of unsigned byte values representing that string in the specified encoding.
 * @param str The string to encode
 */
export type WriterFunction = (str: string) => number[]

/**
 * JavaScript DataView helper for reading/writing strings.
 */
class StringView {
	#readString: Map<string, ReaderFunction> = new Map([
		[encodingAscii, readStringAscii],
		[encodingUtf8, readStringUtf8],
	]);
	#writeString: Map<string, WriterFunction> = new Map([
		[encodingAscii, writeStringAscii],
		[encodingUtf8, writeStringUtf8],
	]);

    /**
     *
     * @param encoding
     * @throws Error
     * @returns
     */
	#checkEncoding(encoding?: string){
		if(typeof encoding === "undefined"){
			encoding = defaultEncoding;
		}
		if(!this.#writeString.has(encoding)){
			throw new Error("Unknown string encoding '" + encoding + "'");
		}
		return encoding;
	}

    #getReader(encoding?: string): ReaderFunction {
        encoding = this.#checkEncoding(encoding);
        var reader: ReaderFunction | undefined

        if (reader = this.#readString.get(encoding)) {
            return reader
        }

        throw new Error("Unknown string encoding '" + encoding + "'");
    }

    #getWriter(encoding?: string): WriterFunction {
        encoding = this.#checkEncoding(encoding);
        var writer: WriterFunction | undefined

        if (writer = this.#writeString.get(encoding)) {
            return writer
        }

        throw new Error("Unknown string encoding '" + encoding + "'");
    }

	addStringCodec(encoding: string, reader: ReaderFunction, writer: WriterFunction){
		this.#readString.set(encoding, reader);
		this.#writeString.set(encoding, writer);
	}

	stringByteLength(str: string, encoding: string){
		encoding = this.#checkEncoding(encoding);
		return this.#getWriter(encoding)(str).length;
	}

    /**
     * Returns the string represented by this DataView's buffer starting at `byteOffset`. The string will be made from `byteLength` bytes (defaulting to the length of the buffer minus `byteOffset` if not specified) interpreted using the specified encoding.
     *
     * This method will throw an Error if the provided `byteOffset` and `byteLength` would cause access past the end of the buffer.
     *
     * If `encoding` is provided to `getString` then `byteLength` must also be provided.
     * The `byteLength` defaults to the length of the buffer minus the `byteOffset` if not provided.
     * @param dataView
     * @param byteOffset
     * @param byteLength
     * @param encoding
     * @throws Error
     * @returns
     */
	getString(dataView: DataView, byteOffset: number = 0, byteLength?: number, encoding?: string){
		return this.getStringData(dataView, byteOffset, byteLength, encoding).str;
	}

    /**
     * Functionally identical to the method `getString`, but returns an object with two properties: `str`, and `byteLength` - the `str` property is the read string, and the `byteLength` property indicates the number of bytes that were consumed while reading it. Note that if decoding issues are encountered this byte length value may differ from a subsequently calculated byte length for the returned string.
     * @param dataView
     * @param byteOffset
     * @param byteLength
     * @param encoding
     * @throws Error
     * @returns
     */
	getStringData(dataView: DataView, byteOffset: number = 0, byteLength?: number, encoding?: string){
		encoding = this.#checkEncoding(encoding);
		if(!byteLength){
			byteLength = dataView.byteLength - byteOffset;
		}
		return this.#getReader(encoding)(dataView, byteOffset, byteLength);
	}

    /**
     * Returns the string represented by this DataView's buffer starting at `byteOffset` and reading until a null byte (or the numeric char code specified as `terminator`) or the end of the buffer is encountered, interpreted using the specified encoding.
     * @param dataView
     * @param byteOffset
     * @param encoding
     * @param terminator
     * @throws Error
     * @returns
     */
	getStringNT(dataView: DataView, byteOffset?: number, encoding?: string, terminator?: number) {
		return this.getStringDataNT(dataView, byteOffset, encoding, terminator).str;
	}

    /**
     * Functionally identical to the method `getStringNT`, but returns an object with two properties: `str`, and `byteLength` - the `str` property is the read string (**not including** null byte), and the `byteLength` property indicates the number of bytes that were consumed while reading it (**including** the null byte). Note that if decoding issues are encountered this byte length value may differ from a subsequently calculated byte length for the returned string.
     * @param dataView
     * @param byteOffset
     * @param encoding
     * @param terminator
     * @throws Error
     * @returns
     */
	getStringDataNT(dataView: DataView, byteOffset?: number, encoding?: string, terminator?: number) {
		encoding = this.#checkEncoding(encoding);
		return this.#getReader(encoding)(dataView, byteOffset, undefined, terminator);
	}

    /**
     * Writes the provided value into this DataView's buffer starting at `byteOffset`. The string will be encoded using the specified encoding. This function will return the number of bytes written to the string, which may be less than the number required to completely represent the string if `byteOffset` is too close to the end of the buffer. Note that this function may write a partial character at the end of the string in the case of truncation.
     * @param dataView
     * @param byteOffset
     * @param value
     * @param encoding
     * @throws Error
     * @returns
     */
	setString(dataView: DataView, byteOffset?: number, value?: string, encoding?: string){
		encoding = this.#checkEncoding(encoding);
		const arr = this.#getWriter(encoding)(value);
		let i;
		for(i = 0; i < arr.length && byteOffset + i < dataView.byteLength; i++){
			dataView.setUint8(byteOffset + i, arr[i]);
		}
		return i;
	}

    /**
     * Writes the provided value into this DataView's buffer starting at `byteOffset`. The string will be encoded using the specified encoding and terminated with a null byte. This function will return the number of bytes written to the string, which may be less than the number required to completely represent the string if `byteOffset` is too close to the end of the buffer. If the string was truncated it will still be terminated by a null byte. The null byte will be included the the return value. Note that this function may write a partial character at the end of the string in the case of truncation. Note that unlike getStringNT this method does not accept a custom terminator argument - if a custom terminator is required then use `setString` with the desired terminator appended to the string.
     * @param dataView
     * @param byteOffset
     * @param value
     * @param encoding
     * @throws Error
     * @returns
     */
	setStringNT(dataView: DataView, byteOffset: number = 0, value?: string, encoding?: string){
		let bytesWritten = this.setString(dataView, byteOffset, value, encoding);
		if(byteOffset + bytesWritten >= dataView.byteLength){
			//Incomplete string write, or written up against end of buffer
			//Pull back 1 byte to put null term in
			bytesWritten -= 1;
		}
		dataView.setUint8(byteOffset + bytesWritten, 0);
		return bytesWritten + 1;
	}
}

export default new StringView();
