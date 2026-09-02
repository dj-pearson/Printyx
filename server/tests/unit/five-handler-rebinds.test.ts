/**
 * Five reachable surfaces bound to columns that exist (AUDIT-037).
 *
 * quote-line-items, service-analysis, validate, activities and projects each
 * wrote or read names their table does not have. Three findings beyond the
 * renames are worth locking on their own:
 *
 *   A TENANT LEAK. quote-line-items' list filtered on quote_id ALONE, with no
 *   tenant_id, so any authenticated user with a quote id could read another
 *   tenant's line items and their prices. It only ever failed because of an
 *   unrelated bad embed in the same select, which is not a control.
 *
 *   A DEFINITION-OF-DONE GATE THAT FAILED CLOSED ON ITS OWN QUERY. validate's
 *   service-completion check selected technician_id, work_performed and
 *   time_spent; the columns are assigned_technician_id, work_order_notes and
 *   labor_hours, so the row came back null and the gate answered "Service
 *   ticket not found" for every ticket that exists.
 *
 *   A UNIT BUG BEHIND A NAME BUG. projects wrote estimated_budget multiplied by
 *   100 "to store in cents", and the real column, `budget`, is decimal(10,2) in
 *   dollars - so fixing only the name would have recorded every project at a
 *   hundred times its budget.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const SQL = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
const ddl = (table: string) => {
  const at = SQL.indexOf(`CREATE TABLE "${table}" (`);
  expect(at).toBeGreaterThan(-1);
  return SQL.slice(at, SQL.indexOf(');', at));
};

describe('quote_line_items', () => {
  const fn = strip(read('supabase/functions/quote-line-items/index.ts'));

  it('is the minimal table, without the three names the handler used', () => {
    const body = ddl('quote_line_items');
    for (const col of ['product_id', 'discount_percent', 'line_number']) {
      expect(body).not.toContain(`"${col}"`);
    }
    expect(body).toContain('"total_price" numeric(10, 2) NOT NULL');
  });

  it('the read is tenant-scoped', () => {
    expect(fn).toMatch(/from\('quote_line_items'\)[\s\S]{0,120}eq\('tenant_id', tenantId\)/);
  });

  it('the write sets both NOT NULL columns it used to omit', () => {
    expect(fn).toContain('tenant_id: tenantId');
    expect(fn).toContain('total_price:');
  });
});

describe('parts_orders', () => {
  const fn = strip(read('supabase/functions/service-analysis/index.ts'));

  it('the create sets every NOT NULL column', () => {
    // subtotal and total are shorthand properties, so match the insert body
    // rather than a `name:` form.
    const at = fn.indexOf("from('parts_orders')");
    const insert = fn.slice(at, fn.indexOf('.select()', at));
    for (const col of ['service_ticket_id:', 'order_number:', 'vendor_name:', 'order_date:']) {
      expect(insert).toContain(col);
    }
    for (const col of ['subtotal', 'total']) {
      expect(insert).toMatch(new RegExp(`\\n\\s*${col},`));
    }
  });

  it('and none of the three that are not columns', () => {
    const body = ddl('parts_orders');
    const at = fn.indexOf("from('parts_orders')");
    const insert = fn.slice(at, fn.indexOf('.select()', at));
    for (const col of ['parts', 'total_cost', 'ordered_by']) {
      expect(body).not.toContain(`"${col}"`);
      expect(insert).not.toContain(`${col}:`);
    }
  });
});

describe('the service-completion gate reads real columns', () => {
  const fn = strip(read('supabase/functions/validate/index.ts'));

  it('selects assigned_technician_id, work_order_notes and labor_hours', () => {
    for (const col of ['assigned_technician_id', 'work_order_notes', 'labor_hours']) {
      expect(fn).toContain(col);
      expect(ddl('service_tickets')).toContain(`"${col}"`);
    }
  });

  it('and not the three names that made every ticket look missing', () => {
    // `technician_id` is checked with a boundary: assigned_technician_id ends
    // in it, and a bare substring ban reports the fix as the defect.
    expect(fn).not.toMatch(/(?<![a-z_])technician_id/);
    for (const col of ['work_performed', 'time_spent']) {
      expect(fn).not.toContain(col);
    }
  });
});

describe('activities', () => {
  const fn = strip(read('supabase/functions/activities/index.ts'));

  it('writes description and call_duration, the columns that exist', () => {
    expect(fn).toContain('description:');
    expect(fn).toContain('call_duration:');
    const body = ddl('business_record_activities');
    expect(body).toContain('"description"');
    expect(body).toContain('"call_duration"');
    for (const col of ['duration_minutes', 'priority']) {
      expect(body).not.toContain(`"${col}"`);
    }
  });

  it('reports priority rather than dropping it silently', () => {
    expect(read('supabase/functions/activities/index.ts')).toContain('unpersisted');
  });
});

describe('projects — one real rename, three false accusations', () => {
  const fn = strip(read('supabase/functions/projects/index.ts'));
  const body = ddl('projects');

  it('the physical table is task-schema shape, not schema.ts shape', () => {
    // This is the AUDIT-039 collision: drizzle-schema.ts skips task-schema's
    // `projects` in favour of schema.ts's, and migration 0000 built
    // task-schema's. So estimated_budget, actual_budget and tags are REAL and
    // check:phantom-cols reporting them is the guard trusting a wrong
    // resolution - the fourth variant of accused-correct-code in this story.
    for (const col of ['project_manager', 'estimated_budget', 'actual_budget', 'tags']) {
      expect(body).toContain(`"${col}"`);
    }
    for (const col of ['budget', 'estimated_hours', 'actual_hours']) {
      expect(body).not.toMatch(new RegExp(`\\n\\t"${col}"`));
    }
  });

  it('estimated_budget is an integer, so the cents convention is correct', () => {
    expect(body).toContain('"estimated_budget" integer');
    expect(fn).toMatch(/\*\s*100/);
  });

  it('the one real defect is fixed: project_manager, not project_manager_id', () => {
    expect(body).not.toContain('"project_manager_id"');
    expect(fn).not.toContain('project_manager_id');
    expect(fn).toContain('project_manager:');
  });
});
