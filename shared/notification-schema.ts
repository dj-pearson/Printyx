import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    type: varchar('type', { length: 50 }).notNull().default('general'),
    priority: varchar('priority', { length: 20 }).notNull().default('medium'),
    category: varchar('category', { length: 30 }).notNull().default('system'),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    read: boolean('read').notNull().default(false),
    readAt: timestamp('read_at'),
    actionUrl: varchar('action_url', { length: 500 }),
    actionLabel: varchar('action_label', { length: 100 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userTenantIdx: index('user_notifications_user_tenant_idx').on(table.userId, table.tenantId),
    tenantCreatedIdx: index('user_notifications_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    userUnreadIdx: index('user_notifications_user_unread_idx').on(
      table.userId,
      table.read,
      table.createdAt,
    ),
  }),
);

export const insertUserNotificationSchema = createInsertSchema(userNotifications);
