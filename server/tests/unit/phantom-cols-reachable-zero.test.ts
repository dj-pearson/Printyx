/**
 * No REACHABLE edge function names a column its table does not have (AUDIT-037).
 *
 * The phantom-column baseline had been read as one undifferentiated pile of
 * debt. Split by reachability it is not: after the blog_posts table split took
 * it from 195 to 77, every remaining entry but fourteen sat in an edge function
 * that `check:unreferenced-edge-fns` already records as callable by nothing - no
 * client tree, no proxy alias, no cron, no cross-function fetch.
 *
 * That distinction is the whole point of this test. A 42703 in a function
 * something calls is a 500 a person sees; the same line in a function nothing
 * calls is a latent defect in code that does not run. Those fourteen were the
 * ones worth fixing, and several were the only thing the endpoint did:
 *
 *   customers could not raise a service request (customer_service_requests has
 *   submitted_at and no created_at); a company could not be created (companies
 *   has no email); a vendor could not be created (the column is vendor_notes);
 *   a phone-in ticket could not be logged (urgency_level, not priority); a
 *   project could not be created from a template (projects has no template_id);
 *   stopping a task timer never moved the total (actual_hours in HOURS, not
 *   time_tracked in minutes); and the platform CSM list came back empty for
 *   every tenant, because the assignment is on platform_business_records rather
 *   than on a health score.
 *
 * This asserts the property, not the count: a new entry in a reachable function
 * fails, and one in an unreachable function does not - which is the trade this
 * baseline is making, stated out loud.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/**
 * Comments stripped before matching. Every fix below carries a comment naming
 * the column it removed, so an absence assertion run over the raw file reports
 * its own explanation as the defect - which is what happened on the first run
 * of this test, for four of its cases at once.
 */
const code = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const phantom = JSON.parse(read('docs/phantom-columns-baseline.json')).allowed as string[];
const unreferenced = new Set<string>(
  JSON.parse(read('docs/unreferenced-edge-fns-baseline.json')).unreferenced,
);

/** The edge function directory an entry belongs to, if it is in one. */
function fnOf(entry: string): string | null {
  return /^supabase\/functions\/([^/]+)\//.exec(entry)?.[1] ?? null;
}

describe('the baseline holds nothing a caller can reach', () => {
  it('every entry is in an edge function nothing calls', () => {
    const reachable = phantom.filter((entry) => {
      const fn = fnOf(entry);
      return !fn || !unreferenced.has(fn);
    });
    expect(reachable).toEqual([]);
  });

  /**
   * IT REACHED ZERO, so this is the hard gate the line above prescribed.
   *
   * The floor that used to stand here read `expect(phantom.length)
   * .toBeGreaterThan(0)` with a comment saying that if the baseline ever
   * emptied, the reachability assertion would pass vacuously and should be
   * replaced by a gate at zero. AUDIT-037's last nine rebindings emptied it,
   * so the floor started failing on the success state - which is the right
   * moment to follow the instruction rather than relax it.
   *
   * `npm run check:phantom-cols` is now a hard gate: any new reference, in a
   * reachable function or not, fails rather than being tolerated. The
   * reachability split above is kept because it is what makes a future
   * regression legible - if somebody baselines one again, it says whether
   * anybody can reach it.
   */
  it('is empty, so check:phantom-cols is a hard gate rather than a ratchet', () => {
    expect(phantom).toEqual([]);
  });
});

describe('the fixes that mattered', () => {
  const cases: Array<[string, string, string]> = [
    // file, what must be there now, what must not
    ['supabase/functions/vendors/index.ts', 'vendor_notes:', '        notes: body.notes || null,'],
    ['supabase/functions/pipeline-forecast/index.ts', 'target_count', 'target_value'],
    ['supabase/functions/platform-cs/index.ts', "from('platform_business_records')", ''],
    ['supabase/functions/tasks/handlers/time-entries.ts', 'actual_hours', 'time_tracked'],
    ['supabase/functions/templates/index.ts', 'instantiatedFromTemplateId', 'template_id:'],
  ];

  it.each(cases)('%s', (file, present, absent) => {
    const src = code(file);
    expect(src).toContain(present);
    if (absent) expect(src).not.toContain(absent);
  });

  it('a customer can raise a service request again', () => {
    // customer_service_requests has submitted_at and updated_at and NO
    // created_at, so this insert 42703'd and the portal's one write failed.
    // Scoped to that insert: customer_supply_orders a few hundred lines below
    // is a different table and does have created_at.
    const src = code('supabase/functions/customer-portal/index.ts');
    const at = src.indexOf('urgency_notes:');
    expect(at).toBeGreaterThan(-1);
    const insert = src.slice(at, src.indexOf('};', at));
    expect(insert).toContain('submitted_at:');
    expect(insert).not.toContain('created_at:');
  });

  it('converts minutes to hours rather than storing sixty times the effort', () => {
    // The unit changes with the column: this handler counts MINUTES and
    // actual_hours is hours.
    const src = code('supabase/functions/tasks/handlers/time-entries.ts');
    expect(src).toContain('deltaMinutes / 60');
  });

  it('keeps phone-in urgency in one column, under two names', () => {
    const src = code('supabase/functions/phone-in-tickets/index.ts');
    expect(src).toContain('urgency_level:');
    // `priority` survives as a RESPONSE key because callers read it; it must
    // not come back as a column.
    expect(src).not.toMatch(/^\s*priority: body\.priority/m);
    expect(src).not.toContain('t.priority');
  });

  it('does not map a lot-tracking flag onto the serial-tracking one', () => {
    // is_serialized is a different question - a serial per unit, not a lot per
    // batch - so inventory_items keeps only the column it has.
    const src = code('supabase/functions/inventory/index.ts');
    expect(src).not.toContain('is_lot_tracked:');
    expect(src).toContain('is_serialized:');
  });
});

describe('the two functions a person can actually reach', () => {
  it('handoff-tasks writes task_name and assigned_to', () => {
    const src = code('supabase/functions/handoff-tasks/index.ts');
    expect(src).toContain('task_name:');
    expect(src).toContain('assigned_to:');
    // handoff_tasks declares no foreign key, so PostgREST cannot embed either
    // of these - and `users` has first_name/last_name, not full_name.
    expect(src).not.toContain('assignee:assignee_id');
    expect(src).not.toContain('handoff:handoff_id');
    expect(src).not.toContain('full_name)');
  });

  it('auto-supply-replenishment treats its rules table as the settings it is', () => {
    const src = code('supabase/functions/auto-supply-replenishment/index.ts');
    // Eleven per-product names, none of them a column on a per-tenant settings
    // row. They are reported back rather than written nowhere.
    expect(src).toContain('PER_PRODUCT_FIELDS');
    expect(src).toContain('settingsColumns(body)');
    expect(src).not.toContain('.update({ ...body,');
  });

  it('its /check derives from inventory_items, which has its own reorder point', () => {
    const src = code('supabase/functions/auto-supply-replenishment/index.ts');
    expect(src).toContain("from('inventory_items')");
    // PostgREST cannot compare two columns, so the comparison happens in the
    // handler - a filter string here would be a lie.
    expect(src).toContain('onHand > reorderAt');
    expect(src).not.toMatch(/from\('inventory'\)/);
  });

  it('and says so when it has no bands to apply', () => {
    const src = code('supabase/functions/auto-supply-replenishment/index.ts');
    expect(src).toContain("unbacked: ['urgency']");
  });
});
