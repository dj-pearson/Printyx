/**
 * The calendar surface: one prefix, and it is not the one that was mocked.
 *
 * server/routes/calendar-routes.ts served /api/calendar with nine handlers that
 * each said what they were - "Mock response for now", "Mock event creation",
 * "Mock event deletion" - and no client tree called that prefix. The only
 * reference anywhere was a test NAME inside an archived .backup file. Deleted:
 * porting a mock handler is the fix PROD-011 ruled out, and deleting one is not
 * a loss.
 *
 * The real surface is CalendarProvider, wrapped around the routed
 * /demo-scheduling page, and it uses a different prefix entirely -
 * /api/integrations/calendar/* - which NEITHER backend serves. It degrades
 * honestly ("Calendar sync is not configured", "Event Saved Locally"), and in
 * production those messages never ran: a relative fetch('/api/...') never
 * passes through getApiUrl, so it hit the static-bundle origin, which answers
 * an unknown path with index.html at 200. `response.ok` was true and
 * `response.json()` then threw on the HTML, so the destructive "Event Creation
 * Failed" branch ran instead of the graceful one. Through apiRequest the
 * request reaches the functions host, 404s, throws, and the honest branch runs.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

describe('the mocked /api/calendar router', () => {
  it('is gone', () => {
    expect(existsSync(join(repo, 'server/routes/calendar-routes.ts'))).toBe(false);
  });

  it('is not registered', () => {
    expect(read('server/routes-registry.ts')).not.toMatch(/\['\/api\/calendar',/);
  });
});

describe('CalendarProvider', () => {
  const provider = read('client/src/components/calendar/CalendarProvider.tsx');

  it('goes through apiRequest, so its fallbacks run in production too', () => {
    expect(provider).not.toMatch(/fetch\(\s*`\/api\//);
    expect((provider.match(/apiRequest\(/g) ?? []).length).toBe(4);
  });

  it('still tells the user what happened rather than failing silently', () => {
    // The point of the change is that these branches now execute; losing them
    // would trade a misleading error for no message at all.
    expect(provider).toMatch(/Calendar sync is not configured/);
    expect(provider).toMatch(/Event Saved Locally/);
  });
});
