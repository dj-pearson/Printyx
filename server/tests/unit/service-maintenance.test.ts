/**
 * PROD-011 — pure logic behind the `service` edge function's
 * proactive-maintenance half (supabase/functions/service/maintenance.ts).
 *
 * Worth noting what these tests are: the Express original has NEVER executed
 * (its SELECT names columns that do not exist, so the endpoint 500s), so this is
 * the first time any of this scoring has been exercised at all.
 */

import { describe, it, expect } from 'vitest';
import {
  NEVER_SERVICED_DAYS,
  buildMaintenanceItem,
  daysSinceService,
  estimatedIssues,
  healthScore,
  nextDueDate,
  proactiveTicketNumber,
  summarize,
  urgencyFor,
  type MaintenanceItem,
} from '../../../supabase/functions/service/maintenance';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');
const DAY = 86_400_000;

describe('daysSinceService', () => {
  it('counts whole days since the last service', () => {
    expect(daysSinceService(new Date(NOW - 30 * DAY).toISOString(), NOW)).toBe(30);
  });

  it('uses the never-serviced sentinel for a missing or unparseable date', () => {
    expect(daysSinceService(null, NOW)).toBe(9999);
    expect(daysSinceService(undefined, NOW)).toBe(9999);
    expect(daysSinceService('not a date', NOW)).toBe(9999);
    expect(NEVER_SERVICED_DAYS).toBe(9999);
  });

  it('the sentinel is large enough to saturate the time-since-service penalty', () => {
    // That is the whole point of it: no record of service is scored as the worst
    // case, not as freshly serviced. A small sentinel would score an unserviced
    // machine at full health.
    expect(healthScore(45, NEVER_SERVICED_DAYS)).toBe(70);
    expect(healthScore(45, NEVER_SERVICED_DAYS)).toBe(healthScore(45, 480));
  });
});

