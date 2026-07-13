import { describe, it, expect, vi } from 'vitest';
import { resolveTenant } from '../../middleware/tenancy';

// CR-001: resolveTenant now runs AFTER authentication, so it can validate the
// x-tenant-id header against the caller's real tenant and fail closed for
// unauthenticated requests.

function mockReq(opts: {
  header?: string;
  supabaseUser?: Record<string, unknown>;
  user?: Record<string, unknown>;
}) {
  const headers: Record<string, string | undefined> = {
    'x-tenant-id': opts.header,
    host: 'app.example.com',
  };
  return {
    get: (h: string) => headers[h.toLowerCase()],
    supabaseUser: opts.supabaseUser,
    user: opts.user,
    session: {},
    path: '/api/customers',
    method: 'GET',
    ip: '127.0.0.1',
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('resolveTenant — CR-001 cross-tenant header override', () => {
  it('rejects (403) a tenant-A JWT with a tenant-B x-tenant-id header (non-admin)', async () => {
    const req = mockReq({
      header: 'tenant-B',
      supabaseUser: { id: 'u1', tenantId: 'tenant-A', isPlatformUser: false, roleLevel: 3 },
    });
    const res = mockRes();
    const next = vi.fn();

    await resolveTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.tenantId).not.toBe('tenant-B');
  });

  it('allows a matching header and resolves the JWT tenant', async () => {
    const req = mockReq({
      header: 'tenant-A',
      supabaseUser: { id: 'u1', tenantId: 'tenant-A', isPlatformUser: false, roleLevel: 3 },
    });
    const res = mockRes();
    const next = vi.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.tenantId).toBe('tenant-A');
  });

  it('lets a platform admin access another tenant via header', async () => {
    const req = mockReq({
      header: 'tenant-B',
      supabaseUser: { id: 'admin', tenantId: 'tenant-A', isPlatformUser: true, roleLevel: 8 },
    });
    const res = mockRes();
    const next = vi.fn();

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.tenantId).toBe('tenant-B');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails closed: unauthenticated request with an x-tenant-id header is rejected (403)', async () => {
    const req = mockReq({ header: 'tenant-B' }); // no supabaseUser / user
    const res = mockRes();
    const next = vi.fn();

    await resolveTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.tenantId).not.toBe('tenant-B');
  });
});
