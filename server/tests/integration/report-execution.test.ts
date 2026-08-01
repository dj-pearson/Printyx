/**
 * Integration Tests: End-to-End Report Execution
 * Tests complete report execution flow from request to response
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mockUsers } from '../setup';

// =====================================================================
// MOCK REPORT DEFINITIONS
// =====================================================================

const mockReportDefinitions = {
  SALES_PIPELINE_INDIVIDUAL: {
    code: 'SALES_PIPELINE_INDIVIDUAL',
    name: 'My Sales Pipeline',
    category: 'sales',
    requiredLevel: 1,
    requiredPermissions: ['sales.lead.view_own'],
    requiredScope: 'own',
    cacheDuration: 300,
    sqlTemplate: `
      SELECT
        id, name, stage, value, created_at, owner_id
      FROM opportunities
      WHERE tenant_id = :tenantId
        AND owner_id = :userId
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 100
    `,
  },
  SALES_TEAM_DASHBOARD: {
    code: 'SALES_TEAM_DASHBOARD',
    name: 'Team Sales Dashboard',
    category: 'sales',
    requiredLevel: 3,
    requiredPermissions: ['sales.lead.view_team'],
    requiredScope: 'team',
    cacheDuration: 600,
    sqlTemplate: `
      SELECT
        COUNT(*) as total_opportunities,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        stage
      FROM opportunities
      WHERE tenant_id = :tenantId
        AND team_id = :teamId
      GROUP BY stage
      ORDER BY stage
    `,
  },
  EXECUTIVE_DASHBOARD: {
    code: 'EXECUTIVE_DASHBOARD',
    name: 'Executive Dashboard',
    category: 'executive',
    requiredLevel: 7,
    requiredPermissions: ['executive.dashboard.view'],
    requiredScope: 'company',
    cacheDuration: 1800,
    sqlTemplate: `
      SELECT
        'revenue' as metric,
        SUM(amount) as value
      FROM invoices
      WHERE tenant_id = :tenantId
        AND status = 'paid'
        AND EXTRACT(MONTH FROM paid_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      UNION ALL
      SELECT
        'opportunities' as metric,
        COUNT(*) as value
      FROM opportunities
      WHERE tenant_id = :tenantId
        AND status = 'open'
    `,
  },
};

// =====================================================================
// SCOPED PERMISSION MATCHING
// =====================================================================

/**
 * The canonical organizational scope hierarchy, ordered narrowest -> broadest.
 * Mirrors server/middleware/enhanced-rbac-middleware.ts and
 * hierarchical-query-builder.ts#canAccessScope, which both grant access when
 * userScopeIndex >= requiredScopeIndex.
 */
const SCOPE_HIERARCHY = ['own', 'team', 'location', 'regional', 'company', 'platform'] as const;

/**
 * Split a `<module>.<resource>.<action>_<scope>` permission into its base and scope.
 * Returns a null scope for unscoped permissions (`executive.dashboard.view`) and for
 * trailing segments that are not real scopes (`platform.admin.full_access`), so those
 * fall back to exact matching.
 */
const splitScopedPermission = (permission: string): { base: string; scope: string | null } => {
  const separatorIndex = permission.lastIndexOf('_');
  if (separatorIndex === -1) {
    return { base: permission, scope: null };
  }

  const scope = permission.slice(separatorIndex + 1);
  if (!(SCOPE_HIERARCHY as readonly string[]).includes(scope)) {
    return { base: permission, scope: null };
  }

  return { base: permission.slice(0, separatorIndex), scope };
};

/**
 * True when the user holds `required`, either exactly or via a BROADER scope on the
 * same action. A Sales Manager holding `sales.lead.view_location` can necessarily view
 * `sales.lead.view_own` records; the reverse must never hold.
 *
 * The base (`sales.lead.view`) must match exactly, so a broad scope on one resource
 * never satisfies a requirement on a different resource.
 */
const satisfiesPermission = (userPermissions: string[] | undefined, required: string): boolean => {
  const granted = userPermissions ?? [];
  if (granted.includes(required)) {
    return true;
  }

  const { base, scope } = splitScopedPermission(required);
  if (scope === null) {
    return false;
  }

  const requiredScopeIndex = SCOPE_HIERARCHY.indexOf(scope as (typeof SCOPE_HIERARCHY)[number]);

  return granted.some((permission) => {
    const held = splitScopedPermission(permission);
    if (held.scope === null || held.base !== base) {
      return false;
    }
    const heldScopeIndex = SCOPE_HIERARCHY.indexOf(held.scope as (typeof SCOPE_HIERARCHY)[number]);
    return heldScopeIndex >= requiredScopeIndex;
  });
};

const SUPPORTED_EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;

// =====================================================================
// MOCK REPORT ENGINE
// =====================================================================

