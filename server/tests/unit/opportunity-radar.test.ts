// COP-B04: the installed base turned into ranked, dated plays.
//
// Every rule here is one a ranked list can get wrong while rendering perfectly:
// a play worth an unknown amount sorted to the bottom as if it were worth zero,
// a lease that ended last month treated as expired rather than urgent, a
// volume claim made from a fleet whose meters are silent, or a colour-share
// verdict drawn from twelve pages.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_THRESHOLDS,
  dealFromPlay,
  detectPlays,
  rankPlays,
  scoreFor,
  urgencyFor,
  type RadarInput,
} from '../../../supabase/functions/_shared/opportunity-radar';

const NOW = new Date('2026-09-19T00:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function input(over: Partial<RadarInput> = {}): RadarInput {
  return {
    equipment: [],
    contracts: [],
    meters: [],
    serviceCalls: new Map(),
    companyNames: new Map(),
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW,
    ...over,
  };
}

const machine = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  customer_id: 'acct-1',
  serial_number: 'SN-1',
  model_number: 'MP C3004',
  is_color_capable: false,
  equipment_status: 'active',
  lease_expires_date: null,
  purchase_price: '12000',
  ...over,
});

const contract = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  customer_id: 'acct-1',
  end_date: null,
  status: 'active',
  monthly_base: '500',
  black_rate: '0.01',
  color_rate: '0.07',
  ...over,
});

describe('urgencyFor — urgency is a curve, not a flag', () => {
  it('maxes out on a trigger that has already passed', () => {
    // A lease that ended last month is the most urgent call on the list, not
    // an expired opportunity.
    expect(urgencyFor(-30, 120)).toBe(100);
    expect(urgencyFor(0, 120)).toBe(100);
  });

  it('separates a trigger next week from one at the edge of the window', () => {
    expect(urgencyFor(7, 120)).toBeGreaterThan(urgencyFor(110, 120));
  });

  it('decays past the window rather than cutting to zero', () => {
    expect(urgencyFor(400, 120)).toBe(10);
  });

  it('is middling for an undated trigger, not zero', () => {
    expect(urgencyFor(null, 120)).toBe(40);
  });
});

describe('scoreFor — a null value is not a zero value', () => {
  it('scores an unknown-value play on urgency alone', () => {
    // The failure this prevents: a real opportunity worth an unknown amount
    // sorted below a trivial one worth $200.
    expect(scoreFor(90, null, 100_000)).toBe(90);
    expect(scoreFor(90, null, 100_000)).toBeGreaterThan(scoreFor(90, 200, 100_000));
  });

  it('blends value in when there is one', () => {
    expect(scoreFor(50, 100_000, 100_000)).toBeGreaterThan(scoreFor(50, 1_000, 100_000));
  });

  it('never leaves 0-100', () => {
    expect(scoreFor(200, 9_999_999, 1)).toBeLessThanOrEqual(100);
    expect(scoreFor(-50, null, 1)).toBeGreaterThanOrEqual(0);
  });
});

