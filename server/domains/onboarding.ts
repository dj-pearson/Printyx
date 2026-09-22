/**
 * Onboarding & User Management Domain
 * Onboarding workflows, user profile, settings, accessibility, export
 */
export { registerOnboardingRoutes } from '../routes-onboarding';
// ROUND 133: ../routes-export is deleted. Two of its three generators set a
// content type they did not produce (HTML as application/pdf, JSON as xlsx) and
// all three 404'd in production. The CSV lives in the onboarding edge function
// now; the PDF is its generate-pdf branch.
export { default as accessibilityRoutes } from '../routes-accessibility';
