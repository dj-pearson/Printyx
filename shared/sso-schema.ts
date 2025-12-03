/**
 * SSO/SAML Schema
 *
 * Database schema for SSO provider configurations and user mappings.
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, pgEnum, index, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, tenants } from './schema';

// SSO Provider Types
export const ssoProviderTypeEnum = pgEnum('sso_provider_type', [
  'azure_ad',
  'okta',
  'google_workspace',
  'onelogin',
  'ping_identity',
  'custom_saml',
  'custom_oidc',
]);

// SSO Protocol Types
export const ssoProtocolEnum = pgEnum('sso_protocol', [
  'saml2',
  'oidc',
]);

// SSO Connection Status
export const ssoConnectionStatusEnum = pgEnum('sso_connection_status', [
  'pending',
  'configured',
  'active',
  'error',
  'disabled',
]);

/**
 * SSO Provider Configurations
 *
 * Stores configuration for each SSO provider per tenant.
 */
export const ssoProviderConfigs = pgTable('sso_provider_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Provider Information
  providerType: ssoProviderTypeEnum('provider_type').notNull(),
  protocol: ssoProtocolEnum('protocol').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  description: text('description'),

  // Connection Status
  status: ssoConnectionStatusEnum('status').notNull().default('pending'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  isPrimary: boolean('is_primary').notNull().default(false),

  // SAML Configuration
  samlEntityId: varchar('saml_entity_id', { length: 512 }),
  samlSsoUrl: varchar('saml_sso_url', { length: 1024 }),
  samlSloUrl: varchar('saml_slo_url', { length: 1024 }),
  samlCertificate: text('saml_certificate'),
  samlCertificateFingerprint: varchar('saml_certificate_fingerprint', { length: 255 }),
  samlSigningAlgorithm: varchar('saml_signing_algorithm', { length: 50 }).default('sha256'),
  samlDigestAlgorithm: varchar('saml_digest_algorithm', { length: 50 }).default('sha256'),
  samlRequestSignature: boolean('saml_request_signature').default(true),
  samlWantAssertionsSigned: boolean('saml_want_assertions_signed').default(true),

  // OIDC Configuration
  oidcClientId: varchar('oidc_client_id', { length: 512 }),
  oidcClientSecret: text('oidc_client_secret'), // Encrypted
  oidcIssuer: varchar('oidc_issuer', { length: 1024 }),
  oidcAuthorizationUrl: varchar('oidc_authorization_url', { length: 1024 }),
  oidcTokenUrl: varchar('oidc_token_url', { length: 1024 }),
  oidcUserInfoUrl: varchar('oidc_userinfo_url', { length: 1024 }),
  oidcJwksUrl: varchar('oidc_jwks_url', { length: 1024 }),
  oidcScopes: varchar('oidc_scopes', { length: 512 }).default('openid profile email'),

  // Attribute Mapping
  attributeMapping: jsonb('attribute_mapping').$type<{
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    department?: string;
    jobTitle?: string;
    phoneNumber?: string;
    employeeId?: string;
    groups?: string;
    roles?: string;
    customAttributes?: Record<string, string>;
  }>().default({}),

  // Group Mapping (IdP group -> Printyx role)
  groupRoleMapping: jsonb('group_role_mapping').$type<Record<string, string>>().default({}),

  // Domain Restrictions
  allowedDomains: varchar('allowed_domains', { length: 1024 }), // Comma-separated list
  allowedEmailDomains: varchar('allowed_email_domains', { length: 1024 }),

  // Auto-provisioning settings
  autoProvisionUsers: boolean('auto_provision_users').notNull().default(true),
  autoUpdateUserAttributes: boolean('auto_update_user_attributes').notNull().default(true),
  autoDeactivateUsers: boolean('auto_deactivate_users').notNull().default(false),
  defaultRole: varchar('default_role', { length: 100 }),
  defaultLocationId: uuid('default_location_id'),

  // JIT (Just-In-Time) provisioning
  jitProvisioning: boolean('jit_provisioning').notNull().default(true),
  jitProvisioningRules: jsonb('jit_provisioning_rules').$type<{
    roleAssignment?: 'default' | 'mapped' | 'lowest';
    locationAssignment?: 'default' | 'mapped';
    requireApproval?: boolean;
    autoActivate?: boolean;
  }>().default({}),

  // Session Configuration
  sessionTimeout: varchar('session_timeout', { length: 20 }).default('8h'),
  forceReauthentication: boolean('force_reauthentication').default(false),
  singleLogoutEnabled: boolean('single_logout_enabled').default(true),

  // Provider-specific settings (e.g., Azure AD tenant ID)
  providerSettings: jsonb('provider_settings').$type<Record<string, any>>().default({}),

  // Metadata
  metadataUrl: varchar('metadata_url', { length: 1024 }),
  metadataXml: text('metadata_xml'),
  metadataLastFetched: timestamp('metadata_last_fetched'),

  // Verification
  verifiedAt: timestamp('verified_at'),
  verifiedBy: uuid('verified_by'),
  lastLoginAt: timestamp('last_login_at'),
  loginCount: varchar('login_count', { length: 20 }).default('0'),

  // Error tracking
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at'),
  errorCount: varchar('error_count', { length: 20 }).default('0'),

  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  tenantIdx: index('sso_provider_configs_tenant_idx').on(table.tenantId),
  providerTypeIdx: index('sso_provider_configs_provider_type_idx').on(table.providerType),
  statusIdx: index('sso_provider_configs_status_idx').on(table.status),
  enabledIdx: index('sso_provider_configs_enabled_idx').on(table.isEnabled),
  uniqueTenantProvider: unique('sso_provider_configs_tenant_provider_unique')
    .on(table.tenantId, table.providerType, table.name),
}));

