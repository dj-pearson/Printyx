import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, tenants } from './schema';

/**
 * DASHBOARD CUSTOMIZATION SYSTEM
 * Allows role-based and user-specific dashboard personalization
 */

// ============================================================================
// DASHBOARD LAYOUTS
// ============================================================================

export const dashboardLayouts = pgTable(
  'dashboard_layouts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Identity
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Scope - either for a role or for a specific user
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: varchar('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = role-based default
    roleId: varchar('role_id'), // For role-based defaults

    // Layout configuration
    isDefault: boolean('is_default').default(false), // Is this the default layout for this role?
    isUserCustom: boolean('is_user_custom').default(false), // Is this a user override?

    // Widget grid layout (stored as JSON)
    // Format: Array of { id, type, position, size, config, visible }
    widgets: jsonb('widgets').default(sql`'[]'::jsonb`),

    // Grid settings
    columns: integer('columns').default(12), // Bootstrap grid columns
    gap: integer('gap').default(4), // Spacing between widgets

    // Metadata
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('dashboard_layouts_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('dashboard_layouts_user_id_idx').on(table.userId),
    roleIdIdx: index('dashboard_layouts_role_id_idx').on(table.roleId),
  }),
);

// ============================================================================
// DASHBOARD WIDGET DEFINITIONS
// ============================================================================

export const dashboardWidgets = pgTable(
  'dashboard_widgets',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Widget metadata
    key: varchar('key', { length: 100 }).notNull().unique(), // crm-pipeline, revenue-chart, etc
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Widget type and rendering
    type: varchar('type', { length: 50 }).notNull(), // card, chart, table, kpi, calendar, timeline, etc
    icon: varchar('icon', { length: 50 }), // lucide icon name

    // Default size
    defaultWidth: integer('default_width').default(1), // 1-12 for 12-col grid
    defaultHeight: integer('default_height').default(300), // pixels

    // Access control
    requiredPermission: varchar('required_permission', { length: 100 }), // If null, available to all
    applicableRoles: jsonb('applicable_roles').default(sql`'[]'::jsonb`), // Roles that can use this
    applicableModules: jsonb('applicable_modules').default(sql`'[]'::jsonb`), // CRM, Billing, Service, etc

    // Configuration
    defaultConfig: jsonb('default_config').default(sql`'{}'::jsonb`), // Default settings
    configurableFields: jsonb('configurable_fields').default(sql`'[]'::jsonb`), // Fields user can customize

    // Features
    isDraggable: boolean('is_draggable').default(true),
    isResizable: boolean('is_resizable').default(true),
    supportsRefresh: boolean('supports_refresh').default(true),
    supportsDrillDown: boolean('supports_drill_down').default(false),

    // Availability
    isActive: boolean('is_active').default(true),
    isPremium: boolean('is_premium').default(false), // Premium only

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    keyIdx: index('dashboard_widgets_key_idx').on(table.key),
    typeIdx: index('dashboard_widgets_type_idx').on(table.type),
  }),
);

// ============================================================================
// USER DASHBOARD PREFERENCES
// ============================================================================

export const userDashboardPreferences = pgTable(
  'user_dashboard_preferences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Current active layout
    activeLayoutId: varchar('active_layout_id').references(() => dashboardLayouts.id),

    // Preferences
    refreshInterval: integer('refresh_interval').default(60000), // milliseconds
    theme: varchar('theme', { length: 50 }).default('light'), // light, dark, auto
    showGridLines: boolean('show_grid_lines').default(false),
    compactMode: boolean('compact_mode').default(false),

    // Saved filters for widgets
    globalFilters: jsonb('global_filters').default(sql`'{}'::jsonb`),

    // Widget state (collapsed, expanded, etc)
    widgetStates: jsonb('widget_states').default(sql`'{}'::jsonb`),

    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_dashboard_prefs_user_id_idx').on(table.userId),
    tenantIdIdx: index('user_dashboard_prefs_tenant_id_idx').on(table.tenantId),
  }),
);

// ============================================================================
// DASHBOARD WIDGET LIBRARY (Available widgets for each module)
// ============================================================================

export const dashboardWidgetLibrary = pgTable(
  'dashboard_widget_library',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    tenantId: varchar('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

    // Widget reference
    widgetId: varchar('widget_id')
      .notNull()
      .references(() => dashboardWidgets.id, { onDelete: 'cascade' }),

    // Customization
    customName: varchar('custom_name', { length: 255 }), // Override default name
    isEnabled: boolean('is_enabled').default(true), // Can this tenant use this widget?
    customConfig: jsonb('custom_config').default(sql`'{}'::jsonb`), // Tenant-specific config

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('widget_library_tenant_id_idx').on(table.tenantId),
    widgetIdIdx: index('widget_library_widget_id_idx').on(table.widgetId),
  }),
);

// ============================================================================
// DASHBOARD SNAPSHOTS (For history/restore)
// ============================================================================

export const dashboardSnapshots = pgTable(
  'dashboard_snapshots',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    layoutId: varchar('layout_id')
      .notNull()
      .references(() => dashboardLayouts.id, { onDelete: 'cascade' }),

    // Snapshot data
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Saved state
    layoutSnapshot: jsonb('layout_snapshot').notNull(), // Full layout config

    // Metadata
    isAutomatic: boolean('is_automatic').default(false), // Auto-generated or manual save

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dashboard_snapshots_user_id_idx').on(table.userId),
    layoutIdIdx: index('dashboard_snapshots_layout_id_idx').on(table.layoutId),
  }),
);

// ============================================================================
// EXPORTS
// ============================================================================

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;

export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type NewDashboardWidget = typeof dashboardWidgets.$inferInsert;

export type UserDashboardPreference = typeof userDashboardPreferences.$inferSelect;
export type NewUserDashboardPreference = typeof userDashboardPreferences.$inferInsert;

export type DashboardWidgetLibrary = typeof dashboardWidgetLibrary.$inferSelect;
export type NewDashboardWidgetLibrary = typeof dashboardWidgetLibrary.$inferInsert;

export type DashboardSnapshot = typeof dashboardSnapshots.$inferSelect;
export type NewDashboardSnapshot = typeof dashboardSnapshots.$inferInsert;
