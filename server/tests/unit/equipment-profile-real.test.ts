import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { machineLabel, warrantyState } from '@/components/CustomerEquipmentProfile';
import { toServiceHistory } from '@shared/service-history';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PROFILE = strip(read('client/src/components/CustomerEquipmentProfile.tsx'));
const HUB = strip(read('client/src/pages/ServiceHub.tsx'));
const HEALTH = strip(read('client/src/components/customer-portal/EquipmentHealthDashboard.tsx'));
const PORTAL = strip(read('client/src/pages/CustomerSelfServicePortal.tsx'));
const MAINT = strip(
  read('client/src/components/customer-portal/MaintenanceSchedulingComponent.tsx'),
);
const EXPRESS = strip(read('server/routes-mobile-api.ts'));

describe('customer equipment profile reads the customer (round 224)', () => {
  it('asks for this customer, and for the selected machine history', () => {
    expect(PROFILE).toMatch(/queryKey: \[`\/api\/customers\/\$\{customerId\}\/equipment`\]/);
    expect(PROFILE).toMatch(/enabled: isOpen && !!customerId/);
    expect(PROFILE).toMatch(/queryKey: \[`\/api\/equipment\/\$\{equipmentId\}\/service-history`\]/);
    for (const s of ['CAN001234567', 'John Smith', 'imageRUNNER', 'Schedule']) {
      expect(PROFILE).not.toContain(s);
    }
  });

  it('ServiceHub no longer invents a customer id for a ticket without one', () => {
    expect(HUB).not.toContain('default-customer');
    expect(HUB).toMatch(/customerId=\{selectedCustomerId\}/);
  });

  it('warranty with no expiry is unknown, not expired', () => {
    const now = new Date('2026-09-24T00:00:00Z');
    expect(warrantyState(null, now)).toBe('unknown');
    expect(warrantyState('junk', now)).toBe('unknown');
    expect(warrantyState('2027-01-01', now)).toBe('active');
    expect(warrantyState('2025-01-01', now)).toBe('expired');
    expect(machineLabel({ id: 'x' })).toBe('Unnamed machine');
    expect(machineLabel({ id: 'x', manufacturer: 'Canon', modelNumber: 'C5540i' })).toBe(
      'Canon C5540i',
    );
  });

  it('dev answers the same history shape production does, Date objects included', () => {
    expect(EXPRESS).toMatch(/res\.json\(toServiceHistory\(tickets\)\)/);
    const [entry] = toServiceHistory([
      {
        id: 't1',
        status: 'completed',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]);
    expect(entry.date).toBe('2026-01-03T00:00:00.000Z');
    expect(entry.isOpen).toBe(false);
  });
});

describe('portal Schedule Service goes to scheduling with the machine (round 224)', () => {
  it('the health card hands the machine to the portal, and offers nothing without a handler', () => {
    expect(HEALTH).toMatch(/\{onScheduleService && \(/);
    expect(HEALTH).toMatch(/onClick=\{\(\) => onScheduleService\(selectedEquipmentData\.id\)\}/);
  });

  it('the portal switches tab and preselects that machine on the booking form', () => {
    expect(PORTAL).toMatch(/setActiveTab\('maintenance-scheduling'\)/);
    expect(PORTAL).toMatch(
      /<MaintenanceSchedulingComponent equipmentId=\{scheduleEquipmentId\} \/>/,
    );
    const defaults = MAINT.slice(
      MAINT.indexOf('defaultValues: {'),
      MAINT.indexOf('},', MAINT.indexOf('defaultValues: {')),
    );
    expect(defaults).toMatch(/\bequipmentId,/);
  });
});
