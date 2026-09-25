/**
 * Billing & Financial Domain
 * Billing, pricing, commissions, forecasting, QuickBooks
 */
export { registerQuickBooksRoutes } from '../routes-quickbooks-integration';
// Round 175: the routes-pricing.ts handlers are retired; /api/pricing is proxied.
export { default as printCostCalculatorRoutes } from '../routes-print-cost-calculator';
export { default as salesForecastingRoutes } from '../routes-sales-forecasting';
