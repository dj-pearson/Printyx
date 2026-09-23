/**
 * The dashboard widget endpoints answer with measurements, with nothing, or
 * with a named absence - and they answer on BOTH hosts (DASH-METRICS-001).
 *
 * server/routes-dashboard-layouts.ts served the stat cards behind
 * RoleBasedDashboard and every widget CustomDashboard offers, and ten of them
 * were typed in: revenue '$125,432' at +12.5%, six months of invented revenue
 * drawn as a trend line, an activity feed naming a customer and an invoice
 * amount, four urgent incidents (one flagged critical), four tasks with one
 * already ticked, and a five-person sales leaderboard with names, dollar
 * attainment and ranks. Every `change` was a literal, including on the two
 * metrics that did count real rows. An earlier pass emptied all ten; this story
 * derived them.
 *
 * THE SECOND HALF WAS WORSE AND NOBODY HAD NOTICED. /api/dashboard was not
 * proxied and supabase/functions/dashboard/ served card-config and modules
 * alone, so metrics, charts, activity, urgent, my-tasks, team-performance and
 * the saved layout all 404'd in production. The layout endpoints could not have
 * worked in dev either: the Express router read `dashboard_layouts` through the
 * shared/reporting-schema declaration while migration 0002 had converted the
 * physical table to the other one, dropping is_active, created_by, layout and
 * display_order. Save on /custom-dashboard threw in dev and 404'd in prod, and
 * had done since it was written.
 *
 * Comments are stripped before matching: the notes above quote the literals.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p: string) => strip(readFileSync(join(repo, p), 'utf8'));

const index = read('supabase/functions/dashboard/index.ts');
const metrics = read('supabase/functions/dashboard/handlers/metrics.ts');
const charts = read('supabase/functions/dashboard/handlers/charts.ts');
const lists = read('supabase/functions/dashboard/handlers/lists.ts');
const layouts = read('supabase/functions/dashboard/handlers/layouts.ts');
const summary = read('supabase/functions/dashboard/handlers/summary.ts');
const proxy = read('server/middleware/edge-function-proxy.ts');
const registry = read('server/routes-registry.ts');
const handlers = [metrics, charts, lists, layouts, summary].join('\n');

describe('the three Express routers are gone', () => {
  it('deletes all three files', () => {
    for (const file of [
      'server/routes-dashboard-layouts.ts',
      'server/routes-dashboards-core.ts',
      'server/routes-modular-dashboard.ts',
    ]) {
      expect(existsSync(join(repo, file)), file).toBe(false);
    }
  });

  it('unregisters them', () => {
    for (const fn of [
      'registerDashboardLayoutsRoutes',
      'registerDashboardsCoreRoutes',
      'registerModularDashboardRoutes',
    ]) {
      expect(registry, fn).not.toContain(fn);
    }
  });

  it('retired registerTodayDashboardRoutes too; /api/dashboards is proxied (round 157)', () => {
    expect(registry).not.toContain('registerTodayDashboardRoutes(app)');
  });
});

describe('dev and production resolve the same handler', () => {
  it('proxies every path the edge function now serves', () => {
    for (const segment of [
      'layouts',
      'metrics',
      'charts',
      'activity',
      'urgent',
      'my-tasks',
      'team-performance',
      'recent-tickets',
      'top-customers',
      'alerts',
      'card-config',
      'modules',
    ]) {
      expect(proxy, segment).toContain(
        `'/api/dashboard/${segment}': { fn: 'dashboard', pathPrefix: '/${segment}' }`,
      );
    }
  });

  it('sends widgets and user-layout to dashboard-widgets, which owns them in prod', () => {
    expect(proxy).toContain(
      "'/api/dashboard/widgets': { fn: 'dashboard-widgets', pathPrefix: '/widgets' }",
    );
    expect(proxy).toContain(
      "'/api/dashboard/user-layout': { fn: 'dashboard-widgets', pathPrefix: '/user-layout' }",
    );
  });

  it('registers those two BEFORE the dashboard entries', () => {
    // Express matches app.use prefixes in registration order, and object key
    // order is insertion order. '/api/dashboard/widgets' after a bare
    // '/api/dashboard' would never be reached.
    expect(proxy.indexOf("'/api/dashboard/widgets':")).toBeLessThan(
      proxy.indexOf("'/api/dashboard/layouts':"),
    );
  });

  it('does NOT proxy the bare prefix', () => {
    // routes-dashboard-customization.ts mounts at the /api/dashboard root and
    // owns /layout, /preferences and /snapshot(s), which no edge function
    // serves. A bare entry would 404 them in dev.
    expect(proxy).not.toMatch(/'\/api\/dashboard':\s*'dashboard'/);
  });

  it('routes each segment in the edge function', () => {
    for (const branch of [
      "endpoint === 'layouts'",
      "endpoint === 'metrics'",
      "endpoint === 'charts'",
      "endpoint === 'activity'",
      "endpoint === 'urgent'",
      "endpoint === 'my-tasks'",
      "endpoint === 'team-performance'",
      "endpoint === 'recent-tickets'",
      "endpoint === 'top-customers'",
      "endpoint === 'alerts'",
    ]) {
      expect(index, branch).toContain(branch);
    }
  });
});

describe('no fabricated value survives', () => {
  it('none of the invented figures appear', () => {
    for (const literal of [
      '125,432',
      '$125,000',
      'Acme Corp',
      'John Smith',
      'Jane Doe',
      'Critical server issue',
      'Enterprise Contract',
      'Follow up with prospect',
      'Submit weekly report',
    ]) {
      expect(handlers, `fabricated literal ${literal}`).not.toContain(literal);
    }
  });

  it('no month-name revenue series remains', () => {
    // The trend buckets are derived from invoice_date and keyed YYYY-MM.
    expect(charts).not.toMatch(/name:\s*'(Jan|Feb|Mar|Apr|May|Jun)'/);
  });

  it('no `change` is a numeric literal', () => {
    expect(handlers).not.toMatch(/change:\s*-?\d/);
  });
});

describe('a change comes from a prior period or is null', () => {
  it('only revenue computes one, because only revenue has a dated source', () => {
    // percentageChange is called once. The other five metrics count current
    // state, nothing versions it, and a prior-period figure does not exist.
    expect(metrics.match(/percentageChange\(/g) ?? []).toHaveLength(1);
    expect(metrics).toContain("case 'revenue'");
  });

  it('an empty prior period is null, not zero percent', () => {
    const context = read('supabase/functions/dashboard/handlers/_context.ts');
    expect(context).toMatch(
      /if \(!Number\.isFinite\(previous\) \|\| previous === 0\) return null;/,
    );
  });

  it('every metric that cannot answer names the field rather than zeroing it', () => {
    // Five of the six return unbacked: ['change'].
    expect(metrics.match(/unbacked: \['change'\]/g) ?? []).toHaveLength(5);
  });
});

describe('the metrics read real rows', () => {
  it('revenue sums invoices over a real month window', () => {
    expect(metrics).toContain("from('invoices')");
    expect(metrics).toContain("gte('invoice_date'");
    // invoice_date is a calendar date at UTC midnight (DATE-LOCAL-002), so the
    // upper bound is exclusive rather than an inclusive 23:59:59.999.
    expect(metrics).toContain("lt('invoice_date'");
  });

  it('inventory alerts compare the two columns in the handler', () => {
    // PostgREST cannot compare two columns, so a filter string would be a lie.
    expect(metrics).toContain('onHand <= reorderAt');
    expect(metrics).not.toContain('quantity_on_hand <= reorder_point');
  });

  it('renewals read contracts ending inside a stated window', () => {
    expect(metrics).toContain('RENEWAL_WINDOW_DAYS');
    expect(metrics).toMatch(/windowDays: RENEWAL_WINDOW_DAYS/);
  });

  it('tickets and opportunities filter on columns those tables have', () => {
    expect(metrics).toContain("from('service_tickets')");
    expect(metrics).toContain("eq('is_closed', false)");
  });
});

describe('the list widgets', () => {
  it('urgent items are the same four families the notification bell derives', () => {
    // One derivation of "what is wrong right now", not two that drift.
    expect(lists).toContain("from '../../_shared/operational-alerts.ts'");
    expect(lists).toContain('deriveOperationalAlerts(admin, tenantId)');
  });

  it('the activity feed reads business_record_activities', () => {
    expect(lists).toContain("from('business_record_activities')");
  });

  it('it resolves account names in one read, not one per row', () => {
    expect(lists).toContain('fetchInBatches');
  });

  it('my-tasks is scoped to the signed-in user', () => {
    expect(lists).toContain("eq('assigned_to', userId)");
    expect(index).toContain('dashboardMyTasks(admin, tenantId, user.id)');
  });

  it('team performance ranks on closed revenue and calls attainment unbacked', () => {
    // There is no quota table in this schema - sales_quotas is named by several
    // reporting services and exists in no migration - so ranking people against
    // a target would be the fabrication this widget started as.
    expect(lists).toContain('quotaAttainment: null');
    expect(lists).toContain("unbacked: ['quotaAttainment']");
    expect(lists).toContain("eq('is_won', true)");
  });
});

describe('the saved layout binds to the columns the table actually has', () => {
  it('uses the migration-0002 shape', () => {
    expect(layouts).toContain("eq('is_user_custom', true)");
    for (const column of ['widgets', 'columns', 'gap', 'is_default']) {
      expect(layouts, column).toContain(column);
    }
  });

  it('names none of the columns migration 0002 dropped', () => {
    for (const dropped of ['is_active', 'created_by', 'display_order', 'is_public']) {
      expect(layouts, dropped).not.toContain(dropped);
    }
  });

  it('replaces the row in place instead of upserting without a unique index', () => {
    // There is no unique index on (tenant_id, user_id, is_user_custom) to name
    // in onConflict, and an upsert without one inserts a duplicate every save.
    expect(layouts).not.toContain('onConflict');
    expect(layouts).toContain('.update({ ...layout, updated_at: now })');
  });

  it('scopes the delete by tenant AND user', () => {
    // An id travels in URLs; hard to guess is not an authorisation check.
    const del = layouts.slice(layouts.indexOf('export async function deleteLayout'));
    expect(del).toContain("eq('tenant_id', tenantId)");
    expect(del).toContain("eq('user_id', userId)");
  });
});

describe('the ported summary endpoints', () => {
  it('bucket monthly revenue on invoice_date, not created_at', () => {
    // Express bucketed on created_at, which counts a back-dated invoice in the
    // wrong month.
    expect(summary).toContain("gte('invoice_date'");
    expect(summary).not.toContain('date_trunc');
  });

  it('answer recentGrowth null rather than the 0 Express returned', () => {
    expect(summary).toContain('recentGrowth: null');
    expect(summary).toContain("unbacked: ['recentGrowth']");
  });
});

describe('tenant resolution is the shared one', () => {
  it('uses resolveTenantId rather than a local copy of SEC-TENANT-003', () => {
    expect(index).toContain("from '../_shared/resolve-tenant.ts'");
    expect(index).not.toContain('TENANT_ACCESS_DENIED');
  });

  it('refuses every ported endpoint without a tenant', () => {
    const gate = index.indexOf(
      "return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);",
    );
    expect(gate).toBeGreaterThan(-1);
    expect(index.indexOf("endpoint === 'layouts'")).toBeGreaterThan(gate);
  });
});
