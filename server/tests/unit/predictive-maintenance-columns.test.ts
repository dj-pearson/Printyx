/**
 * The predictive maintenance hub can load, and stops claiming savings nobody
 * measured (AUDIT-037).
 *
 * /predictive-maintenance-hub is routed and the prefix is proxied, so this ran
 * on both hosts - and never worked on either. Its equipment select named make,
 * model, location, current_meter_reading and status. The columns are
 * manufacturer, model_number, location_description and equipment_status, and
 * equipment has NO meter column at all: readings live in meter_readings.
 * PostgREST rejects a whole select on one bad name, so the error branch fired
 * on every request.
 *
 * Scheduling was worse than a rename. service_tickets has no ticket_type, and
 * customer_id, ticket_number and created_by are all NOT NULL - none of which
 * the insert set, so it was a 42703 that would have been a 23502 three times
 * over.
 *
 * FOUR HEADLINE FIGURES WERE DELETED RATHER THAN REPAIRED: preventableEmergencies
 * was devicesAtRisk * 0.7, downtimePreventedHours was that * 4, costSavings was
 * that * 200, and uptimeImprovement was built on all three. Every coefficient
 * was typed in. Nothing here records whether an at-risk device became an
 * emergency, how long one lasted, or what it cost.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const FN = read('supabase/functions/predictive-maintenance/index.ts');
const PAGE = read('client/src/pages/PredictiveMaintenanceHub.tsx');
const stripComments = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the equipment reads name real columns', () => {
  it('the migration says which they are', () => {
    const sql = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const at = sql.indexOf('CREATE TABLE "equipment" (');
    const body = sql.slice(at, sql.indexOf(');', at));
    for (const col of [
      'manufacturer',
      'model_number',
      'location_description',
      'equipment_status',
    ]) {
      expect(body).toContain(`"${col}"`);
    }
    for (const col of ['make', 'location', 'current_meter_reading', 'status']) {
      expect(body).not.toContain(`\n\t"${col}"`);
    }
  });

  it('no select or filter uses the old names', () => {
    const code = stripComments(FN);
    for (const bad of ["'status'", 'current_meter_reading']) {
      expect(code).not.toContain(bad);
    }
    expect(code).not.toMatch(/select\([^)]*\bmake\b/);
    expect(code).toContain("eq('equipment_status', 'active')");
  });

  it('the meter term comes from meter_readings, and is null when absent', () => {
    const code = stripComments(FN);
    expect(code).toContain("from('meter_readings')");
    expect(code).toContain('bw_meter_reading');
    // A device with no reading contributes no term - zero pages and never-read
    // are different facts.
    expect(code).toMatch(/meterByEquipment\.get\([^)]*\) \?\? null/);
    expect(code).toContain('meterReading !== null && meterReading > recommendedPages');
  });
});

describe('scheduling writes a ticket the table accepts', () => {
  const code = stripComments(FN);

  it('sets every NOT NULL column', () => {
    for (const col of ['customer_id:', 'ticket_number:', 'created_by:', 'title:']) {
      expect(code).toContain(col);
    }
  });

  it('does not write ticket_type, which is not a column', () => {
    expect(code).not.toContain('ticket_type');
    const sql = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const at = sql.indexOf('CREATE TABLE "service_tickets" (');
    const body = sql.slice(at, sql.indexOf(');', at));
    expect(body).not.toContain('"ticket_type"');
    for (const col of ['customer_id', 'ticket_number', 'created_by']) {
      expect(body).toMatch(new RegExp(`"${col}" varchar NOT NULL`));
    }
  });

  it('refuses rather than inventing a customer when equipment has none', () => {
    expect(code).toContain('Equipment has no customer');
  });
});

describe('the invented savings figures are gone from both ends', () => {
  const NAMES = [
    'preventableEmergencies',
    'downtimePreventedHours',
    'costSavings',
    'uptimeImprovement',
  ];

  it.each(NAMES)('%s is no longer computed', (name) => {
    // Absence of the CALCULATION, not of the word. The endpoint still names all
    // four in its unbacked array, so banning the bare string would fail on the
    // honest half of the fix - the first version of this test did exactly that.
    expect(stripComments(FN)).not.toMatch(new RegExp(`const ${name}\\s*=`));
  });

  it.each(NAMES)('%s is no longer rendered', (name) => {
    // Comments first: the page explains the removal in prose.
    expect(stripComments(PAGE)).not.toContain(name);
  });

  it('the endpoint names them as unbacked instead', () => {
    const at = FN.indexOf('unbacked:');
    expect(at).toBeGreaterThan(-1);
    const arr = FN.slice(at, FN.indexOf('],', at));
    for (const name of NAMES) expect(arr).toContain(name);
  });
});
