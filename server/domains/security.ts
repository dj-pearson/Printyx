/**
 * Security & Compliance Domain
 * Security dashboard, GDPR, incident response
 *
 * Breach detection migrated to supabase/functions/reports/handlers/second-tier.ts;
 * frontend hits /api/reports/breaches (proxied to the reports edge function).
 */
export { registerGdprRoutes } from '../routes-gdpr';
export { default as incidentResponseRoutes } from '../routes-incident-response';
