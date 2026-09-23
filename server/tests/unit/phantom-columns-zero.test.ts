/**
 * AUDIT-037: the phantom-column baseline is empty, and these are the eight
 * rebindings that emptied it.
 *
 * A column literal handed to PostgREST that is not a column on the table is a
 * runtime 42703 the moment the code path runs - invisible to tsc, to lint and
 * to any test that does not hit a database. All fifteen survivors lived in
 * edge functions no client calls, which is exactly COP-B03's setup: harmless
 * until somebody wires a caller, and then seven live 500s in one commit.
 *
 * Each assertion below is bound to the write or read that was wrong, because
 * a file-wide check passes while the one chain that matters still carries the
 * bad name.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tenants, businessRecords, tasks } from '../../../shared/schema';
import { ssoProviderConfigs, ssoSessions } from '../../../shared/sso-schema';
import { apiKeys } from '../../../shared/api-key-schema';
import { blogAssets } from '../../../shared/blog-schema';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const strip = (src: string) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const columnsOf = (t: unknown) => new Set(getTableConfig(t as never).columns.map((c) => c.name));

describe('the baseline is empty', () => {
  it('docs/phantom-columns-baseline.json allows nothing', () => {
    const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));
    expect(Object.keys(baseline.allowed)).toEqual([]);
  });
});

describe('the columns these functions now name are real', () => {
  it('tenants has metadata and not settings', () => {
    const cols = columnsOf(tenants);
    expect(cols.has('metadata')).toBe(true);
    expect(cols.has('settings')).toBe(false);
    for (const file of [
      'supabase/functions/settings/index.ts',
      'supabase/functions/auth-me/index.ts',
    ]) {
      // Bound to the tenants chain: both files legitimately say "settings"
      // elsewhere (user settings live on their own table).
      const src = strip(read(file));
      // Stop at the statement end, not after a fixed window: both files
      // legitimately say "settings" a few lines away, because USER settings
      // live on their own table.
      const chains = [...src.matchAll(/\.from\('tenants'\)([\s\S]*?);/g)].map((m) => m[1]);
      expect(chains.length).toBeGreaterThan(0);
      for (const chain of chains) expect(chain).not.toMatch(/['`]settings['`]|\bsettings:/);
    }
  });

  it('the tenant settings write MERGES, so it cannot wipe another feature keys', () => {
    // metadata is shared - auto-lead-routing keeps its configuration there -
    // so a rebind without a merge turns a 42703 into silent data loss.
    const src = read('supabase/functions/settings/index.ts');
    expect(src).toContain('metadata: merged');
    expect(src).toMatch(/\.\.\.\(\(existing\?\.metadata/);
  });

  it('business_records is searched on primary_contact_email', () => {
    expect(columnsOf(businessRecords).has('email')).toBe(false);
    const src = read('supabase/functions/business-records-search/index.ts');
    expect(strip(src)).toMatch(/ilikeAnyFilter\(\['company_name', 'primary_contact_email'\]/);
  });

  it('deals are summed on amount, not deal_value', () => {
    const src = strip(read('supabase/functions/sales-reports/index.ts'));
    expect(src).not.toContain('deal_value');
    expect(src).toContain("select('owner_id, amount, status')");
  });

  it('a monitored device heartbeat writes only real columns', () => {
    const src = strip(read('supabase/functions/remote-monitoring/index.ts'));
    const at = src.indexOf(".from('monitored_devices')\n        .update(");
    expect(at, 'no monitored_devices update found').toBeGreaterThan(-1);
    const payload = src.slice(at, src.indexOf('.eq(', at));
    expect(payload).toContain('last_seen');
    expect(payload).toContain('consecutive_failures');
    // An unknown column fails the WHOLE update, so last_seen went unstamped.
    expect(payload).not.toContain('status');
  });

  it('api_keys is written with key_salt and no phantom service or user_id', () => {
    const cols = columnsOf(apiKeys);
    expect(cols.has('key_salt')).toBe(true);
    expect(cols.has('service')).toBe(false);
    expect(cols.has('user_id')).toBe(false);
    const src = strip(read('supabase/functions/chrome-extension/index.ts'));
    const insert = src.slice(src.indexOf(".from('api_keys')"));
    const payload = insert.slice(0, insert.indexOf('.select('));
    expect(payload).toContain('key_salt: salt');
    /**
     * Derived, not string-matched: every TOP-LEVEL key in the payload must be
     * a real column. `service:` still appears inside `metadata: { service }`,
     * which is correct and which a bare `not.toContain('service:')` would
     * have reported as the defect - the same shape as an absence assertion
     * matching its own explanation.
     */
    const topLevel = [...payload.matchAll(/^ {10}([a-z_]+):/gm)].map((m) => m[1]);
    expect(topLevel.length).toBeGreaterThan(5);
    for (const key of topLevel) {
      expect(cols.has(key), `api_keys insert writes ${key}, which is not a column`).toBe(true);
    }
  });

  it('blog assets export names no filename column', () => {
    expect(columnsOf(blogAssets).has('filename')).toBe(false);
    expect(strip(read('supabase/functions/blog-platform-api/index.ts'))).not.toContain('filename');
  });

  it('the SSO provider test records its result in the columns that exist', () => {
    const cols = columnsOf(ssoProviderConfigs);
    for (const real of ['verified_at', 'last_error', 'last_error_at', 'error_count']) {
      expect(cols.has(real)).toBe(true);
    }
    for (const phantom of ['last_tested_at', 'last_test_success', 'last_test_error']) {
      expect(cols.has(phantom)).toBe(false);
    }
    const src = strip(read('supabase/functions/sso/index.ts'));
    expect(src).toContain('verified_at: now');
    expect(src).not.toContain('last_test_success');
    // A success must clear the error, or a provider reads as working and
    // broken at once.
    expect(src).toContain('last_error: null');
  });
});

describe('the SSO session insert is gone rather than migrated', () => {
  const src = strip(read('supabase/functions/sso/index.ts'));

  it('nothing inserts into sso_sessions', () => {
    expect(src).not.toContain("from('sso_sessions').insert");
  });

  it('because the table requires a user the callback does not have', () => {
    // Adding the three phantom columns would not have made the insert work:
    // user_id is NOT NULL with a FK, and JIT provisioning is unbuilt.
    const cfg = getTableConfig(ssoSessions as never);
    const userId = cfg.columns.find((c) => c.name === 'user_id');
    const sessionId = cfg.columns.find((c) => c.name === 'session_id');
    expect(userId?.notNull).toBe(true);
    expect(sessionId?.notNull).toBe(true);
  });

  it('and the response says no session was stored', () => {
    expect(src).toContain('sessionPersisted: false');
  });
});

describe('a dependency graph nothing can fill is not returned as empty', () => {
  it('tasks has no dependencies column', () => {
    expect(columnsOf(tasks).has('dependencies')).toBe(false);
  });

  it('so the endpoint answers null edges and says why', () => {
    // `edges: []` is not "we do not know" - it is the claim that every task
    // in the project is independent and can start now.
    const src = read('supabase/functions/teams/handlers/projects.ts');
    expect(src).toContain('edges: null');
    expect(src).toContain('Task dependencies are not stored');
    expect(strip(src)).not.toContain("select('id, title, dependencies')");
  });
});
