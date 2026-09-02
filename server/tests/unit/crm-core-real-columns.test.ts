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
import { readFileSync } from 'node:fs';
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

  it('assignments filter deals on owner_id', () => {
    // Scoped to the deals query: `leads` and the assignment table do have an
    // assigned_to_id, so a whole-file assertion would be wrong.
    const src = fn('supabase/functions/user-assignments/index.ts');
    const at = src.indexOf("from('deals')");
    const chain = src.slice(at, at + 400);
    expect(at).toBeGreaterThan(-1);
    expect(chain).toMatch(/eq\('owner_id', userId\)/);
    expect(chain).not.toMatch(/assigned_to_id/);
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