/**
 * SSO User Mappings
 *
 * Links external identity provider users to Printyx users.
 */
export const ssoUserMappings = pgTable('sso_user_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').notNull().references(() => ssoProviderConfigs.id, { onDelete: 'cascade' }),

  // External Identity
  externalId: varchar('external_id', { length: 512 }).notNull(),
  externalEmail: varchar('external_email', { length: 255 }),
  externalUsername: varchar('external_username', { length: 255 }),

  // SAML-specific
  samlNameId: varchar('saml_name_id', { length: 512 }),
  samlNameIdFormat: varchar('saml_name_id_format', { length: 255 }),

  // OIDC-specific
  oidcSubject: varchar('oidc_subject', { length: 512 }),

  // Provisioning info
  provisionedAt: timestamp('provisioned_at').defaultNow().notNull(),
  provisionedBy: varchar('provisioned_by', { length: 50 }).notNull().default('jit'),
  lastSyncedAt: timestamp('last_synced_at'),

  // External attributes (cached from IdP)
  externalAttributes: jsonb('external_attributes').$type<Record<string, any>>().default({}),
  externalGroups: jsonb('external_groups').$type<string[]>().default([]),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  deactivatedAt: timestamp('deactivated_at'),
  deactivatedReason: varchar('deactivated_reason', { length: 255 }),

  // Last login tracking
  lastLoginAt: timestamp('last_login_at'),
  loginCount: varchar('login_count', { length: 20 }).default('0'),

  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('sso_user_mappings_tenant_idx').on(table.tenantId),
  userIdx: index('sso_user_mappings_user_idx').on(table.userId),
  providerIdx: index('sso_user_mappings_provider_idx').on(table.providerId),
  externalIdIdx: index('sso_user_mappings_external_id_idx').on(table.externalId),
  uniqueProviderExternalId: unique('sso_user_mappings_provider_external_id_unique')
    .on(table.providerId, table.externalId),
  uniqueUserProvider: unique('sso_user_mappings_user_provider_unique')
    .on(table.userId, table.providerId),
}));

/**
 * SSO Login Attempts
 *
 * Audit trail for SSO authentication attempts.
 */
export const ssoLoginAttempts = pgTable('sso_login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  providerId: uuid('provider_id').references(() => ssoProviderConfigs.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Request Info
  requestId: varchar('request_id', { length: 255 }).notNull(),
  protocol: ssoProtocolEnum('protocol').notNull(),
  initiatedAt: timestamp('initiated_at').defaultNow().notNull(),

  // Result
  success: boolean('success').notNull(),
  completedAt: timestamp('completed_at'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),

  // External Identity (from IdP response)
  externalId: varchar('external_id', { length: 512 }),
  externalEmail: varchar('external_email', { length: 255 }),

  // Provisioning result
  userProvisioned: boolean('user_provisioned').default(false),
  userUpdated: boolean('user_updated').default(false),

  // Request metadata
  clientIp: varchar('client_ip', { length: 45 }),
  userAgent: text('user_agent'),
  relayState: text('relay_state'),

  // SAML-specific
  samlAssertionId: varchar('saml_assertion_id', { length: 255 }),
  samlIssuer: varchar('saml_issuer', { length: 512 }),
  samlSessionIndex: varchar('saml_session_index', { length: 255 }),

  // OIDC-specific
  oidcNonce: varchar('oidc_nonce', { length: 255 }),
  oidcState: varchar('oidc_state', { length: 255 }),

  // Timing
  durationMs: varchar('duration_ms', { length: 20 }),

  // Additional context
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
}, (table) => ({
  tenantIdx: index('sso_login_attempts_tenant_idx').on(table.tenantId),
  providerIdx: index('sso_login_attempts_provider_idx').on(table.providerId),
  userIdx: index('sso_login_attempts_user_idx').on(table.userId),
  requestIdIdx: index('sso_login_attempts_request_id_idx').on(table.requestId),
  initiatedAtIdx: index('sso_login_attempts_initiated_at_idx').on(table.initiatedAt),
  successIdx: index('sso_login_attempts_success_idx').on(table.success),
}));

/**
 * SSO Sessions
 *
 * Track active SSO sessions for single logout support.
 */
