/**
 * Auth & Security Domain
 * Authentication, session management, RBAC, MFA, SSO, CSP
 */
export { registerAuthCoreRoutes } from '../routes-auth-core';
export { registerFeatureFlagRoutes } from '../routes-feature-flags';
export { registerSessionManagementRoutes } from '../routes-session-management';
export { enhancedRBACRoutes } from '../routes-enhanced-rbac';
export { registerCspReportRoutes } from '../routes-csp-report';
export { trialRoutes } from '../routes-trial';
