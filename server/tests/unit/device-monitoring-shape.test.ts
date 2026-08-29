/**
 * The device-monitoring projection and supply forecast.
 *
 * Three routed pages read this surface - DeviceMonitoring, SupplyRunway and
 * SupplyOrders - through flat keys that neither table stores under those names
 * (tonerBlack, serialNumber, currentLevel), so the shaping IS the contract.
 * It now has one definition in supabase/functions/_shared, imported by
 * server/routes-device-monitoring.ts, so an edge port cannot drift from it.
 *
 * The forecast rules had no tests at all and each one exists to avoid a
 * specific wrong answer, so they are the bulk of what is asserted here.
 */
import { describe, it, expect } from 'vitest';
import {
  shapeMetricForUi,
  decorateAlert,
  latestPerDevice,
  forecastSupplies,
} from '../../../supabase/functions/_shared/device-monitoring-shape';

const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

describe('shapeMetricForUi', () => {
  it('flattens the toner jsonb into the keys the UI reads, and keeps the object', () => {
    const shaped = shapeMetricForUi(
      {
        id: 'm1',
        deviceId: 'd1',
        tonerLevels: { black: 40, cyan: 12 },
        paperLevels: { tray1: 80 },
      },
      { serialNumber: 'SN-1', deviceName: 'Front desk' },
    );
    expect(shaped.tonerBlack).toBe(40);
    expect(shaped.tonerCyan).toBe(12);
    expect(shaped.paperTray1).toBe(80);
    expect(shaped.tonerLevels).toEqual({ black: 40, cyan: 12 });
    expect(shaped.serialNumber).toBe('SN-1');
  });

  it('reads snake_case rows too, because PostgREST and raw SQL return them', () => {
    // Drizzle hands back camelCase and the same shaper is called with both.
    const shaped = shapeMetricForUi(
      { id: 'm1', device_id: 'd1', toner_levels: { black: 7 }, collection_timestamp: '2026-01-01' },
      { serial_number: 'SN-2', device_name: 'Copy room' },
    );
    expect(shaped.deviceId).toBe('d1');
    expect(shaped.tonerBlack).toBe(7);
    expect(shaped.serialNumber).toBe('SN-2');
    expect(shaped.collectionTimestamp).toBe('2026-01-01');
  });

  it('says unknown rather than nothing when a device reports no status', () => {
    expect(shapeMetricForUi({ id: 'm' }, null).deviceStatus).toBe('unknown');
  });
});

describe('decorateAlert', () => {
  it('sends currentLevel and currentValue, since the UI reads one and the column is the other', () => {
    const alert = decorateAlert({ id: 'a1', currentValue: 8, status: 'active' }, null);
    expect(alert.currentLevel).toBe(8);
    expect(alert.currentValue).toBe(8);
  });

  it('reads an elapsed snooze as active without waiting for the next submit cycle', () => {
    const past = decorateAlert(
      { id: 'a1', status: 'snoozed', snoozedUntil: new Date(Date.now() - 1000) },
      null,
    );
    expect(past.status).toBe('active');
  });

  it('leaves a live snooze alone', () => {
    const future = decorateAlert(
      { id: 'a1', status: 'snoozed', snoozedUntil: new Date(Date.now() + DAY) },
      null,
    );
    expect(future.status).toBe('snoozed');
  });
});

describe('latestPerDevice', () => {
  it('keeps the first row per device, which is DISTINCT ON given the caller ordering', () => {
    const kept = latestPerDevice([
      { deviceId: 'a', v: 'newest' },
      { deviceId: 'a', v: 'older' },
      { deviceId: 'b', v: 'newest' },
    ]);
    expect(kept.map((r) => r.v)).toEqual(['newest', 'newest']);
  });

  it('drops rows with no device id rather than grouping them together', () => {
    expect(latestPerDevice([{ deviceId: null }, { deviceId: '' }])).toEqual([]);
  });
});

