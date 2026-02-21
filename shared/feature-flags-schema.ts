/**
 * Feature Flags Schema
 * US-035: Feature flags for controlled rollouts
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    enabled: boolean('enabled').default(false).notNull(),
    rolloutPercentage: integer('rollout_percentage').default(100).notNull(),
    tenantOverrides: jsonb('tenant_overrides').default({}).$type<Record<string, boolean>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameUniqueIdx: unique('feature_flags_name_unique').on(table.name),
    enabledIdx: index('feature_flags_enabled_idx').on(table.enabled),
  }),
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;
