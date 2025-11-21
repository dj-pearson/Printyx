import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced role hierarchy with 8 levels and 4 tiers
export const organizationalTierEnum = pgEnum('organizational_tier', [
  'platform',    // Tier 1: Printyx platform level
  'company',     // Tier 2: Company/tenant level  
  'regional',    // Tier 3: Regional/territory level
  'location'     // Tier 4: Location/branch level
]);

export const roleHierarchyLevelEnum = pgEnum('role_hierarchy_level', [
  'level_1', // Individual Contributors
  'level_2', // Team Leads
  'level_3', // Department Supervisors  
  'level_4', // Location Managers
  'level_5', // Regional Managers
  'level_6', // Company Directors
  'level_7', // Company Executives
  'level_8'  // Platform Administrators
]);

export const permissionEffectEnum = pgEnum('permission_effect', [
  'ALLOW',
  'DENY'
]);

// Organizational Units - implements nested set model for hierarchy
export const organizationalUnits = pgTable("organizational_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  parentUnitId: varchar("parent_unit_id"),
  
  // Organizational details
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  unitType: organizationalTierEnum("unit_type").notNull(),
  description: text("description"),
  
  // Nested set model for efficient hierarchy queries
  lft: integer("lft").notNull(),
  rght: integer("rght").notNull(),
  depth: integer("depth").notNull(),
  
  // Geographic and contact information
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  
  // Manager assignment
  managerId: varchar("manager_id"),
  
  // Status and settings
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings").default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_org_units_tenant").on(table.tenantId),
  index("idx_org_units_parent").on(table.parentUnitId),
  index("idx_org_units_nested_set").on(table.lft, table.rght),
  index("idx_org_units_type").on(table.unitType),
]);

// Enhanced Roles with proper hierarchy support
export const enhancedRoles = pgTable("enhanced_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  organizationalUnitId: varchar("organizational_unit_id"),
  
  // Role identification
  name: varchar("name", { length: 128 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  
  // Hierarchy positioning
  hierarchyLevel: roleHierarchyLevelEnum("hierarchy_level").notNull(),
  organizationalTier: organizationalTierEnum("organizational_tier").notNull(),
  parentRoleId: varchar("parent_role_id"),
  
  // Nested set model for role hierarchy
  lft: integer("lft").notNull(),
  rght: integer("rght").notNull(),
  depth: integer("depth").notNull(),
  
  // Department and functional area
  department: varchar("department", { length: 50 }).notNull(),
  functionalArea: varchar("functional_area", { length: 50 }),
  
  // Role properties
  isSystemRole: boolean("is_system_role").default(false),
  isCustomizable: boolean("is_customizable").default(true),
  isTemplate: boolean("is_template").default(false),
  
  // Business context
  maxDirectReports: integer("max_direct_reports"),
  territoryScope: varchar("territory_scope", { length: 50 }), // location, regional, company, platform
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_enhanced_roles_tenant").on(table.tenantId),
  index("idx_enhanced_roles_org_unit").on(table.organizationalUnitId),
  index("idx_enhanced_roles_hierarchy").on(table.hierarchyLevel),
  index("idx_enhanced_roles_nested_set").on(table.lft, table.rght),
  index("idx_enhanced_roles_department").on(table.department),
]);

// Permissions - granular permission definitions
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Permission identification
  name: varchar("name", { length: 128 }).notNull().unique(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  description: text("description"),
  
  // Permission categorization
  module: varchar("module", { length: 50 }).notNull(), // sales, service, finance, admin, etc.
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // lead, quote, ticket, user, etc.
  action: varchar("action", { length: 50 }).notNull(), // view, create, edit, delete, approve, etc.
  
  // Scope and constraints
  scopeLevel: varchar("scope_level", { length: 50 }).notNull(), // own, team, location, regional, company, platform
  requiresApproval: boolean("requires_approval").default(false),
  requiresMFA: boolean("requires_mfa").default(false),
  
  // Business context
  riskLevel: varchar("risk_level", { length: 20 }).default('low'), // low, medium, high, critical
  complianceLevel: varchar("compliance_level", { length: 20 }).default('standard'),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_permissions_module").on(table.module),
  index("idx_permissions_resource_action").on(table.resourceType, table.action),
  index("idx_permissions_scope").on(table.scopeLevel),
]);

// Role Permissions - junction table with effect (ALLOW/DENY)
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  permissionId: varchar("permission_id").notNull(),
  
  // Permission effect and constraints
  effect: permissionEffectEnum("effect").notNull().default('ALLOW'),
  conditions: jsonb("conditions").default('{}'), // Additional conditions for permission
  constraints: jsonb("constraints").default('{}'), // Time, location, or other constraints
  
  // Customization tracking
  isCustomized: boolean("is_customized").default(false),
  customizedBy: varchar("customized_by"),
  customizedAt: timestamp("customized_at"),
  customizationReason: text("customization_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_role_permissions_role").on(table.roleId),
  index("idx_role_permissions_permission").on(table.permissionId),
  index("idx_role_permissions_effect").on(table.effect),
]);

