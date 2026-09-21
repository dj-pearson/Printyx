/**
 * What a field technician's photo is allowed to be, and where it goes.
 *
 * PROD-008. `POST /api/service-tickets/:id/attachments` is the iOS ticket photo
 * picker - "attach photos of error codes, meters, or damage" - and no host
 * served it: the service-tickets edge function had no `attachments` branch, so
 * every upload fell through to its 405, and Express has no handler either. The
 * picker then showed each photo as failed while the technician stood in front
 * of the machine.
 *
 * `POST /mobile/photos` looked like the existing implementation and is not: its
 * own header says "actual file handled separately", it REQUIRES an
 * `object_path`, and nothing in the tree ever uploads bytes to produce one. So
 * the metadata half shipped and the file half never did.
 *
 * THREE RULES, all of them ones this repo has already paid for.
 *
 * A DECLARED TYPE IS NOT EVIDENCE (SEC-SVG-002). The client sends
 * `mimeType: "image/jpeg"`; that string is whatever the caller wants it to be,
 * so the bytes are sniffed and the SNIFFED type is what gets stored and served.
 * `sniffUpload` is called with NO text fallback, which is what makes SVG and
 * anything else unrecognisable a rejection rather than a guess.
 *
 * THE BUCKET IS PRIVATE. A photo taken on a customer's site shows their
 * equipment, their serials and often their premises, and it is frequently
 * geotagged. `branding-assets` and `blog-assets` are public because a logo and
 * a post image are meant to be fetchable by anyone; this is the qbr-artifacts
 * case, not that one, so objects come back through short-lived signed URLs
 * (docs/storage-bucket-inventory.md).
 *
 * THE PLAN IS A PURE FUNCTION. Decoding, sniffing and naming are decided here
 * and tested with real bytes; the handler does storage and the insert. A source
 * check cannot tell a correct sniff from a constant that is still in the file.
 */
import { sniffUpload } from './upload-validation.ts';

/** A technician photo. Not a document, not a vector, not an archive. */
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

/**
 * 15MB decoded.
 *
 * The iOS picker already downsizes to about 1MB before encoding, so this is a
 * ceiling on a misbehaving client rather than a limit anyone meets. base64
 * inflates by 4/3, so the request body is larger than the file.
 */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Private, and named in docs/storage-bucket-inventory.md. */
export const ATTACHMENT_BUCKET = 'service-photos';

/** How long a returned link stays valid. Long enough to render, short enough to leak badly. */
export const ATTACHMENT_URL_TTL_SECONDS = 15 * 60;

export interface AttachmentPlan {
  bytes: Uint8Array | null;
  /** The type the bytes ARE. Never the declared one. */
  mime: string | null;
  /** Object key inside the bucket, tenant-prefixed. */
  storagePath: string | null;
  /** Filename to record, sanitised, with the sniffed extension. */
  fileName: string | null;
  /** What the caller called the file, kept for the record and trusted for nothing. */
  originalName: string | null;
  error?: { message: string; code: string; status: number };
}

/**
 * Strip anything that is not a plain filename.
 *
 * A caller-supplied name reaches an object key, so `../` and a leading slash
 * have to go; an empty result gets a generic name rather than producing a key
 * that ends in a dot.
 */
export function sanitizeAttachmentName(raw: unknown): string {
  const base = String(raw ?? '')
    // Belt and braces. Mutation testing showed removing this line changes
    // nothing: the character class below already rewrites `/` and `\\` to a
    // dash, so THAT is the line holding the tenant prefix, not this one. Kept
    // because taking the basename is what the reader expects to see here, and
    // labelled so nobody mistakes it for the control.
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return base || 'photo';
}

/** Decode base64, tolerating a `data:` URL prefix and embedded whitespace. */
export function decodeBase64(input: string): Uint8Array | null {
  const cleaned = input.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '');
  if (cleaned.length === 0) return null;
  try {
    const binary = atob(cleaned);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export interface AttachmentInput {
  filename?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  base64?: unknown;
}

/**
 * Decide what to store for one uploaded photo.
 *
 * Every refusal carries the status the handler should answer with, so the
 * caller does not have to re-derive 413 from 415 from 400.
 */
export function planTicketAttachment(
  body: AttachmentInput,
  ctx: { tenantId: string; ticketId: string; uuid: string },
): AttachmentPlan {
  const empty: AttachmentPlan = {
    bytes: null,
    mime: null,
    storagePath: null,
    fileName: null,
    originalName: null,
  };

  const raw = body.base64;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      ...empty,
      error: { message: 'base64 file content is required', code: 'ATTACHMENT_EMPTY', status: 400 },
    };
  }

  const bytes = decodeBase64(raw);
  if (!bytes || bytes.length === 0) {
    return {
      ...empty,
      error: {
        message: 'base64 content could not be decoded',
        code: 'ATTACHMENT_MALFORMED',
        status: 400,
      },
    };
  }

  // Size is checked on the DECODED bytes, which is the thing that gets stored.
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    return {
      ...empty,
      error: {
        message: `Attachment exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`,
        code: 'ATTACHMENT_TOO_LARGE',
        status: 413,
      },
    };
  }

  // No text fallback: a file whose header matches nothing is refused rather
  // than stored under a type the caller chose.
  const sniffed = sniffUpload(bytes);
  if (!sniffed.mime || !(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(sniffed.mime)) {
    return {
      ...empty,
      error: {
        message: 'Attachment must be a photo (jpeg, png, webp, avif or gif)',
        code: 'ATTACHMENT_TYPE_REJECTED',
        status: 415,
      },
    };
  }

  const declared = body.filename ?? body.fileName;
  const stem = sanitizeAttachmentName(declared);
  const fileName = `${stem}.${sniffed.ext}`;

  return {
    bytes,
    mime: sniffed.mime,
    // Tenant-first so one prefix scopes a tenant's objects, and a uuid so two
    // photos taken in the same second cannot overwrite each other - the iOS
    // picker names them from a timestamp and an index.
    storagePath: `${ctx.tenantId}/${ctx.ticketId}/${ctx.uuid}-${fileName}`,
    fileName,
    originalName: typeof declared === 'string' && declared ? declared.slice(0, 255) : null,
  };
}
