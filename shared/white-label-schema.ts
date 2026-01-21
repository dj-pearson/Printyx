import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== White Label Configuration ====================

/**
 * Tenant-specific white-label branding configuration
 * Allows dealers to brand the customer portal as their own
 */
export const whiteLabelConfig = pgTable(
  'white_label_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().unique(), // One config per tenant

    // Company Branding
    companyName: varchar('company_name', { length: 255 }).notNull(),
    companyTagline: varchar('company_tagline', { length: 255 }),
    logoUrl: text('logo_url'), // Primary logo
    logoSquareUrl: text('logo_square_url'), // Square/icon version
    faviconUrl: text('favicon_url'),

    // Domain Configuration
    customDomain: varchar('custom_domain', { length: 255 }), // e.g., portal.acmecopiers.com
    customDomainVerified: boolean('custom_domain_verified').default(false),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at'),

    // Color Scheme (Hex colors)
    colorPrimary: varchar('color_primary', { length: 7 }).default('#6366f1'), // Indigo-500
    colorSecondary: varchar('color_secondary', { length: 7 }).default('#8b5cf6'), // Violet-500
    colorAccent: varchar('color_accent', { length: 7 }).default('#ec4899'), // Pink-500
    colorSuccess: varchar('color_success', { length: 7 }).default('#10b981'), // Green-500
    colorWarning: varchar('color_warning', { length: 7 }).default('#f59e0b'), // Amber-500
    colorError: varchar('color_error', { length: 7 }).default('#ef4444'), // Red-500
    colorBackground: varchar('color_background', { length: 7 }).default('#ffffff'),
    colorText: varchar('color_text', { length: 7 }).default('#1f2937'), // Gray-800

    // Typography
    fontFamily: varchar('font_family', { length: 100 }).default('Inter, sans-serif'),
    fontHeadingFamily: varchar('font_heading_family', { length: 100 }),

    // Portal Welcome Content
    welcomeTitle: varchar('welcome_title', { length: 255 }),
    welcomeMessage: text('welcome_message'),
    welcomeBannerUrl: text('welcome_banner_url'),

    // Contact Information
    supportEmail: varchar('support_email', { length: 255 }),
    supportPhone: varchar('support_phone', { length: 50 }),
    supportHoursText: text('support_hours_text'), // e.g., "Mon-Fri 8am-6pm EST"

    // Legal & Compliance
    termsOfServiceUrl: text('terms_of_service_url'),
    privacyPolicyUrl: text('privacy_policy_url'),
    customTermsOfService: text('custom_terms_of_service'), // Full text if custom
    customPrivacyPolicy: text('custom_privacy_policy'), // Full text if custom

    // Feature Toggles
    features: jsonb('features')
      .$type<{
        enableServiceRequests?: boolean;
        enableSupplyOrdering?: boolean;
        enableMeterSubmission?: boolean;
        enableInvoicePayments?: boolean;
        enableEquipmentMonitoring?: boolean;
        enableKnowledgeBase?: boolean;
        enableLiveChat?: boolean;
        showEquipmentDetails?: boolean;
        showUsageAnalytics?: boolean;
        showMaintenanceHistory?: boolean;
      }>()
      .default({
        enableServiceRequests: true,
        enableSupplyOrdering: true,
        enableMeterSubmission: true,
        enableInvoicePayments: true,
        enableEquipmentMonitoring: true,
        enableKnowledgeBase: true,
        enableLiveChat: false,
        showEquipmentDetails: true,
        showUsageAnalytics: true,
        showMaintenanceHistory: true,
      }),

    // Advanced Settings
    customCss: text('custom_css'), // Optional custom CSS overrides
    customJs: text('custom_js'), // Optional custom JavaScript (sandboxed)
    analyticsCode: text('analytics_code'), // Google Analytics, etc.

    // Social Media Links
    socialLinks: jsonb('social_links').$type<{
      website?: string;
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      youtube?: string;
      instagram?: string;
    }>(),

    // Mobile App Branding
    mobileAppName: varchar('mobile_app_name', { length: 100 }),
    mobileAppIconUrl: text('mobile_app_icon_url'),
    mobileAppSplashScreenUrl: text('mobile_app_splash_screen_url'),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    lastAppliedAt: timestamp('last_applied_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('white_label_config_tenant_idx').on(table.tenantId),
    domainIdx: index('white_label_config_domain_idx').on(table.customDomain),
  }),
);

// ==================== Email Templates ====================

/**
 * Customizable email templates for customer portal notifications
 * Allows dealers to send branded emails from their own domain
 */
