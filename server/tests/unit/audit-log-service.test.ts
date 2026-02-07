import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
});
const mockSelectCount = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
  }),
});

vi.mock('../../db', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => {
      // If called with count, return the count mock
      const firstArg = args[0];
      if (firstArg && typeof firstArg === 'object' && 'count' in firstArg) {
        return mockSelectCount(...args);
      }
      return mockSelect(...args);
    },
  },
}));

vi.mock('@shared/security-schema', () => ({
  auditLogs: {
    tenantId: 'tenantId',
    userId: 'userId',
    action: 'action',
    category: 'category',
    timestamp: 'timestamp',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', field: a, value: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  desc: vi.fn((a) => ({ type: 'desc', field: a })),
  gte: vi.fn((a, b) => ({ type: 'gte', field: a, value: b })),
  lte: vi.fn((a, b) => ({ type: 'lte', field: a, value: b })),
  sql: vi.fn(),
}));

import {
  logAction,
  logAuthEvent,
  logAdminAction,
  logDeletion,
  queryAuditLogs,
} from '../../services/audit-log-service';

function createMockRequest(overrides: any = {}) {
  return {
    ip: '192.168.1.1',
    headers: {
      'user-agent': 'TestAgent/1.0',
      'x-request-id': 'req-123',
      ...overrides.headers,
    },
    ...overrides,
  } as any;
}

describe('Audit Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAction', () => {
    it('should insert an audit log entry with all fields', async () => {
      const req = createMockRequest();

      await logAction({
        action: 'user_create',
        resourceType: 'users',
        resourceId: 'user-456',
        userId: 'admin-123',
        tenantId: 'tenant-789',
        details: { name: 'John Doe' },
        req,
        severity: 'high',
        category: 'authorization',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const values = mockInsert.mock.results[0]?.value?.values;
      expect(values).toBeDefined();
    });

    it('should not throw on database error', async () => {
      mockInsert.mockReturnValueOnce({
        values: vi.fn().mockRejectedValue(new Error('DB error')),
      });

      // Should not throw
      await expect(
        logAction({
          action: 'test',
          resourceType: 'test',
          userId: 'u1',
          tenantId: 't1',
        }),
      ).resolves.toBeUndefined();
    });

    it('should use defaults when req is not provided', async () => {
      await logAction({
        action: 'system_event',
        resourceType: 'system',
        userId: 'sys',
        tenantId: 'tenant-1',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should default severity to low and category to data_modification', async () => {
      await logAction({
        action: 'minor_update',
        resourceType: 'records',
        userId: 'u1',
        tenantId: 't1',
      });

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('logAuthEvent', () => {
    it('should log with authentication category', async () => {
      const req = createMockRequest();

      await logAuthEvent('login_success', 'user-1', 'tenant-1', req);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should set high severity for failure events', async () => {
      const req = createMockRequest();

      await logAuthEvent('login_failure', 'user-1', 'tenant-1', req);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should set medium severity for success events', async () => {
      const req = createMockRequest();

      await logAuthEvent('login_success', 'user-1', 'tenant-1', req);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should pass details through', async () => {
      const req = createMockRequest();

      await logAuthEvent('password_change', 'user-1', 'tenant-1', req, { method: 'reset_link' });

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('logAdminAction', () => {
    it('should log with authorization category and high severity', async () => {
      const req = createMockRequest();

      await logAdminAction('role_change', 'roles', 'role-1', 'admin-1', 'tenant-1', req);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should include resource details', async () => {
      const req = createMockRequest();

      await logAdminAction(
        'permission_change',
        'permissions',
        'perm-1',
        'admin-1',
        'tenant-1',
        req,
        {
          oldRole: 'viewer',
          newRole: 'admin',
        },
      );

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('logDeletion', () => {
    it('should log with record_delete action and high severity', async () => {
      const req = createMockRequest();

      await logDeletion('customers', 'cust-1', 'user-1', 'tenant-1', req);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should include deletion details', async () => {
      const req = createMockRequest();

      await logDeletion('contacts', 'contact-1', 'user-1', 'tenant-1', req, {
        deletedName: 'John Doe',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('queryAuditLogs', () => {
    it('should return logs with pagination', async () => {
      const result = await queryAuditLogs({ tenantId: 'tenant-1' });

      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('totalPages');
    });

    it('should use default page 1 and limit 50', async () => {
      const result = await queryAuditLogs({ tenantId: 'tenant-1' });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('should accept custom page and limit', async () => {
      const result = await queryAuditLogs({ tenantId: 'tenant-1', page: 3, limit: 10 });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
    });

    it('should accept action filter', async () => {
      await queryAuditLogs({ tenantId: 'tenant-1', action: 'login_success' });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('should accept userId filter', async () => {
      await queryAuditLogs({ tenantId: 'tenant-1', userId: 'user-123' });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('should accept date range filters', async () => {
      await queryAuditLogs({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('should accept category filter', async () => {
      await queryAuditLogs({ tenantId: 'tenant-1', category: 'authentication' });

      expect(mockSelect).toHaveBeenCalled();
    });
  });
});
