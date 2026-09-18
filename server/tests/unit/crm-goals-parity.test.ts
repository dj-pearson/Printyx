/**
 * The CRM Goals page was inert in production (WF-S-06).
 *
 * Six endpoints it calls existed only on Express, so they 404'd on the
 * functions host. That was the story. Reading the edge function turned up five
 * more, which is the worse half: four of its five existing branches were TODO
 * stubs and the fifth read the wrong table.
 *
 *   GET  /goals           returned [] unconditionally
 *   POST /goals           returned 201 and wrote NOTHING - a create button
 *                         reporting success over an empty database, which is
 *                         the AUDIT-038 shape
 *   GET  /dashboard-stats returned eight hardcoded zeroes, which on a goals
 *                         page reads as "nobody has sold anything"
 *   GET  /goal-progress   returned one mock OBJECT where the page does
 *                         `rows.forEach`
 *   GET  /teams           read `teams`, a real table but not this page's -
 *                         it means `sales_teams`, one word away
 *
 * So eleven endpoints, not six. These tests pin the shape of each against the
 * columns the schema declares, and the funnel arithmetic is driven directly.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calculateActivityFunnel,
  WORKING_DAYS_PER_MONTH,
} from '../../../supabase/functions/_shared/activity-funnel';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const edge = code('supabase/functions/crm/index.ts');
const page = read('client/src/pages/CrmGoalsDashboard.tsx');

describe('every endpoint the page calls has a branch', () => {
  // Read out of the PAGE, so a new call with no branch fails here rather than
  // in production.
  const called = [...page.matchAll(/['"`]\/api\/crm\/([a-z-]+(?:\/[a-z-]+)?)['"`]/g)].map(
    (m) => m[1],
  );

  it('finds the calls in the page rather than trusting a list', () => {
    expect(new Set(called)).toContain('goals');
    expect(new Set(called)).toContain('goals/bulk-assign');
    expect(new Set(called)).toContain('analytics/conversion-analysis');
  });

  for (const path of [
    'goals',
    'goals/bulk-assign',
    'teams',
    'dashboard-stats',
    'goal-progress',
    'manager-insights',
    'analytics/conversion-analysis',
    'analytics/calculate-activities',
  ]) {
    it(`serves ${path}`, () => {
      const [head, tail] = path.split('/');
      expect(edge).toContain(`subRoute === '${head}'`);
      if (tail) expect(edge).toContain(`'${tail}'`);
    });
  }

  it('serves teams/:id/members, which carries no named first segment', () => {
    expect(edge).toMatch(/subRoute === 'teams' && parts\[1\] && parts\[2\] === 'members'/);
  });
});

describe('no branch is a stub any more', () => {
  it('reads and writes sales_goals instead of answering []', () => {
    expect(edge).toContain("from('sales_goals')");
    expect(edge).not.toMatch(/TODO: (Fetch|Create) .*goal/i);
  });

  it('never reports a created goal it did not write', () => {
    // The exact string the stub returned.
    expect(edge).not.toContain("message: 'Goal created'");
    expect(edge).toMatch(/from\('sales_goals'\)\s*\.insert/);
  });

  it('counts dashboard stats rather than returning zeroes', () => {
    expect(edge).not.toContain('const mockStats');
    expect(edge).toContain("count: 'exact'");
  });

  it('returns goal progress as an array, because the page iterates it', () => {
    expect(page).toMatch(/goalProgress/);
    expect(edge).not.toContain('const mockProgress');
    // The rows array is built and returned.
    const branch = edge.slice(edge.indexOf("subRoute === 'goal-progress'"));
    expect(branch.slice(0, 1600)).toMatch(/rows\.push\(/);
  });

  it('reads sales_teams, not teams', () => {
    const branch = edge.slice(edge.indexOf("subRoute === 'teams' && !parts[1]"));
    expect(branch.slice(0, 400)).toContain("from('sales_teams')");
  });
});

describe('only real columns are written', () => {
  // sales_goals, verbatim from shared/schema.ts.
  const GOAL_COLUMNS = new Set([
    'tenant_id',
    'assigned_to_user_id',
    'assigned_to_team_id',
    'assigned_by',
    'goal_type',
    'target_count',
    'period',
    'start_date',
    'end_date',
    'is_active',
    'notes',
  ]);

  it('goalRow names nothing sales_goals does not have', () => {
    const fn = edge.slice(
      edge.indexOf('function goalRow'),
      edge.indexOf('async function countGoalProgress'),
    );
    const keys = [...fn.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) {
      expect(GOAL_COLUMNS.has(key), `${key} is not a sales_goals column`).toBe(true);
    }
  });

  it('the schema still declares those columns', () => {
    const schema = read('shared/schema.ts');
    const table = schema.slice(schema.indexOf("pgTable('sales_goals'"));
    for (const col of GOAL_COLUMNS) {
      expect(table.slice(0, 1800)).toContain(`'${col}'`);
    }
  });
});

describe('the activity funnel', () => {
  const base = {
    revenueGoal: 100000,
    averageDealSize: 10000,
    callAnswerRate: 25,
    emailResponseRate: 10,
    activityToMeetingRate: 50,
    meetingToProposalRate: 50,
    proposalClosingRate: 25,
  };

  it('works backwards from revenue to deals', () => {
    expect(calculateActivityFunnel(base).requiredActivities.dealsNeeded).toBe(10);
  });

  it('splits connections evenly between calls and emails, and says so', () => {
    const r = calculateActivityFunnel(base);
    // 10 deals / .25 = 40 proposals / .5 = 80 meetings / .5 = 160 connections.
    expect(r.requiredActivities.connectionsNeeded).toBe(160);
    // Half by phone at 25%: 160/0.25/2 = 320. Half by email at 10%: 160/0.1/2 = 800.
    expect(r.requiredActivities.totalCalls).toBe(320);
    expect(r.requiredActivities.totalEmails).toBe(800);
    expect(r.assumptions.join(' ')).toMatch(/split evenly/i);
  });

  it('divides the month into working days, named as an assumption', () => {
    const r = calculateActivityFunnel(base);
    expect(r.dailyBreakdown.totalDaily).toBe(Math.ceil(1120 / WORKING_DAYS_PER_MONTH));
    expect(r.assumptions.join(' ')).toContain(String(WORKING_DAYS_PER_MONTH));
  });

  it('answers null rather than Infinity when a rate is zero', () => {
    // The Express original divided straight through, so a zero closing rate
    // rendered "Infinity calls per day".
    const r = calculateActivityFunnel({ ...base, proposalClosingRate: 0 });
    expect(r.requiredActivities.proposalsNeeded).toBeNull();
    expect(r.dailyBreakdown.callsDaily).toBeNull();
    expect(r.unbacked.join(' ')).toMatch(/proposalClosingRate/);
  });

  it('answers null when the deal size is zero', () => {
    const r = calculateActivityFunnel({ ...base, averageDealSize: 0 });
    expect(r.requiredActivities.dealsNeeded).toBeNull();
    expect(r.unbacked.join(' ')).toMatch(/averageDealSize/);
  });
});

describe('the domain runs one implementation', () => {
  it('server/routes-crm-goals.ts is gone and nothing registers it', () => {
    expect(() => read('server/routes-crm-goals.ts')).toThrow();
    expect(code('server/routes-registry.ts')).not.toContain('registerCrmGoalRoutes');
    expect(code('server/domains/crm.ts')).not.toContain('routes-crm-goals');
  });

  it('supabase/functions/crm-goals is deleted - it could never be reached', () => {
    // The page calls /api/crm, so a separate crm-goals function had no route to
    // it from any client.
    expect(() => read('supabase/functions/crm-goals/index.ts')).toThrow();
  });

  it('/api/crm is proxied, so dev and prod run the same code', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toContain("'/api/crm': 'crm'");
  });

  it('took routes-crm-notes.ts with it, because proxying the prefix shadowed it', () => {
    // check:shadowed-express caught this the moment /api/crm was proxied: the
    // proxy claims the prefix before any domain route registers, so those seven
    // handlers became dead on arrival. Safe to delete only because the crm edge
    // function already covers all seven - CRMX-006 ported them - which is the
    // check CLAUDE.md asks for before retiring a shadowed router.
    expect(() => read('server/routes-crm-notes.ts')).toThrow();
    for (const branch of [
      "subRoute === 'notes'",
      "subRoute === 'associations'",
      "req.method === 'PATCH' && noteId",
      "req.method === 'DELETE' && assocId",
    ]) {
      expect(edge).toContain(branch);
    }
  });
});
