/**
 * CRM-008 AC6: counts on a record page's associated-record tabs.
 *
 * The count is the whole risk here, not the rendering. Three of the four lists
 * behind those tabs apply `applyUserScope` on their own columns, so a count
 * taken over tenant plus the association column tells a rep "Deals 7" above a
 * list of three - a real count of the wrong set, which COP-I01 records as
 * harder to spot than an invented number. And a count that FAILED must render
 * as nothing rather than 0, because "Quotes 0" is a claim about the record.
 *
 * Asserted by reading source: nothing typechecks the edge tree, and the scope
 * columns are strings in a call, invisible to tsc on both sides.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const stripComments = (src: string) =>
  src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const crmFn = read('supabase/functions/crm/index.ts');
const dealsFn = read('supabase/functions/deals/index.ts');
const proposalsFn = read('supabase/functions/proposals/index.ts');
const quotesFn = read('supabase/functions/quotes/index.ts');
const leadDetail = read('client/src/pages/LeadDetail.tsx');
const dealDetail = read('client/src/pages/DealDetail.tsx');

/** The record-counts branch alone, so an assertion cannot drift into a neighbour. */
function countsBranch(): string {
  const start = crmFn.indexOf("subRoute === 'record-counts'");
  expect(start).toBeGreaterThan(-1);
  const next = crmFn.indexOf('if (req.method ===', start + 10);
  return crmFn.slice(start, next > start ? next : start + 4000);
}

describe('GET /crm/record-counts', () => {
  const branch = countsBranch();

  it('refuses without a record id rather than counting the whole tenant', () => {
    expect(branch).toContain('MISSING_RECORD_ID');
  });

  it('counts with head requests, so no rows cross the wire', () => {
    expect(branch).toContain("{ count: 'exact', head: true }");
  });

  it('filters every count by tenant AND by the association column', () => {
    expect(branch).toContain(".eq('tenant_id', tenantId)");
    expect(branch).toContain('.eq(column, recordId)');
  });

  it('answers null for a failed count, never 0', () => {
    expect(branch).toContain('return error ? null : (count ?? null)');
    expect(branch).not.toContain('?? 0');
  });

  it('scopes each table on the SAME columns its list scopes on', () => {
    // deals list: applyUserScope(query, ['owner_id', 'created_by_id'], scope)
    expect(dealsFn).toContain("applyUserScope(query, ['owner_id', 'created_by_id'], scope)");
    expect(branch).toContain(
      "countOfScoped('deals', 'source_business_record_id', ['owner_id', 'created_by_id'])",
    );

    // proposals list: applyUserScope(query, ['assigned_to', 'created_by'], scope)
    expect(proposalsFn).toContain("applyUserScope(query, ['assigned_to', 'created_by'], scope)");
    expect(branch).toContain(
      "countOfScoped('proposals', 'business_record_id', ['assigned_to', 'created_by'])",
    );

    // quotes list: applyUserScope(query, 'created_by', scope) - WF-R-05, margin.
    expect(quotesFn).toContain("applyUserScope(query, 'created_by', scope)");
    expect(branch).toContain("countOfScoped('quotes', 'lead_id', 'created_by')");
  });

  it('leaves contacts unscoped, matching the list that has no user scope', () => {
    expect(branch).toContain("countOfScoped('company_contacts', 'company_id', null)");
    // /companies/:id/contacts filters on tenant + company only.
    const companiesFn = read('supabase/functions/companies/index.ts');
    const contactsRead = companiesFn.slice(
      companiesFn.indexOf("subResource === 'contacts'"),
      companiesFn.indexOf("subResource === 'contacts'") + 700,
    );
    expect(contactsRead).not.toContain('applyUserScope');
  });

  it('says which scope the numbers were taken under', () => {
    // A narrowed total that does not say it was narrowed is a wrong number.
    expect(branch).toContain('scopeTier: scope.tier');
    expect(branch).toContain('coversWholeTenant: scope.userIds === null');
  });
});

describe('the tabs render those counts', () => {
  it('LeadDetail asks the counts endpoint once, not four lists', () => {
    expect(leadDetail).toContain("queryKey: ['/api/crm/record-counts', id]");
    expect(leadDetail).toContain('/api/crm/record-counts?recordId=');
  });

  it('every one of the four tabs carries its count', () => {
    for (const key of ['contacts', 'deals', 'proposals', 'quotes']) {
      expect(leadDetail).toContain(`countBadge(counts?.counts.${key})`);
    }
  });

  it('renders nothing rather than 0 while loading or when a count failed', () => {
    expect(leadDetail).toContain("typeof value === 'number'");
    expect(stripComments(leadDetail)).not.toContain('counts?.counts.contacts ?? 0');
  });

  it("DealDetail's quote tab withholds its count when the link column is missing", () => {
    // The endpoint answers data:[] at 200 with an `unbacked` line when
    // migration 0088 is absent; 0 there would be a claim about the deal.
    expect(dealDetail).toContain('dealQuotesQuery.data?.unbacked?.length ?? 0) === 0');
    expect(dealDetail).toContain('dealQuoteCount !== null');
  });
});

/**
 * The two AC deviations, locked rather than left in prose.
 *
 * AC3 lists the header quick actions and AC9 describes the compose area as a
 * tabbed input. DealDetail matches both literally. LeadDetail reaches the same
 * capabilities differently - a header row aimed at its own workflow, with Email
 * and Task on the timeline compose row instead. That is a deliberate call and
 * this is what stops it becoming an accidental one: if somebody removes
 * LeadDetail's route to logging an email or a task, the capability is gone from
 * that page entirely and this fails.
 */
describe('AC3/AC9 deviations are deliberate, and the capability exists on both pages', () => {
  it('DealDetail carries the literal quick-action set', () => {
    for (const label of ['Log activity', 'Add note', 'Create task', 'Email', 'Call']) {
      expect(dealDetail).toContain(`label: '${label}'`);
    }
  });

  it('DealDetail has the inline compose area AC9 describes', () => {
    expect(dealDetail).toContain('composeType');
    expect(dealDetail).toContain('setComposeBody');
  });

  it('LeadDetail can still log every one of those types, from the timeline row', () => {
    for (const key of ['note', 'call', 'email', 'meeting', 'task']) {
      expect(leadDetail).toContain(`openDialog('${key}')`);
    }
  });

  it('and its header keeps a quick action of its own, so the row is not the only path', () => {
    expect(leadDetail).toContain("label: 'Log activity'");
  });
});
