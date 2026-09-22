/**
 * The lead write path (COP-M01).
 *
 * `PUT /leads/:id` spread the request body into PostgREST. Two defects in one
 * line, and the second is the one that matters:
 *
 *  1. Nobody could edit a lead in PRODUCTION. The page sends camelCase,
 *     PostgREST wants column names, so every save was a PGRST204 reported as
 *     "Failed to update lead". Dev worked, because /api/leads is not proxied
 *     and Express goes through Drizzle, which maps field names to columns.
 *
 *  2. The body could set `tenant_id`. The handler's .eq('tenant_id', tenantId)
 *     decides WHICH row the write lands on, not what is written into it.
 *
 * The column list is asserted against Drizzle's own getTableColumns rather than
 * eyeballed, the way integration-service-columns.test.ts does it: a hand-copied
 * list is a phantom column waiting for a schema change.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { businessRecords } from '../../../shared/schema';
import {
  BUSINESS_RECORD_COLUMNS,
  UNWRITABLE_COLUMNS,
  planBusinessRecordWrite,
} from '../../../supabase/functions/_shared/business-record-write';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const realColumns = new Set(
  Object.values(getTableColumns(businessRecords)).map((c) => (c as { name: string }).name),
);

describe('the column list is the table, not a copy of it', () => {
  it('names every business_records column and no others', () => {
    expect([...BUSINESS_RECORD_COLUMNS].sort()).toEqual([...realColumns].sort());
  });

  it('every unwritable column is a real column', () => {
    // A typo here silently permits the thing it was meant to forbid.
    for (const column of UNWRITABLE_COLUMNS) expect(realColumns, column).toContain(column);
  });
});

describe('a body cannot rewrite the row it is editing', () => {
  it('refuses tenant_id, in either spelling', () => {
    for (const key of ['tenant_id', 'tenantId']) {
      const plan = planBusinessRecordWrite({ [key]: 'other-tenant', companyName: 'Acme' });
      expect(plan.update.tenant_id, key).toBeUndefined();
      expect(plan.refusedFields, key).toContain(key);
    }
  });

  it('refuses the id, which would be a move rather than an edit', () => {
    const plan = planBusinessRecordWrite({ id: 'somebody-elses', notes: 'hi' });
    expect(plan.update.id).toBeUndefined();
    expect(plan.refusedFields).toContain('id');
  });

  it('refuses provenance and the conversion audit trail', () => {
    // created_by and converted_by say who did something. A caller asserting it
    // happened is not the same as it having happened.
    const plan = planBusinessRecordWrite({
      createdBy: 'me',
      convertedBy: 'me',
      deactivatedBy: 'me',
      createdAt: '2019-01-01',
    });
    expect(Object.keys(plan.update)).toHaveLength(0);
    expect(plan.refusedFields.sort()).toEqual(
      ['convertedBy', 'createdAt', 'createdBy', 'deactivatedBy'].sort(),
    );
  });

  it('refuses updated_at, because the handler sets it', () => {
    // Accepting one would let a caller backdate the edit.
    expect(planBusinessRecordWrite({ updatedAt: '2001-01-01' }).refusedFields).toContain(
      'updatedAt',
    );
  });
});

describe('both spellings resolve, because the tree sends both', () => {
  it('maps camelCase to its column', () => {
    const { update } = planBusinessRecordWrite({
      companyName: 'Acme',
      primaryContactEmail: 'a@b.c',
      addressLine1: '2100 Fleur Dr',
      postalCode: '50321',
    });
    expect(update).toEqual({
      company_name: 'Acme',
      primary_contact_email: 'a@b.c',
      address_line1: '2100 Fleur Dr',
      postal_code: '50321',
    });
  });

  it('passes a column name through untouched', () => {
    expect(planBusinessRecordWrite({ company_name: 'Acme' }).update).toEqual({
      company_name: 'Acme',
    });
  });

  it('handles the four fields whose name is not its column camelised', () => {
    // Each of these would camelise to nothing and be dropped in silence, so the
    // field would simply never save and nothing would say why.
    expect(planBusinessRecordWrite({ estimatedAmount: 5 }).update).toEqual({
      estimated_deal_value: 5,
    });
    expect(planBusinessRecordWrite({ estimatedDealValue: 5 }).update).toEqual({
      estimated_deal_value: 5,
    });
    expect(planBusinessRecordWrite({ leadSource: 'referral' }).update).toEqual({
      source: 'referral',
    });
    expect(planBusinessRecordWrite({ churnReason: 'pricing' }).update).toEqual({
      deactivation_reason: 'pricing',
    });
    expect(planBusinessRecordWrite({ billingPostalCode: '50321' }).update).toEqual({
      billing_zip_code: '50321',
    });
  });

  it('handles a run of capitals', () => {
    expect(planBusinessRecordWrite({ slaLevel: 'gold', taxId: '12-3' }).update).toEqual({
      sla_level: 'gold',
      tax_id: '12-3',
    });
  });
});

describe('what it drops, it says', () => {
  it('reports a key that matches no column', () => {
    // COP-B06: a fallback that quietly narrows a write turns a renamed field
    // into data loss that reports success.
    const plan = planBusinessRecordWrite({ companyName: 'Acme', favouriteColour: 'blue' });
    expect(plan.update).toEqual({ company_name: 'Acme' });
    expect(plan.ignoredFields).toEqual(['favouriteColour']);
  });

  it('separates refused from ignored, because they are different facts', () => {
    // "you may not set this" and "this is not a field" need different answers.
    const plan = planBusinessRecordWrite({ tenantId: 'x', nonsense: 'y' });
    expect(plan.refusedFields).toEqual(['tenantId']);
    expect(plan.ignoredFields).toEqual(['nonsense']);
  });

  it('keeps an explicit null, which is how a field is cleared', () => {
    expect(planBusinessRecordWrite({ notes: null }).update).toEqual({ notes: null });
  });

  it('drops undefined without reporting it', () => {
    // An absent key is not an attempted write.
    const plan = planBusinessRecordWrite({ notes: undefined });
    // toEqual treats an undefined-valued key as absent, so it passes either
    // way - the mutation that deleted the skip survived it. Ask for the key.
    expect(Object.keys(plan.update)).toEqual([]);
    expect(plan.ignoredFields).toEqual([]);
  });
});

describe('the handler uses it, and answers rather than no-ops', () => {
  const src = read('supabase/functions/leads/index.ts')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  it('the PUT branch plans the write instead of spreading the body', () => {
    expect(src).toContain('planBusinessRecordWrite(body)');
    expect(src).not.toMatch(/\.update\(\s*\{\s*\.\.\.body/);
  });

  it('an empty plan is a 400, not a 200 that changed nothing', () => {
    // A body of entirely unknown keys would otherwise bump updated_at and
    // report success - the shape Drizzle's silent key-dropping already causes
    // on the server side (CLAUDE.md, batches 26-27).
    expect(src).toContain("code: 'NO_WRITABLE_FIELDS'");
  });

  it('the response carries what was dropped', () => {
    expect(src).toContain('ignoredFields');
    expect(src).toContain('refusedFields');
  });
});
