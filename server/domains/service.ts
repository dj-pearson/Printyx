/**
 * Service & Field Operations Domain
 * Service dispatch, maintenance, equipment lifecycle, technician management
 */
export { registerServiceAnalysisRoutes } from '../routes-service-analysis';
export { registerPredictiveServiceDispatchRoutes } from '../routes-predictive-service-dispatch';
export { registerTechnicianManagementRoutes } from '../routes-technician-management';
export { serviceDispatchRouter } from '../routes-service-dispatch';
export { proactiveMaintenanceRouter } from '../routes-proactive-maintenance';
export { predictiveMaintenanceHubRouter } from '../routes-predictive-maintenance-hub';
export { default as equipmentLifecycleStateMachineRoutes } from '../routes-equipment-lifecycle-state-machine';
export { default as equipmentDisposalRoutes } from '../routes-equipment-disposal';
export { default as equipmentQRRoutes } from '../routes-equipment-qr';
export { default as enhancedServiceRoutes } from '../routes-enhanced-service';
