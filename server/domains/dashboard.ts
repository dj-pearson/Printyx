/**
 * Dashboard & Widgets Domain
 * Core dashboards, modular dashboard, today dashboard, widgets, layouts, customization
 */
export { registerDashboardsCoreRoutes } from '../routes-dashboards-core';
export { registerModularDashboardRoutes } from '../routes-modular-dashboard';
// registerDashboardWidgetRoutes — migrated to supabase/functions/dashboard-widgets/
export { registerTodayDashboardRoutes } from '../routes-today-dashboard';
export { registerDashboardLayoutsRoutes } from '../routes-dashboard-layouts';
