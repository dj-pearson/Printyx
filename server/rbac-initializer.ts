import { rbacService } from './enhanced-rbac-service';
import { rbacSeeder } from './enhanced-rbac-seeder';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { enhancedRoles, organizationalUnits } from './enhanced-rbac-schema';

/**
 * RBAC System Initializer
 * 
 * This module handles the initialization of the Enhanced RBAC system for new tenants
 * and provides utilities for checking and managing RBAC system state.
 */

export class RBACInitializer {
  /**
   * Initialize RBAC system for a tenant
   */
  async initializeTenant(tenantId: string, dealerType: 'small' | 'standard' | 'enterprise', userId: string) {
    try {
      // Check if already initialized
      const existingRoles = await db.select()
        .from(enhancedRoles)
        .where(eq(enhancedRoles.tenantId, tenantId))
        .limit(1);

      if (existingRoles.length > 0) {
        throw new Error('RBAC system already initialized for this tenant');
      }

      // Create company organizational unit first
      const [companyUnit] = await db.insert(organizationalUnits).values({
        id: `company-${tenantId}`,
        tenantId,
        name: 'Company',
        code: 'COMPANY',
        tier: 'COMPANY',
        parentUnitId: null,
        lft: 1,
        rgt: 2,
        depth: 0,
        description: 'Company-wide organizational unit',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // Initialize based on dealer type
      switch (dealerType) {
        case 'small':
          await rbacSeeder.seedSmallDealerRoles(tenantId, companyUnit.id, userId);
          break;
        case 'enterprise':
          await rbacSeeder.seedEnterpriseRoles(tenantId, companyUnit.id, userId);
          break;
        default:
          await rbacSeeder.seedEnhancedRBAC(tenantId, userId);
          break;
      }

      // Assign initial role to the user who initialized the system
      await rbacService.assignUserRole({
        userId,
        roleId: `company-admin-${tenantId}`,
        tenantId,
        organizationalUnitId: companyUnit.id,
        assignedBy: userId,
        assignmentReason: 'System initialization - company admin assignment',
        isActive: true,
        effectiveFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`RBAC system initialized for tenant ${tenantId} (${dealerType})`);
      return {
        success: true,
        tenantId,
        dealerType,
        companyUnitId: companyUnit.id
      };
    } catch (error) {
      console.error('RBAC initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if RBAC system is initialized for a tenant
   */
  async isInitialized(tenantId: string): Promise<boolean> {
    try {
      const roles = await db.select()
        .from(enhancedRoles)
        .where(eq(enhancedRoles.tenantId, tenantId))
        .limit(1);

      return roles.length > 0;
    } catch (error) {
      console.error('Error checking RBAC initialization:', error);
      return false;
    }
  }

  /**
   * Get initialization status and recommendations
   */
  async getInitializationStatus(tenantId: string) {
    try {
      const isInit = await this.isInitialized(tenantId);
      
      if (!isInit) {
        return {
          initialized: false,
          recommendation: 'Initialize RBAC system to enable advanced role management',
          actions: [
            'Define organizational structure',
            'Set up role hierarchy',
            'Configure permissions',
            'Assign initial roles'
          ]
        };
      }

      // Get system statistics
      const [roleCount] = await db.select({ count: db.$count(enhancedRoles, eq(enhancedRoles.tenantId, tenantId)) });
      const [unitCount] = await db.select({ count: db.$count(organizationalUnits, eq(organizationalUnits.tenantId, tenantId)) });

      return {
        initialized: true,
        stats: {
          totalRoles: roleCount.count,
          organizationalUnits: unitCount.count
        },
        recommendation: 'RBAC system is active and ready for management'
      };
    } catch (error) {
      console.error('Error getting RBAC status:', error);
      throw error;
    }
  }

  /**
   * Upgrade RBAC system for existing tenant
   */
  async upgradeSystem(tenantId: string, targetLevel: 'standard' | 'enterprise', userId: string) {
    try {
      const isInit = await this.isInitialized(tenantId);
      if (!isInit) {
        throw new Error('RBAC system must be initialized before upgrading');
      }

      // Add additional roles and permissions based on target level
      if (targetLevel === 'enterprise') {
        await rbacSeeder.addEnterpriseFeatures(tenantId, userId);
      }

      console.log(`RBAC system upgraded to ${targetLevel} for tenant ${tenantId}`);
      return { success: true, targetLevel };
    } catch (error) {
      console.error('RBAC upgrade error:', error);
      throw error;
    }
  }

  /**
   * Reset RBAC system (use with caution)
   */
  async resetSystem(tenantId: string, userId: string, confirmReset = false) {
    if (!confirmReset) {
      throw new Error('Reset confirmation required');
    }

    try {
      // This is a destructive operation - remove all RBAC data for tenant
      await db.transaction(async (tx) => {
        // Remove in correct order to respect foreign key constraints
        await tx.delete(enhancedRoles).where(eq(enhancedRoles.tenantId, tenantId));
        await tx.delete(organizationalUnits).where(eq(organizationalUnits.tenantId, tenantId));
      });

      console.log(`RBAC system reset for tenant ${tenantId}`);
      return { success: true, action: 'reset' };
    } catch (error) {
      console.error('RBAC reset error:', error);
      throw error;
    }
  }

  /**
   * Validate RBAC system integrity
   */
  async validateSystemIntegrity(tenantId: string) {
    try {
      const issues: string[] = [];

      // Check for orphaned roles
      const rolesWithoutUnits = await db.select()
        .from(enhancedRoles)
        .leftJoin(organizationalUnits, eq(enhancedRoles.organizationalUnitId, organizationalUnits.id))
        .where(eq(enhancedRoles.tenantId, tenantId));

      rolesWithoutUnits.forEach(row => {
        if (row.enhanced_roles.organizationalUnitId && !row.organizational_units) {
          issues.push(`Role ${row.enhanced_roles.name} references non-existent organizational unit`);
        }
      });

      // Check hierarchy consistency
      const units = await db.select()
        .from(organizationalUnits)
        .where(eq(organizationalUnits.tenantId, tenantId))
        .orderBy(organizationalUnits.lft);

      // Validate nested set model
      let expectedLft = 1;
      for (const unit of units) {
        if (unit.lft < expectedLft) {
          issues.push(`Organizational unit ${unit.name} has invalid left value`);
        }
        expectedLft = Math.max(expectedLft, unit.rgt + 1);
      }

      return {
        isValid: issues.length === 0,
        issues,
        testedComponents: ['role-unit-references', 'hierarchy-integrity', 'nested-set-model']
      };
    } catch (error) {
      console.error('RBAC validation error:', error);
      throw error;
    }
  }
}

export const rbacInitializer = new RBACInitializer();