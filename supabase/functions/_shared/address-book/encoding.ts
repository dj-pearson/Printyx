// Character-encoding detection + decoding for vendor address-book files.
//
// PA-055: the Deno counterpart of
// server/services/address-book/vendors/_shared/encoding.ts. Same BOM precedence
// and the same conservative Shift-JIS heuristic - Konica exports are frequently
// Shift-JIS - locked by server/tests/unit/address-book-port-parity.test.ts.
//
// TWO RUNTIME DIFFERENCES, both real rather than stylistic:
//
//  - iconv-lite is Node-only. DECODING needs nothing else: TextDecoder is a
//    WHATWG Encoding implementation and handles shift_jis, utf-16le and
//    utf-16be natively.
//  - ENCODING to a legacy code page has no Web API at all - TextEncoder emits
//    UTF-8 and nothing else. That is not a gap in practice, because every one of
//    the four serializers writes UTF-8 (grep encodeText: canon, konica, ricoh
//    and xerox all pass 'utf-8'), but encodeText THROWS on any other encoding
//    rather than silently emitting UTF-8 under a Shift-JIS filename. A device
//    reading that file would show mojibake and the export would look like a
//    parser bug.

export type EncodingHint = 'utf-8' | 'shift_jis' | 'auto';

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM = [0xff, 0xfe];
const UTF16BE_BOM = [0xfe, 0xff];

function hasBom(bytes: Uint8Array, bom: number[]): boolean {
  if (bytes.length < bom.length) return false;
  return bom.every((b, i) => bytes[i] === b);
}

function decodeWith(bytes: Uint8Array, label: string): string {
  return new TextDecoder(label).decode(bytes);
}

/**
 * Heuristic Shift-JIS detector: looks for byte sequences that are valid
 * Shift-JIS lead+trail pairs and uncommon in UTF-8 text. Conservative — only
 * returns true when clear multi-byte SJIS runs appear and the buffer is not
 * valid UTF-8.
 */
function looksLikeShiftJis(bytes: Uint8Array): boolean {
  let sjisPairs = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    const lead = bytes[i];
    const trail = bytes[i + 1];
    const leadOk = (lead >= 0x81 && lead <= 0x9f) || (lead >= 0xe0 && lead <= 0xef);
    const trailOk = (trail >= 0x40 && trail <= 0x7e) || (trail >= 0x80 && trail <= 0xfc);
    if (leadOk && trailOk) {
      sjisPairs++;
      i++; // consume the pair
    }
  }
  if (sjisPairs === 0) return false;
  // If the buffer also decodes cleanly as UTF-8, prefer UTF-8. A non-fatal
  // decoder substitutes U+FFFD, which is the same signal Node's toString gives.
  const decoded = decodeWith(bytes, 'utf-8');
  if (!decoded.includes('�')) return false;
  return true;
}

export interface DecodeResult {
  text: string;
  encoding: string;
  hadBom: boolean;
}

/** Decode a raw file buffer to a JS string, stripping any BOM. */
export function decodeBuffer(bytes: Uint8Array, hint: EncodingHint = 'auto'): DecodeResult {
  if (hasBom(bytes, UTF8_BOM)) {
    return { text: decodeWith(bytes.subarray(3), 'utf-8'), encoding: 'utf-8', hadBom: true };
  }
  if (hasBom(bytes, UTF16LE_BOM)) {
    return { text: decodeWith(bytes.subarray(2), 'utf-16le'), encoding: 'utf-16le', hadBom: true };
  }
  if (hasBom(bytes, UTF16BE_BOM)) {
    return { text: decodeWith(bytes.subarray(2), 'utf-16be'), encoding: 'utf-16be', hadBom: true };
  }

  if (hint === 'shift_jis') {
    return { text: decodeWith(bytes, 'shift_jis'), encoding: 'shift_jis', hadBom: false };
  }
  if (hint === 'utf-8') {
    return { text: decodeWith(bytes, 'utf-8'), encoding: 'utf-8', hadBom: false };
  }

  // auto
  if (looksLikeShiftJis(bytes)) {
    return { text: decodeWith(bytes, 'shift_jis'), encoding: 'shift_jis', hadBom: false };
  }
  return { text: decodeWith(bytes, 'utf-8'), encoding: 'utf-8', hadBom: false };
}

/** Encode a string to bytes. UTF-8 only — see the header for why. */
export function encodeText(text: string, encoding: string, withBom = false): Uint8Array {
  if (encoding !== 'utf-8' && encoding !== 'utf8') {
    throw new Error(
      `encodeText cannot produce ${encoding} in this runtime: TextEncoder emits UTF-8 only. ` +
        'Emitting UTF-8 under another label would produce a file the device silently misreads.',
    );
  }
  const body = new TextEncoder().encode(text);
  if (!withBom) return body;
  const out = new Uint8Array(UTF8_BOM.length + body.length);
  out.set(UTF8_BOM, 0);
  out.set(body, UTF8_BOM.length);
  return out;
}
