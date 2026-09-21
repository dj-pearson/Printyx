import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { meterReadings } from '@shared/schema';
import {
  buildMeterReadingUpdate,
  METER_READING_EDITABLE_COLUMNS,
  METER_READING_DERIVED_COLUMNS,
  METER_READING_FIELD_MAP,
  METER_READING_REFUSED_COLUMNS,
} from '../../../supabase/functions/_shared/meter-reading-write';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const columnNames = new Set(getTableConfig(meterReadings).columns.map((c) => c.name));

/**
 * `PATCH /meter-readings/:id` mapped five field names onto columns that do not
 * exist - black_count, color_count, black_usage, color_usage, reading_type -
 * while the POST branch twelve lines above carried a comment saying those exact
 * names had been fixed there. An unknown column fails the whole statement, so a
 * PATCH touching any meter value was a 42703 behind a generic 500, and one
 * touching only notes worked, which reads as intermittent rather than broken.
 */
describe('every column this module names is real (round 122)', () => {
  it('resolves the table it claims to write', () => {
    expect(getTableConfig(meterReadings).name).toBe('meter_readings');
    expect(columnNames.size).toBeGreaterThan(30);
  });

  it.each([...METER_READING_EDITABLE_COLUMNS])('%s is a column', (col) => {
    expect(columnNames.has(col)).toBe(true);
  });

  it.each([...METER_READING_DERIVED_COLUMNS])('%s is a column', (col) => {
    expect(columnNames.has(col)).toBe(true);
  });

  it('maps every accepted request spelling onto an editable column', () => {
    const editable = new Set<string>(METER_READING_EDITABLE_COLUMNS);
    const entries = Object.entries(METER_READING_FIELD_MAP);
    expect(entries.length).toBeGreaterThan(20);
    for (const [key, column] of entries) {
      expect(columnNames.has(column), `${key} -> ${column} is not a column`).toBe(true);
      expect(editable.has(column), `${key} -> ${column} is not editable`).toBe(true);
    }
  });

  it('names none of the five phantom columns the old field map used', () => {
    for (const phantom of [
      'black_count',
      'color_count',
      'black_usage',
      'color_usage',
      'reading_type',
    ]) {
      expect(columnNames.has(phantom), `${phantom} is somehow a column now`).toBe(false);
      expect(Object.values(METER_READING_FIELD_MAP)).not.toContain(phantom);
    }
  });

  it('refuses the audit and billing columns rather than merely not mapping them', () => {
    for (const col of ['tenant_id', 'invoice_id', 'billing_status', 'is_verified', 'created_by']) {
      expect(METER_READING_REFUSED_COLUMNS.has(col)).toBe(true);
    }
  });
});

describe('the update plan, against real inputs', () => {
  const stored = {
    bw_meter_reading: 5000,
    color_meter_reading: 1200,
    previous_black_meter: 4000,
    previous_color_meter: 1000,
    black_copies: 1000,
    color_copies: 200,
  };

  it('accepts both spellings of the same column', () => {
    expect(buildMeterReadingUpdate({ notes: 'x' }, stored).plan.notes).toBe('x');
    expect(buildMeterReadingUpdate({ reading_notes: 'y' }, stored).plan.reading_notes).toBe('y');
  });

  it('treats blackCount as the COUNTER, the same as the POST branch does', () => {
    const { plan } = buildMeterReadingUpdate({ blackCount: 5500 }, stored);
    expect(plan.bw_meter_reading).toBe(5500);
    expect(plan.black_count).toBeUndefined();
  });

  it('recomputes the delta when a counter is amended', () => {
    // black_copies DEFAULTS TO 0, so a stale delta is indistinguishable from a
    // month in which the machine printed nothing (COP-B05).
    const { plan } = buildMeterReadingUpdate({ bwMeterReading: 5500 }, stored);
    expect(plan.bw_meter_reading).toBe(5500);
    expect(plan.black_copies).toBe(1500);
  });

  it('recomputes from the amended previous reading too', () => {
    const { plan } = buildMeterReadingUpdate({ previousBlackReading: 4500 }, stored);
    expect(plan.black_copies).toBe(500);
  });

  it('leaves the delta alone when only the notes change', () => {
    const { plan } = buildMeterReadingUpdate({ notes: 'typo' }, stored);
    expect(plan.black_copies).toBeUndefined();
    expect(plan.color_copies).toBeUndefined();
  });

  it('refuses a negative delta and says why', () => {
    // A counter reading lower than its previous is a meter reset or a swapped
    // machine, not negative usage, and a negative page count on an invoice is
    // worse than a blank.
    const { plan, derivationWarnings } = buildMeterReadingUpdate({ bwMeterReading: 100 }, stored);
    expect(plan.bw_meter_reading).toBe(100);
    expect(plan.black_copies).toBeUndefined();
    expect(derivationWarnings.join(' ')).toMatch(/reset|swapped/);
  });

  it('says the delta is underivable when the previous reading is not recorded', () => {
    const { plan, derivationWarnings } = buildMeterReadingUpdate(
      { bwMeterReading: 900 },
      { bw_meter_reading: 800 },
    );
    expect(plan.black_copies).toBeUndefined();
    expect(derivationWarnings.join(' ')).toContain('previous_black_meter');
  });

  it('names what it ignored and what it refused rather than dropping either', () => {
    const out = buildMeterReadingUpdate({ madeUp: 1, tenant_id: 'other', notes: 'ok' }, stored);
    expect(out.ignoredFields).toEqual(['madeUp']);
    expect(out.refusedFields).toEqual(['tenant_id']);
    expect(out.plan).toEqual({ notes: 'ok' });
  });

  it('produces an empty plan when nothing was writable', () => {
    expect(buildMeterReadingUpdate({ madeUp: 1 }, stored).plan).toEqual({});
  });

  it('ignores an explicit undefined rather than writing null over a column', () => {
    // toEqual({}) would pass on { notes: undefined } - PostgREST would then
    // receive the key and null the column, which is the opposite of ignoring it.
    const { plan } = buildMeterReadingUpdate({ notes: undefined }, stored);
    expect(Object.keys(plan)).toEqual([]);
    expect('notes' in plan).toBe(false);
  });
});

