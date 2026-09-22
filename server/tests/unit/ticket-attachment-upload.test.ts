/**
 * PROD-008: the iOS ticket photo picker posted to an endpoint nothing served.
 *
 * `POST /api/service-tickets/:id/attachments` is how a field technician sends
 * a photo of an error code, a meter or damage. The service-tickets edge
 * function had no `attachments` branch, so every upload fell through to its
 * trailing 405, and Express has no handler for that path either. The picker
 * showed each photo as failed while the technician stood in front of the
 * machine.
 *
 * `POST /mobile/photos` looks like the existing implementation and is not: its
 * header says "actual file handled separately", it requires an `object_path`,
 * and nothing in the tree ever uploads bytes to produce one.
 *
 * The planner is exercised with REAL BYTES rather than read as text - a sniff
 * assertion that greps for 'sniffUpload' proves the call is in the file and
 * nothing about what comes out of it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { servicePhotos } from '@shared/mobile-service-schema';
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_BUCKET,
  ATTACHMENT_URL_TTL_SECONDS,
  MAX_ATTACHMENT_BYTES,
  decodeBase64,
  planTicketAttachment,
  sanitizeAttachmentName,
} from '../../../supabase/functions/_shared/ticket-attachment.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const b64 = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString('base64');

/** A real JPEG header - what the picker actually encodes. */
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

const ctx = { tenantId: 't1', ticketId: 'tkt-1', uuid: 'uuid-1' };

