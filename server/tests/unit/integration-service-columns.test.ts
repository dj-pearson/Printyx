import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { systemIntegrations } from '@shared/schema';
import { toIntegrationData } from '../../integrations/integration-service';

/**
 * QUALITY-002. `system_integrations` has `configuration` and `credentials`.
 * IntegrationService read `integration.config` everywhere, which is not a
 * property on the row, so `integration.config?.tokens` was undefined for every
 * integration - and its INSERT carried `category`, `description`, `config` and
 * `syncFrequency` while omitting `type`, which is NOT NULL with no default.
 * Drizzle drops unknown keys silently, so the insert reduced to a row missing a
 * NOT NULL column and threw: every OAuth callback failed at the point of
 * storing the connection.
 *
 * tsc catches this class now, but only because the file is inside the ratchet.
 * These tests pin the two things a future edit could break without tsc noticing:
 * the mapper reading the right jsonb columns, and the status vocabulary.
 */
const columns = Object.keys(getTableColumns(systemIntegrations));

/**
 * Comments are stripped before any "this text is absent" assertion. The comment
 * explaining why `db.sql` was removed necessarily names it, and a check that
 * cannot tell prose from code reports its own explanation as the defect.
 */
function codeOf(...segments: string[]): string {
  return readFileSync(join(__dirname, '..', '..', ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('IntegrationService column contract', () => {
  it('the row has configuration and credentials, and no config', () => {
    expect(columns).toContain('configuration');
    expect(columns).toContain('credentials');
    expect(columns).not.toContain('config');
    // The keys the broken insert carried, none of which exist.
    for (const phantom of ['category', 'description', 'syncFrequency']) {
      expect(columns).not.toContain(phantom);
    }
  });

  it('maps tokens out of credentials, not configuration', () => {
    const mapped = toIntegrationData({
      id: 'i1',
      tenantId: 't1',
      name: 'Acme QBO',
      provider: 'quickbooks',
      status: 'active',
      configuration: { userInfo: { realmId: '42' }, category: 'accounting' },
      credentials: { access_token: 'at', refresh_token: 'rt' },
      lastSync: null,
    });

    expect(mapped.tokens?.access_token).toBe('at');
    expect(mapped.metadata).toEqual({ realmId: '42' });
    expect(mapped.config).toEqual({ userInfo: { realmId: '42' }, category: 'accounting' });
    expect(mapped.lastSync).toBeUndefined();
  });

  it('reports no tokens rather than an empty token object when credentials are unset', () => {
    const mapped = toIntegrationData({
      id: 'i1',
      tenantId: 't1',
      name: 'Acme',
      provider: 'google',
      status: 'pending',
      configuration: null,
      credentials: null,
      lastSync: null,
    });

    // A truthy {} here would make every "do we have a token" check pass.
    expect(mapped.tokens).toBeUndefined();
    expect(mapped.config).toEqual({});
  });

  it("never writes the status 'connected', which is outside the column vocabulary", () => {
    const source = codeOf('integrations', 'integration-service.ts');
    expect(source).not.toMatch(/status:\s*'connected'/);
    expect(source).toMatch(/status:\s*'active'/);
  });

  it('the token refresh service persists to credentials, not a config column', () => {
    const source = codeOf('services', 'oauth-token-refresh.ts');
    // .set({ config: ... }) was dropped wholesale by Drizzle, so a refreshed
    // token was never stored while the function logged success.
    expect(source).not.toMatch(/config:\s*updatedConfig/);
    expect(source).not.toMatch(/db\.sql`/);
    expect(source).toContain('credentials: {');
  });
});