export const whiteLabelEmailTemplates = pgTable(
  'white_label_email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Template Identification
    templateKey: varchar('template_key', { length: 100 }).notNull(), // e.g., 'service_request_confirmation'
    templateName: varchar('template_name', { length: 255 }).notNull(),
    description: text('description'),

    // Email Configuration
    fromName: varchar('from_name', { length: 255 }), // e.g., "Acme Copiers Support"
    fromEmail: varchar('from_email', { length: 255 }), // e.g., "support@acmecopiers.com"
    replyToEmail: varchar('reply_to_email', { length: 255 }),

    // Email Content
    subject: varchar('subject', { length: 500 }).notNull(), // Supports variables: {{customerName}}
    htmlBody: text('html_body').notNull(), // HTML email content
    textBody: text('text_body'), // Plain text fallback

    // Template Variables
    availableVariables: jsonb('available_variables').$type<
      {
        name: string;
        description: string;
        example: string;
      }[]
    >(), // List of variables that can be used in this template

    // Header/Footer
    includeHeader: boolean('include_header').default(true),
    includeFooter: boolean('include_footer').default(true),
    customHeader: text('custom_header'), // Custom HTML header
    customFooter: text('custom_footer'), // Custom HTML footer

    // Status
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').default(false), // Is this the system default?

    // Usage Tracking
    sentCount: varchar('sent_count').default('0'),
    lastSentAt: timestamp('last_sent_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantKeyIdx: index('white_label_email_templates_tenant_key_idx').on(
      table.tenantId,
      table.templateKey,
    ),
    tenantIdx: index('white_label_email_templates_tenant_idx').on(table.tenantId),
  }),
);

// ==================== Email Template Types ====================

/**
 * Standard email template types used in the customer portal
 */
export const EMAIL_TEMPLATE_TYPES = {
  // Service Request Templates
  SERVICE_REQUEST_CONFIRMATION: 'service_request_confirmation',
  SERVICE_REQUEST_ASSIGNED: 'service_request_assigned',
  SERVICE_REQUEST_IN_PROGRESS: 'service_request_in_progress',
  SERVICE_REQUEST_COMPLETED: 'service_request_completed',

  // Supply Order Templates
  SUPPLY_ORDER_CONFIRMATION: 'supply_order_confirmation',
  SUPPLY_ORDER_SHIPPED: 'supply_order_shipped',
  SUPPLY_ORDER_DELIVERED: 'supply_order_delivered',

  // Billing Templates
  INVOICE_READY: 'invoice_ready',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REMINDER: 'payment_reminder',

  // Maintenance Templates
  MAINTENANCE_SCHEDULED: 'maintenance_scheduled',
  MAINTENANCE_REMINDER: 'maintenance_reminder',
  MAINTENANCE_COMPLETED: 'maintenance_completed',

  // Equipment Alerts
  SUPPLY_LOW_ALERT: 'supply_low_alert',
  EQUIPMENT_ERROR: 'equipment_error',
  EQUIPMENT_OFFLINE: 'equipment_offline',

  // Account Templates
  WELCOME_EMAIL: 'welcome_email',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_ACTIVATED: 'account_activated',

  // Meter Reading Templates
  METER_READING_REMINDER: 'meter_reading_reminder',
  METER_READING_SUBMITTED: 'meter_reading_submitted',
} as const;

// ==================== Portal Customization Presets ====================

/**
 * Pre-built branding presets for quick setup
 */
export const whiteLabelPresets = pgTable(
  'white_label_presets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    presetName: varchar('preset_name', { length: 255 }).notNull(),
    presetSlug: varchar('preset_slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),

    // Preset Configuration
    config: jsonb('config')
      .$type<{
        colorPrimary: string;
        colorSecondary: string;
        colorAccent: string;
        fontFamily: string;
        fontHeadingFamily?: string;
        style: 'modern' | 'classic' | 'minimal' | 'bold';
      }>()
      .notNull(),

    // Preset Metadata
    isPublic: boolean('is_public').default(true),
    usageCount: varchar('usage_count').default('0'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index('white_label_presets_slug_idx').on(table.presetSlug),
  }),
);

// ==================== Zod Schemas ====================

export const insertWhiteLabelConfigSchema = createInsertSchema(whiteLabelConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  customDomainVerified: true,
  customDomainVerifiedAt: true,
  lastAppliedAt: true,
});

export const updateWhiteLabelConfigSchema = insertWhiteLabelConfigSchema.partial();

export const insertWhiteLabelEmailTemplateSchema = createInsertSchema(
  whiteLabelEmailTemplates,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  lastSentAt: true,
});

export const updateWhiteLabelEmailTemplateSchema = insertWhiteLabelEmailTemplateSchema.partial();

export const insertWhiteLabelPresetSchema = createInsertSchema(whiteLabelPresets).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

// ==================== Type Exports ====================

export type WhiteLabelConfig = typeof whiteLabelConfig.$inferSelect;
export type InsertWhiteLabelConfig = z.infer<typeof insertWhiteLabelConfigSchema>;
export type UpdateWhiteLabelConfig = z.infer<typeof updateWhiteLabelConfigSchema>;

export type WhiteLabelEmailTemplate = typeof whiteLabelEmailTemplates.$inferSelect;
export type InsertWhiteLabelEmailTemplate = z.infer<typeof insertWhiteLabelEmailTemplateSchema>;
export type UpdateWhiteLabelEmailTemplate = z.infer<typeof updateWhiteLabelEmailTemplateSchema>;

export type WhiteLabelPreset = typeof whiteLabelPresets.$inferSelect;
export type InsertWhiteLabelPreset = z.infer<typeof insertWhiteLabelPresetSchema>;
