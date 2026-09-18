/**
 * A deal remembers the lead it came from (WF-S-03).
 *
 * LeadDeals.tsx posted `leadId` and `companyId` from the day it was written and
 * `deals` had neither column. Drizzle iterates the TABLE's columns and picks
 * each one out of the object, and PostgREST rejects or ignores the rest, so the
 * association the whole tab depends on was never stored - a deal created from a
 * lead landed on the board belonging to nobody.
 *
 * THE TAB WAS WORSE THAN THE STORY SAYS. It requested /api/deals?leadId=, which
 * the deals function does not read, so the answer was the tenant's entire deal
 * list - and that answer is `{ data, total, page, limit }` while the useQuery
 * was typed Deal[]. `deals.length === 0` is `undefined === 0`, false, so the
 * render fell through to `deals.map(...)` and threw. The Deals tab on a lead
 * did not show the wrong deals; it crashed, in dev and production alike,
 * because /api/deals is proxied and both hosts return the same envelope.
 */
import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dealStages, deals } from '../../../shared/schema';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const columns = Object.values(getTableColumns(deals)).map((c) => c.name);

describe('the column exists and the old names still do not', () => {
  it('deals has source_business_record_id', () => {
    expect(columns).toContain('source_business_record_id');
  });

  it('it is nullable, so existing deals stay valid', () => {
    const col = Object.values(getTableColumns(deals)).find(
      (c) => c.name === 'source_business_record_id',
    );
    expect(col?.notNull).toBe(false);
  });

  it('deals still has no lead_id or company_id', () => {
    // The point of the story: those are the two keys the page was posting.
    expect(columns).not.toContain('lead_id');
    expect(columns).not.toContain('company_id');
  });

  it('a journaled migration adds it', () => {
    const journal = JSON.parse(read('drizzle/migrations/meta/_journal.json'));
    const tags: string[] = journal.entries.map((e: { tag: string }) => e.tag);
    const owning = tags.filter((tag) =>
      read(`drizzle/migrations/${tag}.sql`).includes('source_business_record_id'),
    );
    expect(owning).toHaveLength(1);
    const sql = read(`drizzle/migrations/${owning[0]}.sql`);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "source_business_record_id"');
    expect(sql).toContain('deals_tenant_source_record_idx');
  });
});

describe('the deals function writes it and filters on it', () => {
  const edge = code('supabase/functions/deals/index.ts');
  const spec = code('supabase/functions/_shared/crm-list-query.ts');

  it('the insert carries the column', () => {
    expect(edge).toContain('source_business_record_id:');
  });

  it('it accepts the key the page has always sent', () => {
    expect(edge).toMatch(/body\.leadId/);
    expect(edge).toMatch(/body\.sourceBusinessRecordId/);
  });

  it('companyId is NOT read as a second identifier', () => {
    // LeadDetail computed it as `lead.companyId || lead.id`, and
    // business_records has no company_id - so it was only ever the lead's own
    // id under another name. Reading it would make a coincidence look like a
    // relationship.
    const insert = edge.slice(edge.indexOf('source_business_record_id:'));
    expect(insert.slice(0, 400)).not.toMatch(/body\.companyId/);
  });

  it('the list filters on the column', () => {
    expect(edge).toContain("eq('source_business_record_id', businessRecordId)");
  });

  it('businessRecordId is a recognised filter key', () => {
    const dealSpec = spec.slice(spec.indexOf('DEAL_LIST_SPEC'));
    expect(dealSpec.slice(0, 2000)).toContain("'businessRecordId'");
  });

  it('leadId is still accepted as an alias, because old bundles send it', () => {
    // The alternative is answering an old bundle with the tenant's whole deal
    // list, which is the defect this story exists to close.
    expect(edge).toContain("url.searchParams.get('leadId')");
  });
});

