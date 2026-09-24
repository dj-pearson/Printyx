/**
 * Round 239: /api/automated-billing/bulk-generate called
 * billingEngine.generateBulkInvoices, which does not exist.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { BULK_GENERATE_MAX, generateBulkInvoices } from '../../lib/bulk-invoice-generation';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('generateBulkInvoices', () => {
  it('runs one at a time, names failures and carries on', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await generateBulkInvoices(['a', 'b', 'c', 'a'], async (id) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      if (id === 'b') throw new Error('Contract not found: b');
      return { id: `inv-${id}` };
    });
    expect(peak).toBe(1);
    expect(result.requested).toBe(3);
    expect(result.generated).toEqual([
      { contractId: 'a', invoiceId: 'inv-a' },
      { contractId: 'c', invoiceId: 'inv-c' },
    ]);
    expect(result.failed).toEqual([{ contractId: 'b', error: 'Contract not found: b' }]);
  });

  it('caps a request rather than truncating it', () => {
    expect(BULK_GENERATE_MAX).toBe(100);
    const route = strip(readFileSync('server/routes/automated-billing-routes.ts', 'utf8'));
    expect(route).toMatch(
      /contractIds: z\.array\(z\.string\(\)\)\.min\(1\)\.max\(BULK_GENERATE_MAX\)/,
    );
  });
});

describe('the bulk-generate route', () => {
  const route = strip(readFileSync('server/routes/automated-billing-routes.ts', 'utf8'));
  const engine = strip(readFileSync('server/services/billing-engine-service.ts', 'utf8'));

  it('calls only methods the billing engine has', () => {
    const called = [...route.matchAll(/billingEngine\.(\w+)\(/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThan(0);
    for (const name of called) expect(engine).toMatch(new RegExp(`\\basync ${name}\\(`));
  });

  it('generates through the per-contract method', () => {
    expect(route).toMatch(/generateBulkInvoices\(\s*data\.contractIds,/);
    expect(route).toMatch(/billingEngine\.generateInvoiceFromContract\(contractId, user\.tenantId/);
  });
});
