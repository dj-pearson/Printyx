import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PROD-013. The product import wizard and the OID mapping console were the last
 * two reachable pages posting bare relative fetches, so in production both
 * resolved against the origin serving the static bundle and neither could do
 * anything at all.
 *
 * The import wizard carries a trap the other conversions did not: all three of
 * its calls send FormData. apiRequest JSON-stringifies its body, so converting
 * them to apiRequest would have posted the string "[object FormData]" and lost
 * the file - a conversion that looks correct, typechecks, and silently uploads
 * nothing. apiFormRequest is the one to use; it also deletes the Content-Type
 * header so the browser can set the multipart boundary itself.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const wizard = read('client/src/pages/UniversalProductImport.tsx');
const oid = read('client/src/pages/OidManagement.tsx');
const queryClient = read('client/src/lib/queryClient.ts');

const stripComments = (src: string) =>
  src
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('the import wizard', () => {
  it('sends its three multipart steps through apiFormRequest, not apiRequest', () => {
    for (const path of [
      '/api/import/upload',
      '/api/import/preview-mapping',
      '/api/import/ai/map-columns',
    ]) {
      expect(wizard).toContain(`apiFormRequest('${path}', 'POST', formData)`);
      expect(wizard).not.toContain(`apiRequest('${path}', 'POST', formData)`);
    }
  });

  it('makes no bare fetch call', () => {
    expect(stripComments(wizard)).not.toMatch(/\bfetch\s*\(/);
  });
});

describe('apiFormRequest', () => {
  it('is what makes a multipart body survive', () => {
    // apiRequest stringifies; this one passes FormData straight through and
    // removes Content-Type so the boundary is the browser's to set.
    const fn = queryClient.slice(queryClient.indexOf('export async function apiFormRequest'));
    expect(fn.slice(0, 1200)).toContain(
      "delete (baseHeaders as Record<string, string>)['Content-Type']",
    );
    expect(fn.slice(0, 1600)).toContain('body: formData');
  });
});

describe('the OID mapping console', () => {
  it('routes all six calls through apiRequest', () => {
    for (const call of [
      'apiRequest(`/api/oid-mappings?${params}`)',
      "apiRequest('/api/oid-mappings', 'POST'",
      "apiRequest(`/api/oid-mappings/${id}`, 'PUT'",
      "apiRequest(`/api/oid-mappings/${id}`, 'DELETE')",
      "apiRequest('/api/oid-mappings/test', 'POST'",
      "apiRequest('/api/oid-mappings/export', 'POST'",
      "apiRequest('/api/oid-mappings/import', 'POST'",
    ]) {
      expect(oid).toContain(call);
    }
  });

  it('no longer treats the result as a Response', () => {
    // apiRequest returns parsed JSON. A leftover `res.ok` check would be
    // permanently false and a leftover `res.json()` a TypeError.
    const code = stripComments(oid);
    expect(code).not.toMatch(/\bres\.ok\b/);
    expect(code).not.toMatch(/\bres\.json\(\)/);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });
});
