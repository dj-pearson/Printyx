/**
 * Sales & Pipeline Domain
 * Deals, pipeline, leads, opportunities, renewals, handoffs
 */
export { registerDealsRoutes } from '../routes-deals';
export { registerDealsManagementRoutes } from '../routes-deals-management';
// registerDealDeskRoutes — migrated to supabase/functions/deal-desk/
export { registerDealTagRoutes } from '../routes-deal-tags';
export { registerOpportunitiesRoutes } from '../routes-opportunities';
// registerPipelineConfigurationRoutes — migrated to supabase/functions/pipeline-config/
// setupSalesPipelineRoutes — migrated to supabase/functions/sales-pipeline/
export { registerLeadAssignmentRoutes } from '../routes-lead-assignment';
export { registerLeadMapRoutes } from '../routes-lead-map';
export { registerAutoLeadRoutingRoutes } from '../routes-auto-lead-routing';
export { registerSalesRepAssignmentRoutes } from '../routes-sales-rep-assignments';
export { registerSalesHandoffRoutes } from '../routes-sales-handoff';
export { registerRenewalManagementRoutes } from '../routes-renewal-management';
export { default as contractRenewalRoutes } from '../routes-contract-renewal';
