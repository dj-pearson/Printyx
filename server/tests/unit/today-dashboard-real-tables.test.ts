/**
 * WF-L-06 fixed one query in supabase/functions/today-dashboard and left five.
 *
 * That function is what the iOS app's Today screen calls
 * (ios/Printyx/Core/Network/APIEndpoint.swift:305). It read `activities`,
 * `leads` and `deal_desk_requests` - none of which is a table in any schema -
 * embedded `users.full_name`, which is not a column, and filtered tasks on
 * `status = 'pending'`, which is not a value the task writers ever store. Every
 * one of those errors was discarded, so the screen showed an empty, quiet day.
 *
 * Nothing typechecks the edge tree, so these assertions read the source. They
 * are bound to individual QUERY CHAINS rather than to the file, because a
 * file-wide grep passes while the wrong chain carries the right text - the
 * mutant that unscoped one query in COP-I06 survived exactly that shape.
 *
 * COMMENTS ARE STRIPPED FIRST: the fix's own header names every phantom table
 * it removed, so an absence assertion over the raw file would clear itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const SRC = readFileSync(join(ROOT, 'supabase/functions/today-dashboard/index.ts'), 'utf8');

/** Line and block comments removed; the `https://` lookbehind keeps URLs intact. */
function stripComments(source: string): string {
  return source.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CODE = stripComments(SRC);

/**
 * Every PostgREST chain in the file, keyed by table. A chain runs from
 * `.from('x')` to the first `)` that closes the statement - approximated here
 * as the next `.from(` or the end, which is enough because each chain is one
 * statement and they never nest.
 */
function chainsOn(table: string): string[] {
  const out: string[] = [];
  const marker = `.from('${table}')`;
  let at = CODE.indexOf(marker);
  while (at !== -1) {
    const next = CODE.indexOf('.from(', at + marker.length);
    out.push(CODE.slice(at, next === -1 ? CODE.length : next));
    at = CODE.indexOf(marker, at + marker.length);
  }
  return out;
}

describe('today-dashboard queries real tables', () => {
  it('has a corpus to check', () => {
    // A walk that matches nothing must fail rather than pass in silence.
    expect(CODE.length).toBeGreaterThan(1000);
    expect(CODE).toContain('export default async function handler');
  });

  it('names no table that does not exist', () => {
    for (const phantom of ['activities', 'leads', 'deal_desk_requests', 'appointments']) {
      expect(chainsOn(phantom)).toHaveLength(0);
    }
  });

  it('embeds no users.full_name', () => {
    // `users` has first_name/last_name. The embed took the whole activity
    // query down with it, so the feed was empty rather than merely unnamed.
    expect(CODE).not.toContain('full_name');
  });

  it('reads activity from business_record_activities', () => {
    const chains = chainsOn('business_record_activities');
    expect(chains).toHaveLength(1);
    expect(chains[0]).toContain("eq('tenant_id', tenantId)");
    expect(chains[0]).toContain('activity_type');
    expect(chains[0]).toContain('limit(10)');
  });

  it('reads pending approvals from approval_requests with the vocabulary deal-desk writes', () => {
    const chains = chainsOn('approval_requests');
    expect(chains).toHaveLength(1);
    expect(chains[0]).toContain("in('status', ['pending', 'in_review'])");
    expect(chains[0]).toContain("eq('tenant_id', tenantId)");
  });

  it("counts new leads as business_records of record_type 'lead'", () => {
    const chains = chainsOn('business_records');
    expect(chains).toHaveLength(1);
    expect(chains[0]).toContain("eq('record_type', 'lead')");
    expect(chains[0]).toContain("eq('tenant_id', tenantId)");
    // A calendar day is two bounds. One bound counts every lead ever created
    // after midnight today, which on an empty morning looks identical.
    expect(chains[0]).toContain("gte('created_at', todayIso)");
    expect(chains[0]).toContain("lt('created_at', tomorrowIso)");
  });
});

describe('today-dashboard task queries', () => {
  it('uses the status vocabulary the task writers store', () => {
    // shared/schema.ts: status defaults to 'todo'; the values are
    // todo/in_progress/completed/cancelled. 'pending' is none of them.
    const decl = CODE.match(/OUTSTANDING_TASK_STATUSES\s*=\s*\[([^\]]*)\]/);
    expect(decl).not.toBeNull();
    const values = decl![1]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    expect(values).toContain('todo');
    expect(values).toContain('in_progress');
    expect(values).not.toContain('completed');
    expect(values).not.toContain('cancelled');
    expect(values).not.toContain('pending');
  });

  it('filters today by an AND of two day bounds, not an OR', () => {
    const chains = chainsOn('tasks');
    expect(chains).toHaveLength(2);
    const today = chains.find((c) => c.includes("gte('due_date'"));
    expect(today).toBeDefined();
    // `.or()` is a DISJUNCTION: "due >= today OR due < tomorrow" is true of
    // every task with a due date at all, so it read as a day filter and was
    // not one.
    expect(today).not.toContain('.or(');
    expect(today).toContain("gte('due_date', todayIso)");
    expect(today).toContain("lt('due_date', tomorrowIso)");
    expect(today).toContain("in('status', OUTSTANDING_TASK_STATUSES)");
  });

  it('counts overdue as due before today and still outstanding', () => {
    const overdue = chainsOn('tasks').find((c) => !c.includes("gte('due_date'"));
    expect(overdue).toBeDefined();
    expect(overdue).toContain("lt('due_date', todayIso)");
    expect(overdue).toContain("in('status', OUTSTANDING_TASK_STATUSES)");
  });

  it('snaps both bounds to a UTC day rather than the host local midnight', () => {
    // DATE-LOCAL-002: tasks.due_date holds a calendar date at UTC midnight, so
    // a bound built from setHours(0,0,0,0) is off by the host's offset.
    expect(CODE).toContain('startOfUtcDay(now)');
    expect(CODE).toContain('startOfNextUtcDay(now)');
    expect(CODE).not.toContain('setHours(0, 0, 0, 0)');
  });
});

