/**
 * Delivery and installation scheduling (WF-L-06).
 *
 * WF-L-02 built list and create for delivery_schedules and
 * installation_schedules. What a dispatcher spends the day doing - assigning a
 * driver and a vehicle, moving a window, marking a run complete, seeing what a
 * crew is due to do - had no endpoint at all. delivery_schedules had one
 * Express writer with no caller; installation_schedules had no reader and no
 * writer anywhere in the repository; the Delivery tab said "will be implemented
 * here".
 *
 * And supabase/functions/scheduling read `appointments`, a table with no
 * schema, no migration and no writer - so did today-dashboard, which the iOS
 * app calls. `.data` came back null, `|| []` turned that into an empty list,
 * and the Today screen has shown zero appointments for every tenant since it
 * shipped.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDeliveryUpdate,
  buildInstallationUpdate,
  dayBounds,
  deliveryRequirements,
  mergeCrewDay,
  SCHEDULE_STATUSES,
} from '../../../supabase/functions/_shared/delivery-scheduling.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('updating a schedule', () => {
  it('maps camelCase and snake_case onto the real columns', () => {
    const update = buildDeliveryUpdate({ driverId: 'd-1', time_window: 'morning' });
    expect(update).toMatchObject({ driver_id: 'd-1', time_window: 'morning' });
  });

  it('refuses a body with nothing it can write', () => {
    // `{ ...body }` at PostgREST fails the whole statement on one unknown key,
    // so unknown keys are dropped and an empty result is an error rather than a
    // silent no-op that reports success.
    expect(buildDeliveryUpdate({ nonsense: 1 })).toEqual({ error: 'No known field to update' });
  });

  it('refuses a status outside the vocabulary', () => {
    const result = buildDeliveryUpdate({ status: 'teleported' });
    expect('error' in result && result.error).toContain('status must be one of');
    expect(buildDeliveryUpdate({ status: 'in_transit' })).toMatchObject({ status: 'in_transit' });
    expect(SCHEDULE_STATUSES).toContain('cancelled');
  });

  it('will not re-point a booked run at another unit or customer', () => {
    // Changing which unit a scheduled delivery is for is a new schedule, not an
    // edit, so these are absent from the field map rather than validated.
    expect(buildDeliveryUpdate({ equipmentId: 'e-2', driverId: 'd-1' })).not.toHaveProperty(
      'equipment_id',
    );
    expect(buildDeliveryUpdate({ customerId: 'c-2', driverId: 'd-1' })).not.toHaveProperty(
      'customer_id',
    );
    expect(buildDeliveryUpdate({ tenantId: 'other', driverId: 'd-1' })).not.toHaveProperty(
      'tenant_id',
    );
  });

  it('stamps updated_at on every write', () => {
    expect(buildInstallationUpdate({ technicianId: 't-1' })).toHaveProperty('updated_at');
  });

  it('an installation moves its own fields, not a delivery driver', () => {
    expect(buildInstallationUpdate({ driverId: 'd-1' })).toEqual({
      error: 'No known field to update',
    });
    expect(buildInstallationUpdate({ preInstallationChecklist: [] })).toMatchObject({
      pre_installation_checklist: [],
    });
  });
});

describe("the crew's day", () => {
  const delivery = { id: 'd1', time_window: '09:00', status: 'scheduled', driver_id: 'u1' };
  const install = { id: 'i1', estimated_duration: 90, status: 'scheduled', technician_id: 'u1' };

  it('merges two tables that name the same three ideas differently', () => {
    const items = mergeCrewDay([delivery], [install]);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.kind === 'delivery')?.assignedTo).toBe('u1');
    expect(items.find((i) => i.kind === 'installation')?.assignedTo).toBe('u1');
  });

  it('shows an install duration where a delivery shows its window', () => {
    // An install has no window column; showing the duration in the same slot
    // beats showing nothing.
    expect(mergeCrewDay([], [install])[0].window).toBe('90 min');
  });

  it('sorts unwindowed work LAST, not to midnight', () => {
    const items = mergeCrewDay(
      [{ id: 'a' }, { ...delivery, id: 'b', time_window: '08:00' }],
      [install],
    );
    expect(items.map((i) => i.id)).toEqual(['b', 'i1', 'a']);
  });

  it('handles a day with nothing on it', () => {
    expect(mergeCrewDay([], [])).toEqual([]);
  });
});

describe('day bounds', () => {
  it('snaps to a UTC day and leaves the upper bound exclusive', () => {
    // scheduled_date holds a calendar date at UTC midnight (DATE-LOCAL-002), so
    // an inclusive 23:59:59.999 is a real timestamp a row can exceed.
    const { from, to } = dayBounds(new Date('2026-09-18T17:42:11Z'));
    expect(from).toBe('2026-09-18T00:00:00.000Z');
    expect(to).toBe('2026-09-19T00:00:00.000Z');
  });
});

describe('the evidence WF-L-13 will check', () => {
  it('a dated, live delivery satisfies delivery_scheduled', () => {
    expect(deliveryRequirements({ scheduled_date: '2026-09-18', status: 'scheduled' })).toEqual([
      'delivery_scheduled',
    ]);
  });

  it('a cancelled one satisfies nothing, however well dated', () => {
    expect(deliveryRequirements({ scheduled_date: '2026-09-18', status: 'cancelled' })).toEqual([]);
  });

  it('driver_assigned means a driver is ON THE ROW', () => {
    expect(deliveryRequirements({ scheduled_date: '2026-09-18', driver_id: null })).not.toContain(
      'driver_assigned',
    );
    expect(deliveryRequirements({ scheduled_date: '2026-09-18', driver_id: 'u1' })).toContain(
      'driver_assigned',
    );
  });

  it('answers nothing for a delivery that is not there', () => {
    expect(deliveryRequirements(null)).toEqual([]);
  });
});

describe('the appointments phantom is gone', () => {
  it('deletes the scheduling function, which read nothing else', () => {
    expect(existsSync(join(repo, 'supabase/functions/scheduling'))).toBe(false);
  });

  it("today-dashboard reads the real tables a dealer's day is made of", () => {
    const src = code('supabase/functions/today-dashboard/index.ts');
    expect(src).toContain("from('delivery_schedules')");
    expect(src).toContain("from('installation_schedules')");
    expect(src).not.toContain("from('appointments')");
  });

  it('and merges them with the same helper the crew view uses', () => {
    // Two derivations of "what is on today" would drift.
    expect(code('supabase/functions/today-dashboard/index.ts')).toContain('mergeCrewDay(');
  });
});

describe('both hosts run the same handler', () => {
  const edge = code('supabase/functions/equipment-lifecycle/index.ts');
  const proxy = read('server/middleware/edge-function-proxy.ts');

  it('the edge function serves PATCH for both schedules and a crew view', () => {
    expect(edge).toContain("req.method === 'PATCH' && firstPart === 'deliveries'");
    expect(edge).toContain("req.method === 'PATCH' && firstPart === 'installations'");
    expect(edge).toContain("firstPart === 'crew'");
  });

  it('the seven paths this story and WF-L-02 own are proxied', () => {
    for (const seg of [
      'deliveries',
      'installations',
      'crew',
      'metrics',
      'lifecycle',
      'assets',
      'purchase-orders',
    ]) {
      // Round 158: covered by the whole-prefix entry, and served by the edge.
      expect(proxy, seg).toMatch(/'\/api\/equipment-lifecycle':\s*'equipment-lifecycle'/);
      expect(edge, seg).toContain(`'${seg}'`);
    }
  });

  it('and the whole prefix, once the transition router was retired (round 158)', () => {
    expect(proxy).toMatch(/'\/api\/equipment-lifecycle':\s*'equipment-lifecycle'/);
  });

  it('scopes the crew day to the caller by default', () => {
    expect(edge).toContain("url.searchParams.get('all') !== 'true'");
    expect(edge).toContain("eq('driver_id', user.id)");
    expect(edge).toContain("eq('technician_id', user.id)");
  });

  it('writes each query out in full so check:phantom-cols can follow it', () => {
    // A reassigned query variable and a chain returned from a lambda both lose
    // the guard: it read the scoped filter as installation_schedules.driver_id.
    expect(edge).not.toContain('let deliveryQuery');
    expect(edge).not.toContain('deliveriesBase()');
    // The mine and all-of-tenant branches are written out separately, so each
    // .from() is followed by its own filters.
    const crew = edge.slice(edge.indexOf("firstPart === 'crew'"));
    expect(crew.match(/from\('delivery_schedules'\)/g) ?? []).toHaveLength(2);
    expect(crew.match(/from\('installation_schedules'\)/g) ?? []).toHaveLength(2);
  });
});

describe('the Delivery tab', () => {
  const page = code('client/src/pages/WarehouseOperations.tsx');

  it('no longer says it will be implemented', () => {
    expect(page).not.toContain('Delivery scheduling interface will be implemented here');
  });

  it('is bound to columns delivery_schedules has', () => {
    // requiredAccessories, deliveryTeam, installationRequired and
    // installationDate have no column there - an install is its own row.
    expect(page).toContain('driverId: z.string().optional()');
    expect(page).not.toContain('installationRequired: z.boolean()');
    expect(page).not.toContain('deliveryTeam: z.array');
  });

  it('the technician surface shows the same crew day', () => {
    // MobileFieldService is the routed technician-facing page. The endpoint
    // scopes by driver_id and technician_id off the verified JWT, so there is
    // nothing to filter client-side and nothing a caller can ask for on
    // someone else's behalf.
    const tech = code('client/src/pages/MobileFieldService.tsx');
    expect(tech).toContain("'/api/equipment-lifecycle/crew'");
  });

  it('calls the list, the create, the assign and the crew view', () => {
    expect(page).toContain("'/api/equipment-lifecycle/deliveries'");
    expect(page).toContain("'/api/equipment-lifecycle/crew'");
    expect(page).toContain("'PATCH', { driverId }");
  });
});