describe('lease_expiring', () => {
  it('fires inside the window and dates the play to the lease end', () => {
    const plays = detectPlays(input({ equipment: [machine({ lease_expires_date: inDays(30) })] }));
    const lease = plays.find((p) => p.playType === 'lease_expiring');
    expect(lease?.reason).toContain('30 days');
    expect(lease?.triggerDate?.slice(0, 10)).toBe(inDays(30).slice(0, 10));
    expect(lease?.estimatedValue).toBe(12000);
  });

  it('does not fire outside the window', () => {
    const plays = detectPlays(input({ equipment: [machine({ lease_expires_date: inDays(300) })] }));
    expect(plays.map((p) => p.playType)).not.toContain('lease_expiring');
  });

  it('STILL fires for a lease that has already ended, and says so', () => {
    const plays = detectPlays(input({ equipment: [machine({ lease_expires_date: inDays(-20) })] }));
    const lease = plays.find((p) => p.playType === 'lease_expiring');
    expect(lease?.reason).toContain('ended 20 days ago');
  });

  it('drops a lease that ended more than a year ago — that is history', () => {
    const plays = detectPlays(
      input({ equipment: [machine({ lease_expires_date: inDays(-400) })] }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('lease_expiring');
  });

  it('carries no value rather than a guess when no purchase price is recorded', () => {
    const plays = detectPlays(
      input({ equipment: [machine({ lease_expires_date: inDays(10), purchase_price: null })] }),
    );
    expect(plays.find((p) => p.playType === 'lease_expiring')?.estimatedValue).toBeNull();
  });

  it('ignores a retired machine', () => {
    const plays = detectPlays(
      input({
        equipment: [machine({ lease_expires_date: inDays(10), equipment_status: 'retired' })],
      }),
    );
    expect(plays).toEqual([]);
  });
});

describe('contract_ending', () => {
  it('fires inside the window and annualizes the monthly base', () => {
    const plays = detectPlays(input({ contracts: [contract({ end_date: inDays(30) })] }));
    const play = plays.find((p) => p.playType === 'contract_ending');
    expect(play?.estimatedValue).toBe(6000);
    expect(play?.contractId).toBe('c1');
  });

  it('ignores a contract that is not active', () => {
    const plays = detectPlays(
      input({ contracts: [contract({ end_date: inDays(30), status: 'cancelled' })] }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('contract_ending');
  });
});

describe('volume_over_tier', () => {
  const overTier = () =>
    input({
      equipment: [machine()],
      contracts: [contract()],
      // 60k black at $0.01 = $600 against a $500 base: 120% of tier.
      meters: [
        { equipmentId: 'e1', monthlyBlack: 60_000, monthlyColor: 0, lastReadingDate: inDays(-5) },
      ],
    });

  it('fires when clicks materially exceed the contracted base', () => {
    const play = detectPlays(overTier()).find((p) => p.playType === 'volume_over_tier');
    expect(play?.scoreFactors.overagePct).toBe(120);
    expect(play?.estimatedValue).toBeCloseTo(1200);
  });

  it('stays quiet just under the threshold', () => {
    const plays = detectPlays(
      input({
        equipment: [machine()],
        contracts: [contract()],
        // $550 against $500 = 110%, under the 15% threshold.
        meters: [
          { equipmentId: 'e1', monthlyBlack: 55_000, monthlyColor: 0, lastReadingDate: inDays(-5) },
        ],
      }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('volume_over_tier');
  });

  it('MAKES NO CLAIM when no machine on the contract has reported', () => {
    // Silence is the meters_not_reporting play, not a volume verdict. Note the
    // threshold enforces this on its own (zero readings give zero click
    // revenue), so this pins the BEHAVIOUR rather than the explicit guard -
    // established by mutation, not assumed.
    const plays = detectPlays(input({ equipment: [machine()], contracts: [contract()] }));
    expect(plays.map((p) => p.playType)).not.toContain('volume_over_tier');
  });

  it('is one play per contract, not one per machine', () => {
    const plays = detectPlays(
      input({
        equipment: [machine({ id: 'e1' }), machine({ id: 'e2' }), machine({ id: 'e3' })],
        contracts: [contract()],
        meters: ['e1', 'e2', 'e3'].map((id) => ({
          equipmentId: id,
          monthlyBlack: 30_000,
          monthlyColor: 0,
          lastReadingDate: inDays(-5),
        })),
      }),
    );
    const volume = plays.filter((p) => p.playType === 'volume_over_tier');
    expect(volume).toHaveLength(1);
    expect(volume[0].equipmentIds).toHaveLength(3);
  });

  it('says how many of the fleet it actually measured', () => {
    const play = detectPlays(
      input({
        equipment: [machine({ id: 'e1' }), machine({ id: 'e2' })],
        contracts: [contract()],
        meters: [
          { equipmentId: 'e1', monthlyBlack: 60_000, monthlyColor: 0, lastReadingDate: inDays(-5) },
        ],
      }),
    ).find((p) => p.playType === 'volume_over_tier');
    expect(play?.scoreFactors).toMatchObject({ devicesMeasured: 1, devicesInFleet: 2 });
  });
});

describe('service_burden — calls, because no cost column exists', () => {
  it('fires at the threshold and names the count', () => {
    const play = detectPlays(
      input({ equipment: [machine()], serviceCalls: new Map([['e1', 5]]) }),
    ).find((p) => p.playType === 'service_burden');
    expect(play?.reason).toContain('5 service calls');
    expect(String(play?.scoreFactors.basis)).toContain('no service cost is recorded');
  });

  it('stays quiet below the threshold', () => {
    const plays = detectPlays(
      input({ equipment: [machine()], serviceCalls: new Map([['e1', 3]]) }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('service_burden');
  });
});

describe('color_underused', () => {
  const colorMachine = (color: number, black: number) =>
    input({
      equipment: [machine({ is_color_capable: true })],
      meters: [
        {
          equipmentId: 'e1',
          monthlyBlack: black,
          monthlyColor: color,
          lastReadingDate: inDays(-5),
        },
      ],
    });

  it('fires on a colour device printing almost no colour', () => {
    const play = detectPlays(colorMachine(100, 9_900)).find(
      (p) => p.playType === 'color_underused',
    );
    expect(play?.scoreFactors.colorSharePct).toBe(1);
    // A right-sizing conversation, not a purchase: no dollar figure follows.
    expect(play?.estimatedValue).toBeNull();
  });

  it('WILL NOT judge colour share from a device printing almost nothing', () => {
    // 0 of 12 pages says nothing about whether they use colour.
    const plays = detectPlays(colorMachine(0, 12));
    expect(plays.map((p) => p.playType)).not.toContain('color_underused');
  });

  it('ignores a mono device', () => {
    const plays = detectPlays(
      input({
        equipment: [machine({ is_color_capable: false })],
        meters: [
          { equipmentId: 'e1', monthlyBlack: 9_000, monthlyColor: 0, lastReadingDate: inDays(-5) },
        ],
      }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('color_underused');
  });
});

describe('meters_not_reporting', () => {
  it('fires on a long silence and counts the days', () => {
    const play = detectPlays(
      input({
        equipment: [machine()],
        meters: [
          { equipmentId: 'e1', monthlyBlack: 100, monthlyColor: 0, lastReadingDate: inDays(-200) },
        ],
      }),
    ).find((p) => p.playType === 'meters_not_reporting');
    expect(play?.scoreFactors.daysSinceLastReading).toBe(200);
  });

  it('fires on a machine that has NEVER reported, and says that instead', () => {
    const play = detectPlays(input({ equipment: [machine()] })).find(
      (p) => p.playType === 'meters_not_reporting',
    );
    expect(play?.scoreFactors.neverReported).toBe(true);
    expect(play?.reason).toContain('never reported');
  });

  it('stays quiet on a device reporting normally', () => {
    const plays = detectPlays(
      input({
        equipment: [machine()],
        meters: [
          { equipmentId: 'e1', monthlyBlack: 100, monthlyColor: 0, lastReadingDate: inDays(-10) },
        ],
      }),
    );
    expect(plays.map((p) => p.playType)).not.toContain('meters_not_reporting');
  });
});

describe('dedupe keys — AC7', () => {
  it('are stable across two scans of the same unchanged data', () => {
    const a = detectPlays(input({ equipment: [machine({ lease_expires_date: inDays(30) })] }));
    const b = detectPlays(input({ equipment: [machine({ lease_expires_date: inDays(30) })] }));
    expect(a.map((p) => p.dedupeKey)).toEqual(b.map((p) => p.dedupeKey));
  });

  it('CHANGE when the trigger date moves — a re-papered lease is a new play', () => {
    const before = detectPlays(
      input({ equipment: [machine({ lease_expires_date: inDays(30) })] }),
    ).find((p) => p.playType === 'lease_expiring')!.dedupeKey;
    const after = detectPlays(
      input({ equipment: [machine({ lease_expires_date: inDays(60) })] }),
    ).find((p) => p.playType === 'lease_expiring')!.dedupeKey;
    expect(after).not.toBe(before);
  });

  it('are unique within one scan', () => {
    const plays = detectPlays(
      input({
        equipment: [
          machine({ id: 'e1', lease_expires_date: inDays(10) }),
          machine({ id: 'e2', lease_expires_date: inDays(10) }),
        ],
      }),
    );
    const keys = plays.map((p) => p.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('rankPlays', () => {
  it('sorts by score, highest first', () => {
    const plays = detectPlays(
      input({
        equipment: [
          machine({ id: 'e1', lease_expires_date: inDays(5), purchase_price: '90000' }),
          machine({ id: 'e2', lease_expires_date: inDays(115), purchase_price: '900' }),
        ],
      }),
    );
    const leases = plays.filter((p) => p.playType === 'lease_expiring');
    expect(leases[0].equipmentIds).toEqual(['e1']);
    expect(leases[0].score).toBeGreaterThan(leases[1].score);
  });

  it('is deterministic for equal scores', () => {
    const run = () =>
      rankPlays([
        {
          playType: 'lease_expiring',
          dedupeKey: 'b',
          customerId: null,
          equipmentIds: [],
          contractId: null,
          reason: 'x',
          triggerDate: null,
          estimatedValue: null,
          score: 0,
          scoreFactors: { urgency: 50 },
        },
        {
          playType: 'lease_expiring',
          dedupeKey: 'a',
          customerId: null,
          equipmentIds: [],
          contractId: null,
          reason: 'x',
          triggerDate: null,
          estimatedValue: null,
          score: 0,
          scoreFactors: { urgency: 50 },
        },
      ]);
    expect(run().map((p) => p.dedupeKey)).toEqual(['a', 'b']);
    expect(run()).toEqual(run());
  });

  it('claims nothing for an empty installed base', () => {
    expect(detectPlays(input())).toEqual([]);
  });
});

describe('dealFromPlay — AC3, the rep never retypes what the system knows', () => {
  const play = {
    playType: 'lease_expiring' as const,
    dedupeKey: 'k',
    customerId: 'acct-1',
    equipmentIds: ['e1'],
    contractId: null,
    reason: 'Lease ends in 30 days.',
    triggerDate: inDays(30),
    estimatedValue: 48000,
    score: 80,
    scoreFactors: {},
    companyName: 'Northgate Dental',
  };
  const opts = { tenantId: 't1', stageId: 's1', ownerId: 'rep-1' };

  it('carries the account, the value and the trigger date onto the deal', () => {
    const row = dealFromPlay(play, opts);
    expect(row.customer_id).toBe('acct-1');
    expect(row.amount).toBe('48000.00');
    expect(row.expected_close_date).toBe(play.triggerDate);
    expect(row.description).toBe(play.reason);
  });

  it('maps the play type to a COP-M04 motion', () => {
    expect(dealFromPlay(play, opts).deal_motion).toBe('lease_rollover');
    expect(dealFromPlay({ ...play, playType: 'contract_ending' }, opts).deal_motion).toBe(
      'renewal',
    );
    expect(dealFromPlay({ ...play, playType: 'service_burden' }, opts).deal_motion).toBe(
      'fleet_refresh',
    );
  });

  it('forecasts as pipeline — nobody has judged a deal generated an instant ago', () => {
    expect(dealFromPlay(play, opts).forecast_category).toBe('pipeline');
    expect(dealFromPlay(play, opts).status).toBe('open');
  });

  it('carries no amount rather than a zero when the play has no value', () => {
    expect(dealFromPlay({ ...play, estimatedValue: null }, opts).amount).toBeNull();
  });
});

/**
 * The scan had no body (COP-B04, round 60).
 *
 * `runScan` resolved its settings, computed `thresholds` and `now`, and then
 * returned an object referencing `drafts`, `inserted` and `equipment` - three
 * identifiers never declared in the function. It fetched nothing and never
 * called `detectPlays`, which was imported and unused.
 *
 * Nothing typechecks the edge tree, so that is not a compile error: it is a
 * ReferenceError the first time the path runs. Both entry points hit it - the
 * manual button and the nightly sweep - and the sweep's per-tenant catch
 * records the failure and steps over it, so an all-failing sweep reads as a
 * quiet night unless somebody opens the response. The radar detected nothing,
 * ever, while looking finished: `thresholds` assigned and unused was the tell.
 *
 * These assertions are about the SHAPE of the scan, because a pure-module test
 * cannot see whether anything calls it. `detectPlays` itself is covered above.
 */
describe('the scan actually scans', () => {
  const SRC = readFileSync(
    join(__dirname, '../../../supabase/functions/opportunity-radar/index.ts'),
    'utf8',
  );
  const scanBody = (() => {
    const at = SRC.indexOf('async function runScan');
    expect(at).toBeGreaterThan(-1);
    const end = SRC.indexOf('async function sweepAllTenants');
    expect(end).toBeGreaterThan(at);
    return SRC.slice(at, end);
  })();
  /**
   * Comments stripped for the absence checks. The scan's own header explains
   * WHY it does not use `black_copies`, and a check that cannot tell prose from
   * a column literal reports that explanation as the defect - the fourth time
   * this trap has fired in this repo.
   */
  const scanCode = scanBody.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('calls the detector it imports', () => {
    expect(SRC).toContain('detectPlays,');
    expect(scanBody).toContain('detectPlays({');
  });

  it('reads the installed base AC1 names', () => {
    for (const table of ['equipment', 'contracts', 'meter_readings', 'service_tickets']) {
      expect(scanBody).toContain(`.from('${table}')`);
    }
  });

  it('pages rather than capping, so a large fleet is scanned whole', () => {
    // AC8. A flat .limit() re-finds the same first page every night and the
    // tail is never looked at.
    //
    // Checked PER READ, not by presence: a bare `toContain('fetchAllRows')` is
    // satisfied by any one of the five calls, so converting just the equipment
    // read back to an unpaged query survived it. Third time this session that a
    // presence check stood in for a per-site one.
    for (const table of [
      'equipment',
      'contracts',
      'meter_readings',
      'service_tickets',
      'business_records',
    ]) {
      const at = scanCode.indexOf(`.from('${table}')`);
      expect({ table, read: at > -1 }).toEqual({ table, read: true });
      const before = scanCode.slice(Math.max(0, at - 220), at);
      expect({ table, paged: before.includes('fetchAllRows') }).toEqual({ table, paged: true });
    }
    expect(scanCode).not.toMatch(/\.limit\(\d+\)/);
  });

  it('scopes every read to the tenant', () => {
    // SEC-TENANT-005: a READ is bound by a filter, a WRITE by the payload, so
    // the radar_plays upsert is excluded here and checked below instead.
    const reads = [...scanCode.matchAll(/\.from\('([a-z_]+)'\)/g)]
      .map((m) => m[1])
      .filter((t) => t !== 'radar_plays');
    expect(reads.length).toBeGreaterThan(4);
    const filters = [...scanCode.matchAll(/\.eq\('tenant_id', tenantId\)/g)].length;
    expect(filters).toBeGreaterThanOrEqual(reads.length);
  });

  it('binds the write to the tenant in its payload', () => {
    expect(scanCode).toMatch(/tenant_id: tenantId/);
  });

  it('derives volume from the lifetime counters, not the delta columns', () => {
    // COP-B05: black_copies/color_copies DEFAULT TO 0, so an unfinished import
    // is indistinguishable from a month of no printing, and a volume play built
    // on that fires on a machine that is simply unmeasured.
    expect(scanCode).toContain('bw_meter_reading');
    expect(scanCode).toContain('color_meter_reading');
    expect(scanCode).not.toContain('black_copies');
  });

  it('refuses a negative rate from a meter reset', () => {
    // A counter reading LOWER than it did is a reset or a swapped machine.
    expect(scanBody).toMatch(/deltaBlack >= 0/);
    expect(scanBody).toMatch(/deltaColor >= 0/);
  });

  it('is idempotent through the unique index, not a scan-time lookup', () => {
    // AC7. Two overlapping sweeps would both read "not present" and both write.
    expect(scanBody).toContain("onConflict: 'tenant_id,dedupe_key'");
    expect(scanBody).toContain('ignoreDuplicates: true');
    // What is reported created has to be what was written, or `detected -
    // created` stops meaning "already known".
    expect(scanBody).toMatch(/inserted = \(written \?\? \[\]\)\.length/);
  });

  it('fails loudly when the write fails', () => {
    // A scan that swallows its insert error reports plays it did not store.
    expect(scanBody).toMatch(/throw new Error\(`radar_plays insert failed/);
  });
});