describe('planTicketAttachment', () => {
  it('accepts the payload the iOS picker sends', () => {
    const plan = planTicketAttachment(
      { filename: 'ticket-tkt-1-1758466000.0-0.jpg', mimeType: 'image/jpeg', base64: JPEG },
      ctx,
    );
    expect(plan.error).toBeUndefined();
    expect(plan.mime).toBe('image/jpeg');
    expect(plan.storagePath).toBe('t1/tkt-1/uuid-1-ticket-tkt-1-1758466000.0-0.jpg');
  });

  it('stores the SNIFFED type, not the declared one', () => {
    // The client calls it a jpeg; the bytes are a PNG. What gets stored and
    // what the object is served as must follow the bytes.
    const plan = planTicketAttachment(
      { filename: 'photo.jpg', mimeType: 'image/jpeg', base64: PNG },
      ctx,
    );
    expect(plan.mime).toBe('image/png');
    expect(plan.fileName).toBe('photo.png');
  });

  it('refuses an SVG, which is the whole reason the bytes are sniffed', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString(
      'base64',
    );
    const plan = planTicketAttachment(
      { filename: 'evil.jpg', mimeType: 'image/jpeg', base64: svg },
      ctx,
    );
    expect(plan.error?.code).toBe('ATTACHMENT_TYPE_REJECTED');
    expect(plan.error?.status).toBe(415);
  });

  it('refuses a file whose header matches nothing rather than guessing', () => {
    const junk = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]).toString('base64');
    expect(planTicketAttachment({ filename: 'x.jpg', base64: junk }, ctx).error?.code).toBe(
      'ATTACHMENT_TYPE_REJECTED',
    );
  });

  it('refuses a PDF - sniffUpload knows it, and it is not a photo', () => {
    // The allow-list is narrower than what the sniffer can recognise, and that
    // gap is the point: a handler that took everything sniffUpload identifies
    // would accept documents on a photo endpoint.
    const pdf = b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(planTicketAttachment({ filename: 'doc.pdf', base64: pdf }, ctx).error?.code).toBe(
      'ATTACHMENT_TYPE_REJECTED',
    );
  });

  it('answers 400 for a missing body rather than storing an empty object', () => {
    expect(planTicketAttachment({}, ctx).error?.code).toBe('ATTACHMENT_EMPTY');
    expect(planTicketAttachment({ base64: '   ' }, ctx).error?.code).toBe('ATTACHMENT_EMPTY');
  });

  it('answers 400 for base64 that cannot be decoded', () => {
    const plan = planTicketAttachment({ base64: '!!!not base64!!!' }, ctx);
    expect(plan.error?.code).toBe('ATTACHMENT_MALFORMED');
    expect(plan.error?.status).toBe(400);
  });

  it('checks the size of the DECODED bytes, which is what gets stored', () => {
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1024);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    const plan = planTicketAttachment({ base64: big.toString('base64') }, ctx);
    expect(plan.error?.code).toBe('ATTACHMENT_TOO_LARGE');
    expect(plan.error?.status).toBe(413);
  });

  it('accepts a photo that only the ENCODED form pushes over the limit', () => {
    // The case that separates the two implementations, and the reason the one
    // above cannot: base64 inflates by 4/3, so a 14MB photo arrives as a 19MB
    // string. Measuring the string rejects a file well inside the limit, and
    // the over-limit fixture above is over it on either reading.
    const justUnder = Buffer.alloc(MAX_ATTACHMENT_BYTES - 1024);
    justUnder[0] = 0xff;
    justUnder[1] = 0xd8;
    justUnder[2] = 0xff;
    const encoded = justUnder.toString('base64');
    expect(encoded.length).toBeGreaterThan(MAX_ATTACHMENT_BYTES);
    const plan = planTicketAttachment({ base64: encoded }, ctx);
    expect(plan.error).toBeUndefined();
    expect(plan.mime).toBe('image/jpeg');
  });

  it('the tenant prefix is held by the character class, not by the basename step', () => {
    // Recorded because a mutant proved it: deleting the split/pop leaves the
    // key just as safe, since `/` and `\\` are rewritten to a dash. Asserting
    // the property here means the guarantee survives whichever line moves.
    expect(sanitizeAttachmentName('a/b/c')).not.toMatch(/[\\/]/);
    expect(sanitizeAttachmentName('..\\..\\x')).not.toMatch(/[\\/]/);
    expect(sanitizeAttachmentName('../../x')).not.toContain('..');
  });

  it('every allowed type is one the sniffer can actually recognise', () => {
    // A type on the allow-list that sniffUpload cannot identify is unreachable,
    // and reads as support for a format nothing will ever accept.
    const heads: Record<string, number[]> = {
      'image/jpeg': [0xff, 0xd8, 0xff, 0x00],
      'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      'image/gif': [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      'image/webp': [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      'image/avif': [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
    };
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      const head = heads[type];
      expect({ type, hasFixture: Boolean(head) }).toEqual({ type, hasFixture: true });
      const plan = planTicketAttachment({ base64: b64(head) }, ctx);
      expect({ type, sniffed: plan.mime }).toEqual({ type, sniffed: type });
    }
  });

  it('a caller-supplied filename cannot escape the tenant prefix', () => {
    // The name reaches an object key, so `../` and a leading slash are what
    // would let one tenant write into another's prefix.
    const plan = planTicketAttachment(
      { filename: '../../../other-tenant/owned.jpg', base64: JPEG },
      ctx,
    );
    expect(plan.storagePath?.startsWith('t1/tkt-1/')).toBe(true);
    expect(plan.storagePath).not.toContain('..');
  });

  it('keeps the original name for the record and trusts it for nothing', () => {
    const plan = planTicketAttachment({ filename: 'Meter Reading!.JPG', base64: JPEG }, ctx);
    expect(plan.originalName).toBe('Meter Reading!.JPG');
    expect(plan.fileName).toBe('Meter-Reading.jpg');
  });

  it('a nameless upload still gets a key, not one ending in a dot', () => {
    expect(sanitizeAttachmentName(undefined)).toBe('photo');
    expect(sanitizeAttachmentName('...')).toBe('photo');
    const plan = planTicketAttachment({ base64: JPEG }, ctx);
    expect(plan.fileName).toBe('photo.jpg');
  });

  it('two photos taken in the same second do not overwrite each other', () => {
    // The picker names files from a timestamp and an index, so the name alone
    // is not unique enough to be an object key.
    const a = planTicketAttachment({ filename: 'p.jpg', base64: JPEG }, { ...ctx, uuid: 'u1' });
    const b = planTicketAttachment({ filename: 'p.jpg', base64: JPEG }, { ...ctx, uuid: 'u2' });
    expect(a.storagePath).not.toBe(b.storagePath);
  });

  it('decodes a data: URL prefix, which is what a web client would send', () => {
    const withPrefix = `data:image/jpeg;base64,${JPEG}`;
    expect(planTicketAttachment({ base64: withPrefix }, ctx).mime).toBe('image/jpeg');
    expect(decodeBase64('')).toBeNull();
  });
});

