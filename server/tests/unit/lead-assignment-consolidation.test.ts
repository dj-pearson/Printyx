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
