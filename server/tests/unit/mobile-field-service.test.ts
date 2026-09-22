/**
 * PROD-008: the React Native field-service screen worked in dev and 404'd on
 * every technician's phone.
 *
 * `mobile/app/(app)/(service)/field-service.tsx` calls three endpoints -
 * /api/mobile/time-tracking/start, /stop and /api/mobile/service-tickets/:id/
 * status. `supabase/functions/mobile/` served `sessions`, `photos` and `sync`
 * and nothing else, so all three fell to its trailing 404; Express served them,
 * and `/api/mobile` is not proxied, so dev was the working host. That split runs
 * in its worse direction here, because production is where the technician is
 * standing.
 *
 * The port is a FIX, not a move. What the Express versions did:
 *   start  wrote status 'in-progress' WITH A HYPHEN, which WF-V-05's CHECK
 *          constraint refuses, and set assigned_technician_id to the caller
 *          with no scope check.
 *   stop   bumped updated_at and answered { stoppedAt } - no session closed, no
 *          duration recorded. A fabricated write outcome.
 *   status passed the body through unvalidated.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SERVICE_TICKET_STATUSES,
  normalizeTicketStatus,
} from '../../../supabase/functions/_shared/service-ticket-vocabulary.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const fn = stripComments(read('supabase/functions/mobile/index.ts'));

/**
 * One branch, bounded by the NEXT branch - a window is not a scope.
 *
 * The first version searched forward for the next `if (req.method` and the stop
 * branch still ran into the status one, which reads `service_tickets`, so the
 * "stopping the clock does not complete the ticket" assertion reported a
 * correct file as wrong. The markers are known, so the bound is the next
 * marker rather than a guess about formatting.
 */
const MARKERS = [
  "resource === 'time-tracking' && resourceId === 'start'",
  "resource === 'time-tracking' && resourceId === 'stop'",
  "resource === 'service-tickets'",
  'PHOTOS ENDPOINTS',
];

function branch(marker: string): string {
  const at = fn.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const later = MARKERS.map((m) => fn.indexOf(m, at + marker.length)).filter((n) => n > -1);
  const end = later.length ? Math.min(...later) : fn.length;
  // The slice must be a real branch, not an empty or runaway one.
  expect(end - at).toBeGreaterThan(200);
  return fn.slice(at, end);
}

describe('the three branches exist', () => {
  it('serves time-tracking start and stop', () => {
    expect(fn).toMatch(/resource === 'time-tracking' && resourceId === 'start'/);
    expect(fn).toMatch(/resource === 'time-tracking' && resourceId === 'stop'/);
  });

  it('serves the ticket status write at the depth the app calls it', () => {
    // /api/mobile/service-tickets/:id/status is three segments deep, so the
    // handler has to read parts[2] - reading only parts[0] and parts[1] is the
    // shape that answers the wrong branch rather than 404ing.
    expect(fn).toMatch(/const subAction = parts\[2\]/);
    expect(fn).toMatch(/resource === 'service-tickets'/);
    expect(fn).toMatch(/subAction === 'status'/);
  });
});

describe('starting a timer', () => {
  const b = branch("resource === 'time-tracking' && resourceId === 'start'");

  it('writes the canonical status spelling, not the hyphenated one', () => {
    // 'in-progress' is refused by WF-V-05's CHECK constraint, so the Express
    // version could only ever 23514.
    expect(b).toMatch(/status: 'in_progress'/);
    expect(b).not.toMatch(/'in-progress'/);
  });

  it('never takes the ticket from another technician', () => {
    // The Express version set assigned_technician_id = caller, so pressing
    // Start reassigned the ticket to whoever pressed it.
    expect(b).not.toMatch(/assigned_technician_id:/);
  });

  it('checks scope before writing anything', () => {
    const check = b.indexOf('denyIfTicketOutOfScope');
    const write = b.indexOf('.insert(');
    expect(check).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(check);
  });

  it('is idempotent - a second press finds the running session', () => {
    // A technician who backgrounds the app and returns must not restart the
    // clock, and two sessions on one ticket would double the hours.
    expect(b).toMatch(/\.is\('check_out_timestamp', null\)/);
    expect(b).toMatch(/alreadyRunning/);
  });

  it('takes the technician from the JWT, not the body', () => {
    expect(b).toMatch(/technician_id: user\.id/);
  });
});

