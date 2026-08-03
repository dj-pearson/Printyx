/**
 * Locks the daily-briefing assembly ported to Deno in
 * supabase/functions/daily-briefing/briefing.ts (PROD-010).
 *
 * The edge function is now the only implementation that runs (dev proxies
 * /api/daily-briefing to it; production has no Express), and there is no Deno in
 * CI, so nothing else in the suite can reach this code.
 *
 * The highest-value assertions here are the three constructs PostgREST could not
 * express, which had to be re-implemented in JS and are therefore the places a
 * port silently drifts:
 *   - latest churn band per customer (was DISTINCT ON) — counts stale bands if wrong
 *   - open-ticket exclusion by lower(status) — PostgREST has no lower() in filters
 *   - parts at/below reorder point — a COLUMN-TO-COLUMN comparison PostgREST cannot do
 * Plus parseAiBriefing, which is the seam where a malformed model reply could put
 * broken content into a customer-facing email.
 */

import { describe, it, expect } from 'vitest';
import {
  assembleOwnerData,
  assembleSalesRepData,
  assembleServiceManagerData,
  briefingDate,
  buildFallback,
  buildPrompt,
  deriveRole,
  flattenMetrics,
  num,
  parseAiBriefing,
  wordCount,
  type BriefingData,
} from '../../../supabase/functions/daily-briefing/briefing.ts';

