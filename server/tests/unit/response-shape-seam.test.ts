import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SHAPE-ENVELOPE-002. Both halves of a data contract, asserted together, so a
 * change to either side fails - the same shape SHAPE-ENVELOPE-001 established.
 *
 * Two live defects came out of narrowing the shape report to the branch, and
 * neither was a shape mismatch in the end: one page read an object as an array,
 * and one asked for a path no branch of its edge function serves. Both were
 * invisible in dev, the first because the empty-state test `=== 0` is false for
 * `undefined` and the second because Express answered it there.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('customer-portal knowledge base', () => {
  const fn = read('supabase/functions/customer-portal/index.ts');
  const page = read('client/src/pages/CustomerSelfServicePortal.tsx');

  it('is the one list branch whose data is an object, not an array', () => {
    // getQueryFn unwraps `{ data: [...] }` and NOTHING else, and apiRequest
    // unwraps nothing at all. This branch nests the list one level deeper.
    expect(fn).toMatch(/data:\s*\{\s*\n\s*articles:/);
  });

  it('the page reaches through that envelope rather than mapping it', () => {
    expect(page).toContain('res?.data?.articles');
    // The crash this replaced: the whole envelope typed as an array, so .length
    // was undefined and .map threw on an object.
    expect(page).not.toMatch(
      /return apiRequest\(`\/api\/customer-portal\/knowledge-base\?\$\{params\.toString\(\)\}`\);/,
    );
  });
});

describe('equipment lifecycle transition history', () => {
  const fn = read('supabase/functions/equipment-lifecycle/index.ts');
  const component = read('client/src/components/equipment/EquipmentTransitionHistory.tsx');

  it('has no equipment-id branch for /transitions', () => {
    // The secondPart branches under an equipment id are status, transition,
    // available-transitions and can-transition. A page asking for
    // /:equipmentId/transitions gets none of them, which is why the panel
    // worked in dev (Express) and 404'd in production.
    const secondPartBranches = [...fn.matchAll(/secondPart === '([a-z-]+)'/g)].map((m) => m[1]);
    expect(secondPartBranches).not.toContain('transitions');
    expect(secondPartBranches.length).toBeGreaterThan(0);
  });

  it('serves the history from /transitions/history, filtered by query parameter', () => {
    expect(fn).toContain("firstPart === 'transitions' && secondPart === 'history'");
    expect(fn).toMatch(/searchParams\.get\('equipmentId'\)/);
  });

  it('the component asks for that path and maps the snake_case rows it sends', () => {
    expect(component).toContain('/api/equipment-lifecycle/transitions/history?equipmentId=');
    expect(component).not.toMatch(/\$\{equipmentId\}\/transitions`/);
    // Without the mapping every field renders blank: the edge function returns
    // raw rows, while the Express handler it replaced returned Drizzle camelCase.
    expect(component).toContain('row.from_stage');
    expect(component).toContain('row.triggered_at');
  });
});