describe('stopping a timer', () => {
  const b = branch("resource === 'time-tracking' && resourceId === 'stop'");

  it('actually closes the session and records the duration', () => {
    // The Express version answered { stoppedAt } having written nothing but
    // updated_at - the technician was told the timer stopped and no time was
    // recorded anywhere.
    //
    // Bound to the VALUE, not the key. `toMatch(/total_hours:/)` is satisfied
    // by `total_hours: null`, which is the defect with the column name still
    // in the file.
    expect(b).toMatch(/check_out_timestamp: stoppedAt/);
    expect(b).toMatch(/total_hours: [^\n]*totalHours/);
    expect(b).toMatch(/working_hours: [^\n]*totalHours/);
  });

  it('writes the departure entry that pairs with the arrival one', () => {
    expect(b).toMatch(/check_in_type: 'departure'/);
  });

  it('does NOT complete the ticket', () => {
    // Stopping the clock is not finishing the job - the screen has a separate
    // status control, and the session check-out path is the "I am done here"
    // action that does close the ticket.
    expect(b).not.toMatch(/status: 'completed',[\s\S]{0,80}resolved_at/);
    expect(b).not.toMatch(/from\('service_tickets'\)/);
  });

  it('a clock that ran backwards records nothing rather than negative hours', () => {
    // Somebody gets paid on this number, and BOTH columns need the guard - a
    // single presence check passed while working_hours lost it, which is this
    // repo's "walk the sites, a total is not a property" trap again.
    for (const column of ['total_hours', 'working_hours'] as const) {
      const line = new RegExp(`${column}: [^\\n]*totalHours >= 0 \\?`);
      expect({ column, guarded: line.test(b) }).toEqual({ column, guarded: true });
    }
  });

  it('no running timer is a 200 that says so, not a failure', () => {
    // A 500 here makes the technician press it again.
    expect(b).toMatch(/stopped: false/);
  });
});

describe('the status write', () => {
  const b = branch("resource === 'service-tickets'");

  it('normalizes through the one vocabulary', () => {
    expect(b).toMatch(/normalizeTicketStatus\(body\.status\)/);
  });

  it('refuses an unknown status WITH the vocabulary instead of a 23514', () => {
    expect(b).toMatch(/allowed: SERVICE_TICKET_STATUSES/);
    expect(b).toMatch(/UNKNOWN_STATUS/);
  });

  it('the vocabulary it refuses against is the real one', () => {
    // Behavioural, not a source read: the normalizer is what decides.
    expect(normalizeTicketStatus('in-progress')).toBe('in_progress');
    expect(normalizeTicketStatus('nonsense')).toBeNull();
    expect(SERVICE_TICKET_STATUSES).toContain('in_progress');
  });

  it('stamps resolved_at when the work is finished', () => {
    expect(b).toMatch(/if \(status === 'completed'\) patch\.resolved_at = nowIso/);
  });

  it('is scoped and tenant-filtered', () => {
    expect(b).toMatch(/denyIfTicketOutOfScope/);
    expect(b).toMatch(/\.eq\('tenant_id', tenantId\)/);
  });
});