export const ssoSessions = pgTable('sso_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').notNull().references(() => ssoProviderConfigs.id, { onDelete: 'cascade' }),

  // Session identifiers
  sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
  appSessionId: varchar('app_session_id', { length: 255 }), // Local app session

  // SAML session tracking
  samlSessionIndex: varchar('saml_session_index', { length: 255 }),
  samlNameId: varchar('saml_name_id', { length: 512 }),
  samlNameIdFormat: varchar('saml_name_id_format', { length: 255 }),

  // OIDC session tracking
  oidcIdToken: text('oidc_id_token'),
  oidcAccessToken: text('oidc_access_token'),
  oidcRefreshToken: text('oidc_refresh_token'),
  oidcTokenExpiresAt: timestamp('oidc_token_expires_at'),

  // Session state
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),

  // Logout tracking
  logoutInitiatedAt: timestamp('logout_initiated_at'),
  logoutCompletedAt: timestamp('logout_completed_at'),
  logoutMethod: varchar('logout_method', { length: 50 }), // 'user', 'idp', 'timeout', 'admin'

  // Client info
  clientIp: varchar('client_ip', { length: 45 }),
  userAgent: text('user_agent'),
}, (table) => ({
  tenantIdx: index('sso_sessions_tenant_idx').on(table.tenantId),
  userIdx: index('sso_sessions_user_idx').on(table.userId),
  providerIdx: index('sso_sessions_provider_idx').on(table.providerId),
  sessionIdIdx: index('sso_sessions_session_id_idx').on(table.sessionId),
  activeIdx: index('sso_sessions_active_idx').on(table.isActive),
  expiresAtIdx: index('sso_sessions_expires_at_idx').on(table.expiresAt),
}));

// Relations
export const ssoProviderConfigsRelations = relations(ssoProviderConfigs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [ssoProviderConfigs.tenantId],
    references: [tenants.id],
  }),
  userMappings: many(ssoUserMappings),
  loginAttempts: many(ssoLoginAttempts),
  sessions: many(ssoSessions),
}));

export const ssoUserMappingsRelations = relations(ssoUserMappings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ssoUserMappings.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [ssoUserMappings.userId],
    references: [users.id],
  }),
  provider: one(ssoProviderConfigs, {
    fields: [ssoUserMappings.providerId],
    references: [ssoProviderConfigs.id],
  }),
}));

export const ssoLoginAttemptsRelations = relations(ssoLoginAttempts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ssoLoginAttempts.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [ssoLoginAttempts.userId],
    references: [users.id],
  }),
  provider: one(ssoProviderConfigs, {
    fields: [ssoLoginAttempts.providerId],
    references: [ssoProviderConfigs.id],
  }),
}));

export const ssoSessionsRelations = relations(ssoSessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ssoSessions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [ssoSessions.userId],
    references: [users.id],
  }),
  provider: one(ssoProviderConfigs, {
    fields: [ssoSessions.providerId],
    references: [ssoProviderConfigs.id],
  }),
}));

// Zod Schemas for validation
export const insertSsoProviderConfigSchema = createInsertSchema(ssoProviderConfigs);
export const selectSsoProviderConfigSchema = createSelectSchema(ssoProviderConfigs);
export const insertSsoUserMappingSchema = createInsertSchema(ssoUserMappings);
export const selectSsoUserMappingSchema = createSelectSchema(ssoUserMappings);

// Type exports
export type SsoProviderConfig = typeof ssoProviderConfigs.$inferSelect;
export type NewSsoProviderConfig = typeof ssoProviderConfigs.$inferInsert;
export type SsoUserMapping = typeof ssoUserMappings.$inferSelect;
export type NewSsoUserMapping = typeof ssoUserMappings.$inferInsert;
export type SsoLoginAttempt = typeof ssoLoginAttempts.$inferSelect;
export type NewSsoLoginAttempt = typeof ssoLoginAttempts.$inferInsert;
export type SsoSession = typeof ssoSessions.$inferSelect;
export type NewSsoSession = typeof ssoSessions.$inferInsert;

// Provider type constants
export const SSO_PROVIDERS = {
  AZURE_AD: 'azure_ad',
  OKTA: 'okta',
  GOOGLE_WORKSPACE: 'google_workspace',
  ONELOGIN: 'onelogin',
  PING_IDENTITY: 'ping_identity',
  CUSTOM_SAML: 'custom_saml',
  CUSTOM_OIDC: 'custom_oidc',
} as const;

export type SsoProviderType = typeof SSO_PROVIDERS[keyof typeof SSO_PROVIDERS];

// Default attribute mappings per provider
export const DEFAULT_ATTRIBUTE_MAPPINGS: Record<string, Record<string, string>> = {
  azure_ad: {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    displayName: 'http://schemas.microsoft.com/identity/claims/displayname',
    groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
  },
  okta: {
    email: 'email',
    firstName: 'firstName',
    lastName: 'lastName',
    displayName: 'displayName',
    groups: 'groups',
  },
  google_workspace: {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    displayName: 'name',
  },
};
