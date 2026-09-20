/**
 * The CRM core tables are queried by the names they actually have (AUDIT-037).
 *
 * CLAUDE.md has recorded for months that `deals` is queried as deal_value,
 * stage, value, name and closed_at by eight edge functions. Those are not
 * columns - the table has amount, stage_id, title and actual_close_date - so
 * each of those reads was a 42703 and the surface above it showed nothing, or
 * zero, with no way to tell that apart from a quiet day.
 *
 * `business_records` had the same problem from the other direction: a record
 * there is a COMPANY, and the person lives in primary_contact_*. Code written as
 * if it were a person wrote first_name, last_name, email, job_title and
 * linkedin_url, none of which exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Comments are stripped on both sides: several of these files now EXPLAIN the
// old column names in prose, and an absence assertion would read its own
// explanation as the defect.
const fn = (p: string) => stripComments(read(p));

describe('deals is read as amount, stage_id, title and actual_close_date', () => {
  it("today's revenue sums a column that exists", () => {
    const src = fn('supabase/functions/today-dashboard/index.ts');
    expect(src).toMatch(/\.select\('amount'\)/);
    expect(src).toMatch(/gte\('actual_close_date'/);
    expect(src).not.toMatch(/closed_at/);
  });

  it('the pipeline board groups on stage_id, the legacy deal_stages id', () => {
    // COP-M07 deleted supabase/functions/pipeline/, which this used to assert
    // against: six deal_stages reads, no caller in any of the seven client
    // trees, and five phantom columns of its own (stage_name, order_index,
    // probability, is_won, is_closed), so its /stages CRUD could not have
    // worked either. pipeline-config is the canonical surface and always was.
    const src = fn('supabase/functions/pipeline-config/index.ts');
    expect(src).toMatch(/stage_id/);
    expect(src).not.toMatch(/deal_value/);
  });

  it('sales reports compute the weighted value rather than reading it', () => {
    // Nothing stores a weighted value; it is amount x probability.
    const src = fn('supabase/functions/sales-reports/index.ts');
    expect(src).not.toMatch(/weighted_value/);
    expect(src).toMatch(
      /Number\(deal\.amount \?\? 0\) \* Number\(deal\.probability \?\? 0\)\) \/ 100/,
    );
  });

  it('no edge function filters deals on assigned_to_id', () => {
    // WIDENED: this used to name supabase/functions/user-assignments/index.ts,
    // which the lead-assignment consolidation deleted as a duplicate. A
    // property asserted about one file by name stops being enforced the day
    // that file goes, so it is asserted about every deals query in the tree.
    //
    // `deals` has owner_id. assigned_to_id belongs to other tables, so the
    // assertion is scoped to each `.from('deals')` CHAIN rather than to whole
    // files.
    const root = join(repo, 'supabase/functions');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(root);
    // A walk that matches nothing must fail rather than pass in silence.
    expect(files.length).toBeGreaterThan(300);

    const offenders: string[] = [];
    let chainsChecked = 0;
    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      let at = src.indexOf("from('deals')");
      while (at !== -1) {
        const next = src.indexOf('.from(', at + 14);
        const chain = src.slice(at, next === -1 ? Math.min(at + 600, src.length) : next);
        chainsChecked += 1;
        if (/assigned_to_id/.test(chain)) {
          offenders.push(file.slice(root.length + 1));
        }
        at = src.indexOf("from('deals')", at + 14);
      }
    }
    expect(chainsChecked).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it('opportunities read and write the primary_contact_ fields', () => {
    const src = fn('supabase/functions/opportunities/index.ts');
    expect(src).toMatch(/primary_contact_email: deal\.primary_contact_email/);
    expect(src).toMatch(/primary_contact_email: body\.email/);
  });
});

describe('business_records is a company, not a person', () => {
  it('the extension imports a contact into primary_contact_*', () => {
    const src = fn('supabase/functions/chrome-extension/index.ts');
    expect(src).toMatch(/primary_contact_name: \[firstName, lastName\]/);
    expect(src).toMatch(/primary_contact_title: body\.jobTitle/);
    for (const col of ['first_name:', 'last_name:', 'job_title:', 'lead_source:', 'tags:']) {
      expect(src, col).not.toContain(col);
    }
  });

  it('drops the LinkedIn match rather than approximating it', () => {
    // There is no linkedin_url column. Matching a profile against a company
    // name would merge two different people at the same employer.
    const src = fn('supabase/functions/chrome-extension/index.ts');
    expect(src).not.toMatch(/linkedin_url/);
    expect(src).not.toMatch(/matchType: 'linkedinUrl'/);
  });

  it('customers write source and estimated_deal_value', () => {
    const src = fn('supabase/functions/customers/index.ts');
    expect(src).toMatch(/source: body\.leadSource/);
    expect(src).toMatch(/estimated_deal_value: body\.estimatedDealValue/);
    expect(src).not.toMatch(/estimated_amount/);
    expect(src).not.toMatch(/updateData\.tags/);
  });
});
