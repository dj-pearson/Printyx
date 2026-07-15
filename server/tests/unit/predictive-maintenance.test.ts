import { describe, it, expect } from 'vitest';
import {
  computeEquipmentHealth,
  selectAiCandidates,
  groupMetricsBySerial,
  type EquipmentInput,
  type EquipmentHealth,
} from '../../lib/predictive-maintenance';

const NOW = new Date('2026-07-15T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function baseItem(overrides: Partial<EquipmentInput> = {}): EquipmentInput {
  return {
    equipmentId: 'eq-1',
    serialNumber: 'SN-1',
    make: 'Canon',
    model: 'iR-5000',
    customerName: 'Acme',
    customerId: 'cust-1',
    location: 'HQ',
    meterReading: 1000,
    lastServiceDate: new Date(NOW.getTime() - 30 * DAY),
    nextServiceDue: new Date(NOW.getTime() + 60 * DAY),
    ...overrides,
  };
}

describe('computeEquipmentHealth (CR-026)', () => {
  it('scores a healthy, recently-serviced device at 100 / scheduled / low', () => {
    const h = computeEquipmentHealth(baseItem(), NOW);
    expect(h.healthScore).toBe(100);
    expect(h.urgency).toBe('scheduled');
    expect(h.riskLevel).toBe('low');
    expect(h.estimatedIssues).toBeUndefined();
    expect(h.daysUntilDue).toBe(60);
  });

  it('flags an overdue device as critical and penalizes the score', () => {
    const h = computeEquipmentHealth(
      baseItem({ nextServiceDue: new Date(NOW.getTime() - 10 * DAY) }),
      NOW,
    );
    expect(h.urgency).toBe('overdue');
    expect(h.riskLevel).toBe('critical');
    expect(h.healthScore).toBe(80); // 100 - min(50, 10*2)
    expect(h.estimatedIssues).toContain('10 days overdue');
  });

  it('penalizes stale service and over-meter usage', () => {
    const h = computeEquipmentHealth(
      baseItem({
        lastServiceDate: new Date(NOW.getTime() - 400 * DAY), // 400 days -> -22
        meterReading: 100000, // 2x recommended -> -20
        nextServiceDue: new Date(NOW.getTime() + 60 * DAY),
      }),
      NOW,
    );
    // 100 - min(30,(400-180)/10=22) - min(20,((100000-50000)/50000)*20=20) = 58
    expect(h.healthScore).toBe(58);
    expect(h.estimatedIssues).toContain('Preventive maintenance recommended');
  });

  it('defaults a missing next-service date to 90 days out', () => {
    const h = computeEquipmentHealth(baseItem({ nextServiceDue: null }), NOW);
    expect(h.daysUntilDue).toBe(90);
    expect(h.urgency).toBe('scheduled');
  });
});

describe('selectAiCandidates (CR-026)', () => {
  const mk = (id: string, score: number, serial: string): EquipmentHealth =>
    ({ equipmentId: id, healthScore: score, serialNumber: serial }) as EquipmentHealth;

  it('picks lowest-health devices that have metrics, capped at maxCount', () => {
    const health = [
      mk('a', 90, 'SN-a'),
      mk('b', 20, 'SN-b'),
      mk('c', 50, 'SN-c'),
      mk('d', 10, 'SN-d'),
    ];
    const withMetrics = new Set(['SN-a', 'SN-b', 'SN-c', 'SN-d']);
    const picked = selectAiCandidates(health, (s) => withMetrics.has(s), 2);
    expect(picked.map((h) => h.equipmentId)).toEqual(['d', 'b']); // 10, 20
  });

  it('excludes devices without metrics', () => {
    const health = [mk('a', 5, 'SN-a'), mk('b', 8, 'SN-b')];
    const withMetrics = new Set(['SN-b']);
    const picked = selectAiCandidates(health, (s) => withMetrics.has(s), 10);
    expect(picked.map((h) => h.equipmentId)).toEqual(['b']);
  });

  it('returns nothing when maxCount is 0', () => {
    const health = [mk('a', 5, 'SN-a')];
    expect(selectAiCandidates(health, () => true, 0)).toEqual([]);
  });
});

describe('groupMetricsBySerial (CR-026)', () => {
  it('groups rows by serial and skips null serials, preserving order', () => {
    const rows = [
      { serialNumber: 'SN-1', v: 1 },
      { serialNumber: 'SN-2', v: 2 },
      { serialNumber: 'SN-1', v: 3 },
      { serialNumber: null, v: 4 },
    ];
    const map = groupMetricsBySerial(rows);
    expect(map.get('SN-1')?.map((r) => r.v)).toEqual([1, 3]);
    expect(map.get('SN-2')?.map((r) => r.v)).toEqual([2]);
    expect(map.size).toBe(2);
  });
});
