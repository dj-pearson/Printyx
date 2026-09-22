/**
 * The unwired renewal-management feature's four edge functions wrote columns
 * their own schema does not have (SEC-EDGE-001 batch 16).
 *
 * AUDIT-026 already triaged the feature: `shared/renewal-management-schema.ts`
 * plus `server/routes-renewal-management.ts` is a complete renewal model that
 * was never wired to a screen, sitting beside a different renewal model that
 * was. Connecting or retiring it is a product call. What was NOT a product call
 * is that the Express half wrote real columns through Drizzle while the edge
 * half - the one production resolves these prefixes to - named columns that do
 * not exist, so every create, update and ordered list was a guaranteed
 * PGRST204 or 42703.
 *
 * Nothing typechecks the edge tree, so these read the source. Assertions are
 * bound to individual query CHAINS rather than to files, and comments are
 * stripped first because each fix's header names the phantom columns it removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const FUNCTIONS = join(ROOT, 'supabase/functions');

function stripComments(source: string): string {
  return source.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const read = (fn: string) => stripComments(readFileSync(join(FUNCTIONS, fn, 'index.ts'), 'utf8'));

describe('renewal_activities is written by its real column names', () => {
  const SRC = read('renewal-activities');

  it('has a corpus to check', () => {
    expect(SRC).toContain("from('renewal_activities')");
    expect(SRC.length).toBeGreaterThan(1000);
  });

  it('names none of the five phantom columns', () => {
    // Anchored on a word boundary: `subject:` is a substring of
    // `activity_subject:`, so a bare toContain would report the FIX as the
    // defect. Same trap the repo has hit with grep assertions three times.
    for (const phantom of [
      'subject',
      'description',
      'performed_by_id',
      'scheduled_at',
      'completed_at',
    ]) {
      expect(SRC).not.toMatch(new RegExp(`(^|[^a-z_])${phantom}:`, 'm'));
    }
  });

  it('writes activity_subject, activity_description, performed_by and activity_date', () => {
    for (const real of [
      'activity_subject:',
      'activity_description:',
      'performed_by:',
      'activity_date:',
    ]) {
      expect(SRC).toContain(real);
    }
  });

  it('drops the embed that could not resolve', () => {
    // The FK column is performed_by, not performed_by_id, and `users` has
    // first_name/last_name. An embed that cannot resolve fails the whole query.
    expect(SRC).not.toContain('full_name');
  });
});

describe('expansion_opportunities is written by its real column names', () => {
  const SRC = read('expansion-opportunities');

  it('names none of the nine phantom columns', () => {
    for (const phantom of [
      'potential_value',
      'actual_value',
      'won_at',
      'lost_at',
      'lost_reason',
      'full_name',
    ]) {
      expect(SRC).not.toContain(phantom);
    }
    // `products:` is a substring of `proposed_products:` and `probability:` of
    // nothing here, but both are anchored for the same reason.
    for (const phantom of ['products', 'probability']) {
      expect(SRC).not.toMatch(new RegExp(`(^|[^a-z_])${phantom}:`, 'm'));
    }
  });

  it('orders the list by a column that exists', () => {
    const at = SRC.indexOf("from('expansion_opportunities')");
    expect(at).toBeGreaterThan(-1);
    expect(SRC.slice(at, at + 600)).toContain("order('estimated_arr'");
  });

  it('closes an opportunity with closed_at, actual_revenue and outcome_notes', () => {
    expect(SRC).toContain("status: 'won'");
    expect(SRC).toContain("status: 'lost'");
    expect(SRC).toContain('actual_revenue:');
    expect(SRC).toContain('outcome_notes:');
    expect(SRC).toContain('closed_at:');
  });

  it('refuses a title rather than dropping it into another column', () => {
    // There is no title column. COP-B06: a write that quietly narrows what it
    // stores turns a schema mismatch into invisible data loss.
    expect(SRC).toContain('UNSTORABLE_FIELD');
  });

  it('coerces a numeric probability into the confidence vocabulary and says so', () => {
    // confidence_level is low|medium|high, not a number.
    expect(SRC).toMatch(/function confidenceFrom/);
    expect(SRC).toContain("return { value: 'high', coerced: true }");
    expect(SRC).toContain("return { value: 'medium', coerced: true }");
    expect(SRC).toContain("return { value: 'low', coerced: true }");
  });
});

describe('renewal_playbooks recommends honestly', () => {
  const SRC = read('renewal-playbooks');

  it('uses playbook_name and trigger_conditions on every write, not just the sort', () => {
    // A bare toContain('playbook_name') is satisfied by the ORDER BY alone, so
    // reverting the INSERT to `name:` survived it. Check each write chain.
    expect(SRC).toContain("order('playbook_name'");
    expect(SRC).not.toContain('risk_levels:');

    const writes = [SRC.indexOf('.insert({'), SRC.indexOf('.update(')];
    expect(writes.every((at) => at > -1)).toBe(true);
    for (const at of writes) {
      const chain = SRC.slice(at, at + 900);
      expect(chain).toContain('playbook_name:');
      expect(chain).toContain('trigger_conditions');
      expect(chain).not.toMatch(/(^|[^a-z_])name:/m);
    }
  });

  it('never falls back to the first row as a recommendation', () => {
    // `p.risk_levels?.includes(...)` was undefined on every row, so find()
    // never matched and `|| playbooks?.[0]` returned whichever playbook came
    // back first under the key recommendedPlaybook - arbitrary selection
    // wearing matching logic's clothes.
    expect(SRC).not.toMatch(/playbooks\?\.\[0\]/);
    expect(SRC).toContain('recommendationBasis');
    expect(SRC).toContain("'none'");
  });

  it('matches on the risk levels inside trigger_conditions', () => {
    expect(SRC).toMatch(/trigger_conditions\?\.riskLevels/);
    expect(SRC).toContain('includes(renewal.risk_level)');
  });
});

describe('superseded duplicates are gone', () => {
  it('deleted the three unreferenced, unrunnable copies', () => {
    // projects-enhanced was a GET+POST subset of the full-CRUD `projects`
    // function over the same table. `roles` and `role-management` both filtered
    // the GLOBAL roles table on tenant_id, a column it does not have, so every
    // branch of both was a 42703 - and `rbac` already serves the reads off
    // enhanced_roles, which does have one.
    for (const fn of ['projects-enhanced', 'roles', 'role-management']) {
      expect(existsSync(join(FUNCTIONS, fn))).toBe(false);
    }
  });

  it('kept the reachable implementations they duplicated', () => {
    for (const fn of ['projects', 'rbac']) {
      expect(existsSync(join(FUNCTIONS, fn, 'index.ts'))).toBe(true);
    }
    // rbac reads enhanced_roles, which is tenant-scoped; that is why it works
    // and the two deleted ones could not.
    expect(read('rbac')).toContain("from('enhanced_roles')");
  });
});