const NOW = Date.parse('2026-06-15T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

/**
 * PostgREST-shaped stub. Filters chain and are recorded; awaiting resolves to the
 * table's rows, or to { count } when select() was called with head:true.
 */
function stubClient(tables: Record<string, Record<string, unknown>[]>) {
  const makeQuery = (table: string) => {
    const rows = tables[table] ?? [];
    let head = false;
    const q: Record<string, unknown> = {};
    q.select = (_c?: unknown, opts?: { head?: boolean }) => {
      if (opts?.head) head = true;
      return q;
    };
    for (const m of ['eq', 'in', 'gte', 'lt', 'not', 'is', 'order', 'limit']) {
      q[m] = () => q;
    }
    q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    q.then = (resolve: (v: unknown) => unknown) =>
      resolve(head ? { count: rows.length, error: null } : { data: rows, error: null });
    return q;
  };
  return { from: (t: string) => makeQuery(t) } as never;
}

describe('helpers', () => {
  it('formats the briefing date as YYYY-MM-DD', () => {
    expect(briefingDate(new Date('2026-06-15T23:30:00Z'))).toBe('2026-06-15');
  });

  it('coerces decimal strings and rejects garbage', () => {
    expect(num('1234.56')).toBeCloseTo(1234.56, 5);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('derives the briefing flavor from a system role', () => {
    expect(deriveRole('Company Owner')).toBe('owner');
    expect(deriveRole('platform_admin')).toBe('owner');
    expect(deriveRole('Service Manager')).toBe('service_manager');
    expect(deriveRole('Sales Rep')).toBe('sales_rep');
    // Unknown roles fall to the least-privileged flavor rather than the owner one.
    expect(deriveRole(null)).toBe('sales_rep');
    expect(deriveRole('')).toBe('sales_rep');
  });

  it('counts words across subject and bullets, ignoring whitespace runs', () => {
    expect(wordCount(['one two', '  three  '], 'a b')).toBe(5);
    expect(wordCount([], '')).toBe(0);
  });
});

describe('assembleOwnerData', () => {
  const base = () => ({
    service_tickets: [{ id: 't1' }],
    customer_churn_scores: [
      // Newest first, as the query orders them.
      { customer_id: 'c-1', band: 'at_risk', calculated_at: daysAgo(1) },
      { customer_id: 'c-1', band: 'healthy', calculated_at: daysAgo(60) },
      { customer_id: 'c-2', band: 'healthy', calculated_at: daysAgo(2) },
      { customer_id: 'c-3', band: 'at_risk', calculated_at: daysAgo(3) },
    ],
    contracts: [{ id: 'k1' }, { id: 'k2' }],
    proposals: [
      { id: 'p1', title: 'Small deal', total_amount: '1000', valid_until: daysAhead(2) },
      { id: 'p2', title: 'Big deal', total_amount: '90000', valid_until: daysAhead(3) },
      { id: 'p3', title: 'Mid deal', total_amount: '5000', valid_until: daysAhead(4) },
      { id: 'p4', title: 'Tiny deal', total_amount: '10', valid_until: daysAhead(5) },
    ],
  });

  it('counts only the LATEST churn band per customer', async () => {
    const s = await assembleOwnerData(stubClient(base()), 'tenant-1', NOW);
    const atRisk = s[0].metrics.find((m) => m.label === 'At-risk customers')!;
    // c-1 (latest at_risk) + c-3 = 2. The stale healthy row for c-1 must not
    // create a third customer, and the stale row must not be counted at all.
    expect(atRisk.value).toBe(2);
  });

  it('ranks closing deals by amount and keeps only the top three', async () => {
    const s = await assembleOwnerData(stubClient(base()), 'tenant-1', NOW);
    const labels = s[1].metrics.map((m) => m.label);
    expect(labels).toEqual(['Big deal', 'Mid deal', 'Small deal']);
    expect(s[1].metrics[0].value).toBe('$90,000');
  });

  it('shows an explicit empty state rather than an empty section', async () => {
    const s = await assembleOwnerData(stubClient({ ...base(), proposals: [] }), 'tenant-1', NOW);
    expect(s[1].metrics).toEqual([{ label: 'No deals closing this week', value: 0 }]);
  });

  it('keeps the revenue STUB disclosure on the MTD figure', async () => {
    const s = await assembleOwnerData(stubClient(base()), 'tenant-1', NOW);
    expect(s[2].metrics[0].detail).toMatch(/STUB/);
  });

  it('survives a tenant with no data at all', async () => {
    const s = await assembleOwnerData(
      stubClient({
        service_tickets: [],
        customer_churn_scores: [],
        contracts: [],
        proposals: [],
      }),
      'tenant-1',
      NOW,
    );
    expect(s[0].metrics[0].value).toBe(0);
    expect(s[2].metrics[0].value).toBe('$0');
  });
});

describe('assembleServiceManagerData', () => {
  const base = () => ({
    service_tickets: [
      { id: 't1', status: 'open', assigned_technician_id: 'tech-1' },
      { id: 't2', status: 'OPEN', assigned_technician_id: 'tech-1' },
      // Closed variants in mixed case — must be excluded both times.
      { id: 't3', status: 'Completed', assigned_technician_id: 'tech-2' },
      { id: 't4', status: 'RESOLVED', assigned_technician_id: 'tech-2' },
      { id: 't5', status: 'in_progress', assigned_technician_id: 'tech-2' },
    ],
    equipment_failure_predictions: [{ id: 'p1' }],
    inventory_items: [
      { id: 'i1', quantity_on_hand: 2, reorder_point: 5 }, // below
      { id: 'i2', quantity_on_hand: 5, reorder_point: 5 }, // at -> counts
      { id: 'i3', quantity_on_hand: 50, reorder_point: 5 }, // above
      { id: 'i4', quantity_on_hand: null, reorder_point: null }, // 0 <= 0 -> counts
    ],
    truck_stock_callbacks: [{ id: 'c1' }, { id: 'c2' }],
  });

  it('excludes closed tickets case-insensitively (PostgREST has no lower())', async () => {
    const s = await assembleServiceManagerData(stubClient(base()), 'tenant-1', NOW);
    // t1, t2 (open/OPEN) and t5 (in_progress) remain; Completed/RESOLVED drop.
    expect(s[0].metrics[0].value).toBe(3);
  });

  it('counts parts at OR below the reorder point, a column-to-column compare', async () => {
    const s = await assembleServiceManagerData(stubClient(base()), 'tenant-1', NOW);
    // i1 (below), i2 (equal), i4 (null/null -> 0 <= 0). i3 is above.
    expect(s[1].metrics[0].value).toBe(3);
  });

  it('averages open tickets per technician over techs WITH work only', async () => {
    const s = await assembleServiceManagerData(stubClient(base()), 'tenant-1', NOW);
    // tech-1 has 2 open, tech-2 has 1 open (in_progress) -> 3 / 2 techs = 1.5
    expect(s[2].metrics[0].value).toBe(1.5);
    expect(s[2].metrics[0].detail).toContain('2 tech(s)');
  });

  it('reports zero rather than NaN when no technician has open work', async () => {
    const s = await assembleServiceManagerData(
      stubClient({
        service_tickets: [{ id: 't1', status: 'closed', assigned_technician_id: 'tech-1' }],
        equipment_failure_predictions: [],
        inventory_items: [],
        truck_stock_callbacks: [],
      }),
      'tenant-1',
      NOW,
    );
    expect(s[2].metrics[0].value).toBe(0);
    expect(Number.isNaN(s[2].metrics[0].value as number)).toBe(false);
  });
});

describe('assembleSalesRepData', () => {
  const base = () => ({
    proposals: [
      { title: 'Deal A', total_amount: '5000', status: 'sent' },
      { title: 'Deal B', total_amount: '2500.75', status: 'draft' },
    ],
    business_records: [{ id: 'l1' }, { id: 'l2' }],
    renewal_auto_quotes: [{ id: 'r1' }],
    contracts: [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }],
  });

  it('lists next best actions with formatted amounts and the STUB disclosure', async () => {
    const s = await assembleSalesRepData(stubClient(base()), 'tenant-1', 'user-1', NOW);
    expect(s[0].metrics[0]).toMatchObject({ label: 'Deal A', value: '$5,000' });
    expect(s[0].metrics[0].detail).toMatch(/win-probability STUB/);
  });

  it('shows an explicit empty state when the rep has no open proposals', async () => {
    const s = await assembleSalesRepData(
      stubClient({ ...base(), proposals: [] }),
      'tenant-1',
      'user-1',
      NOW,
    );
    expect(s[0].metrics).toEqual([{ label: 'No open proposals assigned to you', value: 0 }]);
  });

  it('sums renewal drafts and ending contracts into one figure, itemised in the detail', async () => {
    const s = await assembleSalesRepData(stubClient(base()), 'tenant-1', 'user-1', NOW);
    const renewals = s[2].metrics[0];
    expect(renewals.value).toBe(4); // 1 draft + 3 contracts
    expect(renewals.detail).toBe('1 draft(s) + 3 contract(s) ending ≤90d');
  });
});

describe('fallback briefing', () => {
  const data: BriefingData = {
    role: 'owner',
    sections: [
      {
        heading: 'Urgent attention',
        metrics: [
          { label: 'P1 incidents', value: 3, detail: 'urgent tickets' },
          { label: 'At-risk customers', value: 0 },
        ],
      },
    ],
  };

  it('flattens every metric with its section heading for the prompt', () => {
    expect(flattenMetrics(data)).toEqual([
      'Urgent attention — P1 incidents: 3 (urgent tickets)',
      'Urgent attention — At-risk customers: 0',
    ]);
  });

  it('produces a role-labelled subject and one bullet per metric', () => {
    const f = buildFallback(data, '2026-06-15');
    expect(f.subject).toBe('Owner morning briefing — 2026-06-15');
    expect(f.bullets).toEqual(['P1 incidents: 3 — urgent tickets', 'At-risk customers: 0']);
    expect(f.source).toBe('fallback');
  });

  it('instructs the model differently per A/B variant and forbids invented numbers', () => {
    const numbers = buildPrompt(data, 'numbers', '2026-06-15');
    const narrative = buildPrompt(data, 'narrative', '2026-06-15');
    expect(numbers).toContain('Lead with the hard figures');
    expect(narrative).toContain('narrative framing');
    // Both must carry the anti-hallucination instruction and the real figures.
    for (const p of [numbers, narrative]) {
      expect(p).toContain('do not invent numbers');
      expect(p).toContain('P1 incidents: 3');
    }
  });
});

describe('parseAiBriefing', () => {
  it('extracts a valid briefing from a reply with surrounding prose', () => {
    const r = parseAiBriefing('Sure!\n{"subject":"S","bullets":["a","b"]}\nHope that helps.');
    expect(r).toEqual({ subject: 'S', bullets: ['a', 'b'] });
  });

  it('rejects replies that would put broken content in front of a customer', () => {
    // Each of these must fall back rather than render.
    expect(parseAiBriefing('no json here')).toBeNull();
    expect(parseAiBriefing('{ not valid json }')).toBeNull();
    expect(parseAiBriefing('{"subject":"S"}')).toBeNull(); // no bullets
    expect(parseAiBriefing('{"subject":"S","bullets":[]}')).toBeNull(); // empty bullets
    expect(parseAiBriefing('{"subject":5,"bullets":["a"]}')).toBeNull(); // wrong type
    expect(parseAiBriefing('{"subject":"S","bullets":["a",7]}')).toBeNull(); // mixed types
    expect(parseAiBriefing('{"subject":"S","bullets":"a"}')).toBeNull(); // not an array
  });
});
