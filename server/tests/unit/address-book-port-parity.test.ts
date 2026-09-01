/**
 * The address-book vendor layer exists twice and must stay one implementation.
 *
 * PA-055 ported it to supabase/functions/_shared/address-book/ so import and
 * export can run in production - ABK-014 shipped them as Express routes only,
 * and getApiUrl sends /api/* to the functions host, so the browser never reaches
 * Express there.
 *
 * A file written by one host has to be readable by the other. If the Canon
 * crypto parameters, the field maps or the vendor registry drift, that stops
 * being true and neither side's own tests notice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const nodeDir = join(repo, 'server/services/address-book');
const edgeDir = join(repo, 'supabase/functions/_shared/address-book');

const read = (p: string) => readFileSync(p, 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the Canon crypto scheme is identical on both hosts', () => {
  const nodeCrypto = read(join(nodeDir, 'vendors/canon/crypto.ts'));
  const edgeCrypto = read(join(edgeDir, 'canon-crypto.ts'));

  it('uses the same KDF parameters', () => {
    // A different iteration count or key length makes a blob written by one
    // host undecryptable by the other, with no error that says why.
    for (const src of [nodeCrypto, edgeCrypto]) {
      expect(src).toMatch(/SALT_LEN = 16/);
      expect(src).toMatch(/IV_LEN = 16/);
      expect(src).toMatch(/KEY_LEN = 32/);
      expect(src).toMatch(/ITERATIONS = 10000/);
    }
    expect(nodeCrypto).toMatch(/DIGEST = 'sha256'/);
    expect(edgeCrypto).toMatch(/DIGEST = 'SHA-256'/); // Web Crypto spells it upper-case
  });

  it('uses AES-256-CBC on both', () => {
    expect(nodeCrypto).toContain('aes-256-cbc');
    expect(edgeCrypto).toContain('AES-CBC');
    expect(edgeCrypto).toMatch(/length: KEY_LEN \* 8/);
  });

  it('writes the same self-describing blob layout', () => {
    // base64( salt[16] || iv[16] || ciphertext ) — the header of both files
    // states it, and both build the buffer in that order.
    for (const src of [nodeCrypto, edgeCrypto]) {
      expect(src).toMatch(/salt\[16\] \|\| iv\[16\] \|\| /);
    }
    expect(edgeCrypto).toMatch(/out\.set\(salt, 0\)/);
    expect(edgeCrypto).toMatch(/out\.set\(iv, salt\.length\)/);
  });

  it('rejects a blob too short to be a ciphertext, on both', () => {
    for (const src of [nodeCrypto, edgeCrypto]) {
      expect(src).toMatch(/SALT_LEN \+ IV_LEN \+ 16/);
    }
  });
});

describe('the vendor registry matches', () => {
  const nodeReg = read(join(nodeDir, 'vendors/index.ts'));
  const edgeReg = read(join(edgeDir, 'vendors.ts'));

  it('registers the same four vendors with the same capability flags', () => {
    for (const line of [
      'canon: { parse: parseCanon, serialize: serializeCanon, supportsEncryptedCredentials: true }',
      'konica: { parse: parseKonica, serialize: serializeKonica, supportsEncryptedCredentials: false }',
      'xerox: { parse: parseXerox, serialize: serializeXerox, supportsEncryptedCredentials: false }',
      'ricoh: { parse: parseRicoh, serialize: serializeRicoh, supportsEncryptedCredentials: false }',
    ]) {
      const compact = (s: string) => s.replace(/\s+/g, ' ');
      expect(compact(nodeReg)).toContain(compact(line));
      expect(compact(edgeReg)).toContain(compact(line));
    }
  });

  it('ports every vendor file', () => {
    const edgeFiles = readdirSync(edgeDir);
    for (const vendor of ['canon', 'konica', 'xerox', 'ricoh']) {
      expect(edgeFiles).toContain(`${vendor}-parser.ts`);
      expect(edgeFiles).toContain(`${vendor}-serializer.ts`);
    }
    for (const shared of ['csv.ts', 'encoding.ts', 'options.ts', 'conversion-engine.ts']) {
      expect(edgeFiles).toContain(shared);
    }
  });
});

describe('the encoding port is honest about what it cannot do', () => {
  const edgeEncoding = read(join(edgeDir, 'encoding.ts'));

  it('keeps the same BOM precedence and the SJIS heuristic', () => {
    const nodeEncoding = read(join(nodeDir, 'vendors/_shared/encoding.ts'));
    for (const src of [nodeEncoding, edgeEncoding]) {
      expect(src).toMatch(/UTF8_BOM = \[0xef, 0xbb, 0xbf\]/);
      expect(src).toMatch(/lead >= 0x81 && lead <= 0x9f/);
      expect(src).toMatch(/trail >= 0x40 && trail <= 0x7e/);
    }
  });

  it('throws rather than emitting UTF-8 under another label', () => {
    // TextEncoder is UTF-8 only. Writing UTF-8 bytes into a file the device
    // will read as Shift-JIS produces mojibake that looks like a parser bug.
    expect(edgeEncoding).toMatch(/encodeText cannot produce/);
    const code = stripComments(edgeEncoding);
    expect(code).not.toContain('iconv');
  });

  it('is not a limitation any serializer hits: all four write UTF-8', () => {
    for (const vendor of ['canon', 'konica', 'xerox', 'ricoh']) {
      const src = read(join(edgeDir, `${vendor}-serializer.ts`));
      // Matched per LINE, not with [^)]*: Canon's call embeds a join(')') and a
      // character class stops at that paren.
      const call = src.split('\n').find((line) => line.includes('encodeText('));
      expect(call, `${vendor} serializer does not call encodeText`).toBeTruthy();
      expect(call).toContain("'utf-8'");
    }
  });
});

describe('the async ripple is contained to Canon', () => {
  it('only Canon awaits, and its callers are async', () => {
    expect(read(join(edgeDir, 'canon-parser.ts'))).toMatch(/export async function parseCanon/);
    expect(read(join(edgeDir, 'canon-serializer.ts'))).toMatch(
      /export async function serializeCanon/,
    );
    expect(read(join(edgeDir, 'conversion-engine.ts'))).toMatch(
      /export async function convertBook/,
    );
  });

  it('types every adapter as possibly-async, so the registry is not a trap', () => {
    // Three of four are synchronous; a registry where one returns a promise and
    // the others do not is how a missing await ships.
    const reg = read(join(edgeDir, 'vendors.ts'));
    expect(reg).toMatch(/ParseResult \| Promise<ParseResult>/);
    expect(reg).toMatch(/SerializeResult \| Promise<SerializeResult>/);
  });
});

describe('no Node built-in survived the port', () => {
  it('imports nothing from node: and never names Buffer', () => {
    for (const file of readdirSync(edgeDir)) {
      const src = read(join(edgeDir, file));
      expect(src, `${file} imports a Node built-in`).not.toMatch(/from 'node:/);
      // decodeBuffer keeps its name - it is the same function on both sides and
      // renaming it would break the parity the rest of this file asserts. What
      // must not survive is the Node TYPE.
      expect(stripComments(src), `${file} still uses the Buffer type`).not.toMatch(
        /:\s*Buffer\b|Buffer\.(from|concat|alloc)/,
      );
    }
  });
});

describe('the credential vault writes what the table holds', () => {
  const nodeVault = read(join(nodeDir, 'credential-vault.ts'));
  const edgeVault = read(join(edgeDir, 'credential-columns.ts'));

  it('uses AES-256-GCM with a 12-byte IV on both', () => {
    expect(nodeVault).toMatch(/aes-256-gcm/i);
    expect(edgeVault).toMatch(/ALGORITHM = 'AES-GCM'/);
    expect(nodeVault).toMatch(/IV_LENGTH_BYTES = 12/);
    expect(edgeVault).toMatch(/IV_LENGTH_BYTES = 12/);
    expect(edgeVault).toMatch(/KEY_LENGTH_BYTES = 32/);
  });

  it('reads the same env var, so one key serves both hosts', () => {
    expect(nodeVault).toMatch(/ADDRESS_BOOK_MASTER_KEY/);
    expect(edgeVault).toMatch(/ENV_VAR = 'ADDRESS_BOOK_MASTER_KEY'/);
  });

  it('splits the auth tag out, because the columns are separate', () => {
    // Web Crypto appends the tag to the ciphertext; node:crypto exposes it via
    // getAuthTag(). Without the split the two formats differ on disk and a
    // credential written by one fails auth-tag verification on the other -
    // which surfaces as "wrong password" on an SMB entry, not as a format error.
    expect(edgeVault).toMatch(/AUTH_TAG_BYTES = 16/);
    expect(edgeVault).toMatch(/sealed\.subarray\(0, sealed\.length - AUTH_TAG_BYTES\)/);
    expect(edgeVault).toMatch(/sealed\.subarray\(sealed\.length - AUTH_TAG_BYTES\)/);
  });

  it('does NOT use the single-blob shared vault, which targets a jsonb column', () => {
    const importer = read(join(repo, 'supabase/functions/address-books/_import-export.ts'));
    expect(importer).toMatch(/encryptCredentialColumns/);
    expect(importer).not.toMatch(/from '\.\.\/_shared\/credential-vault\.ts'/);
  });
});

describe('a source password never leaves memory', () => {
  const importer = read(join(repo, 'supabase/functions/address-books/_import-export.ts'));

  it('strips _password from every metadata payload it returns or stores', () => {
    // ABK-014's standing requirement, carried across the port.
    expect(importer).toMatch(/delete clone\._password/);
    const responses = importer.match(/source_metadata: sanitizeMetadata\(/g) ?? [];
    expect(responses.length).toBeGreaterThanOrEqual(3);
  });

  it('never logs the upload fields or a credential', () => {
    const code = stripComments(importer);
    expect(code).not.toMatch(/console\.(log|error)\([^)]*password/i);
    expect(code).not.toMatch(/console\.(log|error)\([^)]*fields/);
  });

  it('caps the upload before reading the body into memory', () => {
    expect(importer).toMatch(/MAX_UPLOAD_BYTES = 25 \* 1024 \* 1024/);
    const capAt = importer.indexOf('file.size > MAX_UPLOAD_BYTES');
    const readAt = importer.indexOf('file.arrayBuffer()');
    expect(capAt).toBeGreaterThan(-1);
    expect(capAt).toBeLessThan(readAt);
  });
});
