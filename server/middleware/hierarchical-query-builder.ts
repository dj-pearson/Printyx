// =====================================================================
// HIERARCHICAL QUERY BUILDER
// Automatic data scoping based on user's organizational position
// =====================================================================

import { SQL, sql, eq, and, or, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { organizationalUnits, users } from '../enhanced-rbac-schema';
import type { EnhancedUserContext } from './enhanced-rbac-middleware';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

export type ScopeLevel = 'platform' | 'company' | 'regional' | 'location' | 'team' | 'own';

export interface QueryFilterOptions {
  /**
   * Override the default scope for this query
   * Useful when a manager wants to view their own data vs team data
   */
  overrideScope?: ScopeLevel;

  /**
   * Table alias for the query (if using joins)
   */
  tableAlias?: string;

  /**
   * Custom field names (if different from defaults)
   */
  fieldNames?: {
    userId?: string;
    tenantId?: string;
    locationId?: string;
    regionId?: string;
    teamId?: string;
    organizationalUnitId?: string;
  };

  /**
   * Additional filters to AND with scope filter
   */
  additionalFilters?: SQL[];
}

// =====================================================================
// HIERARCHICAL QUERY BUILDER CLASS
// =====================================================================

export class HierarchicalQueryBuilder {
  constructor(private userContext: EnhancedUserContext) {}

  /**
   * Get the effective scope for this query
   */
  private getEffectiveScope(options?: QueryFilterOptions): ScopeLevel {
    return options?.overrideScope || this.userContext.territoryScope;
  }

  /**
   * Get field name with optional table prefix
   */
  private getFieldName(
    fieldName: keyof NonNullable<QueryFilterOptions['fieldNames']>,
    options?: QueryFilterOptions
  ): string {
    const customFieldName = options?.fieldNames?.[fieldName];
    const actualFieldName = customFieldName || this.getDefaultFieldName(fieldName);
    const prefix = options?.tableAlias ? `${options.tableAlias}.` : '';
    return `${prefix}${actualFieldName}`;
  }

  /**
   * Get default field name for standard fields
   */
  private getDefaultFieldName(fieldName: keyof NonNullable<QueryFilterOptions['fieldNames']>): string {
    const defaults: Record<string, string> = {
      userId: 'user_id',
      tenantId: 'tenant_id',
      locationId: 'location_id',
      regionId: 'region_id',
      teamId: 'team_id',
      organizationalUnitId: 'organizational_unit_id',
    };
    return defaults[fieldName] || fieldName;
  }

  /**
   * Apply hierarchical filtering to a query
   * This is the main method to use for automatically scoping data
   */
  applyHierarchicalFilter(options?: QueryFilterOptions): SQL | undefined {
    const scope = this.getEffectiveScope(options);
    const filters: SQL[] = [];

    // Always filter by tenant (except platform scope)
    if (scope !== 'platform') {
      const tenantField = this.getFieldName('tenantId', options);
      filters.push(sql.raw(`${tenantField} = '${this.userContext.tenantId}'`));
    }

    // Apply scope-specific filters
    switch (scope) {
      case 'platform':
        // Platform users can access ALL data across ALL tenants
        // No additional filters needed
        break;

      case 'company':
        // Company-wide access - already filtered by tenantId above
        // No additional filters needed
        break;

      case 'regional':
        // Regional access - filter by region
        if (this.userContext.regionId) {
          const regionField = this.getFieldName('regionId', options);
          filters.push(sql.raw(`${regionField} = '${this.userContext.regionId}'`));
        } else {
          // If no region assigned, use location as fallback
          if (this.userContext.locationId) {
            const locationField = this.getFieldName('locationId', options);
            filters.push(sql.raw(`${locationField} = '${this.userContext.locationId}'`));
          }
        }
        break;

      case 'location':
        // Location access - filter by location
        if (this.userContext.locationId) {
          const locationField = this.getFieldName('locationId', options);
          filters.push(sql.raw(`${locationField} = '${this.userContext.locationId}'`));
        } else {
          // No location = no access (prevent data leak)
          filters.push(sql.raw(`1 = 0`));
        }
        break;

      case 'team':
        // Team access - filter by team and location
        if (this.userContext.teamId) {
          const teamField = this.getFieldName('teamId', options);
          filters.push(sql.raw(`${teamField} = '${this.userContext.teamId}'`));
        } else if (this.userContext.managerId) {
          // If no explicit team, filter by manager's direct reports
          const userField = this.getFieldName('userId', options);
          filters.push(sql.raw(`(${userField} IN (
            SELECT id FROM users WHERE manager_id = '${this.userContext.id}'
          ) OR ${userField} = '${this.userContext.id}')`));
        } else {
          // No team or manager = own data only
          const userField = this.getFieldName('userId', options);
          filters.push(sql.raw(`${userField} = '${this.userContext.id}'`));
        }
        break;

      case 'own':
        // Individual access - filter by user
        const userField = this.getFieldName('userId', options);
        filters.push(sql.raw(`${userField} = '${this.userContext.id}'`));
        break;
    }

    // Add additional custom filters
    if (options?.additionalFilters && options.additionalFilters.length > 0) {
      filters.push(...options.additionalFilters);
    }

    // Combine all filters with AND
    if (filters.length === 0) {
      return undefined;
    } else if (filters.length === 1) {
      return filters[0];
    } else {
      return and(...filters);
    }
  }

  /**
   * Get accessible location IDs for this user (for use in IN queries)
   */
  async getAccessibleLocationIds(): Promise<string[]> {
    const scope = this.userContext.territoryScope;

    switch (scope) {
      case 'platform':
        // Platform users can access ALL locations
        const allLocations = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(eq(organizationalUnits.unitType, 'location'));
        return allLocations.map(loc => loc.id);

      case 'company':
        // Company-wide - all locations for this tenant
        const companyLocations = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(
            and(
              eq(organizationalUnits.tenantId, this.userContext.tenantId),
              eq(organizationalUnits.unitType, 'location')
            )
          );
        return companyLocations.map(loc => loc.id);

      case 'regional':
        // Regional - all locations in this region
        if (!this.userContext.regionId) {
          return this.userContext.locationId ? [this.userContext.locationId] : [];
        }

        // Get all locations under this region using nested set
        const regionalUnit = await db.select()
          .from(organizationalUnits)
          .where(
            and(
              eq(organizationalUnits.id, this.userContext.regionId),
              eq(organizationalUnits.tenantId, this.userContext.tenantId)
            )
          )
          .limit(1);

        if (regionalUnit.length === 0) {
          return [];
        }

        const regionalLocations = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(
            and(
              eq(organizationalUnits.tenantId, this.userContext.tenantId),
              eq(organizationalUnits.unitType, 'location'),
              gte(organizationalUnits.lft, regionalUnit[0].lft),
              lte(organizationalUnits.rght, regionalUnit[0].rght)
            )
          );
        return regionalLocations.map(loc => loc.id);

      case 'location':
      case 'team':
      case 'own':
        // Location, team, or individual - single location
        return this.userContext.locationId ? [this.userContext.locationId] : [];

      default:
        return [];
    }
  }

  /**
   * Get accessible region IDs for this user
   */
  async getAccessibleRegionIds(): Promise<string[]> {
    const scope = this.userContext.territoryScope;

    switch (scope) {
      case 'platform':
        // Platform users can access ALL regions
        const allRegions = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(eq(organizationalUnits.unitType, 'regional'));
        return allRegions.map(reg => reg.id);

      case 'company':
        // Company-wide - all regions for this tenant
        const companyRegions = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(
            and(
              eq(organizationalUnits.tenantId, this.userContext.tenantId),
              eq(organizationalUnits.unitType, 'regional')
            )
          );
        return companyRegions.map(reg => reg.id);

      case 'regional':
        // Regional - single region
        return this.userContext.regionId ? [this.userContext.regionId] : [];

      case 'location':
      case 'team':
      case 'own':
        // Location, team, or individual - get parent region
        if (!this.userContext.locationId) return [];

        const location = await db.select({ id: organizationalUnits.id, lft: organizationalUnits.lft, rght: organizationalUnits.rght })
          .from(organizationalUnits)
          .where(eq(organizationalUnits.id, this.userContext.locationId))
          .limit(1);

        if (location.length === 0) return [];

        // Find parent regional unit using nested set
        const parentRegion = await db.select({ id: organizationalUnits.id })
          .from(organizationalUnits)
          .where(
            and(
              eq(organizationalUnits.tenantId, this.userContext.tenantId),
              eq(organizationalUnits.unitType, 'regional'),
              lte(organizationalUnits.lft, location[0].lft),
              gte(organizationalUnits.rght, location[0].rght)
            )
          )
          .limit(1);

        return parentRegion.length > 0 ? [parentRegion[0].id] : [];

      default:
        return [];
    }
  }

  /**
   * Get accessible user IDs (for team/manager queries)
   */
  async getAccessibleUserIds(): Promise<string[]> {
    const scope = this.userContext.territoryScope;

    switch (scope) {
      case 'platform':
      case 'company':
        // Can access all users in tenant
        const allUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.tenantId, this.userContext.tenantId));
        return allUsers.map(u => u.id);

      case 'regional':
      case 'location':
        // Can access all users in accessible locations
        const locationIds = await this.getAccessibleLocationIds();
        if (locationIds.length === 0) return [this.userContext.id];

        const locationUsers = await db.select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.tenantId, this.userContext.tenantId),
              inArray(users.primaryLocationId, locationIds)
            )
          );
        return locationUsers.map(u => u.id);

      case 'team':
        // Can access direct reports + self
        const teamMembers = await db.select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.tenantId, this.userContext.tenantId),
              or(
                eq(users.managerId, this.userContext.id),
                eq(users.id, this.userContext.id)
              )
            )
          );
        return teamMembers.map(u => u.id);

      case 'own':
        // Only self
        return [this.userContext.id];

      default:
        return [this.userContext.id];
    }
  }

  /**
   * Build a nested set query for organizational units
   * Used when querying hierarchical data
   */
  buildNestedSetFilter(parentUnitId: string, includeParent = true): SQL {
    // This would typically be used with a subquery
    const operator = includeParent ? '>=' : '>';
    const operator2 = includeParent ? '<=' : '<';

    return sql.raw(`
      ${this.getFieldName('organizationalUnitId')} IN (
        SELECT id FROM organizational_units child
        WHERE EXISTS (
          SELECT 1 FROM organizational_units parent
          WHERE parent.id = '${parentUnitId}'
            AND child.lft ${operator} parent.lft
            AND child.rght ${operator2} parent.rght
            AND child.tenant_id = parent.tenant_id
        )
      )
    `);
  }

  /**
   * Check if user can access a specific organizational scope
   */
  canAccessScope(targetScope: ScopeLevel): boolean {
    const scopeHierarchy: ScopeLevel[] = ['own', 'team', 'location', 'regional', 'company', 'platform'];
    const userScopeIndex = scopeHierarchy.indexOf(this.userContext.territoryScope);
    const targetScopeIndex = scopeHierarchy.indexOf(targetScope);

    return userScopeIndex >= targetScopeIndex;
  }

  /**
   * Get minimum scope level user can access
   */
  getMinimumScope(): ScopeLevel {
    return this.userContext.territoryScope;
  }

  /**
   * Get maximum scope level user can access
   */
  getMaximumScope(): ScopeLevel {
    return 'platform'; // All users can technically request up to platform scope
  }

  /**
   * Create a scope-aware WHERE clause for raw SQL queries
   * Returns a SQL string fragment
   */
  getSQLWhereClause(options?: QueryFilterOptions): string {
    const scope = this.getEffectiveScope(options);
    const prefix = options?.tableAlias ? `${options.tableAlias}.` : '';
    const clauses: string[] = [];

    // Tenant filter (except platform)
    if (scope !== 'platform') {
      clauses.push(`${prefix}tenant_id = '${this.userContext.tenantId}'`);
    }

    // Scope-specific filters
    switch (scope) {
      case 'platform':
        // No additional filters
        break;

      case 'company':
        // Already filtered by tenant
        break;

      case 'regional':
        if (this.userContext.regionId) {
          clauses.push(`${prefix}region_id = '${this.userContext.regionId}'`);
        } else if (this.userContext.locationId) {
          clauses.push(`${prefix}location_id = '${this.userContext.locationId}'`);
        }
        break;

      case 'location':
        if (this.userContext.locationId) {
          clauses.push(`${prefix}location_id = '${this.userContext.locationId}'`);
        } else {
          clauses.push('1 = 0'); // No access
        }
        break;

      case 'team':
        if (this.userContext.teamId) {
          clauses.push(`${prefix}team_id = '${this.userContext.teamId}'`);
        } else {
          clauses.push(`(${prefix}user_id IN (
            SELECT id FROM users WHERE manager_id = '${this.userContext.id}'
          ) OR ${prefix}user_id = '${this.userContext.id}')`);
        }
        break;

      case 'own':
        clauses.push(`${prefix}user_id = '${this.userContext.id}'`);
        break;
    }

    return clauses.length > 0 ? clauses.join(' AND ') : '1 = 1';
  }
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Create a query builder for a user
 */
export function createQueryBuilder(userContext: EnhancedUserContext): HierarchicalQueryBuilder {
  return new HierarchicalQueryBuilder(userContext);
}

/**
 * Quick helper to apply hierarchical filter to a Drizzle query
 */
export function applyUserScope(
  userContext: EnhancedUserContext,
  options?: QueryFilterOptions
): SQL | undefined {
  const builder = new HierarchicalQueryBuilder(userContext);
  return builder.applyHierarchicalFilter(options);
}

// =====================================================================
// EXPORT
// =====================================================================

export { HierarchicalQueryBuilder as default };
