/**
 * PROD-011 — pure logic behind the toner-replenish edge function
 * (supabase/functions/toner-replenish/replenish.ts).
 *
 * This pipeline spends money without a human in the loop — an auto_ship order
 * becomes a cartridge on a truck — so most of these tests are about the ways an
 * order must NOT be created.
 */

import { describe, it, expect } from 'vitest';
import {
  DAY_MS,
  DEFAULT_APPROVAL_COST_THRESHOLD,
  DEFAULT_LEAD_TIME_DAYS,
  DEFAULT_SAFETY_BUFFER_DAYS,
  SUPPLY_COLORS,
  SUPPLY_ORDER_STATUSES,
  TONER_UNIT_COST,
  colorKeyOf,
  fetchVendorSupplyLevels,
  groupReadings,
  isSuppressed,
  isSupplyColor,
  latestPerMachineColor,
  num,
  orderKey,
  orderStatusFor,
  parseCapture,
  parseMachineSettings,
  parseOrderStatusFilter,
  parseShipNow,
  parseTenantSettings,
  predictDepletion,
  supplyName,
  toLevel,
  toMachineSettings,
  toOrder,
  toTenantSettings,
  triggerReason,
  windowDays,
  withinOrderWindow,
} from '../../../supabase/functions/toner-replenish/replenish';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');

/** Readings at N days ago, percent p. */
const at = (daysAgo: number, percent: number) => ({
  capturedAt: NOW - daysAgo * DAY_MS,
  percentRemaining: percent,
});

describe('predictDepletion', () => {
  it('predicts the depletion date from a steady drain', () => {
    // 10%/day from 50% now -> empty in 5 days.
    const out = predictDepletion([at(0, 50), at(1, 60), at(2, 70)], NOW);
    expect(out).not.toBeNull();
    expect(out!.getTime()).toBeCloseTo(NOW + 5 * DAY_MS, -4);
  });

  it('returns null for a single reading — no line to fit', () => {
    expect(predictDepletion([at(0, 50)], NOW)).toBeNull();
    expect(predictDepletion([], NOW)).toBeNull();
  });

  it('returns null for a FLAT curve', () => {
    expect(predictDepletion([at(0, 50), at(1, 50), at(2, 50)], NOW)).toBeNull();
  });

  it('returns null for a RISING curve — the cartridge was just replaced', () => {
    // Ordering off a refill would ship toner nobody needs.
    expect(predictDepletion([at(0, 90), at(1, 40), at(2, 20)], NOW)).toBeNull();
  });

  it('returns null when every reading shares one instant', () => {
    expect(predictDepletion([at(1, 50), at(1, 40)], NOW)).toBeNull();
  });

  it('treats an already-empty cartridge as depleted NOW, not as no signal', () => {
    const out = predictDepletion([at(0, 0), at(2, 20)], NOW);
    expect(out?.getTime()).toBe(NOW);
  });

  it('uses the MOST RECENT reading as the current level, whatever order they arrive in', () => {
    const ascending = predictDepletion([at(2, 70), at(1, 60), at(0, 50)], NOW);
    const descending = predictDepletion([at(0, 50), at(1, 60), at(2, 70)], NOW);
    expect(ascending!.getTime()).toBe(descending!.getTime());
  });

  it('predicts further out for a slower drain', () => {
    const fast = predictDepletion([at(0, 50), at(1, 70)], NOW)!;
    const slow = predictDepletion([at(0, 50), at(1, 55)], NOW)!;
    expect(slow.getTime()).toBeGreaterThan(fast.getTime());
  });
});

describe('isSuppressed', () => {
  it('allows a plain machine with no overrides', () => {
    expect(isSuppressed({})).toBe(false);
  });

  it('SUPPRESSES a customer-managed machine', () => {
    // That customer buys their own toner; shipping bills them for something
    // they did not ask for.
    expect(isSuppressed({ customer_managed: true })).toBe(true);
  });

  it('lets the emergency override beat customer-managed', () => {
    expect(isSuppressed({ customer_managed: true, emergency_override: true })).toBe(false);
  });

  it('suppresses when auto-ship is explicitly off, independently of customer-managed', () => {
    expect(isSuppressed({ auto_ship_enabled: false })).toBe(true);
    // The emergency override does NOT re-enable an operator-disabled machine.
    expect(isSuppressed({ auto_ship_enabled: false, emergency_override: true })).toBe(true);
  });

  it('suppresses when there is no settings row at all', () => {
    expect(isSuppressed(null)).toBe(true);
    expect(isSuppressed(undefined)).toBe(true);
  });

  it('treats a missing auto_ship column as ON, not off', () => {
    expect(isSuppressed({ customer_managed: false })).toBe(false);
  });
});

