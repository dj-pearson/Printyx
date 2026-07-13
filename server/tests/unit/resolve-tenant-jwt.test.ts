import { describe, it, expect } from 'vitest';
import { tenantFromJwt } from '../../../supabase/functions/_shared/resolve-tenant';

// CR-010: tenant must come from the verified JWT app_metadata only — never from
// user-editable user_metadata or the x-tenant-id header.
describe('tenantFromJwt (CR-010 JWT-only tenant resolution)', () => {
  it('resolves tenant from app_metadata.tenantId', () => {
    expect(tenantFromJwt({ app_metadata: { tenantId: 'tenant-A' } })).toBe('tenant-A');
  });

  it('resolves the snake_case tenant_id variant', () => {
    expect(tenantFromJwt({ app_metadata: { tenant_id: 'tenant-A' } })).toBe('tenant-A');
  });

  it('IGNORES a spoofed tenant in user_metadata', () => {
    // user_metadata is editable by the user via the client SDK — must not count.
    const user = { app_metadata: {}, user_metadata: { tenantId: 'attacker-tenant' } } as any;
    expect(tenantFromJwt(user)).toBeNull();
  });

  it('returns null when app_metadata has no tenant (caller then 400/403s)', () => {
    expect(tenantFromJwt({ app_metadata: {} })).toBeNull();
    expect(tenantFromJwt({})).toBeNull();
    expect(tenantFromJwt(null)).toBeNull();
    expect(tenantFromJwt(undefined)).toBeNull();
  });

  it('rejects a non-string tenant value', () => {
    expect(tenantFromJwt({ app_metadata: { tenantId: 12345 } } as any)).toBeNull();
    expect(tenantFromJwt({ app_metadata: { tenantId: '' } })).toBeNull();
  });
});
