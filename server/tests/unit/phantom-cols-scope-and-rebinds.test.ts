/**
 * Three things from one pass (AUDIT-037).
 *
 * 1. check:phantom-cols resolved a named payload to a same-named variable in a
 *    DIFFERENT function. predictive-failure has `const updates = { … }` in one
 *    handler and, 340 lines later, `async function updatePrediction(admin,
 *    tenantId, id, updates)` doing `.update(updates)` on another table - so five
 *    real columns of predictive_dispatch_settings were reported as phantom
 *    columns of equipment_failure_predictions. Correct code accused. Parameters
 *    are collected as bindings now, so the nearest-preceding rule stops at them.
 *
 * 2. Creating a billing rule 42703'd. It wrote description, conditions, actions,
 *    effective_from and effective_to, dropped the twenty rate and rounding
 *    fields billing-rule-dialog.tsx collects, and never set effective_start_date,
 *    which is NOT NULL.
 *
 * 3. Apollo lead enrichment never ran past its first gate. It read `lead.email`
 *    and business_records has no email column - a record there is a COMPANY and
 *    the person is in primary_contact_*. So every lead returned "no email to
 *    match against", and the phantom columns downstream were never reached.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the guard no longer resolves a payload across a function boundary', () => {
  const guard = read('scripts/check-phantom-columns.ts');

  it('collects parameter names as keyless bindings', () => {
    expect(guard).toContain('function paramNames(');
    expect(guard).toMatch(/declarations\.push\(\{ name, at: open, keys: null \}\)/);
  });

  it('does not use the crude boundary rule that dropped a true finding', () => {
    // Rejecting on any `function` keyword between declaration and call also
    // dropped lead-scoring's genuine phantom columns, which sit behind an
    // unrelated arrow helper. Recorded so it is not reintroduced as a
    // simplification.
    expect(stripComments(guard)).not.toContain('crossesScope');
  });

  it('predictive-failure writes those five to the settings table, which has them', () => {
    const fn = read('supabase/functions/predictive-failure/index.ts');
    expect(fn).toContain("from('predictive_dispatch_settings')");
    const schema = read('shared/predictive-failure-schema.ts');
    for (const col of [
      'agent_enabled',
      'confidence_threshold',
      'paused_at',
      'paused_reason',
      'updated_by_user_id',
    ]) {
      expect(schema).toContain(`'${col}'`);
    }
  });
});

describe('billing rules are creatable', () => {
  const fn = read('supabase/functions/billing/index.ts');
  const code = stripComments(fn);

  it('writes the real columns and not the invented ones', () => {
    for (const col of ['rule_name:', 'rule_description:', 'effective_start_date:', 'bw_rate:']) {
      expect(code).toContain(col);
    }
    for (const col of ['effective_from:', 'effective_to:', 'conditions:', 'actions:']) {
      expect(code).not.toContain(col);
    }
  });

  it('carries the rate fields the dialog collects', () => {
    const dialog = read('client/src/components/billing/billing-rule-dialog.tsx');
    for (const field of [
      'baseCharge',
      'minimumCharge',
      'maximumCharge',
      'bwRate',
      'colorRate',
      'overageMultiplier',
      'roundingMethod',
      'customCalculationFormula',
    ]) {
      expect(dialog).toContain(field);
      expect(code).toContain(field);
    }
  });

  it('refuses rather than letting effective_start_date NOT NULL 500', () => {
    expect(code).toContain("missingRuleFields.push('effectiveStartDate')");
  });
});

describe('Apollo enrichment matches on a column that exists', () => {
  const fn = read('supabase/functions/lead-scoring/handlers/intelligence.ts');
  const code = stripComments(fn);

  it('business_records has no email column, and has primary_contact_email', () => {
    const sql = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const at = sql.indexOf('CREATE TABLE "business_records" (');
    const body = sql.slice(at, sql.indexOf(');', at));
    expect(body).toContain('"primary_contact_email"');
    expect(body).not.toMatch(/\n\t"email"/);
  });

  it('the gate reads the real column', () => {
    expect(code).toContain('lead.primary_contact_email');
    expect(code).not.toMatch(/!lead\.email\b/);
  });

  it('copies into contact columns, not person-shaped ones the table lacks', () => {
    expect(code).toContain("copy('primary_contact_title', 'title')");
    expect(code).toContain('updates.primary_contact_name');
    for (const bad of [
      "copy('first_name'",
      "copy('last_name'",
      "copy('job_title'",
      'linkedin_url',
    ]) {
      expect(code).not.toContain(bad);
    }
  });

  it('surfaces the write error instead of discarding it', () => {
    expect(code).toMatch(/const \{ error: enrichError \}/);
  });
});
