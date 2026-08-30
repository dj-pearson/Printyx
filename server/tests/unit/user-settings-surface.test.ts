/**
 * The /api/user surface: one implementation, one table.
 *
 * Three things were true here at once and none of them is visible to tsc.
 *
 *  1. /api/user was not proxied, so DEV ran server/routes-settings.ts while
 *     production ran supabase/functions/user/. They disagreed about storage:
 *     Express put phone/jobTitle/department on user_settings and changed
 *     passwords by rehashing users.password_hash; the edge function puts those
 *     three in users.metadata (they have no column) and changes passwords
 *     through GoTrue. Testing the Settings page in dev proved nothing about
 *     production.
 *  2. Both /preferences handlers read and wrote `user_preferences`, a relation
 *     in no schema and no migration. GET swallowed the 42P01 and answered 200
 *     with hardcoded defaults, so the tab looked like a user who had set
 *     nothing.
 *  3. /api/user/notification-preferences was served by neither backend.
 *
 * Comments are stripped before every assertion. An absence assertion otherwise
 * matches the comment explaining the removal - this repo has produced that bug
 * three times.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));
const userFn = read('supabase/functions/user/index.ts');
const proxy = read('server/middleware/edge-function-proxy.ts');
const registry = read('server/routes-registry.ts');

describe('/api/user routing', () => {
  it('is proxied in dev to the same function production uses', () => {
    expect(proxy).toMatch(/'\/api\/user':\s*'user'/);
  });

  it('needs no server.ts alias, because the directory name is the URL segment', () => {
    expect(existsSync(join(repo, 'supabase/functions/user'))).toBe(true);
    const dispatcher = read('supabase/functions/server.ts');
    expect(dispatcher).not.toMatch(/functionName === 'user'/);
  });

  it('has no Express handlers left under the proxied prefix', () => {
    expect(registry).not.toMatch(/app\.(get|put|post|delete)\('\/api\/user\//);
    expect(existsSync(join(repo, 'server/routes-settings.ts'))).toBe(false);
  });

  it('keeps one implementation - the duplicate user-settings function is gone', () => {
    expect(existsSync(join(repo, 'supabase/functions/user-settings'))).toBe(false);
  });
});

describe('/api/user storage', () => {
  it('never touches user_preferences, which exists in no schema or migration', () => {
    expect(userFn).not.toMatch(/user_preferences/);
  });

  it('reads and writes preferences on user_settings, the table GET /settings reads', () => {
    // Both directions, so a half-migration - reading the real table while
    // writing the phantom one - fails here rather than in production.
    const preferenceBranches = userFn.match(/endpoint === 'preferences'[\s\S]{0,2000}?\n    \}/g);
    expect(preferenceBranches).toHaveLength(2);
    for (const branch of preferenceBranches ?? []) {
      expect(branch).toMatch(/from\('user_settings'\)/);
    }
  });

  it('merges the notifications jsonb rather than replacing it', () => {
    // The preferences tab writes four channel toggles; the notification dialog
    // keeps its per-type choices under `detailed` on the same column. A
    // replacing write from either side erases the other.
    expect(userFn).toMatch(/notifications:\s*\{\s*\n?\s*\.\.\./);
    expect(userFn).toMatch(/detailed/);
  });

  it('resolves a tenant id before any upsert, since user_settings.tenant_id is NOT NULL', () => {
    const upserts = userFn.match(/upsert\(/g) ?? [];
    expect(upserts.length).toBeGreaterThan(0);
    const resolves = userFn.match(/await resolveTenantId\(\)/g) ?? [];
    expect(resolves.length).toBe(upserts.length);
  });
});

describe('/api/user/notification-preferences', () => {
  it('is served', () => {
    expect(userFn).toMatch(/endpoint === 'notification-preferences'/);
  });

  it('stores choices, not the type catalogue', () => {
    const client = read('client/src/components/layout/notification-preferences.tsx');
    // Labels and descriptions stay in the component; only typeSettings goes up.
    expect(client).toMatch(/typeSettings: Object\.fromEntries/);
    expect(client).toMatch(/function mergeWithDefaults/);
  });
});