describe('both hosts run one implementation', () => {
  const proxy = read('server/middleware/edge-function-proxy.ts');
  const express = read('server/routes-mobile-api.ts');

  it('the two paths are proxied so dev runs what production runs', () => {
    expect(proxy).toMatch(/'\/api\/mobile\/time-tracking': \{ fn: 'mobile'/);
    expect(proxy).toMatch(/'\/api\/mobile\/service-tickets': \{ fn: 'mobile'/);
  });

  it('the whole /api/mobile prefix is NOT proxied', () => {
    // dashboard and jobs/:jobId are still Express-only; a bare entry would take
    // them from working-in-dev to 404-in-dev.
    expect(proxy).not.toMatch(/'\/api\/mobile': /);
  });

  it('the Express handlers are gone, not shadowed', () => {
    const code = stripComments(express);
    expect(code).not.toMatch(/mobile\/time-tracking\/start/);
    expect(code).not.toMatch(/mobile\/time-tracking\/stop/);
    expect(code).not.toMatch(/mobile\/service-tickets\/:ticketId\/status/);
  });
});

/**
 * The sweep that found this.
 *
 * check:edge-path-coverage asks whether a segment appears ANYWHERE in the
 * function source, which is generous on purpose - and round 112 showed what
 * that costs when the word is present for another reason. This asks the
 * stricter question: is the segment ever COMPARED to? It is a test rather than
 * a guard because the strict rule has false positives of its own (a path
 * matched by a regex rather than an equality), which is exactly why the shipped
 * guard is lenient.
 */
describe('native clients: every path segment reaches a routing comparison', () => {
  const TREES = [
    'printyx-client',
    'printyx-desktop',
    'mobile-app',
    'mobile',
    'browser-extensions',
    'printyx-extension',
    'ios',
  ];
  const SRC = /\.(ts|tsx|js|jsx|mjs|cjs|swift|kt|java|dart)$/;
  const TEST =
    /(^|[\\/])(tests?|__tests__|spec|specs)[\\/]|[\\/][^\\/]*(Tests|\.test|\.spec)\.[a-z]+$/i;

  function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
      if (['node_modules', 'dist', 'build'].includes(entry) || entry.startsWith('.')) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (SRC.test(entry) && !TEST.test(p)) out.push(p);
    }
    return out;
  }

  function dirSrc(dir: string): string {
    let out = '';
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) out += dirSrc(p);
      else if (p.endsWith('.ts')) out += stripComments(readFileSync(p, 'utf8'));
    }
    return out;
  }

  /** Domains whose native paths are knowingly unserved; each one a worklist entry. */
  const KNOWN_UNSERVED = new Set([
    'mobile/dashboard', // AUDIT-033: a fixture on both hosts.
    'mobile/device-tokens', // No token table and no push sender anywhere.
    'mobile/push-token', // Same feature, the React Native half.
    'activities/recent',
    'analytics/performance-metrics',
    'equipment/:id/service-history',
    // No edge directory at all, and no server.ts alias:
    'client-metrics',
    'extension',
    'health',
    'proposal-templates',
    'service-dispatch',
  ]);

  it('the mobile field-service paths all reach a comparison now', () => {
    const files = TREES.flatMap((t) => walk(join(repo, t)));
    expect(files.length).toBeGreaterThan(100);

    const shapes = new Set<string>();
    for (const f of files) {
      const s = stripComments(readFileSync(f, 'utf8'));
      for (const m of s.matchAll(/["'`]\/api\/([a-z0-9-]+)((?:\/[^"'`?\s]*)*)/g)) {
        const tail = (m[2] || '')
          .split('/')
          .filter(Boolean)
          .map((seg) => (/^[a-z0-9][a-z0-9-]*$/.test(seg) ? seg : ':id'));
        shapes.add(m[1] + (tail.length ? '/' + tail.join('/') : ''));
      }
    }
    expect(shapes.size).toBeGreaterThan(50);

    const unserved: string[] = [];
    for (const shape of shapes) {
      const [domain, ...tail] = shape.split('/');
      const dir = join(repo, 'supabase/functions', domain);
      if (!existsSync(dir)) {
        unserved.push(domain);
        continue;
      }
      const src = dirSrc(dir);
      for (const seg of tail) {
        if (seg === ':id') continue;
        const cmp = new RegExp(
          `===\\s*['"\`]${seg}['"\`]|['"\`]/${seg}['"\`]|startsWith\\(['"\`]/?${seg}|case '${seg}'|\\[['"\`]${seg}['"\`]\\]|\\b${seg.replace(/-/g, '')}Match\\b`,
        );
        if (!cmp.test(src)) unserved.push(shape);
      }
    }

    const surprising = [...new Set(unserved)].filter((s) => {
      if (KNOWN_UNSERVED.has(s)) return false;
      // A bare domain with no edge directory is recorded by its domain name.
      return !KNOWN_UNSERVED.has(s.split('/')[0]);
    });
    expect(surprising).toEqual([]);
  });
});
