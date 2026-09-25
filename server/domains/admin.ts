/**
 * Admin & Operations Domain
 * Root admin, admin workflows, stats, subscriptions, seed data
 */
export { registerAdminStatsRoutes } from '../routes-admin-stats';
export { registerOperationsExtendedRoutes } from '../routes-operations-extended';
// Round 154: registerAuditLogRoutes (routes-audit-logs.ts) retired; the prefix
// is proxied to supabase/functions/audit-logs/, which answers the same
// { logs, pagination } shape, caps `limit` at 200, and takes the tenant from
// the caller rather than an x-tenant-id header.
export { registerSampleDataRoutes } from '../routes-sample-data';
export { registerDisposableEmailRoutes } from '../routes-disposable-emails';
