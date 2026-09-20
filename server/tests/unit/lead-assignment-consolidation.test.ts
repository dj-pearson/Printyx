/**
 * PR 2 of the lead-assignment consolidation, finished.
 *
 * `supabase/functions/lead-assignment/` is the canonical dispatcher and its own
 * header lists nine auxiliary edge functions to delete "once PR 2 ships". PR 1
 * landed and PR 2 did not, so seven of them sat alongside it - every one
 * phantom-columned against the tables it claimed to serve, and every one a
 * second answer to a URL the canonical handler already covers.
 *
 * The consolidation's routing premise was also missing. docs/lead-assignment-
 * parity.md says the router "fans out to the canonical edge function based on
 * prefix", and nothing implemented that: `server.ts` resolves a function from
 * URL segment 0, so /api/rep-capacity found the rep-capacity DIRECTORY and the
 * canonical handler was unreachable by that name. Deleting the seven without
 * the alias would have taken seven URL prefixes from a broken function to no
 * function.
 *
 * Absence assertions strip comments: the alias block names every retired
 * function, so a raw-text check would clear itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const FUNCTIONS = join(ROOT, 'supabase/functions');
const SERVER_TS = readFileSync(join(FUNCTIONS, 'server.ts'), 'utf8');

function stripComments(source: string): string {
  return source.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SERVER_CODE = stripComments(SERVER_TS);

/** The seven the canonical dispatcher supersedes and this change removed. */
const RETIRED = [
  'lead-assignment-rules',
  'lead-assignment-queue',
  'lead-assignment-history',
  'assign-lead',
  'territories',
  'user-assignments',
  'rep-capacity',
];

/** Kept deliberately: both have live callers in client/src. */
const KEPT = ['sales-territories', 'auto-lead-routing', 'lead-assignment'];

describe('lead-assignment consolidation', () => {
  it('has a corpus to check', () => {
    // A directory walk that finds nothing must fail rather than pass quietly.
    const dirs = readdirSync(FUNCTIONS, { withFileTypes: true }).filter((d) => d.isDirectory());
    expect(dirs.length).toBeGreaterThan(200);
  });

  it('removed every superseded duplicate', () => {
    for (const fn of RETIRED) {
      expect(existsSync(join(FUNCTIONS, fn))).toBe(false);
    }
  });

  it('kept the canonical dispatcher and the two functions with live callers', () => {
    for (const fn of KEPT) {
      expect(existsSync(join(FUNCTIONS, fn, 'index.ts'))).toBe(true);
    }
  });

  it('routes every retired prefix to the canonical function', () => {
    // Without this the deletion is a removal, not a consolidation.
    for (const fn of RETIRED) {
      expect(SERVER_CODE).toContain(`functionName === '${fn}'`);
    }
    expect(SERVER_CODE).toMatch(/functionName = 'lead-assignment';/);
  });

  it('keeps the discriminator segment on the alias', () => {
    // lead-assignment's PREFIX_MAP keys on segment 0, so stripping it makes
    // every aliased request 404 inside the dispatcher. Same rule as the leases
    // and reports families.
    const block = SERVER_CODE.slice(
      SERVER_CODE.indexOf("functionName === 'lead-assignment-rules'"),
    ).slice(0, 600);
    expect(block).toContain("functionName = 'lead-assignment'");
    expect(block).toContain('stripSegments = 0');
    expect(block).not.toContain('stripSegments = 1');
  });

  it('does not alias the two functions that still serve their own callers', () => {
    // An alias here would send a live page to a handler with a different
    // response shape, which EDGE-005f records as worse than a 404.
    expect(SERVER_CODE).not.toContain("functionName === 'sales-territories'");
    expect(SERVER_CODE).not.toContain("functionName === 'auto-lead-routing'");
  });
});