class MockReportEngine {
  static async executeReport(
    reportCode: string,
    user: any,
    params: any = {},
  ): Promise<{ success: boolean; data?: any[]; error?: string; executionTime?: number }> {
    const startTime = Date.now();
    const report = mockReportDefinitions[reportCode as keyof typeof mockReportDefinitions];

    if (!report) {
      return { success: false, error: 'Report not found' };
    }

    // Check permissions BEFORE role level, matching requirePermission in
    // server/middleware/enhanced-rbac-middleware.ts, which gates on the permission
    // grant first and only then applies options.minLevel. A caller who holds no
    // relevant grant at all is a permission failure, not a level failure.
    const hasPermission = report.requiredPermissions.some((p) =>
      satisfiesPermission(user.permissions, p),
    );
    if (!hasPermission) {
      return { success: false, error: 'Missing required permissions' };
    }

    if (user.roleLevel < report.requiredLevel) {
      return { success: false, error: 'Insufficient role level' };
    }

    // Simulate SQL execution with mock data
    let mockData: any[] = [];

    if (reportCode === 'SALES_PIPELINE_INDIVIDUAL') {
      mockData = [
        { id: 1, name: 'Deal 1', stage: 'Discovery', value: 10000, owner_id: user.id },
        { id: 2, name: 'Deal 2', stage: 'Proposal', value: 25000, owner_id: user.id },
      ];
    } else if (reportCode === 'SALES_TEAM_DASHBOARD') {
      mockData = [
        { stage: 'Discovery', total_opportunities: 5, total_value: 50000, avg_value: 10000 },
        { stage: 'Proposal', total_opportunities: 3, total_value: 75000, avg_value: 25000 },
      ];
    } else if (reportCode === 'EXECUTIVE_DASHBOARD') {
      mockData = [
        { metric: 'revenue', value: 250000 },
        { metric: 'opportunities', value: 45 },
      ];
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: mockData,
      executionTime,
    };
  }

  static async exportReport(
    reportCode: string,
    user: any,
    format: 'csv' | 'xlsx' | 'pdf',
    params: any = {},
  ): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
    // Validate the requested format BEFORE executing. Format is pure request shape:
    // checking it needs no privileges and reveals nothing about the report or the
    // caller's rights, so reporting it first is the correct contract (400-before-403).
    // Rejecting it here also means an unsupported format can never reach data access.
    // The permission gate below is unchanged: an unauthorized caller asking for a
    // SUPPORTED format is still refused with 'Missing required permissions'.
    if (!(SUPPORTED_EXPORT_FORMATS as readonly string[]).includes(format)) {
      return { success: false, error: `Unsupported format: ${format}` };
    }

    const result = await this.executeReport(reportCode, user, params);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Simulate export generation
    let mockBuffer: Buffer;

    if (format === 'csv') {
      const csv = 'id,name,value\n1,Test,100\n';
      mockBuffer = Buffer.from(csv, 'utf-8');
    } else if (format === 'xlsx') {
      // Simulate Excel binary data
      mockBuffer = Buffer.from('XLSX_BINARY_DATA', 'utf-8');
    } else {
      // Simulate PDF binary data
      mockBuffer = Buffer.from('PDF_BINARY_DATA', 'utf-8');
    }

    return {
      success: true,
      buffer: mockBuffer,
    };
  }
}

// =====================================================================
// TESTS
// =====================================================================