describe('the Deals tab asks for one lead and survives the answer', () => {
  const tab = code('client/src/components/leads/LeadDeals.tsx');

  it('requests the filter the function reads', () => {
    expect(tab).toContain('/api/deals?businessRecordId=');
    expect(tab).not.toContain('/api/deals?leadId=');
  });

  it('unwraps the paginated envelope instead of mapping over it', () => {
    expect(tab).toContain('extractRecords<Deal>(response)');
    expect(tab).not.toMatch(/return response \|\| \[\];/);
  });

  it('the query key carries the lead, so two leads do not share a cache entry', () => {
    expect(tab).toContain("queryKey: ['/api/deals', { businessRecordId: leadId }]");
  });

  it('posts the column rather than the two that were dropped', () => {
    expect(tab).toContain('sourceBusinessRecordId: leadId');
    expect(tab).not.toMatch(/^\s*leadId: leadId,/m);
    expect(tab).not.toMatch(/^\s*companyId: companyId,/m);
  });

  it('the phantom companyId prop is gone from both sides', () => {
    expect(tab).not.toContain('companyId: string;');
    // `lead.companyId` is not a field at all: business_records has no
    // company_id column, so every read of it resolved to undefined and the
    // fallback was the only branch that ever ran. Both consumers on the page
    // now name what they actually use.
    expect(code('client/src/pages/LeadDetail.tsx')).not.toContain('lead?.companyId');
  });
});

describe('conversion offers the first deal', () => {
  const page = code('client/src/pages/LeadsPage.tsx');

  it('the offer exists and is linked', () => {
    expect(page).toContain('createFirstDealMutation');
    expect(page).toContain('sourceBusinessRecordId: payload.businessRecordId');
  });

  it('sends no stage, so the server resolves one against the tenant', () => {
    // supabase/functions/_shared/deal-stage.ts puts a new deal on the tenant's
    // own front-of-pipeline stage. A slug typed here would write a stage_id
    // belonging to nothing - deal-stages' edge function still answers six
    // hardcoded ids, which is its own story.
    const mutation = page.slice(page.indexOf('createFirstDealMutation'));
    expect(mutation.slice(0, 900)).not.toMatch(/stageId|stage_id/);
  });

  it('an empty amount stays undefined rather than becoming zero', () => {
    // A deal worth nothing and a deal not yet sized are different things, and
    // the forecast sums them.
    expect(page).toContain("dealAmount.trim() === '' ? undefined : Number(dealAmount)");
  });

  it('nothing is created until the rep asks', () => {
    expect(page).toContain('Not yet');
    expect(page).toMatch(/disabled=\{!dealTitle\.trim\(\)/);
  });
});

describe("the stage picker offers the tenant's own stages", () => {
  const fn = code('supabase/functions/deal-stages/index.ts');

  it('the six hardcoded stages are gone', () => {
    // /api/deal-stages is not proxied, so dev read real deal_stages rows while
    // production answered a fixture with ids '1'..'6' - and deals.stage_id
    // references deal_stages.id. COP-M01's resolveStageId is the only reason
    // that never wrote a dangling id: an unrecognised value falls back to the
    // front of the pipeline, so a rep picking "Negotiation" got "Prospecting".
    expect(fn).not.toContain('defaultStages');
    expect(fn).not.toContain("name: 'Prospecting'");
  });

  it("reads the tenant's rows", () => {
    expect(fn).toContain("from('deal_stages')");
    expect(fn).toContain("eq('tenant_id', tenantId)");
  });

  it('invents no probability, because the table has no such column', () => {
    const cols = Object.values(getTableColumns(dealStages)).map((c) => c.name);
    expect(cols).not.toContain('probability');
    expect(fn).not.toContain('probability');
  });

  it('answers an empty list rather than offering stages a deal cannot use', () => {
    // POST /deals replies 400 NO_DEAL_STAGES for a tenant with no pipeline, so
    // the two endpoints agree.
    expect(fn).toContain('data ?? []');
  });
});
