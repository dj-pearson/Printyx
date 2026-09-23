// Round 175 (route-divergence: pricing). The Express half of /api/pricing
// (routes-pricing.ts, routes-product-pricing.ts, services/pricing-service.ts)
// gated on the legacy role-name map that no role code matches, and lacked
// products/bulk-update entirely. The edge function serves every client path,
// so the prefix is proxied and the Express half deleted.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
const REGISTRY = strip(readFileSync('server/routes-registry.ts', 'utf8'));
const EDGE = strip(readFileSync('supabase/functions/pricing/index.ts', 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe('/api/pricing has one host', () => {
  it('is proxied to the pricing edge function', () => {
    expect(PROXY).toMatch(/'\/api\/pricing':\s*'pricing'/);
  });

  it('the Express half is gone and nothing registers a pricing path', () => {
    for (const f of [
      'server/routes-pricing.ts',
      'server/routes-product-pricing.ts',
      'server/services/pricing-service.ts',
    ]) {
      expect(existsSync(f), f).toBe(false);
    }
    expect(REGISTRY).not.toMatch(/app\.\w+\(\s*'\/api\/pricing\//);
    expect(REGISTRY).not.toMatch(/registerProductPricingRoutes/);
  });

  it('every /api/pricing segment client/src calls has an edge branch', () => {
    const segs = new Set<string>();
    for (const f of walk('client/src')) {
      for (const m of strip(readFileSync(f, 'utf8')).matchAll(/['`]\/api\/pricing\/([a-z-]+)/g)) {
        segs.add(m[1]);
      }
    }
    expect(segs.size).toBeGreaterThanOrEqual(5);
    const unserved = [...segs].filter((s) => !EDGE.includes(`resource === '${s}'`));
    expect(unserved).toEqual([]);
  });
});