describe('the edge function uses it, and gates the amendment paths', () => {
  const src = read('supabase/functions/meter-readings/index.ts');
  const code = stripComments(src);

  it('builds its update through the shared module', () => {
    expect(code).toContain('buildMeterReadingUpdate(');
    expect(code).toContain("from '../_shared/meter-reading-write.ts'");
  });

  it('no longer carries the phantom field map', () => {
    for (const phantom of ["'black_count'", "'color_count'", "'black_usage'", "'color_usage'"]) {
      expect(code).not.toContain(phantom);
    }
    expect(code).not.toMatch(/readingType:\s*'reading_type'/);
  });

  it('answers 400 rather than a 200 that changed nothing', () => {
    const at = code.indexOf('NO_WRITABLE_FIELDS');
    expect(at).toBeGreaterThan(-1);
    // The status is the property, not the code string: a 200 carrying
    // NO_WRITABLE_FIELDS still reports success for a write that did nothing.
    const response = code.slice(at, code.indexOf('req,', at));
    expect(response).toContain('400');
    expect(response).not.toContain('200');
  });

  it('reads the stored row before writing, so a delta can be derived at all', () => {
    const patchAt = code.indexOf("req.method === 'PATCH'");
    const deleteAt = code.indexOf("req.method === 'DELETE'");
    expect(patchAt).toBeGreaterThan(-1);
    const branch = code.slice(patchAt, deleteAt);
    expect(branch).toContain('.maybeSingle()');
    // Bound to the CONDITION, not the message: `if (false)` keeps the string.
    expect(branch).toMatch(/if\s*\(!existing\)\s*\{/);
    expect(branch).toContain("'Meter reading not found'");
    // The read must come before the update, or there is nothing to merge.
    expect(branch.indexOf('.maybeSingle()')).toBeLessThan(branch.indexOf('.update('));
  });

  it.each([
    ["req.method === 'PATCH'", 'amending'],
    ["req.method === 'DELETE'", 'deleting'],
  ])('gates the branch at %s', (marker) => {
    const at = code.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    // Bound to the branch, not to a character window: the next branch header or
    // the trailing 405 is where this one ends.
    const rest = code.slice(at);
    const end = rest.indexOf('Method not allowed');
    const branch = rest.slice(0, end > 0 ? end : rest.length);
    const nextBranch = branch.indexOf("req.method === 'DELETE'", 10);
    const scoped = nextBranch > 0 ? branch.slice(0, nextBranch) : branch;
    expect(scoped).toContain('requireSupervisor()');
    expect(scoped).toContain('denySupervisor(err)');
  });

  it('leaves submitting and reading open, because that is a technician job', () => {
    const postAt = code.indexOf("req.method === 'POST'");
    const patchAt = code.indexOf("req.method === 'PATCH'");
    const postBranch = code.slice(postAt, patchAt);
    expect(postBranch).not.toContain('requireSupervisor()');
    // /meter-readings carries no minLevel in navigation-permissions.ts.
    const nav = read('client/src/lib/navigation-permissions.ts');
    const entry = nav.slice(
      nav.indexOf("'/meter-readings'"),
      nav.indexOf("'/meter-readings'") + 200,
    );
    expect(entry).not.toMatch(/minLevel/);
  });

  it('refuses only an RbacError, so an outage does not read as a role problem', () => {
    expect(code).toContain('err instanceof RbacError');
    expect(code).toContain('INSUFFICIENT_ROLE');
  });
});