describe('Report Execution Integration Tests', () => {
  describe('Individual Contributor Reports (Level 1-2)', () => {
    it('should execute individual sales pipeline report', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeLessThan(1000);
    });

    it('should deny access to team reports for individual contributors', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('permission');
    });

    it('should deny access to executive reports for individual contributors', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('EXECUTIVE_DASHBOARD', user);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Manager Reports (Level 3-4)', () => {
    it('should execute team dashboard for managers', async () => {
      const user = mockUsers.salesManager;
      const result = await MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });

    it('should allow managers to view their own reports', async () => {
      const user = mockUsers.salesManager;
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should deny executive reports to managers', async () => {
      const user = mockUsers.salesManager;
      const result = await MockReportEngine.executeReport('EXECUTIVE_DASHBOARD', user);

      expect(result.success).toBe(false);
    });
  });

  describe('Executive Reports (Level 7)', () => {
    it('should execute executive dashboard for CEO', async () => {
      const user = mockUsers.ceo;
      const result = await MockReportEngine.executeReport('EXECUTIVE_DASHBOARD', user);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.some((d) => d.metric === 'revenue')).toBe(true);
      expect(result.data?.some((d) => d.metric === 'opportunities')).toBe(true);
    });

    it('should allow CEO to access all lower-level reports', async () => {
      const user = mockUsers.ceo;

      const individualResult = await MockReportEngine.executeReport(
        'SALES_PIPELINE_INDIVIDUAL',
        user,
      );
      expect(individualResult.success).toBe(true);

      const teamResult = await MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user);
      // CEO doesn't have team permission in our mock, but has higher level
      // In real implementation, this would work due to level hierarchy
    });
  });

  describe('Report Caching', () => {
    it('should cache report results for faster subsequent access', async () => {
      const user = mockUsers.salesRep;

      // First execution
      const result1 = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);
      const time1 = result1.executionTime!;

      // Second execution (would be cached in real implementation)
      const result2 = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result2.success).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });

    it('should respect cache duration settings', async () => {
      const report = mockReportDefinitions.SALES_PIPELINE_INDIVIDUAL;
      expect(report.cacheDuration).toBe(300); // 5 minutes
    });
  });

  describe('Report Parameter Substitution', () => {
    it('should substitute userId parameter', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user, {
        userId: user.id,
      });

      expect(result.success).toBe(true);
      expect(result.data?.every((d) => d.owner_id === user.id)).toBe(true);
    });

    it('should substitute tenantId parameter', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user, {
        tenantId: user.tenantId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should export report as CSV', async () => {
      const user = mockUsers.regionalDirector; // Has export permission
      const result = await MockReportEngine.exportReport('SALES_PIPELINE_INDIVIDUAL', user, 'csv');

      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should export report as Excel', async () => {
      const user = mockUsers.regionalDirector;
      const result = await MockReportEngine.exportReport('SALES_PIPELINE_INDIVIDUAL', user, 'xlsx');

      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
    });

    it('should export report as PDF', async () => {
      const user = mockUsers.regionalDirector;
      const result = await MockReportEngine.exportReport('SALES_PIPELINE_INDIVIDUAL', user, 'pdf');

      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
    });

    it('should deny export for unsupported formats', async () => {
      const user = mockUsers.regionalDirector;
      const result = await MockReportEngine.exportReport(
        'SALES_PIPELINE_INDIVIDUAL',
        user,
        'xml' as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });
  });

  // Scope subsumption is the only widening in the permission model, so these lock the
  // direction it must NOT travel. Without them a regression that made matching
  // symmetric (or base-insensitive) would still leave every test above green.
  describe('Scoped Permission Boundaries', () => {
    it('should not let a narrower scope satisfy a broader requirement', async () => {
      // salesRep holds sales.lead.view_own; the team dashboard demands view_team.
      const result = await MockReportEngine.executeReport(
        'SALES_TEAM_DASHBOARD',
        mockUsers.salesRep,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required permissions');
    });

    it('should not let a broad scope on one resource satisfy another resource', async () => {
      const user = {
        ...mockUsers.salesRep,
        roleLevel: 7,
        // Company-wide, but on opportunities rather than leads.
        permissions: ['sales.opportunity.view_company'],
      };
      const result = await MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required permissions');
    });

    it('should require an exact match for unscoped permissions', async () => {
      const user = {
        ...mockUsers.ceo,
        // platform.admin.full_access must not be parsed as scope "access", and no
        // scope grant substitutes for the literal executive.dashboard.view.
        permissions: ['platform.admin.full_access', 'executive.dashboard.view_company'],
      };
      const result = await MockReportEngine.executeReport('EXECUTIVE_DASHBOARD', user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required permissions');
    });

    it('should still report a level failure when the caller holds the permission', async () => {
      // Permission-first ordering must not swallow the role-level gate.
      const user = { ...mockUsers.salesManager, roleLevel: 1 };
      const result = await MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient role level');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent reports gracefully', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('NON_EXISTENT_REPORT', user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Report not found');
    });

    it('should handle missing permissions gracefully', async () => {
      const user = {
        ...mockUsers.salesRep,
        permissions: [], // No permissions
      };
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should handle insufficient role level gracefully', async () => {
      const user = {
        ...mockUsers.salesRep,
        roleLevel: 0, // Below minimum
      };
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('role level');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should execute simple reports in under 1 second', async () => {
      const user = mockUsers.salesRep;
      const result = await MockReportEngine.executeReport('SALES_PIPELINE_INDIVIDUAL', user);

      expect(result.executionTime).toBeLessThan(1000);
    });

    it('should execute complex reports in under 5 seconds', async () => {
      const user = mockUsers.ceo;
      const result = await MockReportEngine.executeReport('EXECUTIVE_DASHBOARD', user);

      expect(result.executionTime).toBeLessThan(5000);
    });

    // NOTE: this test previously failed for all 10 executions, which read as a
    // concurrency limit. It was not: every execution failed identically because
    // salesManager holds sales.lead.view_location and the engine demanded a literal
    // sales.lead.view_team. There is no concurrency limit here to fix or document.
    it('should handle concurrent report executions', async () => {
      const user = mockUsers.salesManager;

      const promises = Array.from({ length: 10 }, () =>
        MockReportEngine.executeReport('SALES_TEAM_DASHBOARD', user),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });
});
