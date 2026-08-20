// PROD-014 parity lock.
//
// ModularDashboard reads /api/dashboard/modules. The edge function answered it
// with four HARDCODED cards ('$125,430' revenue, 48 deals, 1,247 customers)
// under ids nothing else in the system uses, as a bare array rather than the
// { modules, userRole, roleConfig } the page destructures — so the page's
// default [] applied and production rendered the "no modules" empty state.
//
// Both backends now build cards from the same role map and the same
// presentation table. What that pins: the card IDS (the page persists switched
// -on ids in localStorage, so a backend inventing its own makes the toggles
// meaningless) and the CATEGORY of each card (the page groups by it, so a card
// labelled 'management' on one side and 'sales' on the other lands in a
// different section).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as node from '../../lib/dashboard-cards';
import * as edge from '../../../supabase/functions/_shared/dashboard-cards';

const edgeSrc = readFileSync(join(process.cwd(), 'supabase/functions/dashboard/index.ts'), 'utf-8');
const expressSrc = readFileSync(join(process.cwd(), 'server/routes-modular-dashboard.ts'), 'utf-8');
const page = readFileSync(
  join(process.cwd(), 'client/src/components/ModularDashboard.tsx'),
  'utf-8',
);

describe('the two copies agree', () => {
  it('on the role map', () => {
    expect(edge.ROLE_CARDS).toEqual(node.ROLE_CARDS);
  });

  it('on every card presentation', () => {
    expect(edge.CARD_META).toEqual(node.CARD_META);
  });

  it.each(['sales', 'sales_rep', 'technician', 'service_manager', 'manager', 'admin', 'nobody'])(
    'on the active cards for %s',
    (role) => {
      const enabled = ['team_revenue', 'inventory_alerts', 'not_a_card'];
      expect(edge.resolveActiveCards(role, enabled)).toEqual(
        node.resolveActiveCards(role, enabled),
      );
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
    expect(node.parseEnabledParam('a, b ,,c')).toEqual(['a', 'b', 'c']);
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
    expect(node.buildCard('not_a_card', 1)).toBeNull();
  });

  it('produces the same card object on both sides', () => {
    expect(edge.buildCard('personal_deals', 7)).toEqual(node.buildCard('personal_deals', 7));
    expect(edge.buildCard('service_overview', 3, { subtitle: '9 total tickets' })).toEqual(
      node.buildCard('service_overview', 3, { subtitle: '9 total tickets' }),
    );
  });

  it('uses data instead of value for the executive card', () => {
    const card = edge.buildCard('business_overview', 0, { data: { customers: 2 } })!;
    expect(card.data).toEqual({ customers: 2 });
    expect(card.value).toBeUndefined();
  });
});

describe('money formatting', () => {
  it('matches on both sides and carries no cents', () => {
    for (const n of [0, 1234, 125430.49, 1_000_000]) {
      expect(edge.formatCurrency(n)).toBe(node.formatCurrency(n));
    }
    expect(edge.formatCurrency(125430)).toBe('$125,430');
  });

  it('sums the numeric strings PostgREST returns', () => {
    expect(edge.sumNumeric(['10.50', '20.25', 5])).toBeCloseTo(35.75);
    expect(edge.sumNumeric([null, undefined, 'x', 2])).toBe(2);
    expect(node.sumNumeric(['10.50', '20.25', 5])).toBeCloseTo(35.75);
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

  it('both backends read the same query parameter', () => {
    expect(edgeSrc).toContain("url.searchParams.get('enabled')");
    expect(expressSrc).toContain('req.query.enabled');
    expect(page).toContain('?enabled=');
  });

  it('the page no longer puts the card list in the path', () => {
    // queryKey.join('/') built /api/dashboard/modules/a,b — a path neither
    // backend routes.
    expect(page).toContain('queryFn: () =>');
    expect(page).toContain('/api/dashboard/modules?enabled=');
  });
});