describe('today-dashboard reports what it could not load', () => {
  it('counts a failed family as null rather than zero', () => {
    // A 0 is a measurement: it says the day is empty. A family whose read
    // failed has not measured anything.
    expect(CODE).toMatch(/taskCount:\s*countOf\(tasks\)/);
    expect(CODE).toMatch(/overdueCount:\s*countOf\(overdueTasks\)/);
    expect(CODE).toMatch(/pendingApprovalCount:\s*countOf\(pendingApprovals\)/);
    expect(CODE).toMatch(/newLeads:\s*countOf\(newLeads\)/);
    expect(CODE).toMatch(/rows === null \? null : rows\.length/);
  });

  it('names the failed families on the response', () => {
    expect(CODE).toMatch(/degraded\.push\(name\)/);
    expect(CODE).toMatch(/\n\s*degraded,\n/);
  });
});

/**
 * Same defect class, one function over, found by the same grep.
 *
 * `parts-orders` embedded `vendor:vendor_id (id, name)` on the list and
 * `ordered_by_user:ordered_by (id, full_name, email)` on the detail. `vendors`
 * has vendor_name and no name; `parts_orders` has no ordered_by column at all
 * (COP-M01 recorded that and the embed survived it); `users` has
 * first_name/last_name. So the list answered 500 and the detail answered
 * "Parts order not found" - an error that reads as a missing row rather than a
 * broken query.
 */
describe('parts-orders embeds resolve', () => {
  const PARTS = stripComments(
    readFileSync(join(ROOT, 'supabase/functions/parts-orders/index.ts'), 'utf8'),
  );

  it('has a corpus to check', () => {
    expect(PARTS).toContain("from('parts_orders')");
  });

  it('embeds no phantom column', () => {
    expect(PARTS).not.toContain('full_name');
    expect(PARTS).not.toContain('ordered_by_user');
    expect(PARTS).not.toMatch(/vendor:vendor_id\s*\(\s*id,\s*name\s*\)/);
  });

  it('keeps the vendor join only where the FK column exists', () => {
    // parts_orders.vendor_id is real, so `vendor:vendor_id (*)` resolves; the
    // list needs no join at all because the table carries vendor_name.
    expect(PARTS).toContain("select('*, vendor:vendor_id (*)')");
  });
});
