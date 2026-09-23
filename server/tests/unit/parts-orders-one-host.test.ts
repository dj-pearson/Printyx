// Round 174 (route-divergence: parts-orders). /api/parts-orders is proxied and
// server/routes-service-analysis.ts, which held the last Express copy, is
// deleted. Two defects went with it: the edge GET /:id/items answered raw
// snake_case, and ServiceTicketAnalysis posted an order's line items with no
// error handling, so a failure left an empty order saved and said nothing.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const PROXY = strip(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
const REGISTRY = strip(readFileSync('server/routes-registry.ts', 'utf8'));
const EDGE = strip(readFileSync('supabase/functions/parts-orders/index.ts', 'utf8'));
const PAGE = strip(readFileSync('client/src/components/service/ServiceTicketAnalysis.tsx', 'utf8'));

describe('/api/parts-orders has one host', () => {
  it('is proxied to the parts-orders edge function', () => {
    expect(PROXY).toMatch(/'\/api\/parts-orders':\s*'parts-orders'/);
  });

  it('the Express router is gone and nothing mounts it', () => {
    expect(existsSync('server/routes-service-analysis.ts')).toBe(false);
    expect(REGISTRY).not.toMatch(/registerServiceAnalysisRoutes/);
  });

  it('the edge function serves every path Express had', () => {
    expect(EDGE).toMatch(/req\.method === 'PATCH' && orderId && !subResource/);
    expect(EDGE).toMatch(/req\.method === 'GET' && orderId && subResource === 'items'/);
    expect(EDGE).toMatch(/req\.method === 'POST' && orderId && subResource === 'items'/);
  });
});

describe('GET /:id/items answers camelCase', () => {
  it('maps every row through toCamelShallow', () => {
    const at = EDGE.indexOf("req.method === 'GET' && orderId && subResource === 'items'");
    const branch = EDGE.slice(at, EDGE.indexOf("req.method === 'POST' && orderId", at));
    expect(branch).toMatch(/\.map\(\(r: Record<string, unknown>\) => toCamelShallow\(r\)\)/);
    expect(branch).not.toMatch(/createCorsResponse\(items \|\| \[\], 200/);
  });
});

describe('a failed line-item post is reported', () => {
  const at = PAGE.indexOf('const createPartsOrderMutation = useMutation');
  const body = PAGE.slice(at, PAGE.indexOf('onError', at));

  it('awaits the items post inside a try with a catch that tells the user', () => {
    expect(body).toMatch(
      /try \{\s*await apiRequest\(`\/api\/parts-orders\/\$\{newOrder\.id\}\/items`/,
    );
    expect(body).toMatch(/catch \(err\) \{[\s\S]*?variant: 'destructive'[\s\S]*?return;/);
  });

  it('no longer fires the post and forgets it', () => {
    expect(body).not.toMatch(/Promise\.resolve\(/);
  });

  it('reports success only after the items landed', () => {
    const ok = body.indexOf("'Parts order created successfully'");
    const post = body.indexOf('await apiRequest(`/api/parts-orders/');
    expect(post).toBeGreaterThan(0);
    expect(ok).toBeGreaterThan(post);
  });
});
