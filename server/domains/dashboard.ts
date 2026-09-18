/**
 * Dashboard & Widgets Domain
 * Core dashboards, modular dashboard, today dashboard, widgets, layouts, customization
 */
// registerDashboardsCoreRoutes, registerModularDashboardRoutes and
// registerDashboardLayoutsRoutes are GONE (DASH-METRICS-001). All three served
// /api/dashboard/*, which is proxied to supabase/functions/dashboard/ now, so
// every handler in them was shadowed. registerTodayDashboardRoutes stays: it
// owns /api/dashboards/today, a different prefix.
// registerDashboardWidgetRoutes — migrated to supabase/functions/dashboard-widgets/
export { registerTodayDashboardRoutes } from '../routes-today-dashboard';
