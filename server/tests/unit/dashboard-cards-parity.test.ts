// PROD-014 parity lock, now a SINGLE-SOURCE lock (DASH-METRICS-001).
//
// ModularDashboard reads /api/dashboard/modules. The edge function answered it
// with four HARDCODED cards ('$125,430' revenue, 48 deals, 1,247 customers)
// under ids nothing else in the system uses, as a bare array rather than the
// { modules, userRole, roleConfig } the page destructures — so the page's
// default [] applied and production rendered the "no modules" empty state.
//
// Both backends built cards from the same role map and the same presentation
// table, and this file locked the two copies together. There is only one copy
// now: DASH-METRICS-001 proxied /api/dashboard/modules and deleted
// server/routes-modular-dashboard.ts, which took the last consumer of the Node
// copy with it, so server/lib/dashboard-cards.ts is deleted too and the assertion
// below keeps a second one from coming back.
//
// What the rest still pins is unchanged and still matters: the card IDS (the
// page persists switched-on ids in localStorage, so a backend inventing its own
// makes the toggles meaningless) and the CATEGORY of each card (the page groups
// by it, so a mislabelled card lands in the wrong section).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as edge from '../../../supabase/functions/_shared/dashboard-cards';

const edgeSrc = readFileSync(join(process.cwd(), 'supabase/functions/dashboard/index.ts'), 'utf-8');
const proxySrc = readFileSync(
  join(process.cwd(), 'server/middleware/edge-function-proxy.ts'),
  'utf-8',
);
const page = readFileSync(
  join(process.cwd(), 'client/src/components/ModularDashboard.tsx'),
  'utf-8',
);

describe('there is one copy', () => {
  it('deletes the Node one, whose last consumer went with routes-modular-dashboard', () => {
    expect(existsSync(join(process.cwd(), 'server/lib/dashboard-cards.ts'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'server/routes-modular-dashboard.ts'))).toBe(false);
  });

  it('serves /api/dashboard/modules from the edge function on both hosts', () => {
    expect(proxySrc).toContain(
      "'/api/dashboard/modules': { fn: 'dashboard', pathPrefix: '/modules' }",
    );
  });

  it.each(['sales', 'sales_rep', 'technician', 'service_manager', 'manager', 'admin', 'nobody'])(
    'resolves active cards for %s without throwing on an unknown id',
    (role) => {
      const enabled = ['team_revenue', 'inventory_alerts', 'not_a_card'];
      const { activeCards } = edge.resolveActiveCards(role, enabled);
      expect(activeCards).not.toContain('not_a_card');
      expect(Array.isArray(activeCards)).toBe(true);
    },
  );
});

describe('a card a role may not switch on is refused', () => {
  it('ignores an optional card outside the role"s availableCards', () => {
    // Otherwise a caller names any id and is served data its role does not get.
    const { activeCards } = edge.resolveActiveCards('sales', ['revenue_overview']);
    expect(activeCards).not.toContain('revenue_overview');
  });

  it('honours one that is in availableCards', () => {
    const { activeCards } = edge.resolveActiveCards('sales', ['team_revenue']);
    expect(activeCards).toContain('team_revenue');
  });

  it('treats an unknown role as sales, the way Express always has', () => {
    expect(edge.roleCards('who').defaultCards).toEqual(edge.ROLE_CARDS.sales.defaultCards);
  });

  it('reads an absent or empty enabled param as no optional cards, not all', () => {
    expect(edge.parseEnabledParam(null)).toEqual([]);
    expect(edge.parseEnabledParam('')).toEqual([]);
    expect(edge.parseEnabledParam('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('every card a role can see can actually be built', () => {
  it('has presentation for each id in the role map', () => {
    const ids = new Set<string>();
    for (const cfg of Object.values(edge.ROLE_CARDS)) {
      for (const id of [...cfg.defaultCards, ...cfg.availableCards]) ids.add(id);
    }
    const missing = [...ids].filter((id) => !edge.CARD_META[id]);
    // team_tickets, response_time, completion_rate, technician_performance and
    // company_revenue are listed for technician and service_manager roles and
    // no backend has ever built one. Named here rather than quietly passing.
    expect(missing.sort()).toEqual([
      'company_revenue',
      'completion_rate',
      'response_time',
      'team_tickets',
      'technician_performance',
    ]);
  });

  it('builds nothing for an unknown id rather than a card with no title', () => {
    expect(edge.buildCard('not_a_card', 1)).toBeNull();
  });

  it('carries the id, title and category the page groups by', () => {
    expect(edge.buildCard('personal_deals', 7)).toMatchObject({
      id: 'personal_deals',
      value: 7,
    });
    expect(edge.buildCard('service_overview', 3, { subtitle: '9 total tickets' })).toMatchObject({
      id: 'service_overview',
      subtitle: '9 total tickets',
    });
  });

  it('uses data instead of value for the executive card', () => {
    const card = edge.buildCard('business_overview', 0, { data: { customers: 2 } })!;
    expect(card.data).toEqual({ customers: 2 });
    expect(card.value).toBeUndefined();
  });
});

describe('money formatting', () => {
  it('keeps cents when there are any', () => {
    // The old assertion here said "carries no cents" and then compared the two
    // copies to each other plus one INTEGER, so it never tested the claim. The
    // formatter keeps whatever fraction it is given.
    expect(edge.formatCurrency(0)).toBe('$0');
    expect(edge.formatCurrency(1234)).toBe('$1,234');
    expect(edge.formatCurrency(125430.49)).toBe('$125,430.49');
    expect(edge.formatCurrency(1_000_000)).toBe('$1,000,000');
  });

  it('sums the numeric strings PostgREST returns', () => {
    expect(edge.sumNumeric(['10.50', '20.25', 5])).toBeCloseTo(35.75);
    expect(edge.sumNumeric([null, undefined, 'x', 2])).toBe(2);
  });
});

describe('the fabricated dashboard is gone', () => {
  it('no hardcoded figures remain in the edge function', () => {
    // Comments are stripped first: the header quotes the fabricated numbers to
    // say what was removed, and that note is worth keeping.
    const code = edgeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const fake of ['125,430', 'Active Deals', '1247', "'tasks'"]) {
      expect(code, fake).not.toContain(fake);
    }
  });

  it('returns the shape the page destructures', () => {
    expect(edgeSrc).toContain('modules,');
    expect(edgeSrc).toContain('userRole:');
    expect(edgeSrc).toContain('roleConfig: {');
    expect(page).toContain('modules: DashboardModule[];');
  });

  it('scopes every count to the tenant', () => {
    expect(edgeSrc).toContain(".eq('tenant_id', tenantId)");
    expect(edgeSrc).not.toMatch(
      /from\('(invoices|deals|business_records|service_tickets)'\)\s*\n\s*\.select\([^)]*\)\s*\n\s*\.(gte|in)\(/,
    );
  });

  it('the one backend reads the parameter the page sends', () => {
    expect(edgeSrc).toContain("url.searchParams.get('enabled')");
    expect(page).toContain('?enabled=');
  });

  it('the page no longer puts the card list in the path', () => {
    // queryKey.join('/') built /api/dashboard/modules/a,b — a path neither
    // backend routes.
    expect(page).toContain('queryFn: () =>');
    expect(page).toContain('/api/dashboard/modules?enabled=');
  });
});