describe('windowDays', () => {
  const defaults = { lead: 5, buffer: 3 };

  it('uses the tenant defaults when the machine has no override', () => {
    expect(windowDays({}, defaults)).toEqual({ lead: 5, buffer: 3 });
    expect(windowDays(null, defaults)).toEqual({ lead: 5, buffer: 3 });
  });

  it('prefers the per-machine values when set', () => {
    expect(windowDays({ lead_time_days: 10, safety_buffer_days: 1 }, defaults)).toEqual({
      lead: 10,
      buffer: 1,
    });
  });

  it('honours an explicit ZERO override rather than falling back', () => {
    // 0 is a real choice (same-day courier); treating it as unset would order
    // days early forever.
    expect(windowDays({ lead_time_days: 0 }, defaults)).toEqual({ lead: 0, buffer: 3 });
  });
});

describe('withinOrderWindow', () => {
  it('orders when depletion lands inside lead + buffer', () => {
    expect(withinOrderWindow(new Date(NOW + 3 * DAY_MS), NOW, 5, 3)).toBe(true);
  });

  it('does NOT order when depletion is beyond the window', () => {
    expect(withinOrderWindow(new Date(NOW + 20 * DAY_MS), NOW, 5, 3)).toBe(false);
  });

  it('is STRICT at the boundary — exactly at the cutoff can wait a cycle', () => {
    expect(withinOrderWindow(new Date(NOW + 8 * DAY_MS), NOW, 5, 3)).toBe(false);
    expect(withinOrderWindow(new Date(NOW + 8 * DAY_MS - 1), NOW, 5, 3)).toBe(true);
  });

  it('orders for a depletion already in the past', () => {
    expect(withinOrderWindow(new Date(NOW - DAY_MS), NOW, 5, 3)).toBe(true);
  });
});

describe('orderStatusFor', () => {
  it('auto-ships under the tenant threshold', () => {
    expect(orderStatusFor({ totalCost: 85, approvalThreshold: 150, costCeiling: null })).toBe(
      'auto_ship',
    );
  });

  it('holds for approval above it', () => {
    expect(orderStatusFor({ totalCost: 200, approvalThreshold: 150, costCeiling: null })).toBe(
      'pending_approval',
    );
  });

  it('auto-ships exactly AT the threshold — the gate is strictly greater', () => {
    expect(orderStatusFor({ totalCost: 150, approvalThreshold: 150, costCeiling: null })).toBe(
      'auto_ship',
    );
  });

  it('takes the MINIMUM of the tenant threshold and the machine ceiling', () => {
    // A per-machine ceiling can only ever make approval MORE likely.
    expect(orderStatusFor({ totalCost: 100, approvalThreshold: 150, costCeiling: 50 })).toBe(
      'pending_approval',
    );
    expect(orderStatusFor({ totalCost: 100, approvalThreshold: 50, costCeiling: 500 })).toBe(
      'pending_approval',
    );
  });

  it('treats a zero ceiling as "always require approval", not as absent', () => {
    expect(orderStatusFor({ totalCost: 1, approvalThreshold: 150, costCeiling: 0 })).toBe(
      'pending_approval',
    );
  });

  it('falls back to the tenant threshold with no ceiling set', () => {
    expect(orderStatusFor({ totalCost: 110, approvalThreshold: 150, costCeiling: null })).toBe(
      'auto_ship',
    );
  });
});

