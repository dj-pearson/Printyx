/**
 * Round 150: /api/deal-desk-copilot, the edge function production runs.
 *
 * 1. The per-quote branches loaded the quote by id and tenant alone while the
 *    proposals function scopes the same rows to their owners, so a rep could
 *    read a colleague's gross profit, GP% and customer AR aging by id.
 * 2. /margin was a labelled stub counting parts only, while dev ran the shared
 *    cost model (parts + service delivery + financing carry), so production
 *    reported a higher GP% and flagged fewer quotes below the floor.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { computeMargin, computeQuoteCost } from '../../../shared/deal-desk-margin';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = stripComments(readFileSync('supabase/functions/deal-desk-copilot/index.ts', 'utf8'));

describe('per-quote routes are scoped to the quote owner', () => {
  const at = fn.indexOf("if (first && action && req.method === 'GET')");
  const branch = fn.slice(at, fn.indexOf('switch (action)', at));

  it('locates the branch', () => {
    expect(at).toBeGreaterThan(-1);
    expect(branch.length).toBeGreaterThan(100);
  });

  it('checks the row against the caller scope on both owner columns before any handler', () => {
    expect(branch).toMatch(/resolveScope\(admin,/);
    expect(branch).toMatch(/rowInScope\(owned, \['assigned_to', 'created_by'\], scope\)/);
    expect(branch).toMatch(/\.eq\('tenant_id', tenantId\)/);
  });

  it('answers not-yours with the same 404 as not-found', () => {
    const guard = branch.indexOf('if (!owned || !rowInScope(');
    expect(guard).toBeGreaterThan(-1);
    expect(branch.slice(guard)).toMatch(
      /return createCorsResponse\(\{ message: 'Quote not found' \}, 404, req\)/,
    );
  });
});

describe('/margin runs the shared cost model', () => {
  const margin = fn.slice(
    fn.indexOf('async function handleMargin('),
    fn.indexOf('async function handleObjections('),
  );

  it('imports the shared module and calls both halves', () => {
    expect(fn).toMatch(/from '\.\.\/\.\.\/\.\.\/shared\/deal-desk-margin\.ts'/);
    expect(margin).toMatch(/computeQuoteCost\(costLines, \{ revenue, financed \}\)/);
    expect(margin).toMatch(/computeMargin\(\{ revenue, cost, gpFloorPct \}\)/);
  });

  it('reads the columns the model needs and no longer answers a stub', () => {
    expect(margin).toMatch(/select\('item_type,unit_cost,unit_price,quantity'\)/);
    expect(margin).toMatch(/isFinancedDeal\(proposal\.proposal_type\)/);
    expect(margin).not.toMatch(/financingNote|serviceCostNote/);
    expect(margin).toMatch(/costBreakdown: \{/);
  });

  it('refuses rather than computing over lines that failed to load', () => {
    expect(margin).toMatch(/if \(linesError\) \{\s*return createCorsResponse\([^)]*500/);
  });

  it('the model the edge now runs prices service and financing the parts-only stub missed', () => {
    const revenue = 10000;
    const lines = [
      { itemType: 'equipment', unitCost: 5000, unitPrice: 7000, quantity: 1 },
      { itemType: 'service', unitCost: 0, unitPrice: 3000, quantity: 1 },
    ];
    const partsOnly = computeMargin({
      revenue,
      cost: { partsCost: 5000, serviceCost: 0, financingCost: 0, totalCost: 5000 },
      gpFloorPct: 40,
    });
    const modelled = computeMargin({
      revenue,
      cost: computeQuoteCost(lines, { revenue, financed: true }),
      gpFloorPct: 40,
    });
    expect(partsOnly.belowFloor).toBe(false);
    expect(modelled.belowFloor).toBe(true);
    expect(modelled.gpPercent).toBeLessThan(partsOnly.gpPercent);
  });
});
