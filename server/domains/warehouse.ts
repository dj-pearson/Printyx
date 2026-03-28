/**
 * Warehouse & Inventory Domain
 * Warehouse ops, purchase orders, supply replenishment, FPY
 */
export { registerWarehouseRoutes } from '../routes-warehouse';
export { registerPurchaseOrderRoutes } from '../routes-purchase-orders';
export { default as autoSupplyReplenishmentRoutes } from '../routes-auto-supply-replenishment';
export { default as warehouseFpyRoutes } from '../routes-warehouse-fpy';
