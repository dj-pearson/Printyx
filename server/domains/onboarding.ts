/**
 * Onboarding & User Management Domain
 * Onboarding workflows, user profile, settings, accessibility, export
 */
export { registerOnboardingRoutes } from '../routes-onboarding';
export { exportChecklistPDF, exportChecklistExcel, exportChecklistCSV } from '../routes-export';
export { default as accessibilityRoutes } from '../routes-accessibility';
