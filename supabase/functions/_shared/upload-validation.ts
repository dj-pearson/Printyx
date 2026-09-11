// What a file actually IS, as opposed to what the client said it was.
//
// A declared content type is a string the caller controls. blog-assets took
// `mime_type` on a metadata call and never looked at the object, so the row
// could say image/png over anything at all; branding-profiles trusted
// `file.type` off the multipart part, which the browser sets from the file
// extension and any other client sets to whatever it likes. Neither is
// evidence.
//
// This sniffs the leading bytes instead. It is deliberately a SHORT list: a
// format that cannot be recognised from its header is rejected rather than
// guessed at, because "unknown" stored under a caller-chosen content type is
// the exposure this exists to close.
//
// SVG has no magic number - it is an XML document, and a valid one may open
// with a comment, a BOM, an <?xml?> declaration or a doctype. It is detected
// structurally, and anything claiming to be an SVG must still go through
// sanitizeSvg before it is stored.

export interface SniffResult {
  /** The type the bytes actually are, or null when nothing matched. */
  mime: string | null;
  /** Canonical extension for that type, without the dot. */
  ext: string | null;
}

interface Signature {
  mime: string;
  ext: string;
  /** Byte values at the head of the file; null matches any byte. */
  magic: (number | null)[];
  /** Extra bytes that must appear at a fixed offset (container brands). */
  at?: { offset: number; bytes: number[] };
}

const SIGNATURES: Signature[] = [
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
  {
    mime: 'image/webp',
    ext: 'webp',
    magic: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    at: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP"
  },
  {
    // ISO-BMFF: "ftyp" at offset 4, brand "avif"/"avis" at 8.
    mime: 'image/avif',
    ext: 'avif',
    magic: [null, null, null, null, 0x66, 0x74, 0x79, 0x70],
    at: { offset: 8, bytes: [0x61, 0x76, 0x69] }, // "avi"
  },
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

function matches(bytes: Uint8Array, sig: Signature): boolean {
  if (bytes.length < sig.magic.length) return false;
  for (let i = 0; i < sig.magic.length; i++) {
    const want = sig.magic[i];
    if (want !== null && bytes[i] !== want) return false;
  }
  if (sig.at) {
    const { offset, bytes: want } = sig.at;
    if (bytes.length < offset + want.length) return false;
    for (let i = 0; i < want.length; i++) {
      if (bytes[offset + i] !== want[i]) return false;
    }
  }
  return true;
}

/** Skip a UTF-8 BOM and leading whitespace before looking at text content. */
function textHead(bytes: Uint8Array, limit = 2048): string {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  return new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(start, start + limit))
    .trimStart();
}

/** True when the head of the file parses as the opening of an SVG document. */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  let head = textHead(bytes);
  // Drop an XML declaration, a doctype and any leading comments, in any order.
  for (;;) {
    const before = head;
    head = head.replace(/^<\?xml[^>]*\?>/i, '').trimStart();
    head = head.replace(/^<!DOCTYPE[^>]*>/i, '').trimStart();
    head = head.replace(/^<!--[\s\S]*?-->/, '').trimStart();
    if (head === before) break;
  }
  return /^<svg[\s>]/i.test(head);
}

/**
 * Identify a file from its leading bytes.
 *
 * `textFallback` names the types that may be accepted on structure alone
 * (svg, json, csv, plain text) - pass the set the caller actually allows, so a
 * handler that takes images only never lands on text/csv.
 */
export function sniffUpload(bytes: Uint8Array, textFallback: readonly string[] = []): SniffResult {
  for (const sig of SIGNATURES) {
    if (matches(bytes, sig)) return { mime: sig.mime, ext: sig.ext };
  }

  const allow = new Set(textFallback);
  if (allow.has('image/svg+xml') && looksLikeSvg(bytes)) {
    return { mime: 'image/svg+xml', ext: 'svg' };
  }

  const head = textHead(bytes);
  if (head.length === 0) return { mime: null, ext: null };
  // A control byte outside tab, newline and carriage return means this is not
  // text, whatever the caller called it.
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(head)) return { mime: null, ext: null };

  if (allow.has('application/json') && /^[[{]/.test(head)) {
    return { mime: 'application/json', ext: 'json' };
  }
  if (allow.has('text/csv')) return { mime: 'text/csv', ext: 'csv' };
  if (allow.has('text/plain')) return { mime: 'text/plain', ext: 'txt' };
  return { mime: null, ext: null };
}
