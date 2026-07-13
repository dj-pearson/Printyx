import { describe, it, expect, vi } from 'vitest';
import { requirePermission } from '../../middleware/enhanced-rbac-middleware';

// CR-003: the destructive / financial product & AP/AR routes in
// routes-products-crud.ts are now gated by requirePermission([...]). These tests
// verify the middleware denies a low-privilege (Guest-like) user and allows a
// user that holds the permission.

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockUser(perms: string[]) {
  return {
    id: 'u1',
    tenantId: 't1',
    permissions: new Set(perms),
    hasAllPermissions: false,
    roleLevel: 1,
    territoryScope: 'own',
  };
}

describe('CR-003 requirePermission gating on products/AP/AR CRUD', () => {
  it('returns 403 when a low-role user lacks inventory.item.delete', () => {
    const mw = requirePermission(['inventory.item.delete'], { auditLog: false });
    const req: any = { user: mockUser(['inventory.item.view']) };
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a Guest hitting accounts-payable (finance.bill.enter)', () => {
    const mw = requirePermission(['finance.bill.enter'], { auditLog: false });
    const req: any = { user: mockUser([]) }; // no permissions at all
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the user holds the required permission', () => {
    const mw = requirePermission(['inventory.item.delete']);
    const req: any = { user: mockUser(['inventory.item.delete']) };
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', () => {
    const mw = requirePermission(['inventory.item.create']);
    const req: any = {};
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
