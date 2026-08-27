// COP-M05: the arithmetic behind "attaching a machine fills the deal fields in".
//
// These are the numbers a copier deal is priced on, so the interesting cases are
// the ones where the honest answer is "unknown" rather than a confident zero.
import { describe, it, expect } from 'vitest';

import {
  monthlyVolumeFromReadings,
  sumVolumes,
  totalBuyoutExposure,
} from '../../../supabase/functions/_shared/installed-base';

describe('monthlyVolumeFromReadings', () => {
  it('annualises the delta between the two most recent readings', () => {
    // 30 days apart, 45,000 mono pages and 12,000 color.
    const volume = monthlyVolumeFromReadings([
      { reading_date: '2026-06-01', bw_meter_reading: 1_000_000, color_meter_reading: 300_000 },
      { reading_date: '2026-07-01', bw_meter_reading: 1_045_000, color_meter_reading: 312_000 },
    ]);
    expect(volume.bw).toBe(Math.round((45_000 / 30) * 30.44));
    expect(volume.color).toBe(Math.round((12_000 / 30) * 30.44));
  });

  it('ignores order and uses only the newest pair', () => {
    const rows = [
      { reading_date: '2026-01-01', bw_meter_reading: 0 },
      { reading_date: '2026-07-01', bw_meter_reading: 1_045_000 },
      { reading_date: '2026-06-01', bw_meter_reading: 1_000_000 },
    ];
    expect(monthlyVolumeFromReadings(rows).bw).toBe(Math.round((45_000 / 30) * 30.44));
  });

  it('returns null, not zero, with fewer than two readings', () => {
    expect(monthlyVolumeFromReadings([]).bw).toBeNull();
    expect(
      monthlyVolumeFromReadings([{ reading_date: '2026-07-01', bw_meter_reading: 10 }]).bw,
    ).toBeNull();
  });

  it('returns null when the counter went DOWN — a reset meter or a new board', () => {
    const volume = monthlyVolumeFromReadings([
      { reading_date: '2026-06-01', bw_meter_reading: 900_000 },
      { reading_date: '2026-07-01', bw_meter_reading: 12_000 },
    ]);
    expect(volume.bw).toBeNull();
  });

  it('returns null when both readings share a date', () => {
    expect(
      monthlyVolumeFromReadings([
        { reading_date: '2026-07-01', bw_meter_reading: 1 },
        { reading_date: '2026-07-01', bw_meter_reading: 2 },
      ]).bw,
    ).toBeNull();
  });

  it('reports mono without color when only the mono counter is present', () => {
    const volume = monthlyVolumeFromReadings([
      { reading_date: '2026-06-01', bw_meter_reading: 100, color_meter_reading: null },
      { reading_date: '2026-07-01', bw_meter_reading: 400, color_meter_reading: null },
    ]);
    expect(volume.bw).not.toBeNull();
    expect(volume.color).toBeNull();
  });

  it('accepts numeric strings, which is how PostgREST returns numerics', () => {
    const volume = monthlyVolumeFromReadings([
      { reading_date: '2026-06-01', bw_meter_reading: '1000' },
      { reading_date: '2026-07-01', bw_meter_reading: '4044' },
    ]);
    expect(volume.bw).toBe(Math.round((3044 / 30) * 30.44));
  });
});

describe('totalBuyoutExposure', () => {
  it('sums the amounts it has', () => {
    expect(totalBuyoutExposure([{ buyout_amount: '1200.50' }, { buyout_amount: 800 }])).toBe(
      2000.5,
    );
  });

  it('is null when nothing carries an amount, so the deal field stays empty', () => {
    expect(totalBuyoutExposure([])).toBeNull();
    expect(totalBuyoutExposure([{ buyout_amount: null }])).toBeNull();
  });

  it('does not let a missing amount drag the total to zero', () => {
    expect(totalBuyoutExposure([{ buyout_amount: null }, { buyout_amount: 500 }])).toBe(500);
  });
});

describe('sumVolumes', () => {
  it('adds the machines it knows about', () => {
    expect(
      sumVolumes([
        { bw: 10_000, color: 2_000 },
        { bw: 5_000, color: null },
      ]),
    ).toEqual({ bw: 15_000, color: 2_000 });
  });

  it('is null per counter only when every machine is unknown', () => {
    expect(sumVolumes([{ bw: null, color: null }])).toEqual({ bw: null, color: null });
    expect(sumVolumes([])).toEqual({ bw: null, color: null });
  });
});
