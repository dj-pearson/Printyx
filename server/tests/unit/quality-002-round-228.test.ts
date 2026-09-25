import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const DISPOSAL_SCHEMA = 'shared/equipment-schema.ts';
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The Drizzle property names one pgTable declaration in shared/schema.ts has. */
function columnsOf(table: string, file = 'shared/schema.ts'): Set<string> {
  const schema = read(file);
  const at = schema.indexOf(`export const ${table} = pgTable(`);
  const body = schema.slice(at, schema.indexOf('\n);', at));
  return new Set([...body.matchAll(/^\s+(\w+): [a-z]+\('/gm)].map((m) => m[1]));
}

describe('QUALITY-002 round 228', () => {
  it('the DoD validator selects only columns its tables have', () => {
    const src = strip(read('server/routes-validate.ts'));
    const br = columnsOf('businessRecords');
    const po = columnsOf('purchaseOrders');
    expect(br.size).toBeGreaterThan(20);
    expect(po.size).toBeGreaterThan(10);
    for (const [, col] of src.matchAll(/businessRecords\.(\w+)/g)) expect(br, col).toContain(col);
    for (const [, col] of src.matchAll(/purchaseOrders\.(\w+)/g)) expect(po, col).toContain(col);
  });

  it('decimal amounts are coerced before comparing, not compared as text', () => {
    const src = strip(read('server/routes-validate.ts'));
    expect(src).not.toMatch(/quote\.totalAmount <= 0/);
    expect(src).not.toMatch(/ticket\.timeSpent <= 0/);
  });

  it('the 503-only QR router is gone and nothing mounts it', () => {
    expect(existsSync(resolve(root, 'server/routes-equipment-qr.ts'))).toBe(false);
    expect(strip(read('server/routes-registry.ts'))).not.toContain('equipmentQRRoutes');
    expect(strip(read('server/domains/service.ts'))).not.toContain('routes-equipment-qr');
  });

  it('the extension quick-import writes only business_records columns', () => {
    // Drizzle drops a key the table does not have, silently when the payload
    // is a variable, so an imported lead used to keep its company and lose the
    // person entirely. Every key of the insert must be a real column.
    const src = strip(read('server/routes/chrome-extension-routes.ts'));
    const at = src.indexOf('const recordData = {');
    const body = src.slice(at, src.indexOf('\n    };', at));
    const keys = [...body.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(8);
    const br = columnsOf('businessRecords');
    for (const k of keys) expect(br, k).toContain(k);
    expect(keys).toContain('primaryContactName');
    expect(keys).toContain('primaryContactEmail');
    expect(src).not.toMatch(/businessRecords\.linkedinUrl/);
  });

  it('equipment disposal names only equipment_disposal columns', () => {
    // The insert named six columns the table does not have and the status
    // PATCH built an \`any\` of three more, so a record was stored with no
    // cost, notes, status or author and a status change never landed.
    const src = strip(read('server/routes-equipment-disposal.ts'));
    const cols = columnsOf('equipmentDisposal', DISPOSAL_SCHEMA);
    expect(cols.size).toBeGreaterThan(10);
    const refs = [...src.matchAll(/equipmentDisposal\.(\w+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(3);
    for (const col of refs.filter((c) => c !== '$inferInsert')) expect(cols, col).toContain(col);
    const at = src.indexOf('.insert(equipmentDisposal)');
    const values = src.slice(
      src.indexOf('.values({', at),
      src.indexOf('})', src.indexOf('.values({', at)),
    );
    for (const [, k] of values.matchAll(/^\s+(\w+):/gm)) expect(cols, k).toContain(k);
    expect(src).not.toMatch(/updateData: any/);
  });
});
