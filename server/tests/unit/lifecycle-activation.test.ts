/**
 * WF-L-08: acceptance starts the contract, records the baseline meter and
 * registers monitoring.
 *
 * `installed -> active` is the moment a machine becomes a serviced, billable
 * asset, and neither host did any of it. The Express state machine's handler
 * opened with `try { log.info('Equipment monitoring activated') } catch` - a log
 * line inside a try/catch with nothing in it that could throw - while the
 * warranty stamp and welcome email beside it were real, which is exactly what
 * made the block read as implemented. US-050 recorded it as "activate
 * monitoring" done. The production edge transition handler did none of the
 * three: it set current_stage, wrote the transition row and returned.
 *
 * So no device was registered, no contract term started, and no baseline meter
 * captured. The first billing cycle counted from zero on a machine that had
 * already printed, and the contract WF-C-09 deliberately leaves un-dated at
 * proposal acceptance stayed un-dated forever.
 *
 * The last block is AC3: it runs the plan's writes against a REAL PostgreSQL and
 * asserts the three rows exist. It skips when no scratch database is offered
 * through WF_L08_TEST_DATABASE_URL, so CI stays green without one; it was run
 * against PostgreSQL 16 for this story and the results are in the story note.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import {
  ACTIVATION_STAGE_FROM,
  ACTIVATION_STAGE_TO,
  normalizeManufacturer,
  planActivation,
  planRetirement,
} from '../../../supabase/functions/_shared/lifecycle-activation';

const NOW = '2026-09-02T12:00:00.000Z';

const unit = (over: Record<string, unknown> = {}) => ({
  equipmentId: 'eq-1',
  tenantId: 'tenant-1',
  serialNumber: 'CNX-11001',
  manufacturer: 'Canon',
  model: 'imageRUNNER C5850i',
  customerId: 'acct-1',
  currentLocation: 'Floor 2',
  ipAddress: '10.0.0.9',
  serviceContractNumber: null,
  ...over,
});

const CANON = { id: 'int-canon', manufacturer: 'canon', is_active: true };

describe('registering the device for monitoring', () => {
  it('registers against the tenant integration for that manufacturer', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [CANON, { id: 'int-hp', manufacturer: 'hp', is_active: true }],
      contracts: [],
      now: NOW,
    });

    expect(plan.deviceRegistration).toMatchObject({
      tenant_id: 'tenant-1',
      integration_id: 'int-canon',
      device_id: 'CNX-11001',
      serial_number: 'CNX-11001',
      ip_address: '10.0.0.9',
      location: 'Floor 2',
      customer_id: 'acct-1',
    });
  });

  it('reports the device as unknown, not online - nothing has heard from it yet', () => {
    const plan = planActivation({ unit: unit(), integrations: [CANON], contracts: [], now: NOW });
    expect(plan.deviceRegistration?.status).toBe('unknown');
  });

  it('will not invent an integration to satisfy the NOT NULL foreign key', () => {
    // device_registrations.integration_id references manufacturer_integrations,
    // which needs a manufacturer, an auth method and credentials. A placeholder
    // would put a fake vendor connection in the integrations list.
    const plan = planActivation({ unit: unit(), integrations: [], contracts: [], now: NOW });
    expect(plan.deviceRegistration).toBeNull();
    expect(plan.skipped.join(' ')).toContain('no active canon integration');
  });

  it('skips an inactive integration and a manufacturer nothing supports', () => {
    expect(
      planActivation({
        unit: unit(),
        integrations: [{ ...CANON, is_active: false }],
        contracts: [],
        now: NOW,
      }).deviceRegistration,
    ).toBeNull();

    const unsupported = planActivation({
      unit: unit({ manufacturer: 'Ricoh' }),
      integrations: [CANON],
      contracts: [],
      now: NOW,
    });
    expect(unsupported.deviceRegistration).toBeNull();
    expect(unsupported.skipped.join(' ')).toContain('Ricoh');
  });

  it('matches free-text manufacturers onto the enum', () => {
    expect(normalizeManufacturer('Konica Minolta')).toBe('konica_minolta');
    expect(normalizeManufacturer('konica-minolta')).toBe('konica_minolta');
    expect(normalizeManufacturer('Hewlett-Packard')).toBe('hp');
    expect(normalizeManufacturer('HP Inc.')).toBe('hp');
    expect(normalizeManufacturer('Ricoh')).toBeNull();
    expect(normalizeManufacturer(null)).toBeNull();
  });

  it('does not re-register a device that already has a registration', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [CANON],
      existingRegistration: { id: 'dev-1', status: 'online' },
      contracts: [],
      now: NOW,
    });
    expect(plan.deviceRegistration).toBeNull();
    expect(plan.skipped.join(' ')).toContain('already registered');
  });
});

describe('starting the contract term', () => {
  it('starts the one contract for this customer that has no start date', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [{ id: 'c-1', contract_number: 'CT-2026-0001', start_date: null }],
      now: NOW,
    });
    expect(plan.contractStart).toEqual({
      id: 'c-1',
      patch: { start_date: NOW, updated_at: NOW },
    });
  });

  it('refuses to choose between two un-started contracts', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [
        { id: 'c-1', contract_number: 'CT-1', start_date: null },
        { id: 'c-2', contract_number: 'CT-2', start_date: null },
      ],
      now: NOW,
    });
    expect(plan.contractStart).toBeNull();
    expect(plan.skipped.join(' ')).toContain('ambiguous');
  });

  it('resolves the ambiguity when the unit names its contract number', () => {
    const plan = planActivation({
      unit: unit({ serviceContractNumber: 'CT-2' }),
      integrations: [],
      contracts: [
        { id: 'c-1', contract_number: 'CT-1', start_date: null },
        { id: 'c-2', contract_number: 'CT-2', start_date: null },
      ],
      now: NOW,
    });
    expect(plan.contractStart?.id).toBe('c-2');
  });

  it('never moves a term that is already running', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [{ id: 'c-1', contract_number: 'CT-1', start_date: '2025-01-01T00:00:00.000Z' }],
      now: NOW,
    });
    expect(plan.contractStart).toBeNull();
    expect(plan.skipped.join(' ')).toContain('already started');
  });

  it('says so when the customer has no contract at all', () => {
    const plan = planActivation({ unit: unit(), integrations: [], contracts: [], now: NOW });
    expect(plan.skipped.join(' ')).toContain('no contract for this customer');
  });

  it('sets the lease first payment date only when it is unset', () => {
    expect(
      planActivation({
        unit: unit(),
        integrations: [],
        contracts: [],
        lease: { id: 'l-1', first_payment_date: null },
        now: NOW,
      }).leaseStart,
    ).toEqual({ id: 'l-1', patch: { first_payment_date: NOW, updated_at: NOW } });

    const already = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [],
      lease: { id: 'l-1', first_payment_date: '2026-01-01T00:00:00.000Z' },
      now: NOW,
    });
    expect(already.leaseStart).toBeNull();
    expect(already.skipped.join(' ')).toContain('already has a first payment date');
  });
});

describe('the baseline meter', () => {
  it('stores what the acceptance form carried', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [{ id: 'c-1', contract_number: 'CT-1', start_date: null }],
      reading: { bwMeterReading: 412, colorMeterReading: 37, readingDate: '2026-09-02' },
      now: NOW,
    });
    expect(plan.baselineReading).toMatchObject({
      tenant_id: 'tenant-1',
      equipment_id: 'eq-1',
      contract_id: 'c-1',
      bw_meter_reading: 412,
      color_meter_reading: 37,
      reading_date: '2026-09-02',
      collection_method: 'manual',
      previous_black_meter: 0,
      black_copies: 0,
    });
  });

  it('NEVER defaults a baseline to zero', () => {
    // A machine arrives having printed its own test pages. A baseline of 0 bills
    // the customer for every one of them on the first cycle.
    const plan = planActivation({ unit: unit(), integrations: [], contracts: [], now: NOW });
    expect(plan.baselineReading).toBeNull();
    expect(plan.skipped.join(' ')).toContain('no meter values');

    const empty = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [],
      reading: { bwMeterReading: null, colorMeterReading: '' },
      now: NOW,
    });
    expect(empty.baselineReading).toBeNull();
  });

  it('accepts a genuine zero on one meter when another is present', () => {
    const plan = planActivation({
      unit: unit(),
      integrations: [],
      contracts: [],
      reading: { bwMeterReading: 100, colorMeterReading: 0 },
      now: NOW,
    });
    expect(plan.baselineReading?.color_meter_reading).toBe(0);
  });
});

describe('retirement is symmetric', () => {
  it('marks the registration offline rather than deleting it', () => {
    // device_metrics references it on delete cascade, and the meter history of a
    // retired machine is what the final invoice is built from.
    expect(planRetirement({ id: 'dev-1', status: 'online' }, NOW).deviceRegistration).toEqual({
      id: 'dev-1',
      patch: { status: 'offline', updated_at: NOW },
    });
  });

  it('says so when there was nothing registered, and is idempotent', () => {
    expect(planRetirement(null, NOW).skipped.join(' ')).toContain('nothing to deactivate');
    expect(planRetirement({ id: 'dev-1', status: 'offline' }, NOW).deviceRegistration).toBeNull();
  });
});

describe('both hosts run it, and US-050 is corrected', () => {
  const strip = (src: string) =>
    src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      })
      .join('\n');

  it('the Express state machine no longer has an empty try/catch for monitoring', () => {
    const src = readFileSync('server/services/equipment-lifecycle-state-machine.ts', 'utf8');
    const code = strip(src);
    expect(code).toContain('runLifecycleActivation(tx, tenantId, equipmentId)');
    expect(code).toContain('runLifecycleRetirement(tx, tenantId, equipmentId)');
    // The exact line this story exists to remove.
    expect(code).not.toContain('Equipment monitoring activated');
    expect(code).not.toContain('Equipment monitoring deactivated');
  });

  it('the edge transition handler runs the same module', () => {
    const code = strip(readFileSync('supabase/functions/equipment-lifecycle/index.ts', 'utf8'));
    expect(code).toContain("from '../_shared/lifecycle-activation.ts'");
    expect(code).toContain('runActivation(admin, tenantId, equipmentId, lifecycle, body)');
    expect(code).toContain('runRetirement(admin, tenantId, lifecycle)');
    // Named rather than silently absent.
    expect(code).toContain('activation,');
  });

  it('the Node driver imports the shared module rather than copying it', () => {
    const code = readFileSync('server/services/lifecycle-activation-effects.ts', 'utf8');
    expect(code).toContain("from '../../supabase/functions/_shared/lifecycle-activation'");
    expect(code).toContain('planActivation(');
    expect(code).toContain('planRetirement(');
  });

  it('the stage names both hosts key off are the same two strings', () => {
    expect(ACTIVATION_STAGE_FROM).toBe('installed');
    expect(ACTIVATION_STAGE_TO).toBe('active');
  });
});

// ── AC3: against a real database ────────────────────────────────────────────
const SCRATCH = process.env.WF_L08_TEST_DATABASE_URL;

describe.skipIf(!SCRATCH)('installed -> active against a scratch database', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;

  beforeAll(async () => {
    const pg = (await import('pg')).default;
    client = new pg.Client({ connectionString: SCRATCH });
    await client.connect();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it('writes the registration, the contract start date and the baseline reading', async () => {
    const { rows: integrations } = await client.query(
      'select id, manufacturer, is_active from manufacturer_integrations where tenant_id = $1',
      ['550e8400-e29b-41d4-a716-446655440000'],
    );
    const { rows: contractRows } = await client.query(
      'select id, contract_number, start_date, lease_id from contracts where customer_id = $1',
      ['acct-1'],
    );

    const plan = planActivation({
      unit: unit({ tenantId: '550e8400-e29b-41d4-a716-446655440000' }),
      integrations,
      contracts: contractRows.map((c: Record<string, unknown>) => ({
        id: String(c.id),
        contract_number: c.contract_number as string,
        start_date: c.start_date ? new Date(c.start_date as string).toISOString() : null,
        lease_id: c.lease_id as string | null,
      })),
      reading: { bwMeterReading: 412, colorMeterReading: 37 },
    });

    expect(plan.deviceRegistration).not.toBeNull();
    expect(plan.contractStart).not.toBeNull();
    expect(plan.baselineReading).not.toBeNull();

    const insert = (table: string, row: Record<string, unknown>) => {
      const cols = Object.keys(row);
      const values = cols.map((_, i) => `$${i + 1}`);
      return client.query(
        `insert into ${table} (${cols.join(', ')}) values (${values.join(', ')})`,
        cols.map((c) => row[c]),
      );
    };

    await insert('device_registrations', plan.deviceRegistration!);
    await client.query('update contracts set start_date = now() where id = $1', [
      plan.contractStart!.id,
    ]);
    await insert('meter_readings', plan.baselineReading!);

    const { rows: registered } = await client.query(
      'select serial_number, status from device_registrations where serial_number = $1',
      ['CNX-11001'],
    );
    expect(registered).toHaveLength(1);
    expect(registered[0].status).toBe('unknown');

    const { rows: started } = await client.query('select start_date from contracts where id = $1', [
      plan.contractStart!.id,
    ]);
    expect(started[0].start_date).not.toBeNull();

    const { rows: baseline } = await client.query(
      'select bw_meter_reading, color_meter_reading from meter_readings where equipment_id = $1',
      ['eq-1'],
    );
    expect(baseline).toHaveLength(1);
    expect(baseline[0].bw_meter_reading).toBe(412);
    expect(baseline[0].color_meter_reading).toBe(37);
  });
});
