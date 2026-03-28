/**
 * Mobile & Field Operations Domain
 * Mobile API, technician app, workflow, GPS, mileage, geofence
 */
export { registerMobileApiRoutes } from '../routes-mobile-api';
export { registerWorkflowMobileRoutes } from '../routes-workflow-mobile';
export { default as mobileTechnicianRoutes } from '../routes-mobile-technician';
export { default as mobileLogsRoutes, registerMobileLogsAdminRoutes } from '../routes-mobile-logs';
