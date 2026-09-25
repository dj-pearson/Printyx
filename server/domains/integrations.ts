/**
 * Integrations & External Services Domain
 * Salesforce, QuickBooks, manufacturer, data enrichment, integration hub
 */
// Round 176: registerIntegrationRoutes retired; routes-integrations.ts shadowed
// integrations/routes.ts on three paths with a fabricated connection test.
export { registerSalesforceRoutes } from '../routes-salesforce-integration';
export { registerSalesforceTestRoutes } from '../test-salesforce-integration';
export { default as integrationRoutes } from '../integrations/routes';
