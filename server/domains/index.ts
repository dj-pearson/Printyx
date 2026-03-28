/**
 * Domain Module Index
 *
 * All route files are organized into ~20 logical domain modules.
 * Each domain barrel re-exports registration functions from its member route files.
 * This allows the route registry to import from ~20 modules instead of 134+ individual files.
 */
export * as AuthDomain from './auth';
export * as BillingDomain from './billing';
export * as CrmDomain from './crm';
export * as SalesDomain from './sales';
export * as ProductsDomain from './products';
export * as WarehouseDomain from './warehouse';
export * as ServiceDomain from './service';
export * as MobileDomain from './mobile';
export * as DashboardDomain from './dashboard';
export * as ReportingDomain from './reporting';
export * as AdminDomain from './admin';
export * as SecurityDomain from './security';
export * as KnowledgeDomain from './knowledge';
export * as IntegrationsDomain from './integrations';
export * as TasksDomain from './tasks';
export * as ContentDomain from './content';
export * as OnboardingDomain from './onboarding';
export * as NotificationsDomain from './notifications';
export * as AiDomain from './ai';
export * as PortalDomain from './portal';
