/**
 * Sales & Pipeline Domain
 * Deals, pipeline, leads, opportunities, renewals, handoffs
 */
// registerDealDeskRoutes — migrated to supabase/functions/deal-desk/
export { registerDealTagRoutes } from '../routes-deal-tags';
// registerPipelineConfigurationRoutes — migrated to supabase/functions/pipeline-config/
// setupSalesPipelineRoutes — migrated to supabase/functions/sales-pipeline/
// registerLeadAssignmentRoutes - DELETED (SEC-EDGE-001 batch 15). All six of its
// prefixes are uncalled by every client tree and covered by the canonical
// supabase/functions/lead-assignment/, which server.ts now aliases them onto.
export { registerLeadMapRoutes } from '../routes-lead-map';
// registerAutoLeadRoutingRoutes - DELETED (SEC-EDGE-001 batch 15), shadowed by
// the /api/auto-lead-routing proxy entry.
// registerSalesHandoffRoutes - DELETED (WF-P-07, implementation_projects retired)
// Round 182: registerRenewalManagementRoutes retired with the unwired renewal
// model (docs/renewal-model-decision.md).
// Round 165: contractRenewalRoutes retired. The edge function serves every
// path the web page and iOS call (including /upcoming and /:id/renew, which the
// Express router never had) and shares the analysis through
// _shared/renewal-analysis.ts. /api/contract-renewal is proxied.