describe('nextDueDate', () => {
  it('uses the stored due date when present', () => {
    const due = nextDueDate('2026-09-01T00:00:00.000Z', NOW);
    expect(due.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('falls back to 90 days out when absent or unparseable', () => {
    expect(nextDueDate(null, NOW).getTime()).toBe(NOW + 90 * DAY);
    expect(nextDueDate('garbage', NOW).getTime()).toBe(NOW + 90 * DAY);
  });
});

describe('healthScore', () => {
  it('is 100 for equipment that is neither overdue nor long unserviced', () => {
    expect(healthScore(45, 30)).toBe(100);
  });

  it('penalises 2 points per overdue day, capped at 50', () => {
    expect(healthScore(-5, 0)).toBe(90);
    expect(healthScore(-25, 0)).toBe(50);
    expect(healthScore(-1000, 0)).toBe(50);
  });

  it('penalises time since service only past 180 days, capped at 30', () => {
    expect(healthScore(45, 180)).toBe(100);
    expect(healthScore(45, 280)).toBe(90);
    expect(healthScore(45, 9999)).toBe(70);
  });

  it('applies both penalties together', () => {
    expect(healthScore(-25, 9999)).toBe(20);
  });

  it('never leaves [0, 100]', () => {
    expect(healthScore(-100000, 100000)).toBeGreaterThanOrEqual(0);
    expect(healthScore(1000, 0)).toBe(100);
  });

  it('returns a whole number', () => {
    expect(Number.isInteger(healthScore(45, 185))).toBe(true);
  });
});

describe('urgencyFor', () => {
  it('buckets by days until due', () => {
    expect(urgencyFor(-1)).toBe('overdue');
    expect(urgencyFor(1)).toBe('urgent');
    expect(urgencyFor(7)).toBe('urgent');
    expect(urgencyFor(8)).toBe('soon');
    expect(urgencyFor(30)).toBe('soon');
    expect(urgencyFor(31)).toBe('scheduled');
  });

  it('treats due TODAY as overdue, not urgent', () => {
    // Zero slack left, so it belongs with the late ones. This boundary decides
    // which tab of the dashboard a machine lands in.
    expect(urgencyFor(0)).toBe('overdue');
  });
});

describe('estimatedIssues', () => {
  it('escalates the wording as the score drops', () => {
    expect(estimatedIssues(85, 45)).toEqual([]);
    expect(estimatedIssues(70, 45)).toEqual(['Minor adjustments may be needed']);
    expect(estimatedIssues(50, 45)).toEqual(['Preventive maintenance recommended']);
    expect(estimatedIssues(30, 45)).toEqual(['High risk of failure']);
  });

  it('adds an overdue line with the absolute day count', () => {
    expect(estimatedIssues(90, -12)).toEqual(['12 days overdue']);
  });

  it('emits at most one severity line plus the overdue line', () => {
    expect(estimatedIssues(30, -12)).toEqual(['High risk of failure', '12 days overdue']);
  });
});

describe('buildMaintenanceItem', () => {
  const row = {
    id: 'eq-1',
    serial_number: 'SN-100',
    manufacturer: 'Canon',
    model_number: 'iR-ADV C5560',
    customer_id: 'cust-1',
    location_description: '3rd floor copy room',
    last_service_date: new Date(NOW - 200 * DAY).toISOString(),
    next_service_due_date: new Date(NOW - 10 * DAY).toISOString(),
    equipment_status: 'active',
  };

  it('assembles the camelCase shape the dashboard types', () => {
    const item = buildMaintenanceItem(row, 'Acme Dental', NOW);
    expect(item.equipmentId).toBe('eq-1');
    expect(item.serialNumber).toBe('SN-100');
    expect(item.make).toBe('Canon');
    expect(item.model).toBe('iR-ADV C5560');
    expect(item.customerName).toBe('Acme Dental');
    expect(item.location).toBe('3rd floor copy room');
    expect(item.daysSinceService).toBe(200);
    expect(item.daysUntilDue).toBe(-10);
    expect(item.urgency).toBe('overdue');
    expect(item.healthScore).toBe(78);
    expect(item.estimatedIssues).toEqual(['Minor adjustments may be needed', '10 days overdue']);
  });

  it('reports meterReading as null, never 0', () => {
    // There is no meter column on equipment. Reporting 0 would read as a
    // brand-new machine; null says "not known", which is the truth.
    expect(buildMaintenanceItem(row, 'Acme', NOW).meterReading).toBeNull();
  });

  it('substitutes the Express placeholder strings for missing fields', () => {
    const item = buildMaintenanceItem({ id: 'eq-2' }, null, NOW);
    expect(item.serialNumber).toBe('N/A');
    expect(item.make).toBe('Unknown');
    expect(item.model).toBe('Unknown');
    expect(item.customerName).toBe('Unknown Customer');
    expect(item.location).toBe('Unknown');
    expect(item.customerId).toBeNull();
  });

  it('omits estimatedIssues entirely when there are none', () => {
    const healthy = {
      id: 'eq-3',
      last_service_date: new Date(NOW - 5 * DAY).toISOString(),
      next_service_due_date: new Date(NOW + 60 * DAY).toISOString(),
    };
    const item = buildMaintenanceItem(healthy, 'Acme', NOW);
    expect(item.healthScore).toBe(100);
    expect('estimatedIssues' in item).toBe(false);
  });

  it('emits an ISO due date even when the row had none', () => {
    const item = buildMaintenanceItem({ id: 'eq-4' }, null, NOW);
    expect(item.nextServiceDue).toBe(new Date(NOW + 90 * DAY).toISOString());
    expect(item.daysUntilDue).toBe(90);
  });
});

describe('summarize', () => {
  const item = (urgency: MaintenanceItem['urgency'], health: number): MaintenanceItem =>
    ({ urgency, healthScore: health }) as MaintenanceItem;

  it('counts each urgency bucket', () => {
    const out = summarize([
      item('overdue', 40),
      item('overdue', 30),
      item('urgent', 70),
      item('soon', 80),
      item('scheduled', 100),
    ]);
    expect(out.totalEquipment).toBe(5);
    expect(out.overdueCount).toBe(2);
    expect(out.urgentCount).toBe(1);
    expect(out.soonCount).toBe(1);
    expect(out.scheduledCount).toBe(1);
  });

  it('rounds the average health score', () => {
    expect(summarize([item('soon', 90), item('soon', 85)]).averageHealthScore).toBe(88);
  });

  it('reports 100 average and zero counts for an empty fleet', () => {
    const out = summarize([]);
    expect(out.totalEquipment).toBe(0);
    expect(out.averageHealthScore).toBe(100);
    expect(out.preventableEmergencies).toBe(0);
  });

  it('estimates preventable emergencies as 70% of sub-60 machines, floored', () => {
    // The one number here with no observation behind it — an estimate carried
    // over from Express, not a count of anything that happened.
    expect(summarize([item('overdue', 50)]).preventableEmergencies).toBe(0);
    expect(summarize([item('overdue', 50), item('overdue', 30)]).preventableEmergencies).toBe(1);
    expect(
      summarize([item('overdue', 50), item('overdue', 30), item('soon', 59), item('soon', 100)])
        .preventableEmergencies,
    ).toBe(2);
  });

  it('uses a strict cutoff at 60', () => {
    expect(
      summarize(Array.from({ length: 10 }, () => item('soon', 60))).preventableEmergencies,
    ).toBe(0);
  });
});

describe('proactiveTicketNumber', () => {
  it('is the PM- prefix plus an uppercase base36 timestamp', () => {
    expect(proactiveTicketNumber(1754575200000)).toBe(
      `PM-${(1754575200000).toString(36).toUpperCase()}`,
    );
    expect(proactiveTicketNumber(NOW)).toMatch(/^PM-[0-9A-Z]+$/);
  });
});
