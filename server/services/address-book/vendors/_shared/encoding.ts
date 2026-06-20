/**
 * Character-encoding detection + decoding for vendor address-book files
 * (ABK-006: Konica Minolta exports are frequently Shift-JIS; others UTF-8).
 *
 * Uses iconv-lite (already a project dependency) for legacy code pages. BOM
 * detection takes precedence over heuristics.
 */
import iconv from 'iconv-lite';

export type EncodingHint = 'utf-8' | 'shift_jis' | 'auto';

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM = [0xff, 0xfe];
const UTF16BE_BOM = [0xfe, 0xff];

function hasBom(buffer: Buffer, bom: number[]): boolean {
  if (buffer.length < bom.length) return false;
  return bom.every((b, i) => buffer[i] === b);
}

/**
 * Heuristic Shift-JIS detector: looks for byte sequences that are valid
 * Shift-JIS lead+trail pairs and uncommon in UTF-8 text. Conservative — only
 * returns true when clear multi-byte SJIS runs appear and the buffer is not
 * valid UTF-8.
 */
function looksLikeShiftJis(buffer: Buffer): boolean {
  let sjisPairs = 0;
  for (let i = 0; i < buffer.length - 1; i++) {
    const lead = buffer[i];
    const trail = buffer[i + 1];
    const leadOk = (lead >= 0x81 && lead <= 0x9f) || (lead >= 0xe0 && lead <= 0xef);
    const trailOk = (trail >= 0x40 && trail <= 0x7e) || (trail >= 0x80 && trail <= 0xfc);
    if (leadOk && trailOk) {
      sjisPairs++;
      i++; // consume the pair
    }
  }
  if (sjisPairs === 0) return false;
  // If the buffer also decodes cleanly as UTF-8, prefer UTF-8.
  try {
    const decoded = buffer.toString('utf-8');
    if (!decoded.includes('�')) return false;
  } catch {
    /* fall through */
  }
  return true;
}

export interface DecodeResult {
  text: string;
  encoding: string;
  hadBom: boolean;
}

/** Decode a raw file buffer to a JS string, stripping any BOM. */
export function decodeBuffer(buffer: Buffer, hint: EncodingHint = 'auto'): DecodeResult {
  if (hasBom(buffer, UTF8_BOM)) {
    return { text: buffer.subarray(3).toString('utf-8'), encoding: 'utf-8', hadBom: true };
  }
  if (hasBom(buffer, UTF16LE_BOM)) {
    return {
      text: iconv.decode(buffer.subarray(2), 'utf-16le'),
      encoding: 'utf-16le',
      hadBom: true,
    };
  }
  if (hasBom(buffer, UTF16BE_BOM)) {
    return {
      text: iconv.decode(buffer.subarray(2), 'utf-16be'),
      encoding: 'utf-16be',
      hadBom: true,
    };
  }

  if (hint === 'shift_jis') {
    return { text: iconv.decode(buffer, 'shift_jis'), encoding: 'shift_jis', hadBom: false };
  }
  if (hint === 'utf-8') {
    return { text: buffer.toString('utf-8'), encoding: 'utf-8', hadBom: false };
  }

  // auto
  if (looksLikeShiftJis(buffer)) {
    return { text: iconv.decode(buffer, 'shift_jis'), encoding: 'shift_jis', hadBom: false };
  }
  return { text: buffer.toString('utf-8'), encoding: 'utf-8', hadBom: false };
}

/** Encode a string to a buffer in the requested encoding (UTF-8 default). */
export function encodeText(text: string, encoding: string, withBom = false): Buffer {
  if (encoding === 'utf-8' || encoding === 'utf8') {
    const body = Buffer.from(text, 'utf-8');
    return withBom ? Buffer.concat([Buffer.from(UTF8_BOM), body]) : body;
  }
  return iconv.encode(text, encoding);
}
