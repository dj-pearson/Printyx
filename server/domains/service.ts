/**
 * Service & Field Operations Domain
 * Service dispatch, maintenance, equipment lifecycle, technician management
 */
export { registerServiceAnalysisRoutes } from '../routes-service-analysis';
export { registerTechnicianManagementRoutes } from '../routes-technician-management';
export { serviceDispatchRouter } from '../routes-service-dispatch';
// Round 158: equipmentLifecycleStateMachineRoutes retired; /api/equipment-lifecycle
// is proxied whole to supabase/functions/equipment-lifecycle/.
export { default as equipmentDisposalRoutes } from '../routes-equipment-disposal';
export { default as equipmentQRRoutes } from '../routes-equipment-qr';
export { default as enhancedServiceRoutes } from '../routes-enhanced-service';