describe('colors and costs', () => {
  it('recognises exactly the four supply colors', () => {
    expect(SUPPLY_COLORS).toEqual(['k', 'c', 'm', 'y']);
    for (const c of SUPPLY_COLORS) expect(isSupplyColor(c)).toBe(true);
    expect(isSupplyColor('K')).toBe(false);
    expect(isSupplyColor('black')).toBe(false);
    expect(isSupplyColor(null)).toBe(false);
  });

  it('falls back to black for an unknown color rather than throwing', () => {
    expect(colorKeyOf('nonsense')).toBe('k');
    expect(colorKeyOf(undefined)).toBe('k');
    expect(colorKeyOf('c')).toBe('c');
  });

  it('prices black below the color channels', () => {
    expect(TONER_UNIT_COST.k).toBeLessThan(TONER_UNIT_COST.c);
    for (const c of SUPPLY_COLORS) expect(TONER_UNIT_COST[c]).toBeGreaterThan(0);
  });

  it('names the supply for the UI', () => {
    expect(supplyName('k')).toBe('Black toner');
    expect(supplyName('y')).toBe('Yellow toner');
    expect(supplyName('bogus')).toBe('Black toner');
  });
});

describe('triggerReason', () => {
  it('records the predicted date and the window that fired', () => {
    const reason = triggerReason(new Date('2026-08-20T00:00:00.000Z'), 5, 3);
    expect(reason).toContain('2026-08-20');
    expect(reason).toContain('8-day lead+buffer');
  });
});

describe('groupReadings / orderKey / latestPerMachineColor', () => {
  it('groups by machine AND color', () => {
    const grouped = groupReadings([
      { machine_id: 'm1', color: 'k', percent_remaining: 50, captured_at: '2026-08-07T00:00:00Z' },
      { machine_id: 'm1', color: 'c', percent_remaining: 80, captured_at: '2026-08-07T00:00:00Z' },
      { machine_id: 'm1', color: 'k', percent_remaining: 60, captured_at: '2026-08-06T00:00:00Z' },
    ]);
    expect(grouped.size).toBe(2);
    expect(grouped.get('m1::k')).toHaveLength(2);
  });

  it('drops rows with an unparseable timestamp instead of poisoning the regression', () => {
    const grouped = groupReadings([
      { machine_id: 'm1', color: 'k', percent_remaining: 50, captured_at: 'not a date' },
    ]);
    expect(grouped.size).toBe(0);
  });

  it('builds a stable key and tolerates a null color', () => {
    expect(orderKey('m1', 'k')).toBe('m1::k');
    expect(orderKey('m1', null)).toBe('m1::');
  });

  it('keeps the FIRST row per machine+color — rows must be newest-first', () => {
    // This replaces SELECT DISTINCT ON. Reversed, the dashboard shows each
    // machine's OLDEST toner level.
    const rows = [
      { machine_id: 'm1', color: 'k', percent_remaining: 20 },
      { machine_id: 'm1', color: 'k', percent_remaining: 90 },
      { machine_id: 'm1', color: 'c', percent_remaining: 40 },
    ];
    expect(latestPerMachineColor(rows).map((r) => r.percent_remaining)).toEqual([20, 40]);
  });
});

describe('fetchVendorSupplyLevels', () => {
  const mono = { id: 'machine-abc', is_color_capable: false };
  const color = { id: 'machine-abc', is_color_capable: true };

  it('reads only black for a mono device and all four for a color device', () => {
    expect(fetchVendorSupplyLevels(mono, NOW).map((l) => l.color)).toEqual(['k']);
    expect(fetchVendorSupplyLevels(color, NOW).map((l) => l.color)).toEqual(['k', 'c', 'm', 'y']);
  });

  it('is deterministic for the same machine and day', () => {
    expect(fetchVendorSupplyLevels(color, NOW)).toEqual(fetchVendorSupplyLevels(color, NOW));
  });

  it('differs between machines, so the fleet is not uniform', () => {
    const a = fetchVendorSupplyLevels({ id: 'aaa', is_color_capable: false }, NOW)[0];
    const b = fetchVendorSupplyLevels({ id: 'zzz', is_color_capable: false }, NOW)[0];
    expect(a.percentRemaining).not.toBe(b.percentRemaining);
  });

  it('stays inside 2..100 percent', () => {
    for (const day of [0, 15, 30, 45, 59]) {
      for (const level of fetchVendorSupplyLevels(color, NOW + day * DAY_MS)) {
        expect(level.percentRemaining).toBeGreaterThanOrEqual(2);
        expect(level.percentRemaining).toBeLessThanOrEqual(100);
        expect(level.pageCountRemaining).toBeGreaterThan(0);
      }
    }
  });
});