// User Role Assignments with organizational context
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  
  // Organizational context
  tenantId: varchar("tenant_id").notNull(),
  organizationalUnitId: varchar("organizational_unit_id"),
  
  // Assignment details
  assignedBy: varchar("assigned_by").notNull(),
  assignmentReason: text("assignment_reason"),
  
  // Temporal constraints
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveUntil: timestamp("effective_until"),
  
  // Territory and scope limitations
  territoryRestrictions: jsonb("territory_restrictions").default('{}'),
  scopeRestrictions: jsonb("scope_restrictions").default('{}'),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_role_assignments_user").on(table.userId),
  index("idx_user_role_assignments_role").on(table.roleId),
  index("idx_user_role_assignments_tenant").on(table.tenantId),
  index("idx_user_role_assignments_org_unit").on(table.organizationalUnitId),
  index("idx_user_role_assignments_effective").on(table.effectiveFrom, table.effectiveUntil),
]);

// Permission Overrides - for exception management
export const permissionOverrides = pgTable("permission_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  permissionId: varchar("permission_id").notNull(),
  
  // Override details
  effect: permissionEffectEnum("effect").notNull(),
  overrideReason: text("override_reason").notNull(),
  businessJustification: text("business_justification").notNull(),
  
  // Approval workflow
  requestedBy: varchar("requested_by").notNull(),
  approvedBy: varchar("approved_by"),
  approvalDate: timestamp("approval_date"),
  
  // Temporal constraints
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveUntil: timestamp("effective_until"),
  
  // Organizational context
  tenantId: varchar("tenant_id").notNull(),
  organizationalUnitId: varchar("organizational_unit_id"),
  
  // Review requirements
  requiresReview: boolean("requires_review").default(true),
  nextReviewDate: timestamp("next_review_date"),
  lastReviewDate: timestamp("last_review_date"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_permission_overrides_user").on(table.userId),
  index("idx_permission_overrides_permission").on(table.permissionId),
  index("idx_permission_overrides_effective").on(table.effectiveFrom, table.effectiveUntil),
  index("idx_permission_overrides_review").on(table.nextReviewDate),
]);

// Permission Cache for performance optimization
export const permissionCache = pgTable("permission_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organizationalContext: varchar("organizational_context").notNull(),
  
  // Cached permissions
  effectivePermissions: jsonb("effective_permissions").notNull(),
  permissionHash: varchar("permission_hash", { length: 64 }).notNull(),
  
  // Cache metadata
  computedAt: timestamp("computed_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  cacheVersion: integer("cache_version").default(1),
  
  // Performance tracking
  computationTime: integer("computation_time"), // milliseconds
  cacheHits: integer("cache_hits").default(0),
  
  tenantId: varchar("tenant_id").notNull(),
}, (table) => [
  index("idx_permission_cache_user_context").on(table.userId, table.organizationalContext),
  index("idx_permission_cache_expires").on(table.expiresAt),
  index("idx_permission_cache_hash").on(table.permissionHash),
]);

// Relations for the enhanced RBAC system
export const organizationalUnitsRelations = relations(organizationalUnits, ({ one, many }) => ({
  parent: one(organizationalUnits, {
    fields: [organizationalUnits.parentUnitId],
    references: [organizationalUnits.id],
  }),
  children: many(organizationalUnits),
  roles: many(enhancedRoles),
  userAssignments: many(userRoleAssignments),
}));

export const enhancedRolesRelations = relations(enhancedRoles, ({ one, many }) => ({
  organizationalUnit: one(organizationalUnits, {
    fields: [enhancedRoles.organizationalUnitId],
    references: [organizationalUnits.id],
  }),
  parentRole: one(enhancedRoles, {
    fields: [enhancedRoles.parentRoleId],
    references: [enhancedRoles.id],
  }),
  childRoles: many(enhancedRoles),
  permissions: many(rolePermissions),
  userAssignments: many(userRoleAssignments),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  overrides: many(permissionOverrides),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(enhancedRoles, {
    fields: [rolePermissions.roleId],
    references: [enhancedRoles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  role: one(enhancedRoles, {
    fields: [userRoleAssignments.roleId],
    references: [enhancedRoles.id],
  }),
  organizationalUnit: one(organizationalUnits, {
    fields: [userRoleAssignments.organizationalUnitId],
    references: [organizationalUnits.id],
  }),
}));

// Zod schemas for validation
export const insertOrganizationalUnitSchema = createInsertSchema(organizationalUnits);
export const insertEnhancedRoleSchema = createInsertSchema(enhancedRoles);
export const insertPermissionSchema = createInsertSchema(permissions);
export const insertRolePermissionSchema = createInsertSchema(rolePermissions);
export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments);
export const insertPermissionOverrideSchema = createInsertSchema(permissionOverrides);

// TypeScript types
export type OrganizationalUnit = typeof organizationalUnits.$inferSelect;
export type InsertOrganizationalUnit = z.infer<typeof insertOrganizationalUnitSchema>;
export type EnhancedRole = typeof enhancedRoles.$inferSelect;
export type InsertEnhancedRole = z.infer<typeof insertEnhancedRoleSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type PermissionOverride = typeof permissionOverrides.$inferSelect;
export type InsertPermissionOverride = z.infer<typeof insertPermissionOverrideSchema>;