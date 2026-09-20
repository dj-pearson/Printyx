/**
 * CRM-008 AC5 on the lead and customer timelines.
 *
 * DealDetail got the type filter when CRM-008 shipped and `ActivityTimeline` -
 * which renders the timeline on BOTH LeadDetail and CustomerDetail - did not.
 * The same story already recorded this shape once (AC8's stage picker was on
 * DealDetail alone), so the bucket vocabulary is a module now and this test
 * holds the two properties that made the split expensive.
 *
 * It also locks the defect underneath the filter: `GET /companies/:id/activities`
 * answered a bare `select('*')`, so every camelCase key the component reads
 * arrived undefined and the timeline rendered blank entries stamped "Unknown
 * time". That is asserted by reading source, because nothing typechecks the
 * edge tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  ACTIVITY_BUCKETS,
  bucketOf,
  bucketTabs,
  filterByBucket,
  isKnownActivityType,
} from '../../../client/src/lib/activity-timeline-filters';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const stripComments = (src: string) =>
  src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const rows = [
  { id: '1', activityType: 'email' },
  { id: '2', activityType: 'call' },
  { id: '3', activityType: 'stage_change' },
  { id: '4', activityType: 'record_updated' },
  { id: '5', activityType: 'churn_prevention' },
  { id: '6', activityType: null },
  { id: '7', activityType: 'note' },
];

describe('activity buckets', () => {
  it('puts each known type in its own tab', () => {
    expect(bucketOf('email')).toBe('email');
    expect(bucketOf('call')).toBe('call');
    expect(bucketOf('meeting')).toBe('meeting');
    expect(bucketOf('note')).toBe('note');
    expect(bucketOf('task')).toBe('task');
  });

  it('groups all three change types under Changes, because AC5 asks for one tab', () => {
    // stage_change comes from sales-pipeline; the record_* pair from customers.
    expect(bucketOf('stage_change')).toBe('change');
    expect(bucketOf('record_created')).toBe('change');
    expect(bucketOf('record_updated')).toBe('change');
  });

  it('sends an unrecognised or missing type to Other rather than dropping it', () => {
    expect(bucketOf('churn_prevention')).toBe('other');
    expect(bucketOf('service_call')).toBe('other');
    expect(bucketOf(null)).toBe('other');
    expect(bucketOf('')).toBe('other');
    expect(bucketOf('   ')).toBe('other');
  });

  it('never loses a row: the named buckets plus Other account for everything', () => {
    const counted = ACTIVITY_BUCKETS.filter((b) => b.id !== 'all').reduce(
      (sum, b) => sum + filterByBucket(rows, b.id).length,
      0,
    );
    expect(counted).toBe(rows.length);
  });

  it('all returns every row, unknown types included', () => {
    expect(filterByBucket(rows, 'all')).toHaveLength(rows.length);
    expect(filterByBucket(rows, 'all').map((r) => r.id)).toContain('5');
  });

  it('isKnownActivityType excludes the buckets that are not types', () => {
    expect(isKnownActivityType('stage_change')).toBe(true);
    expect(isKnownActivityType('demo')).toBe(false);
    expect(isKnownActivityType('all')).toBe(false);
    expect(isKnownActivityType('other')).toBe(false);
  });
});

describe('bucketTabs', () => {
  it('counts each tab off the same list the rows come from', () => {
    const tabs = bucketTabs(rows);
    const byId = Object.fromEntries(tabs.map((t) => [t.id, t.count]));
    expect(byId.all).toBe(7);
    expect(byId.email).toBe(1);
    expect(byId.change).toBe(2);
    expect(byId.other).toBe(2); // churn_prevention + the null type
    expect(byId.task).toBe(0); // a named bucket stays visible at zero
  });

  it('hides Other when nothing is in it, and shows it the moment something is', () => {
    const known = [{ activityType: 'call' }, { activityType: 'note' }];
    expect(bucketTabs(known).map((t) => t.id)).not.toContain('other');
    expect(bucketTabs([...known, { activityType: 'demo' }]).map((t) => t.id)).toContain('other');
  });

  it('keeps the named tabs on an empty record so the vocabulary is still legible', () => {
    const ids = bucketTabs([]).map((t) => t.id);
    expect(ids).toEqual(['all', 'email', 'call', 'meeting', 'note', 'task', 'change']);
  });
});

describe('the timeline renders the filter and the endpoint answers camelCase', () => {
  const timeline = read('client/src/components/ActivityTimeline.tsx');
  const companies = read('supabase/functions/companies/index.ts');

  it('ActivityTimeline maps the FILTERED list, not the raw one', () => {
    expect(timeline).toContain("from '@/lib/activity-timeline-filters'");
    expect(timeline).toContain('filterByBucket(activities, bucket)');
    expect(timeline).toContain('visible.map((activity, index)');
    // The old unfiltered map would make the tabs decoration.
    expect(stripComments(timeline)).not.toContain('activities.map((activity, index)');
  });

  it('the activities GET camelises its rows', () => {
    const branch = companies.slice(
      companies.indexOf(
        "subResource === 'activities'",
        companies.indexOf('// GET /companies/:id/activities'),
      ),
    );
    const upToEnd = branch.slice(0, 2000);
    expect(upToEnd).toContain('.map(toCamelShallow)');
    expect(companies).toContain("import { toCamelShallow } from '../_shared/case.ts'");
  });

  it('camelises SHALLOW, so a jsonb column keeps the keys the customer stored', () => {
    // related_records and attachments are arbitrary jsonb; a deep convert would
    // rewrite their contents.
    expect(companies).not.toContain('.map(toCamel)');
  });

  it('the edit dialog writes call_outcome to its own column', () => {
    const activitiesFn = read('supabase/functions/activities/index.ts');
    expect(activitiesFn).toContain("callOutcome: 'call_outcome'");
    expect(timeline).toContain('updateData.callOutcome = editFormData.callOutcome');
  });

  it('the timeline no longer prints activity contents to the browser console', () => {
    expect(stripComments(timeline)).not.toContain('console.log');
  });
});

/**
 * AC3's "record name (large, editable)".
 *
 * The engine rendered a plain h1, so the one field a rep is most likely to
 * correct - the account or deal name they just typed wrong - was the only thing
 * on the page they could not fix in place. Both names are writable server-side,
 * checked rather than assumed: `company_name` is in the business-record write
 * whitelist and `title` is in the deals PATCH field map, so this is not
 * CRM-008's own "editable field the write path silently drops" defect again.
 */
describe('AC3: the record name is editable in place', () => {
  const engine = read('client/src/components/crm/RecordPageLayout.tsx');
  const leadDetail = read('client/src/pages/LeadDetail.tsx');
  const dealDetail = read('client/src/pages/DealDetail.tsx');
  const writeWhitelist = read('supabase/functions/_shared/business-record-write.ts');
  const dealsFn = read('supabase/functions/deals/index.ts');

  it('the engine edits the title only when the page can persist it', () => {
    expect(engine).toContain('titleField');
    // Both conditions, or a page with no save handler gets a pencil that drops
    // the edit - the rule PropertyRow already applies.
    expect(engine).toContain('titleField && onFieldSave');
  });

  it('both record pages name the field their title maps to', () => {
    expect(leadDetail).toContain('titleField="companyName"');
    expect(dealDetail).toContain('titleField="title"');
  });

  it('and both of those fields are actually writable', () => {
    expect(writeWhitelist).toContain("'company_name'");
    expect(dealsFn).toContain("title: 'title'");
  });
});