describe('response shaping', () => {
  it('maps a level row to the keys the dashboard reads', () => {
    const out = toLevel(
      {
        id: 'l1',
        machine_id: 'm1',
        color: 'k',
        percent_remaining: '42.5',
        page_count_remaining: '5100',
        source: 'injected',
        captured_at: '2026-08-07T00:00:00.000Z',
      },
      {
        serial_number: 'SN-1',
        model_number: 'iR-C5560',
        manufacturer: 'Canon',
        is_color_capable: true,
        customer_id: 'c1',
      },
      'Acme Dental',
      '2026-08-14T00:00:00.000Z',
    );
    expect(out.percentRemaining).toBe(42.5);
    expect(out.serialNumber).toBe('SN-1');
    expect(out.companyName).toBe('Acme Dental');
    expect(out.predictedDepletionDate).toBe('2026-08-14T00:00:00.000Z');
    expect(out.isColorCapable).toBe(true);
    for (const key of Object.keys(out)) expect(key).not.toContain('_');
  });

  it('keeps a NULL percent null rather than turning it into 0', () => {
    // "No reading" and "empty cartridge" are opposite states, and the page
    // paints the latter red.
    const out = toLevel(
      { id: 'l1', machine_id: 'm1', color: 'k', percent_remaining: null },
      undefined,
      null,
      null,
    );
    expect(out.percentRemaining).toBeNull();
    expect(out.pageCountRemaining).toBeNull();
    expect(out.isColorCapable).toBe(false);
  });

  it('maps an order and keeps money as a STRING', () => {
    const out = toOrder({
      id: 'o1',
      machine_id: 'm1',
      color: 'k',
      status: 'auto_ship',
      supply_name: 'Black toner',
      quantity: '1',
      unit_cost: '85.00',
      total_cost: '85.00',
      is_emergency: false,
      customer_notified: false,
      created_at: '2026-08-07T00:00:00.000Z',
    });
    // Parsing to float would reintroduce rounding on a money value.
    expect(out.unitCost).toBe('85.00');
    expect(out.totalCost).toBe('85.00');
    expect(out.quantity).toBe(1);
    expect(out.isEmergency).toBe(false);
    expect(out.customerNotified).toBe(false);
    for (const key of Object.keys(out)) expect(key).not.toContain('_');
  });

  it('defaults the order booleans to false rather than undefined', () => {
    const out = toOrder({ id: 'o1' });
    expect(out.isEmergency).toBe(false);
    expect(out.customerNotified).toBe(false);
    expect(out.trackingNumber).toBeNull();
  });

  it('supplies tenant-settings defaults for an empty row', () => {
    const out = toTenantSettings('t1', null);
    expect(out).toMatchObject({
      tenantId: 't1',
      approvalCostThreshold: DEFAULT_APPROVAL_COST_THRESHOLD,
      defaultLeadTimeDays: DEFAULT_LEAD_TIME_DAYS,
      defaultSafetyBufferDays: DEFAULT_SAFETY_BUFFER_DAYS,
    });
  });

  it('honours a stored ZERO threshold instead of substituting the default', () => {
    // 0 means "approve everything", which is the opposite of the 150 default.
    expect(toTenantSettings('t1', { approval_cost_threshold: 0 }).approvalCostThreshold).toBe(0);
    expect(toTenantSettings('t1', { default_lead_time_days: 0 }).defaultLeadTimeDays).toBe(0);
  });

  it('maps machine settings, defaulting auto-ship to ON when absent', () => {
    expect(toMachineSettings({ id: 's1' }).autoShipEnabled).toBe(true);
    expect(toMachineSettings({ id: 's1', auto_ship_enabled: false }).autoShipEnabled).toBe(false);
    expect(toMachineSettings({ id: 's1' }).costCeiling).toBeNull();
    expect(toMachineSettings({ id: 's1', cost_ceiling: '75.00' }).costCeiling).toBe(75);
  });
});

