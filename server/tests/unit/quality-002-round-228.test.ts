import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The Drizzle property names one pgTable declaration in shared/schema.ts has. */
function columnsOf(table: string): Set<string> {
  const schema = read('shared/schema.ts');
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
});
