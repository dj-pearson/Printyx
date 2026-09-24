/**
 * Service & Field Operations Domain
 * Service dispatch, maintenance, equipment lifecycle, technician management
 */
// Round 174: registerServiceAnalysisRoutes retired with routes-service-analysis.ts;
// /api/parts-orders is proxied whole to supabase/functions/parts-orders/.
export { registerTechnicianManagementRoutes } from '../routes-technician-management';
export { serviceDispatchRouter } from '../routes-service-dispatch';
// Round 158: equipmentLifecycleStateMachineRoutes retired; /api/equipment-lifecycle
// is proxied whole to supabase/functions/equipment-lifecycle/.
export { default as equipmentDisposalRoutes } from '../routes-equipment-disposal';
// equipmentQRRoutes: deleted in round 228 (routes-equipment-qr.ts); see routes-registry.
export { default as enhancedServiceRoutes } from '../routes-enhanced-service';
