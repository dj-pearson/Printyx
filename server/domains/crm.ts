/**
 * CRM Core Domain
 * Contacts, companies, activities, customers, business records, goals, views
 */
export { registerCrmCoreRoutes } from '../routes-crm-core';
export { registerCompaniesRoutes } from '../routes-companies';
export { registerBusinessRecordRoutes } from '../routes-business-records';
export { registerCrmBulkRoutes } from '../routes-crm-bulk';
export { registerBulkOperationsRoutes } from '../routes-bulk-operations';
export { registerCsvImportRoutes } from '../routes-csv-import';
// signupCrmRoutes (routes-signup-crm.ts) retired in round 243: no caller.
export { default as universalSearchRoutes } from '../routes-universal-search';
export { default as businessRecordsRoutes } from '../routes-business-records';
