// Round 173 (route-divergence: invoices). Express registered only the two bulk
// POSTs under /api/invoices, so MeterBilling and AdvancedReporting's
// GET /api/invoices 404'd in dev. The prefix is proxied, the Express pair is
// deleted, and the Invoices page reports what the bulk update measured.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
const BULK = strip(readFileSync('server/routes-bulk-operations.ts', 'utf8'));
const EDGE = strip(readFileSync('supabase/functions/invoices/index.ts', 'utf8'));
const PAGE = strip(readFileSync('client/src/pages/Invoices.tsx', 'utf8'));

describe('/api/invoices has one host', () => {
  it('is proxied to the invoices edge function', () => {
    expect(PROXY).toMatch(/'\/api\/invoices':\s*'invoices'/);
  });

  it('Express no longer registers anything under it', () => {
    expect(BULK).not.toMatch(/app\.\w+\(\s*'\/api\/invoices/);
  });

  it('the edge function serves both bulk paths above its create branch', () => {
    const update = EDGE.indexOf("invoiceId === 'bulk-update'");
    const del = EDGE.indexOf("invoiceId === 'bulk-delete'");
    expect(update).toBeGreaterThan(0);
    expect(del).toBeGreaterThan(0);
  });

  it('every client caller of /api/invoices hits a prefix the proxy owns', () => {
    for (const f of [
      'client/src/pages/MeterBilling.tsx',
      'client/src/pages/AdvancedReporting.tsx',
    ]) {
      expect(readFileSync(f, 'utf8')).toMatch(/'\/api\/invoices'/);
    }
  });
});

describe('the bulk status toast reports the measured count', () => {
  const at = PAGE.indexOf('const bulkStatusMutation = useMutation');
  const body = PAGE.slice(at, PAGE.indexOf('onError', at));

  it('reads updatedCount off the response', () => {
    expect(body).toMatch(/const updated = result\?\.updatedCount \?\? 0;/);
    expect(body).toMatch(/\$\{updated\} invoice\(s\) updated/);
  });

  it('never reports the request size as the outcome', () => {
    expect(body).not.toMatch(/variables\.ids\.length/);
  });
});
