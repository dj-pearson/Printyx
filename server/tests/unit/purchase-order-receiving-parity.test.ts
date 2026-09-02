/**
 * WF-P-02: the two receiving modules must not drift.
 *
 * /api/purchase-orders is not proxied, so Express serves dev and the edge function
 * serves production. WF-P-01 is what happens when the two disagree about a payload
 * shape - every line item dropped in production while dev looked fine - and
 * receiving is worse to get wrong, because the disagreement would be about stock
 * levels and a payable rather than about a form.
 *
 * Nothing under server/ imports from supabase/functions at runtime, so the module
 * is duplicated. This is the thing that makes the duplicate safe.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const MARKER = 'export interface ReceivableLine {';

function body(path: string): string {
  const src = readFileSync(path, 'utf8');
  const at = src.indexOf(MARKER);
  expect(at, `${path} must contain "${MARKER}"`).toBeGreaterThan(-1);
  return src.slice(at);
}

describe('WF-P-02: receiving logic is identical on both hosts', () => {
  it('the Node copy matches the Deno copy from the first export onwards', () => {
    const deno = body('supabase/functions/purchase-orders/_receiving.ts');
    const node = body('server/services/purchase-order-receiving.ts');
    expect(node).toBe(deno);
  });

  it('only the header differs, and both headers point at the other file', () => {
    const denoHeader = readFileSync(
      'supabase/functions/purchase-orders/_receiving.ts',
      'utf8',
    ).slice(
      0,
      readFileSync('supabase/functions/purchase-orders/_receiving.ts', 'utf8').indexOf(MARKER),
    );
    const nodeHeader = readFileSync('server/services/purchase-order-receiving.ts', 'utf8').slice(
      0,
      readFileSync('server/services/purchase-order-receiving.ts', 'utf8').indexOf(MARKER),
    );
    expect(nodeHeader).toContain('supabase/functions/purchase-orders/_receiving.ts');
    expect(denoHeader).toContain('WF-P-02');
  });
});