describe('the row it produces fits the table', () => {
  const columns = getTableConfig(servicePhotos).columns;
  const src = stripComments(read('supabase/functions/service-tickets/index.ts'));
  const branchStart = src.indexOf("subResource === 'attachments'");
  const branch = src.slice(branchStart, src.indexOf('// GET /service-tickets/:id ', branchStart));

  it('the attachments branch exists at all', () => {
    // The whole defect: it did not, so the upload fell through to a 405.
    expect(branchStart).toBeGreaterThan(-1);
  });

  it('supplies every NOT NULL column that has no default', () => {
    // Derived from drizzle, so a schema change that adds one fails here rather
    // than at runtime on a technician's phone.
    const required = columns.filter((c) => c.notNull && !c.hasDefault).map((c) => c.name);
    expect(required.length).toBeGreaterThan(0);
    const missing = required.filter((c) => !new RegExp(`(^|\\s)${c}:`, 'm').test(branch));
    expect(missing).toEqual([]);
  });

  it('names no column the table does not have', () => {
    const real = new Set(columns.map((c) => c.name));
    const insertAt = branch.indexOf('.insert({');
    const literal = branch.slice(insertAt, branch.indexOf('})', insertAt));
    const named = [...literal.matchAll(/^\s{10}([a-z_]+):/gm)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(4);
    expect(named.filter((c) => !real.has(c))).toEqual([]);
  });
});

describe('the objects are private', () => {
  const src = stripComments(read('supabase/functions/service-tickets/index.ts'));

  it('the bucket is created with public: false, stated rather than defaulted', () => {
    const at = src.indexOf('createBucket(ATTACHMENT_BUCKET');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 200)).toMatch(/public:\s*false/);
  });

  it('signs the whole list in one call, not one per row', () => {
    // A ticket can carry twenty photos. Signing them one at a time is an N+1
    // the report would flag, and createSignedUrls takes the list.
    const at = src.indexOf("subResource === 'attachments'");
    const branch = src.slice(at, src.indexOf('// GET /service-tickets/:id ', at));
    expect(branch).toMatch(/createSignedUrls\(paths,/);
    expect(branch).not.toMatch(/for \([^)]*\) \{[\s\S]{0,200}createSignedUrl\(/);
  });

  it('reads hand back a signed URL and never getPublicUrl', () => {
    // getPublicUrl returns a working-looking string whether or not the bucket
    // is public, which is how the QBR decks came to be world-readable.
    expect(src).toMatch(/createSignedUrl\(/);
    const at = src.indexOf("subResource === 'attachments'");
    const branch = src.slice(at, src.indexOf('// GET /service-tickets/:id ', at));
    expect(branch).not.toMatch(/getPublicUrl/);
  });

  it('the signed URL is short lived', () => {
    expect(ATTACHMENT_URL_TTL_SECONDS).toBeLessThanOrEqual(60 * 60);
    expect(ATTACHMENT_URL_TTL_SECONDS).toBeGreaterThan(0);
  });

  it('the inventory doc records the bucket and says it is private', () => {
    const doc = read('docs/storage-bucket-inventory.md');
    expect(doc).toContain(ATTACHMENT_BUCKET);
    const row = doc.split('\n').find((l) => l.includes(`\`${ATTACHMENT_BUCKET}\``))!;
    expect(row).toMatch(/\|\s*private\s*\|/);
  });

  it('the storage audit knows what this bucket is meant to be', () => {
    // A bucket missing from that map is one the audit reports as unexpected
    // rather than one it checks the visibility of.
    const audit = read('scripts/audit-storage-buckets.ts');
    const at = audit.indexOf(`'${ATTACHMENT_BUCKET}': {`);
    expect(at).toBeGreaterThan(-1);
    expect(audit.slice(at, at + 200)).toMatch(/visibility:\s*'private'/);
  });
});

describe('the ticket is checked before anything is stored', () => {
  const src = stripComments(read('supabase/functions/service-tickets/index.ts'));
  const at = src.indexOf("subResource === 'attachments'");
  const branch = src.slice(at, src.indexOf('// GET /service-tickets/:id ', at));

  it('a ticket in another tenant answers 404, not an upload', () => {
    const lookup = branch.indexOf("from('service_tickets')");
    expect(lookup).toBeGreaterThan(-1);
    expect(branch.slice(lookup, lookup + 300)).toMatch(/\.eq\('tenant_id', tenantId\)/);
  });

  it('the scope check runs BEFORE the upload, not after it', () => {
    // A refusal that runs after the write is not a refusal.
    const scope = branch.indexOf('denyIfTicketOutOfScope');
    const upload = branch.indexOf('.upload(');
    expect(scope).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(scope);
  });

  it('a failed insert removes the object rather than leaving an orphan', () => {
    expect(branch).toMatch(/\.remove\(\[plan\.storagePath\]\)/);
  });
});
