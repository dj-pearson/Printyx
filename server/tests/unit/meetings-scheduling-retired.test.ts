/**
 * MEETINGS-READS-001: the meeting-scheduling surface is retired on both hosts.
 *
 * The story framed this as "implement the four reads or retire the surface",
 * and reading the tree settled it in a way the story's own notes had wrong.
 * It said the other four handlers "genuinely call that service, which is real,
 * db-backed". `server/services/meeting-scheduling-service.ts` was 775 lines
 * that imported `db` and never used it - zero `.select(`, zero `.from(` - so
 * the surface was a mock all the way down, not half built.
 *
 * Three more facts decided the deletion:
 *   - No caller in any of the eight client trees for /api/meetings (only
 *     /api/meetings/calendar/*, a different branch and proxied), /api/types,
 *     /api/rooms, /api/schedule-request, /api/schedule/:id or
 *     /api/optimize-schedule.
 *   - Production never ran the Express router anyway: /api/meetings resolves
 *     to supabase/functions/meetings/ through getApiUrl.
 *   - The migration that would have created the tables was never committed.
 *     `server/run-meeting-scheduling-migration.ts` read
 *     `migrations/meeting-scheduling-migration.sql`, which does not exist - so
 *     the whole surface was built against a schema that never landed, which is
 *     why every handler on both hosts had to be a mock.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the Express half is gone', () => {
  it('the router, its service and the dead migration runner are deleted', () => {
    for (const path of [
      'server/routes/meeting-scheduling-routes.ts',
      'server/services/meeting-scheduling-service.ts',
      'server/run-meeting-scheduling-migration.ts',
    ]) {
      expect({ path, exists: existsSync(join(repo, path)) }).toEqual({ path, exists: false });
    }
  });

  it('the registry no longer mounts it, and says why where the mount was', () => {
    // An unmounted router is invisible to a grep for its module path, so the
    // reason belongs at the mount site rather than only in a story note.
    const registry = read('server/routes-registry.ts');
    expect(stripComments(registry)).not.toMatch(/routes\/meeting-scheduling-routes/);
    expect(registry).toMatch(/meeting-scheduling-routes retired \(MEETINGS-READS-001\)/);
    expect(registry).toMatch(/never used it/);
  });

  it('nothing imports the deleted service', () => {
    const offenders: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(join(repo, dir))) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const rel = `${dir}/${entry}`;
        if (statSync(join(repo, rel)).isDirectory()) visit(rel);
        else if (
          /\.tsx?$/.test(entry) &&
          // Comments stripped: the unmount note in routes-registry.ts NAMES the
          // deleted service while explaining that it is gone, so a raw scan
          // reports its own explanation as the defect. Ninth time.
          /meeting-scheduling-service/.test(stripComments(read(rel)))
        ) {
          offenders.push(rel);
        }
      }
    };
    visit('server');
    // server/tests is excluded by RULE: a test that asserts the file is absent
    // necessarily names it, so scanning the proof over the property reports the
    // explanation as the defect - the same shape as the comment strip above,
    // one directory up.
    expect(offenders.filter((f) => !f.startsWith('server/tests/'))).toEqual([]);
  });

  it('the baselines that named the deleted files were tightened with it', () => {
    // A baseline entry for a file that no longer exists claims credit for debt
    // that was deleted rather than converted, and pre-forgives anything that
    // returns under that name (CR-023).
    const errorShape = JSON.stringify(JSON.parse(read('docs/error-shape-baseline.json')));
    const orphans = JSON.stringify(JSON.parse(read('docs/server-orphans-baseline.json')));
    for (const name of ['meeting-scheduling-routes', 'run-meeting-scheduling-migration']) {
      expect({ name, inErrorShape: errorShape.includes(name) }).toEqual({
        name,
        inErrorShape: false,
      });
      expect({ name, inOrphans: orphans.includes(name) }).toEqual({ name, inOrphans: false });
    }
  });
});

describe('the edge half stops inventing, and says which kind of nothing it has', () => {
  const FN = read('supabase/functions/meetings/handlers/meetings.ts');
  const CODE = stripComments(FN);

  it('the mock constants are gone', () => {
    expect(CODE).not.toMatch(/MOCK_MEETING_TYPES/);
    expect(CODE).not.toMatch(/MOCK_ROOMS/);
    expect(CODE).not.toMatch(/Conference Room A|Huddle Room|Weekly Team Sync/);
  });

  it('GET /meetings answers 410 and names the endpoint that works', () => {
    // 410 rather than 501: the capability is not missing. A second reader of
    // calendar_events is the duplicate this repo keeps paying for, so the
    // withdrawal points at the real one instead of leaving a gap.
    const at = CODE.indexOf('export async function handleMeetings(');
    expect(at).toBeGreaterThan(-1);
    const body = CODE.slice(at, CODE.indexOf('export async function handleTypes('));
    expect(body).toMatch(/errorResponse\(\s*410,/);
    expect(body).not.toMatch(/jsonResponse\(/);
    expect(body).toMatch(/USE_CALENDAR_EVENTS/);
    expect(body).toMatch(/calendar\/events/);
    // And it no longer answers anything for a specific id, which used to return
    // the SAME meeting whatever was asked for.
    expect(body).not.toMatch(/meetingId/);
  });

  it('types and rooms answer 501, naming the table that does not exist', () => {
    for (const [fn, code] of [
      ['handleTypes', 'NO_MEETING_TYPES_TABLE'],
      ['handleRooms', 'NO_MEETING_ROOMS_TABLE'],
    ] as const) {
      const at = CODE.indexOf(`export async function ${fn}(`);
      expect({ fn, found: at > -1 }).toEqual({ fn, found: true });
      // Bound to the FUNCTION, not to a character window, and asserting the
      // absence of the thing it replaced: a mutant that prepends
      // `return jsonResponse(MOCK, 200, ...)` leaves the 501 text intact
      // further down, so a presence check passes while the mock is what runs.
      const end = CODE.indexOf('export async function ', at + 10);
      const body = CODE.slice(at, end > -1 ? end : undefined);
      expect(body).toMatch(/errorResponse\(\s*501,/);
      expect(body).toContain(code);
      expect(body).not.toMatch(/jsonResponse\(/);
    }
  });

  it('booking a suggested slot answers 501 instead of 201 for a row it never wrote', () => {
    // The worst of the four: a caller booked a meeting, got an id back, and
    // nothing existed. A fabricated write outcome is harder to catch than a
    // fabricated read, because the success IS the evidence.
    const at = CODE.indexOf("pathParts[0] === 'schedule' && pathParts[1]");
    expect(at).toBeGreaterThan(-1);
    const branch = CODE.slice(at, CODE.indexOf('export async function handleMeetings(', at));
    expect(branch).toMatch(/errorResponse\(\s*501,/);
    expect(branch).not.toMatch(/jsonResponse\(/);
    expect(branch).not.toMatch(/meeting-\$\{Date\.now\(\)\}/);
  });

  it('the analytics branch is untouched and still counts calendar_events', () => {
    // AUDIT-020 made this real; a retirement pass must not take it with the
    // mocks around it.
    const at = CODE.indexOf('export async function handleAnalytics(');
    expect(at).toBeGreaterThan(-1);
    const body = CODE.slice(at);
    expect(body).toMatch(/from\('calendar_events'\)/);
    expect(body).toMatch(/\.eq\('tenant_id', auth\.tenantId\)/);
  });

  it('schedule-request still runs its real Claude call', () => {
    expect(CODE).toMatch(/generateCompletion\(/);
  });

  it('the header records what disappears and where a real version would write', () => {
    // Deleting a broken attempt silently retires the idea with it.
    expect(FN).toMatch(/calendar_events` is where a real\s*\n\/\/ implementation would write/);
    expect(FN).toMatch(/COP-B12/);
  });
});

describe('the surface had no caller to lose', () => {
  const TREES = [
    'client/src',
    'printyx-client',
    'printyx-desktop',
    'mobile-app',
    'mobile',
    'browser-extensions',
    'printyx-extension',
    'ios',
  ];

  const sources: string[] = [];
  const visit = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(join(repo, dir));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const rel = `${dir}/${entry}`;
      if (statSync(join(repo, rel)).isDirectory()) visit(rel);
      else if (/\.(ts|tsx|js|jsx|swift|kt)$/.test(entry)) sources.push(read(rel));
    }
  };
  for (const tree of TREES) visit(tree);

  it('all eight trees were walked, so an empty result means something', () => {
    expect(sources.length).toBeGreaterThan(900);
  });

  it('nothing calls the retired paths', () => {
    for (const path of [
      '/api/types',
      '/api/rooms',
      '/api/schedule-request',
      '/api/optimize-schedule',
    ]) {
      const callers = sources.filter((s) => s.includes(path)).length;
      expect({ path, callers }).toEqual({ path, callers: 0 });
    }
  });

  it('every /api/meetings reference is the calendar sub-path, which stays', () => {
    // The one live consumer is CalendarProvider, and /api/meetings/calendar is
    // the only meetings prefix in crmProxies.
    const offenders = sources.filter((s) => /\/api\/meetings(?!\/calendar)/.test(s));
    expect(offenders).toHaveLength(0);
    expect(read('server/middleware/edge-function-proxy.ts')).toMatch(
      /'\/api\/meetings\/calendar': \{ fn: 'meetings', pathPrefix: '\/calendar' \}/,
    );
  });
});