describe('forecastSupplies', () => {
  const steady = (levels: Array<[number, number]>) =>
    levels.map(([daysAgo, level]) => ({
      deviceId: 'd1',
      collectionTimestamp: at(daysAgo),
      tonerLevels: { black: level },
      serialNumber: 'SN-1',
    }));

  it('computes days remaining from the observed burn rate', () => {
    // 40 points over 10 days is 4/day; 20 left is 5 days.
    const [f] = forecastSupplies(
      steady([
        [10, 60],
        [0, 20],
      ]),
      { windowDays: 14 },
    );
    expect(f.consumptionPerDay).toBeCloseTo(4, 1);
    expect(f.daysRemaining).toBeCloseTo(5, 1);
    expect(f.currentLevel).toBe(20);
  });

  it('treats a rise of more than five points as a cartridge swap and restarts there', () => {
    // 60 -> 20 over 8 days, a refill to 95, then 95 -> 55 over 10 days.
    //
    // The rate after the swap is 4/day. Measured across the whole series it is
    // (60 - 55) / 20 = 0.25/day, a sixteen-fold understatement that would put
    // the runway at 220 days instead of 14. Asserting the RATE is what makes
    // this test about swap detection - an earlier version asserted only that
    // consumption was positive and currentLevel was 55, both of which hold with
    // the rule disabled, so it passed under mutation and proved nothing.
    const [f] = forecastSupplies(
      steady([
        [20, 60],
        [12, 20],
        [10, 95],
        [0, 55],
      ]),
      { windowDays: 30 },
    );
    expect(f.consumptionPerDay).toBeCloseTo(4, 1);
    expect(f.daysRemaining).toBeCloseTo(13.8, 0);
    expect(f.sampleCount).toBe(2);
  });

  it('forecasts nothing from under half a day of data', () => {
    // Two readings an hour apart would turn a rounding step into a burn rate.
    expect(
      forecastSupplies(
        steady([
          [0.05, 50],
          [0, 49],
        ]),
        { windowDays: 14 },
      ),
    ).toEqual([]);
  });

  it('treats a supply that is barely moving as idle rather than slow', () => {
    // 0.05 points/day or less divides out to runways of decades.
    expect(
      forecastSupplies(
        steady([
          [20, 50],
          [0, 49.9],
        ]),
        { windowDays: 30 },
      ),
    ).toEqual([]);
  });

  it('weights confidence by window coverage, not sample count alone', () => {
    const clustered = Array.from({ length: 10 }, (_, i) => ({
      deviceId: 'd1',
      collectionTimestamp: at(1 - i * 0.05),
      tonerLevels: { black: 60 - i },
      serialNumber: 'SN-1',
    }));
    const spread = Array.from({ length: 10 }, (_, i) => ({
      deviceId: 'd1',
      collectionTimestamp: at(13 - i * 1.4),
      tonerLevels: { black: 60 - i * 4 },
      serialNumber: 'SN-1',
    }));
    expect(forecastSupplies(clustered, { windowDays: 14 })[0]?.confidence).not.toBe('high');
    expect(forecastSupplies(spread, { windowDays: 14 })[0].confidence).toBe('high');
  });

  it('sorts most urgent first', () => {
    const rows = [
      ...steady([
        [10, 60],
        [0, 50],
      ]),
      ...steady([
        [10, 60],
        [0, 10],
      ]).map((r) => ({ ...r, deviceId: 'd2', serialNumber: 'SN-2' })),
    ];
    const out = forecastSupplies(rows, { windowDays: 14 });
    expect(out[0].daysRemaining).toBeLessThan(out[1].daysRemaining);
  });

  it('honours lowOnly by dropping anything with two weeks or more left', () => {
    const rows = steady([
      [10, 60],
      [0, 50],
    ]);
    expect(forecastSupplies(rows, { windowDays: 14 })).toHaveLength(1);
    expect(forecastSupplies(rows, { windowDays: 14, lowOnly: true })).toEqual([]);
  });

  it('ignores levels outside 0-100, which are sensor faults rather than readings', () => {
    const rows = steady([
      [10, 60],
      [5, 250],
      [0, 20],
    ]);
    const [f] = forecastSupplies(rows, { windowDays: 14 });
    expect(f.sampleCount).toBe(2);
  });
});
