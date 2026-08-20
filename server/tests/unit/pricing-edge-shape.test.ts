// PROD-014: four pricing endpoints the UI calls had no branch on the edge
// function. What a port of this shape gets wrong quietly: the role gate (these
// endpoints expose dealer cost and margin, so a missing check publishes the
// company's costs to every rep), the response shape (the widgets destructure
// nested keys), and the tenant filter.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';

import { priceChangeApprovals, enhancedQuotePricing } from '@shared/schema';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');
const edge = read('supabase/functions/pricing/index.ts');
const express = read('server/routes-product-pricing.ts');
const badge = read('client/src/components/pricing/PricingNotificationBadge.tsx');
const widgets = read('client/src/components/dashboards/PricingDashboardWidgets.tsx');

const cols = (t: unknown) =>
  new Set(
    Object.values(getTableColumns(t as never) as Record<string, { name: string }>).map(
      (c) => c.name,
    ),
  );

function branch(marker: string, end: string): string {
  const at = edge.indexOf(marker);
  expect(at, `branch not found: ${marker}`).toBeGreaterThan(-1);
  const to = edge.indexOf(end, at);
  return edge.slice(at, to === -1 ? at + 4000 : to);
}

describe('the endpoints exist', () => {
  it.each([
    ["resource === 'calculate-rep-cost'", '/api/pricing/calculate-rep-cost'],
    ["resource === 'approvals' && resourceId === 'pending'", '/api/pricing/approvals/pending'],
    ["resource === 'approval' && resourceId", '/api/pricing/approval/'],
    ["resource === 'margin-report'", '/api/pricing/margin-report'],
  ])('%s', (marker, expressPath) => {
    expect(edge).toContain(marker);
    expect(express).toContain(expressPath);
  });
});

describe('the role gate is not lost in the port', () => {
  it.each([
    ["resource === 'approvals' && resourceId === 'pending'", 'GET /pricing/approvals/pending'],
    ["resource === 'approval' && resourceId", 'PATCH /pricing/approval/:id'],
    ["resource === 'margin-report'", 'GET /pricing/margin-report'],
  ])('%s refuses a caller who may not see dealer cost', (marker) => {
    const at = edge.indexOf(marker);
    const body = edge.slice(at, at + 700);
    expect(body).toContain('canSeeDealerCost(userRole)');
    expect(body).toContain('403');
  });

  it('takes the gate from the shared copy rather than reimplementing it', () => {
    expect(edge).toContain("from '../_shared/pricing-math.ts'");
    expect(edge).not.toMatch(/roleLevel\s*<=\s*4/);
  });

  it('Express gates the same three the same way', () => {
    for (const path of [
      '/api/pricing/approvals/pending',
      '/api/pricing/approval/:id',
      '/api/pricing/margin-report',
    ]) {
      const at = express.indexOf(path);
      expect(express.slice(at, at + 1400)).toContain('canSeeDealerCost(userRole)');
    }
  });
});

describe('every column named exists', () => {
  it('on price_change_approvals', () => {
    const approvalCols = cols(priceChangeApprovals);
    const body = branch("resource === 'approvals' && resourceId === 'pending'", 'margin-report');
    for (const m of body.matchAll(/row\.([a-z_]+)/g)) {
      if (m[1] === 'requested_by') continue; // also used as a join key
      expect(approvalCols.has(m[1]), `price_change_approvals.${m[1]}`).toBe(true);
    }
    for (const column of [
      'status',
      'approved_by',
      'approved_date',
      'approval_notes',
      'rejection_reason',
    ]) {
      expect(approvalCols.has(column), column).toBe(true);
    }
  });

  it('on enhanced_quote_pricing', () => {
    const quoteCols = cols(enhancedQuotePricing);
    const body = branch("resource === 'margin-report'", 'GET /pricing/company-settings');
    for (const m of body.matchAll(/quote\.([a-z_]+)/g)) {
      expect(quoteCols.has(m[1]), `enhanced_quote_pricing.${m[1]}`).toBe(true);
    }
  });
});

describe('the shape the widgets destructure', () => {
  it('approvals come back as { approval, requestedBy } in camelCase', () => {
    // The badge reads approval.requestedDate and requestedBy.firstName off the
    // row; PostgREST rows are snake_case, so raw rows render blank.
    expect(badge).toContain('approval:');
    expect(widgets).toContain('requestedBy');
    const body = branch("resource === 'approvals' && resourceId === 'pending'", 'margin-report');
    expect(body).toContain('requestedDate:');
    expect(body).toContain('firstName:');
    expect(body).toContain('discountPercentage:');
  });

  it('the margin report is { count, report } with the widget"s keys', () => {
    expect(widgets).toContain('report: Array<');
    const body = branch("resource === 'margin-report'", 'GET /pricing/company-settings');
    expect(body).toContain('count: report.length');
    for (const key of [
      'quoteNumber',
      'quoteDate',
      'salesRep',
      'totalMargin',
      'marginPercentage',
      'totalCustomerPrice',
    ]) {
      expect(body, key).toContain(`${key}:`);
    }
  });

  it('does not recompute margin, it reports what was stored', () => {
    // A third margin formula is how the two that disagreed with quote-math got
    // into the codebase.
    const body = branch("resource === 'margin-report'", 'GET /pricing/company-settings');
    expect(body).toContain('total_margin_percentage');
    expect(body).not.toContain('grossMarginPct');
  });
});

describe('tenant scoping', () => {
  it.each([
    "resource === 'approvals' && resourceId === 'pending'",
    "resource === 'approval' && resourceId",
    "resource === 'margin-report'",
    "resource === 'calculate-rep-cost'",
  ])('%s filters by tenant', (marker) => {
    const at = edge.indexOf(marker);
    expect(edge.slice(at, at + 2500)).toContain("eq('tenant_id', tenantId)");
  });
});