describe('the canonical dispatcher covers what was deleted', () => {
  const INDEX = readFileSync(join(FUNCTIONS, 'lead-assignment/index.ts'), 'utf8');

  it('maps every retired prefix to a handler', () => {
    for (const fn of RETIRED) {
      expect(INDEX).toContain(`prefix: '/${fn}'`);
    }
  });

  it('writes the rep_capacity columns that exist', () => {
    // The deleted rep-capacity/ wrote max_leads and current_leads, neither of
    // which is a column: the table has max_active_leads and
    // current_active_leads, which is what the routing engine reads.
    const engine = readFileSync(join(FUNCTIONS, 'lead-assignment/_engine.ts'), 'utf8');
    expect(engine).toContain('max_active_leads');
    expect(engine).toContain('current_active_leads');
    const capacity = readFileSync(join(FUNCTIONS, 'lead-assignment/handlers/capacity.ts'), 'utf8');
    expect(capacity).not.toContain('max_leads:');
    expect(capacity).not.toContain('current_leads:');
  });

  it('embeds no users.full_name anywhere in the canonical tree', () => {
    // `users` has first_name/last_name. Six of the seven deleted functions
    // embedded full_name, which takes the whole query down with a 42703.
    const dir = join(FUNCTIONS, 'lead-assignment');
    const files: string[] = [];
    const walk = (p: string) => {
      for (const e of readdirSync(p, { withFileTypes: true })) {
        const full = join(p, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      expect(stripComments(readFileSync(f, 'utf8'))).not.toContain('full_name');
    }
  });
});

/**
 * Batch 15: the Express side of the same consolidation.
 *
 * `server/routes-lead-assignment.ts` was a THIRD implementation of the six
 * prefixes batch 14 retired - 16 handlers, mounted via an exported
 * `register*(app)` so a grep of the registry for its filename found nothing.
 * No client tree calls any of its domains and the canonical edge function
 * covers 15 of its 16 endpoints, so it is deleted rather than kept.
 *
 * `server/routes-auto-lead-routing.ts` is the live half and the more useful
 * finding. `AutoLeadRoutingDashboard.tsx` is routed and calls /dashboard,
 * /config and /rules; Express had NO /rules handler, so listing, creating and
 * deleting a routing rule 404'd in dev while working in production, and its
 * /config PUT logged the body and answered success without storing anything.
 * The prefix is proxied now, so dev runs the same handler prod does.
 */
describe('lead-assignment Express routers retired', () => {
  const SERVER = join(ROOT, 'server');

  it('deleted both routers', () => {
    expect(existsSync(join(SERVER, 'routes-lead-assignment.ts'))).toBe(false);
    expect(existsSync(join(SERVER, 'routes-auto-lead-routing.ts'))).toBe(false);
  });

  it('unmounted them rather than leaving a dangling call', () => {
    // An exported register*(app) mount is invisible to a grep for the module
    // path, so this checks the identifier the registry actually calls.
    const registry = stripComments(readFileSync(join(SERVER, 'routes-registry.ts'), 'utf8'));
    expect(registry).not.toContain('registerLeadAssignmentRoutes');
    expect(registry).not.toContain('registerAutoLeadRoutingRoutes');
    const sales = stripComments(readFileSync(join(SERVER, 'domains/sales.ts'), 'utf8'));
    expect(sales).not.toContain('routes-lead-assignment');
    expect(sales).not.toContain('routes-auto-lead-routing');
  });

  it('proxies auto-lead-routing so the rules controls resolve in dev', () => {
    // Without the proxy, deleting the Express router takes /dashboard and
    // /config from working-in-dev to unserved, and /rules stays broken.
    const proxy = stripComments(
      readFileSync(join(SERVER, 'middleware/edge-function-proxy.ts'), 'utf8'),
    );
    expect(proxy).toContain("'/api/auto-lead-routing': 'auto-lead-routing'");
  });

  it('keeps the edge function the proxy points at, with its rules branches', () => {
    const src = readFileSync(join(FUNCTIONS, 'auto-lead-routing/index.ts'), 'utf8');
    for (const branch of [
      "method === 'GET' && endpoint === 'rules'",
      "method === 'POST' && endpoint === 'rules'",
      "method === 'DELETE' && endpoint === 'rules'",
      "endpoint === 'dashboard'",
      "endpoint === 'config'",
    ]) {
      expect(src).toContain(branch);
    }
    // EDGE-002g: this function once answered with two invented routing rules
    // for a table named by no schema. It reads the real one.
    expect(src).toContain("RULES_TABLE = 'lead_assignment_rules'");
  });

  it('answers the four dashboard keys the page reads', () => {
    // A proxy entry changes what dev answers, so the shapes are compared
    // rather than assumed (PA-040).
    const src = readFileSync(join(FUNCTIONS, 'auto-lead-routing/index.ts'), 'utf8');
    const page = readFileSync(join(ROOT, 'client/src/pages/AutoLeadRoutingDashboard.tsx'), 'utf8');
    for (const key of ['overview', 'scoreDistribution', 'repWorkload', 'recentLeads']) {
      expect(src).toContain(`${key}:`);
      expect(page).toContain(`dashboardData?.${key}`);
    }
  });

  it('keeps the routing service, which a live workflow seam imports', () => {
    // web-form-processor.ts dispatches form.submitted and uses it, so the
    // service is not an orphan even though both routers are gone.
    expect(existsSync(join(SERVER, 'services/auto-lead-routing-service.ts'))).toBe(true);
    const seam = readFileSync(join(SERVER, 'services/web-form-processor.ts'), 'utf8');
    expect(seam).toContain("from './auto-lead-routing-service'");
  });
});
