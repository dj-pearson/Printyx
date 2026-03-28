/**
 * Integrations & External Services Domain
 * Salesforce, QuickBooks, manufacturer, data enrichment, integration hub
 */
export { registerIntegrationRoutes } from '../routes-integrations';
export { registerSalesforceRoutes } from '../routes-salesforce-integration';
export { registerSalesforceTestRoutes } from '../test-salesforce-integration';
export { default as integrationRoutes } from '../integrations/routes';
export { default as integrationHubRoutes } from '../routes-integration-hub';
