/**
 * Warehouse & Inventory Domain
 * Warehouse ops, purchase orders, supply replenishment, FPY
 */
export { registerWarehouseRoutes } from '../routes-warehouse';
// Round 164: autoSupplyReplenishmentRoutes retired. The edge function serves
// every path the page calls and shares the analysis logic through
// _shared/supply-analysis.ts; /api/auto-supply-replenishment is proxied.
export { default as warehouseFpyRoutes } from '../routes-warehouse-fpy';