describe('num', () => {
  it('parses the strings PostgREST returns for numeric columns', () => {
    expect(num('42.5')).toBe(42.5);
    expect(num(42)).toBe(42);
  });

  it('maps null, undefined and garbage to 0', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('parseCapture / parseShipNow', () => {
  it('accepts an empty capture body — that means "every machine"', () => {
    expect(parseCapture({})).toEqual({ ok: true, value: {} });
    expect(parseCapture({ machineId: 'm1' })).toEqual({ ok: true, value: { machineId: 'm1' } });
    expect(parseCapture({ machineId: '' }).ok).toBe(false);
  });

  it('defaults ship-now to black and rejects an unknown color', () => {
    expect(parseShipNow({})).toEqual({ ok: true, value: { color: 'k' } });
    expect(parseShipNow({ color: 'm' })).toEqual({ ok: true, value: { color: 'm' } });
    // A bogus color would silently ship black under a color's name.
    expect(parseShipNow({ color: 'purple' }).ok).toBe(false);
  });
});

describe('parseTenantSettings', () => {
  it('accepts an empty body', () => {
    expect(parseTenantSettings({})).toEqual({ ok: true, value: {} });
  });

  it('bounds the threshold and the day counts', () => {
    expect(parseTenantSettings({ approvalCostThreshold: 0 }).ok).toBe(true);
    expect(parseTenantSettings({ approvalCostThreshold: -1 }).ok).toBe(false);
    expect(parseTenantSettings({ approvalCostThreshold: 1_000_001 }).ok).toBe(false);
    expect(parseTenantSettings({ defaultLeadTimeDays: 366 }).ok).toBe(false);
    expect(parseTenantSettings({ defaultLeadTimeDays: 2.5 }).ok).toBe(false);
    expect(parseTenantSettings({ defaultSafetyBufferDays: 0 }).ok).toBe(true);
  });

  it('allows a FRACTIONAL threshold — it is money, not a day count', () => {
    expect(parseTenantSettings({ approvalCostThreshold: 149.99 }).ok).toBe(true);
  });

  it('rejects a numeric string', () => {
    expect(parseTenantSettings({ approvalCostThreshold: '150' }).ok).toBe(false);
  });
});

describe('parseMachineSettings', () => {
  it('accepts an empty body', () => {
    expect(parseMachineSettings({})).toEqual({ ok: true, value: {} });
  });

  it('carries the booleans through', () => {
    expect(parseMachineSettings({ customerManaged: true, autoShipEnabled: false })).toEqual({
      ok: true,
      value: { autoShipEnabled: false, customerManaged: true },
    });
  });

  it('rejects a non-boolean flag rather than coercing it', () => {
    // Coercing 'false' to true would silently re-enable a suppressed machine.
    expect(parseMachineSettings({ customerManaged: 'true' }).ok).toBe(false);
    expect(parseMachineSettings({ autoShipEnabled: 1 }).ok).toBe(false);
  });

  it('distinguishes NULL (clear the override) from omitted (leave as-is)', () => {
    const cleared = parseMachineSettings({ costCeiling: null, leadTimeDays: null });
    expect(cleared).toEqual({ ok: true, value: { costCeiling: null, leadTimeDays: null } });
    const omitted = parseMachineSettings({});
    expect(omitted.ok && 'costCeiling' in omitted.value).toBe(false);
  });

  it('bounds the numeric overrides', () => {
    expect(parseMachineSettings({ costCeiling: -1 }).ok).toBe(false);
    expect(parseMachineSettings({ costCeiling: 0 }).ok).toBe(true);
    expect(parseMachineSettings({ leadTimeDays: 366 }).ok).toBe(false);
    expect(parseMachineSettings({ safetyBufferDays: 1.5 }).ok).toBe(false);
  });
});

describe('parseOrderStatusFilter', () => {
  it('accepts every real status', () => {
    for (const status of SUPPLY_ORDER_STATUSES) expect(parseOrderStatusFilter(status)).toBe(status);
  });

  it('treats absent and "all" as no filter', () => {
    expect(parseOrderStatusFilter(null)).toBeNull();
    expect(parseOrderStatusFilter('all')).toBeNull();
  });

  it('drops an unrecognised status rather than filtering on it', () => {
    // Filtering on a value no row can hold shows an empty list, which reads as
    // "no orders" rather than "bad filter".
    expect(parseOrderStatusFilter('SHIPPED')).toBeNull();
    expect(parseOrderStatusFilter('pending')).toBeNull();
  });
});
