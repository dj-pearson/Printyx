/**
 * Products & Catalog Domain
 * Product CRUD, catalog, models, software products, data enrichment
 */
export { registerProductsCrudRoutes } from '../routes-products-crud';
// registerCatalogRoutes / routes-catalog.ts DELETED (PROD-008): /api/catalog
// is proxied to supabase/functions/catalog/, which serves the master catalogue.
export { registerCatalogCsvRoutes } from '../routes-catalog-csv';
export { registerProductModelsRoutes } from '../routes-product-models';
// Round 175: registerProductPricingRoutes retired; /api/pricing is proxied.
// Round 154: registerSoftwareProductsRoutes (routes-software-products.ts)
// retired. It had no role check on writes and no /import or /dedupe branch,
// both of which SoftwareProducts.tsx calls, so dev 404'd on them. The prefix is
// proxied to supabase/functions/software-products/.
// Round 161: registerManufacturerIntegrationRoutes retired. It redacted through
// the shared view but had no role gate on its writes, while the edge function
// needs a manager (SEC-EDGE-001 round 74). /api/manufacturer-integrations is
// proxied to supabase/functions/manufacturer-integrations/.
