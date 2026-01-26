# Schema Validation Report

**Generated:** 2026-01-26T22:46:18.063Z

## Summary

- **Files Scanned:** 1108
- **Total Issues:** 3511
  - Errors: 2248 ❌
  - Warnings: 1263 ⚠️
  - Info: 0 ℹ️

## Schema Information

- **Total Tables:** 207.5
- **Total Columns:** 8483
- **Schemas:** _realtime, realtime, public, auth, storage

## ❌ Invalid Table References

Found 2248 issue(s)

### `server\websocket-service.ts`

❌ **Line 299:** Table 'to' not found in schema

```
`📡 Broadcasted update to channel: ${channel} (${this.getSubscriberCount(channel)} subscribers)`,
```

💡 **Suggestion:** Similar tables: mfa_factors, one_time_tokens, refresh_tokens

---

### `server\update-stripe-ids.ts`

❌ **Line 74:** Table 'subscriptionPlans' not found in schema

```
const existingPlan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 126:** Table 'subscriptionPlans' not found in schema

```
const allPlans = await db.query.subscriptionPlans.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\test-toner-order.ts`

❌ **Line 32:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 64:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 132:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 245:** Table 'service_contracts' not found in schema

```
console.log("   DELETE FROM service_contracts WHERE contract_number = 'TEST-SVC-2025-001';");
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\storage.ts`

❌ **Line 1907:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels);
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 1929:** Table 'masterProductAccessories' not found in schema

```
.from(masterProductAccessories);
```

💡 **Suggestion:** Did you mean 'master_product_accessories'?

---

❌ **Line 1990:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels)
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 2023:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels)
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 2045:** Table 'masterProductAccessories' not found in schema

```
.from(masterProductAccessories)
```

💡 **Suggestion:** Did you mean 'master_product_accessories'?

---

❌ **Line 2074:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels)
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 2103:** Table 'enabledProducts' not found in schema

```
.from(enabledProducts)
```

💡 **Suggestion:** Did you mean 'enabled_products'?

---

❌ **Line 2118:** Table 'enabledProducts' not found in schema

```
.from(enabledProducts)
```

💡 **Suggestion:** Did you mean 'enabled_products'?

---

❌ **Line 2176:** Table 'masterProductAccessoryRelationships' not found in schema

```
.from(masterProductAccessoryRelationships)
```

💡 **Suggestion:** Did you mean 'master_product_accessory_relationships'?

---

❌ **Line 2301:** Table 'userCustomerAssignments' not found in schema

```
.from(userCustomerAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2326:** Table 'userCustomerAssignments' not found in schema

```
.from(userCustomerAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2386:** Table 'serviceTickets' not found in schema

```
let query = db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 2504:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 2530:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 2613:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 2620:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 2628:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 2810:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 2819:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 2892:** Table 'serviceTickets' not found in schema

```
return await db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 2917:** Table 'inventoryItems' not found in schema

```
return await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 2954:** Table 'meterReadings' not found in schema

```
return await db.select().from(meterReadings).where(eq(meterReadings.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 2967:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 3009:** Table 'userCustomerAssignments' not found in schema

```
.from(userCustomerAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3171:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 3195:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

❌ **Line 3230:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

❌ **Line 3244:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 3300:** Table 'leadContacts' not found in schema

```
.from(leadContacts)
```

💡 **Suggestion:** Did you mean 'lead_contacts'?

---

❌ **Line 3315:** Table 'leadRelatedRecords' not found in schema

```
.from(leadRelatedRecords)
```

💡 **Suggestion:** Did you mean 'lead_related_records'?

---

❌ **Line 3344:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 3352:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 3363:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 3375:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 3409:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 3430:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 3480:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels)
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 3498:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 3509:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 3526:** Table 'accessoryModelCompatibility' not found in schema

```
.from(accessoryModelCompatibility)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3540:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 3585:** Table 'accessoryModelCompatibility' not found in schema

```
.from(accessoryModelCompatibility)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3600:** Table 'accessoryModelCompatibility' not found in schema

```
.from(accessoryModelCompatibility)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3635:** Table 'cpcRates' not found in schema

```
.from(cpcRates)
```

💡 **Suggestion:** Did you mean 'cpc_rates'?

---

❌ **Line 3649:** Table 'contractTieredRates' not found in schema

```
.from(contractTieredRates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3657:** Table 'contractTieredRates' not found in schema

```
.from(contractTieredRates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3776:** Table 'performanceMetrics' not found in schema

```
.from(performanceMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3813:** Table 'systemAlerts' not found in schema

```
.from(systemAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3843:** Table 'systemAlerts' not found in schema

```
.from(systemAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3869:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 3901:** Table 'professionalServices' not found in schema

```
.from(professionalServices)
```

💡 **Suggestion:** Did you mean 'professional_services'?

---

❌ **Line 3912:** Table 'professionalServices' not found in schema

```
.from(professionalServices)
```

💡 **Suggestion:** Did you mean 'professional_services'?

---

❌ **Line 3953:** Table 'serviceProducts' not found in schema

```
.from(serviceProducts)
```

💡 **Suggestion:** Did you mean 'service_products'?

---

❌ **Line 3967:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 3978:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 4035:** Table 'masterProductModels' not found in schema

```
.from(masterProductModels)
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

❌ **Line 4052:** Table 'managedServices' not found in schema

```
.from(managedServices)
```

💡 **Suggestion:** Did you mean 'managed_services'?

---

❌ **Line 4063:** Table 'managedServices' not found in schema

```
.from(managedServices)
```

💡 **Suggestion:** Did you mean 'managed_services'?

---

❌ **Line 4155:** Table 'leadContacts' not found in schema

```
.from(leadContacts)
```

💡 **Suggestion:** Did you mean 'lead_contacts'?

---

❌ **Line 4198:** Table 'enhancedContacts' not found in schema

```
.from(enhancedContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4209:** Table 'vendors' not found in schema

```
return await db.select().from(vendors).where(eq(vendors.tenantId, tenantId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4215:** Table 'vendors' not found in schema

```
.from(vendors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4247:** Table 'accountsPayable' not found in schema

```
return await db.select().from(accountsPayable).where(eq(accountsPayable.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'accounts_payable'?

---

❌ **Line 4253:** Table 'accountsPayable' not found in schema

```
.from(accountsPayable)
```

💡 **Suggestion:** Did you mean 'accounts_payable'?

---

❌ **Line 4280:** Table 'accountsReceivable' not found in schema

```
.from(accountsReceivable)
```

💡 **Suggestion:** Did you mean 'accounts_receivable'?

---

❌ **Line 4290:** Table 'accountsReceivable' not found in schema

```
.from(accountsReceivable)
```

💡 **Suggestion:** Did you mean 'accounts_receivable'?

---

❌ **Line 4315:** Table 'chartOfAccounts' not found in schema

```
return await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, tenantId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4321:** Table 'chartOfAccounts' not found in schema

```
.from(chartOfAccounts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4346:** Table 'purchaseOrders' not found in schema

```
return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'purchase_orders'?

---

❌ **Line 4352:** Table 'purchaseOrders' not found in schema

```
.from(purchaseOrders)
```

💡 **Suggestion:** Did you mean 'purchase_orders'?

---

❌ **Line 4381:** Table 'purchaseOrderItems' not found in schema

```
.from(purchaseOrderItems)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4441:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 4555:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 4582:** Table 'dealStages' not found in schema

```
const [stage] = await db.select().from(dealStages).where(eq(dealStages.id, stageId));
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 4634:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 4667:** Table 'dealActivities' not found in schema

```
.from(dealActivities)
```

💡 **Suggestion:** Did you mean 'deal_activities'?

---

❌ **Line 4682:** Table 'companyPricingSettings' not found in schema

```
.from(companyPricingSettings)
```

💡 **Suggestion:** Did you mean 'company_pricing_settings'?

---

❌ **Line 4719:** Table 'productPricing' not found in schema

```
.from(productPricing)
```

💡 **Suggestion:** Did you mean 'product_pricing'?

---

❌ **Line 4731:** Table 'productPricing' not found in schema

```
.from(productPricing)
```

💡 **Suggestion:** Did you mean 'product_pricing'?

---

❌ **Line 4771:** Table 'quotePricing' not found in schema

```
.from(quotePricing)
```

💡 **Suggestion:** Did you mean 'quote_pricing'?

---

❌ **Line 4809:** Table 'quotePricingLineItems' not found in schema

```
.from(quotePricingLineItems)
```

💡 **Suggestion:** Did you mean 'quote_pricing_line_items'?

---

❌ **Line 4875:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 4931:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 4960:** Table 'companyContacts' not found in schema

```
const [contact] = await db.select().from(companyContacts).where(eq(companyContacts.id, id));
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 5015:** Table 'userSettings' not found in schema

```
const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
```

💡 **Suggestion:** Did you mean 'user_settings'?

---

❌ **Line 5233:** Table 'mobileServiceSessions' not found in schema

```
.from(mobileServiceSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5270:** Table 'timeTrackingEntries' not found in schema

```
.from(timeTrackingEntries)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5290:** Table 'servicePhotos' not found in schema

```
let query = db.select().from(servicePhotos).where(eq(servicePhotos.tenantId, params.tenantId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5317:** Table 'locationHistory' not found in schema

```
.from(locationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5348:** Table 'onboardingChecklists' not found in schema

```
.from(onboardingChecklists)
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 5359:** Table 'onboardingChecklists' not found in schema

```
.from(onboardingChecklists)
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 5396:** Table 'onboardingEquipment' not found in schema

```
.from(onboardingEquipment)
```

💡 **Suggestion:** Did you mean 'onboarding_equipment'?

---

❌ **Line 5432:** Table 'onboardingNetworkConfig' not found in schema

```
.from(onboardingNetworkConfig)
```

💡 **Suggestion:** Did you mean 'onboarding_network_config'?

---

❌ **Line 5470:** Table 'onboardingPrintManagement' not found in schema

```
.from(onboardingPrintManagement)
```

💡 **Suggestion:** Did you mean 'onboarding_print_management'?

---

❌ **Line 5508:** Table 'onboardingDynamicSections' not found in schema

```
.from(onboardingDynamicSections)
```

💡 **Suggestion:** Did you mean 'onboarding_dynamic_sections'?

---

❌ **Line 5551:** Table 'onboardingTasks' not found in schema

```
.from(onboardingTasks)
```

💡 **Suggestion:** Did you mean 'onboarding_tasks'?

---

❌ **Line 5588:** Table 'leases' not found in schema

```
.from(leases)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5596:** Table 'leases' not found in schema

```
.from(leases)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5604:** Table 'leases' not found in schema

```
.from(leases)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5612:** Table 'leases' not found in schema

```
.from(leases)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5643:** Table 'leasePayments' not found in schema

```
.from(leasePayments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5651:** Table 'leasePayments' not found in schema

```
.from(leasePayments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5662:** Table 'leasePayments' not found in schema

```
.from(leasePayments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5678:** Table 'leasePayments' not found in schema

```
.from(leasePayments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5717:** Table 'leaseRenewals' not found in schema

```
.from(leaseRenewals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5725:** Table 'leaseRenewals' not found in schema

```
.from(leaseRenewals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5736:** Table 'leaseRenewals' not found in schema

```
.from(leaseRenewals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5750:** Table 'leaseRenewals' not found in schema

```
.from(leaseRenewals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5789:** Table 'leaseDispositions' not found in schema

```
.from(leaseDispositions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5797:** Table 'leaseDispositions' not found in schema

```
.from(leaseDispositions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5808:** Table 'leaseDispositions' not found in schema

```
.from(leaseDispositions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5847:** Table 'integrationCredentials' not found in schema

```
.from(integrationCredentials)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5858:** Table 'integrationCredentials' not found in schema

```
.from(integrationCredentials)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5869:** Table 'integrationCredentials' not found in schema

```
.from(integrationCredentials)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5880:** Table 'integrationCredentials' not found in schema

```
.from(integrationCredentials)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5933:** Table 'signatureRequests' not found in schema

```
.from(signatureRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5939:** Table 'signatureRequests' not found in schema

```
.from(signatureRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5947:** Table 'signatureRequests' not found in schema

```
.from(signatureRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5958:** Table 'signatureRequests' not found in schema

```
.from(signatureRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5974:** Table 'signatureRequests' not found in schema

```
.from(signatureRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6014:** Table 'signatureSigners' not found in schema

```
.from(signatureSigners)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6024:** Table 'signatureSigners' not found in schema

```
.from(signatureSigners)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6057:** Table 'signatureDocuments' not found in schema

```
.from(signatureDocuments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6067:** Table 'signatureDocuments' not found in schema

```
.from(signatureDocuments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6100:** Table 'signatureAuditLogs' not found in schema

```
.from(signatureAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6113:** Table 'signatureAuditLogs' not found in schema

```
.from(signatureAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6146:** Table 'installations' not found in schema

```
.from(installations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6154:** Table 'installations' not found in schema

```
.from(installations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6165:** Table 'installations' not found in schema

```
.from(installations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6206:** Table 'installations' not found in schema

```
.from(installations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6237:** Table 'serviceSignatures' not found in schema

```
.from(serviceSignatures)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6245:** Table 'serviceSignatures' not found in schema

```
.from(serviceSignatures)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6281:** Table 'installationChecklists' not found in schema

```
.from(installationChecklists)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6297:** Table 'installationChecklists' not found in schema

```
.from(installationChecklists)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6339:** Table 'emailTemplates' not found in schema

```
let query = db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6355:** Table 'emailTemplates' not found in schema

```
.from(emailTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6363:** Table 'emailTemplates' not found in schema

```
.from(emailTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6374:** Table 'emailTemplates' not found in schema

```
.from(emailTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6423:** Table 'emailCampaigns' not found in schema

```
.from(emailCampaigns)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6431:** Table 'emailCampaigns' not found in schema

```
.from(emailCampaigns)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6442:** Table 'emailCampaigns' not found in schema

```
.from(emailCampaigns)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6479:** Table 'emailSends' not found in schema

```
.from(emailSends)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6484:** Table 'emailEvents' not found in schema

```
.from(emailEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6538:** Table 'emailSends' not found in schema

```
.from(emailSends)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6546:** Table 'emailSends' not found in schema

```
.from(emailSends)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6554:** Table 'emailSends' not found in schema

```
.from(emailSends)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6591:** Table 'emailEvents' not found in schema

```
.from(emailEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6609:** Table 'emailEvents' not found in schema

```
.from(emailEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6637:** Table 'emailLists' not found in schema

```
.from(emailLists)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6645:** Table 'emailLists' not found in schema

```
.from(emailLists)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6653:** Table 'emailLists' not found in schema

```
.from(emailLists)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6685:** Table 'emailListMembers' not found in schema

```
.from(emailListMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6715:** Table 'emailListMembers' not found in schema

```
.from(emailListMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6723:** Table 'emailListMembers' not found in schema

```
.from(emailListMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6735:** Table 'emailListMembers' not found in schema

```
.from(emailListMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6790:** Table 'emailUnsubscribes' not found in schema

```
.from(emailUnsubscribes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6811:** Table 'emailUnsubscribes' not found in schema

```
.from(emailUnsubscribes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6885:** Table 'mfaBackupCodes' not found in schema

```
.from(mfaBackupCodes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6933:** Table 'mfaBackupCodes' not found in schema

```
.from(mfaBackupCodes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6959:** Table 'mfaBackupCodes' not found in schema

```
.from(mfaBackupCodes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6991:** Table 'mfaAuditLogs' not found in schema

```
.from(mfaAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7012:** Table 'mfaAuditLogs' not found in schema

```
.from(mfaAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7051:** Table 'mfaAuditLogs' not found in schema

```
.from(mfaAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7066:** Table 'mfaAuditLogs' not found in schema

```
.from(mfaAuditLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7109:** Table 'workflows' not found in schema

```
const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7120:** Table 'workflows' not found in schema

```
.from(workflows)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7147:** Table 'workflowVersions' not found in schema

```
.from(workflowVersions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7153:** Table 'workflowVersions' not found in schema

```
const [version] = await db.select().from(workflowVersions).where(eq(workflowVersions.id, id));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7160:** Table 'workflowVersions' not found in schema

```
.from(workflowVersions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7176:** Table 'workflowTriggers' not found in schema

```
.from(workflowTriggers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7181:** Table 'workflowTriggers' not found in schema

```
const [trigger] = await db.select().from(workflowTriggers).where(eq(workflowTriggers.id, id));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7204:** Table 'workflowTriggers' not found in schema

```
.from(workflowTriggers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7217:** Table 'triggerSchedules' not found in schema

```
.from(triggerSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7238:** Table 'triggerSchedules' not found in schema

```
.from(triggerSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7259:** Table 'workflowStepsAutomation' not found in schema

```
.from(workflowStepsAutomation)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7289:** Table 'workflowExecutions' not found in schema

```
.from(workflowExecutions)
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 7300:** Table 'workflowExecutions' not found in schema

```
.from(workflowExecutions)
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 7312:** Table 'workflowExecutions' not found in schema

```
.from(workflowExecutions)
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 7333:** Table 'workflowExecutions' not found in schema

```
.from(workflowExecutions)
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 7348:** Table 'workflowExecutionSteps' not found in schema

```
.from(workflowExecutionSteps)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7373:** Table 'workflowExecutionEvents' not found in schema

```
.from(workflowExecutionEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7395:** Table 'workflowConditions' not found in schema

```
.from(workflowConditions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7413:** Table 'workflowTemplates' not found in schema

```
.from(workflowTemplates)
```

💡 **Suggestion:** Did you mean 'workflow_templates'?

---

❌ **Line 7422:** Table 'workflowTemplates' not found in schema

```
.from(workflowTemplates)
```

💡 **Suggestion:** Did you mean 'workflow_templates'?

---

❌ **Line 7455:** Table 'templateVariables' not found in schema

```
.from(templateVariables)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7473:** Table 'workflowEventRegistry' not found in schema

```
.from(workflowEventRegistry)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7481:** Table 'workflowEventRegistry' not found in schema

```
.from(workflowEventRegistry)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7495:** Table 'workflowExecutions' not found in schema

```
.from(workflowExecutions)
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 7528:** Table 'leadScoringRules' not found in schema

```
const [rule] = await db.select().from(leadScoringRules).where(eq(leadScoringRules.id, id));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7539:** Table 'leadScoringRules' not found in schema

```
.from(leadScoringRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7547:** Table 'leadScoringRules' not found in schema

```
.from(leadScoringRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7577:** Table 'leadScoringFactors' not found in schema

```
.from(leadScoringFactors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7595:** Table 'bantQualificationCriteria' not found in schema

```
.from(bantQualificationCriteria)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7618:** Table 'bantQualificationCriteria' not found in schema

```
.from(bantQualificationCriteria)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7639:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7649:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7663:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7670:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7692:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7699:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7728:** Table 'leadQualificationHistory' not found in schema

```
.from(leadQualificationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7739:** Table 'leadQualificationHistory' not found in schema

```
.from(leadQualificationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7754:** Table 'leadEngagementTracking' not found in schema

```
.from(leadEngagementTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7766:** Table 'leadEngagementTracking' not found in schema

```
.from(leadEngagementTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7782:** Table 'leadEngagementTracking' not found in schema

```
.from(leadEngagementTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7816:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7823:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7862:** Table 'leadScoringFactors' not found in schema

```
.from(leadScoringFactors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7898:** Table 'bantQualificationCriteria' not found in schema

```
.from(bantQualificationCriteria)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7951:** Table 'manufacturerConnections' not found in schema

```
.from(manufacturerConnections)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7970:** Table 'manufacturerConnections' not found in schema

```
.from(manufacturerConnections)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7980:** Table 'manufacturerConnections' not found in schema

```
.from(manufacturerConnections)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7993:** Table 'manufacturerConnections' not found in schema

```
.from(manufacturerConnections)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8101:** Table 'manufacturerOrders' not found in schema

```
.from(manufacturerOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8111:** Table 'manufacturerOrders' not found in schema

```
.from(manufacturerOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8124:** Table 'manufacturerOrders' not found in schema

```
.from(manufacturerOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8220:** Table 'manufacturerOrderLineItems' not found in schema

```
.from(manufacturerOrderLineItems)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8230:** Table 'manufacturerOrderLineItems' not found in schema

```
.from(manufacturerOrderLineItems)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8316:** Table 'manufacturerOrderConfirmations' not found in schema

```
.from(manufacturerOrderConfirmations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8326:** Table 'manufacturerOrderConfirmations' not found in schema

```
.from(manufacturerOrderConfirmations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8389:** Table 'manufacturerOrderShipments' not found in schema

```
.from(manufacturerOrderShipments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8399:** Table 'manufacturerOrderShipments' not found in schema

```
.from(manufacturerOrderShipments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8412:** Table 'manufacturerOrderShipments' not found in schema

```
.from(manufacturerOrderShipments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8519:** Table 'manufacturerOrderExceptions' not found in schema

```
.from(manufacturerOrderExceptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8545:** Table 'manufacturerOrderExceptions' not found in schema

```
.from(manufacturerOrderExceptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8555:** Table 'manufacturerOrderExceptions' not found in schema

```
.from(manufacturerOrderExceptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8659:** Table 'manufacturerOrders' not found in schema

```
.from(manufacturerOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8690:** Table 'manufacturerOrderShipments' not found in schema

```
.from(manufacturerOrderShipments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8713:** Table 'manufacturerOrderExceptions' not found in schema

```
.from(manufacturerOrderExceptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8723:** Table 'manufacturerConnections' not found in schema

```
.from(manufacturerConnections)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8767:** Table 'technicianLocations' not found in schema

```
.from(technicianLocations)
```

💡 **Suggestion:** Did you mean 'technician_locations'?

---

❌ **Line 8812:** Table 'technicianLocations' not found in schema

```
.from(technicianLocations)
```

💡 **Suggestion:** Did you mean 'technician_locations'?

---

❌ **Line 8829:** Table 'technicianLocations' not found in schema

```
.from(technicianLocations)
```

💡 **Suggestion:** Did you mean 'technician_locations'?

---

❌ **Line 8851:** Table 'gpsLocationHistory' not found in schema

```
.from(gpsLocationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8885:** Table 'technicianLocations' not found in schema

```
.from(technicianLocations)
```

💡 **Suggestion:** Did you mean 'technician_locations'?

---

❌ **Line 8924:** Table 'gpsLocationHistory' not found in schema

```
.from(gpsLocationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8936:** Table 'gpsLocationHistory' not found in schema

```
.from(gpsLocationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 8998:** Table 'routeAssignments' not found in schema

```
.from(routeAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9006:** Table 'routeAssignments' not found in schema

```
.from(routeAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9140:** Table 'routeDeviations' not found in schema

```
.from(routeDeviations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9148:** Table 'routeDeviations' not found in schema

```
.from(routeDeviations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9218:** Table 'routeDeviations' not found in schema

```
.from(routeDeviations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9255:** Table 'etaCalculations' not found in schema

```
.from(etaCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9263:** Table 'etaCalculations' not found in schema

```
.from(etaCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9297:** Table 'etaCalculations' not found in schema

```
.from(etaCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9360:** Table 'etaCalculations' not found in schema

```
.from(etaCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9409:** Table 'geofences' not found in schema

```
.from(geofences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9417:** Table 'geofences' not found in schema

```
.from(geofences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9453:** Table 'geofences' not found in schema

```
.from(geofences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9502:** Table 'geofenceEvents' not found in schema

```
.from(geofenceEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9537:** Table 'geofenceEvents' not found in schema

```
.from(geofenceEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9545:** Table 'geofenceEvents' not found in schema

```
.from(geofenceEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9553:** Table 'geofenceEvents' not found in schema

```
.from(geofenceEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9633:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9639:** Table 'billingRules' not found in schema

```
const [rule] = await db.select().from(billingRules).where(eq(billingRules.id, ruleId)).limit(1);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9698:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9753:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9769:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9805:** Table 'meterAnomalies' not found in schema

```
.from(meterAnomalies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9813:** Table 'meterAnomalies' not found in schema

```
.from(meterAnomalies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9892:** Table 'meterAnomalies' not found in schema

```
.from(meterAnomalies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9904:** Table 'meterAnomalies' not found in schema

```
.from(meterAnomalies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9942:** Table 'billingDisputes' not found in schema

```
.from(billingDisputes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9950:** Table 'billingDisputes' not found in schema

```
.from(billingDisputes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10072:** Table 'billingDisputes' not found in schema

```
.from(billingDisputes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10080:** Table 'billingDisputes' not found in schema

```
.from(billingDisputes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10090:** Table 'billingDisputes' not found in schema

```
.from(billingDisputes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10122:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10130:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10159:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10179:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10196:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10246:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10254:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10287:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10295:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10350:** Table 'creditMemos' not found in schema

```
.from(creditMemos)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10358:** Table 'creditMemos' not found in schema

```
.from(creditMemos)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10460:** Table 'creditMemos' not found in schema

```
.from(creditMemos)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10468:** Table 'creditMemos' not found in schema

```
.from(creditMemos)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10500:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10508:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10520:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10553:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10566:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10583:** Table 'customerHealthScores' not found in schema

```
.from(customerHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10618:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10626:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10638:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10668:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10681:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10691:** Table 'churnPredictions' not found in schema

```
.from(churnPredictions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10729:** Table 'successInterventions' not found in schema

```
.from(successInterventions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10737:** Table 'successInterventions' not found in schema

```
.from(successInterventions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10749:** Table 'successInterventions' not found in schema

```
.from(successInterventions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10832:** Table 'successInterventions' not found in schema

```
.from(successInterventions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10846:** Table 'successInterventions' not found in schema

```
.from(successInterventions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10901:** Table 'customerJourneys' not found in schema

```
.from(customerJourneys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10909:** Table 'customerJourneys' not found in schema

```
.from(customerJourneys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10921:** Table 'customerJourneys' not found in schema

```
.from(customerJourneys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10972:** Table 'customerJourneys' not found in schema

```
.from(customerJourneys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11026:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11034:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11043:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11059:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11141:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11154:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11167:** Table 'assignmentGroups' not found in schema

```
return await db.query.assignmentGroups.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11174:** Table 'assignmentGroups' not found in schema

```
return await db.query.assignmentGroups.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11200:** Table 'assignmentGroups' not found in schema

```
const group = await db.query.assignmentGroups.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11215:** Table 'assignmentGroups' not found in schema

```
const userGroups = await db.query.assignmentGroups.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11233:** Table 'workflowApprovals' not found in schema

```
const approvals = await db.query.workflowApprovals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11246:** Table 'workflowApprovals' not found in schema

```
return await db.query.workflowApprovals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 11252:** Table 'workflowApprovals' not found in schema

```
return await db.query.workflowApprovals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-workflow-events.ts`

❌ **Line 513:** Table 'workflowEventRegistry' not found in schema

```
const existing = await db.query.workflowEventRegistry.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-workflow-automation.ts`

❌ **Line 261:** Table 'CRM' not found in schema

```
name: 'Update CRM Status',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 448:** Table 'CRM' not found in schema

```
name: 'Update CRM',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 464:** Table 'template...' not found in schema

```
console.log('📋 Creating sample workflow from template...');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 484:** Table 'Customer' not found in schema

```
changelog: 'Initial version cloned from Customer Onboarding template',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-toner-workflow.ts`

❌ **Line 225:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 274:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

### `server\seed-subscription-plans.ts`

❌ **Line 23:** Table 'multiple' not found in schema

```
description: 'Capture and manage leads from multiple sources',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 417:** Table 'mobile' not found in schema

```
description: 'Capture and attach photos from mobile devices',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-subscription-addons.ts`

❌ **Line 46:** Table 'your' not found in schema

```
'Expert data migration from your existing systems to Printyx, including data cleansing and validation',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 58:** Table 'legacy' not found in schema

```
'Data extraction from legacy systems',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-signature-data.ts`

❌ **Line 24:** Table 'businessRecords' not found in schema

```
const customers = await db.query.businessRecords.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\seed-sales-workflow-automation.ts`

❌ **Line 311:** Table 'Account' not found in schema

```
taskName: 'Update Account Profile',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 329:** Table 'Billing' not found in schema

```
taskName: 'Update Billing Terms',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 483:** Table 'both' not found in schema

```
description: 'Schedule QBR with executive sponsors from both sides',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 686:** Table 'CRM' not found in schema

```
name: 'Update CRM Stage',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\seed-sales-metrics.ts`

❌ **Line 34:** Table 'salesTeams' not found in schema

```
.from(salesTeams)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table '16' not found in schema

```
action: 'Increase daily activities from 16 to 27',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\seed-oid-mappings.ts`

❌ **Line 212:** Table 'oidMappings' not found in schema

```
.from(oidMappings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-mfa-data.ts`

❌ **Line 109:** Table 'mfaBackupCodes' not found in schema

```
.from(mfaBackupCodes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-lease-data.ts`

❌ **Line 19:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\seed-knowledge-base.ts`

❌ **Line 138:** Table 'CRM' not found in schema

```
'Printyx is a comprehensive SaaS platform designed specifically for copier dealers to manage their entire business operations. From CRM and service dispatch to meter billing and inventory management, Printyx provides all the tools you need in one unified system.',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 226:** Table 'various' not found in schema

```
'Leads can be created manually or imported from various sources. To create a lead manually, navigate to CRM > Leads and click "Add Lead".',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 285:** Table 'Settings' not found in schema

```
'Download the Printyx monitoring client from Settings > Fleet Monitoring',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 348:** Table 'the' not found in schema

```
'The system will suggest technicians based on availability, location, and skill set. You can also manually assign a technician from the dropdown.',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 359:** Table 'the' not found in schema

```
'Technicians receive notifications on their mobile devices and can view service call details, update status, and upload photos from the field.',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 442:** Table 'various' not found in schema

```
'When you search, the AI analyzes multiple articles and generates a comprehensive answer that synthesizes information from various sources, with citations to the source articles.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 492:** Table 'Record' not found in schema

```
'Update Record - Modify customer or equipment records',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-field-service-data.ts`

❌ **Line 32:** Table 'businessRecords' not found in schema

```
const customers = await db.query.businessRecords.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 52:** Table 'serviceTickets' not found in schema

```
const serviceTickets = await db.query.serviceTickets.findMany({
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 436:** Table 'John' not found in schema

```
notes: 'Signature obtained from John Smith, Office Manager',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-dashboard-widgets.ts`

❌ **Line 558:** Table 'dashboardWidgets' not found in schema

```
const existingCount = await db.query.dashboardWidgets?.findMany?.();
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seed-customer-success.ts`

❌ **Line 19:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\seed-advanced-billing.ts`

❌ **Line 215:** Table 'previous' not found in schema

```
'CRITICAL: Meter reading decreased from previous reading. Current: 2,500 (was 95,000). Possible meter replacement or equipment swap.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 284:** Table 'expected' not found in schema

```
'Slight deviation from expected usage pattern. May indicate seasonal variation.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\security-compliance.ts`

❌ **Line 314:** Table 'businessRecords' not found in schema

```
businessRecords: await db.query.businessRecords.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 318:** Table 'serviceTickets' not found in schema

```
serviceTickets: await db.query.serviceTickets.findMany({
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 322:** Table 'auditLogs' not found in schema

```
auditLogs: await db.query.auditLogs.findMany({
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 401:** Table 'securitySessions' not found in schema

```
const session = await db.query.securitySessions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\run-ai-migration.ts`

❌ **Line 67:** Table 'sidebar' not found in schema

```
console.log('2. Update sidebar navigation to include new features');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes.ts`

❌ **Line 1002:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 1029:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 1063:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 1088:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 1126:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 1206:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 2368:** Table 'lead' not found in schema

```
'Standardized process for onboarding new customers from lead to active account',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2489:** Table 'unusual' not found in schema

```
'Multiple failed login attempts detected from unusual geographic locations',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2512:** Table 'configuration' not found in schema

```
remediation: 'Renew SSL certificate and update configuration',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3341:** Table 'unusual' not found in schema

```
description: 'Multiple failed login attempts from unusual location',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 3614:** Table 'creation' not found in schema

```
description: 'Automated end-to-end order processing from creation to payment',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4005:** Table 'lead' not found in schema

```
res.status(500).json({ message: 'Failed to update lead' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4235:** Table 'product' not found in schema

```
res.status(500).json({ message: 'Failed to update product model' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4472:** Table 'product' not found in schema

```
res.status(500).json({ message: 'Failed to update product accessory' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4630:** Table 'professional' not found in schema

```
res.status(500).json({ message: 'Failed to update professional service' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4733:** Table 'software' not found in schema

```
res.status(500).json({ message: 'Failed to update software product' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4825:** Table 'supply' not found in schema

```
res.status(500).json({ message: 'Failed to update supply' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4941:** Table 'inventory' not found in schema

```
res.status(500).json({ message: 'Failed to update inventory item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 4977:** Table 'managed' not found in schema

```
res.status(500).json({ message: 'Failed to update managed service' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5051:** Table 'vendor' not found in schema

```
res.status(500).json({ message: 'Failed to update vendor' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5188:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 5202:** Table 'vendors' not found in schema

```
.from(vendors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 5277:** Table 'low' not found in schema

```
`Auto-generated from low stock for ${group.vendorName || group.vendorId}`,
```

💡 **Suggestion:** Similar tables: flow_state, cash_flow_projections, workflow_executions

---

❌ **Line 5518:** Table 'contractTieredRates' not found in schema

```
.from(contractTieredRates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6005:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 6317:** Table 'workflow' not found in schema

```
res.status(500).json({ message: 'Failed to update workflow rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6516:** Table 'deal' not found in schema

```
res.status(500).json({ message: 'Failed to update deal stage' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 6800:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 6830:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 6911:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 7066:** Table 'seoSettings' not found in schema

```
const [existing] = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7098:** Table 'seoPages' not found in schema

```
.from(seoPages)
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 7123:** Table 'seoSettings' not found in schema

```
const settingsRows = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7133:** Table 'seoPages' not found in schema

```
.from(seoPages);
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 7167:** Table 'seoSettings' not found in schema

```
const settingsRows = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7212:** Table 'seoPages' not found in schema

```
const [page] = await db.select().from(seoPages).where(eq(seoPages.path, path)).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 7213:** Table 'seoSettings' not found in schema

```
const [settings] = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7240:** Table 'seoSettings' not found in schema

```
const settingsRows = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7304:** Table 'seoPages' not found in schema

```
const [page] = await db.select().from(seoPages).where(eq(seoPages.path, path)).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 7305:** Table 'seoSettings' not found in schema

```
const settingsRows = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7339:** Table 'seoSettings' not found in schema

```
const rows = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7352:** Table 'seoPages' not found in schema

```
const rows = await db.select().from(seoPages).orderBy(desc(seoPages.updatedAt));
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 7413:** Table 'seoSettings' not found in schema

```
const [settings] = await db.select().from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 7512:** Table 'seoPages' not found in schema

```
.from(seoPages)
```

💡 **Suggestion:** Did you mean 'seo_pages'?

---

❌ **Line 8176:** Table 'pricing' not found in schema

```
res.status(500).json({ message: 'Failed to bulk update pricing' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 9567:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 10056:** Table 'payment_date' not found in schema

```
`SELECT COALESCE(SUM(net_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'completed' AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10178:** Table 'cc.calculation_period_start' not found in schema

```
`EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10183:** Table 'cc.calculation_period_start' not found in schema

```
`EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10183:** Table 'cc.calculation_period_start' not found in schema

```
`EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 10188:** Table 'cc.calculation_period_start' not found in schema

```
`EXTRACT(QUARTER FROM cc.calculation_period_start) = EXTRACT(QUARTER FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 12351:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 12733:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 12808:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-workflow-automation.ts`

❌ **Line 102:** Table 'CRM' not found in schema

```
name: 'Update CRM Status',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 304:** Table 'Accounting' not found in schema

```
name: 'Update Accounting System',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 369:** Table 'installation' not found in schema

```
description: 'Complete equipment lifecycle automation from installation to replacement',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 584:** Table 'CRM' not found in schema

```
{ type: 'update_crm', name: 'Update CRM Record', category: 'Data', popularity: 78.9 },
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\routes-white-label.ts`

❌ **Line 64:** Table 'white' not found in schema

```
console.error('Failed to update white-label config:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 65:** Table 'configuration' not found in schema

```
res.status(500).json({ error: 'Failed to update configuration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 186:** Table 'email' not found in schema

```
console.error('Failed to update email template:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 187:** Table 'email' not found in schema

```
res.status(500).json({ error: 'Failed to update email template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 324:** Table 'whiteLabelConfig' not found in schema

```
const config = await db.query.whiteLabelConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-warehouse.ts`

❌ **Line 168:** Table 'warehouse' not found in schema

```
res.status(500).json({ error: 'Failed to update warehouse operation' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 197:** Table 'warehouse' not found in schema

```
res.status(500).json({ error: 'Failed to update warehouse operation status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 293:** Table 'serial' not found in schema

```
res.status(500).json({ error: 'Failed to update serial number' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 391:** Table 'delivery' not found in schema

```
res.status(500).json({ error: 'Failed to update delivery schedule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-warehouse-fpy.ts`

❌ **Line 49:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 110:** Table 'warehouse' not found in schema

```
res.status(500).json({ error: 'Failed to update warehouse kitting operation' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 123:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 197:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 315:** Table 'autoInvoiceGeneration' not found in schema

```
.from(autoInvoiceGeneration)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 344:** Table 'autoInvoiceGeneration' not found in schema

```
.from(autoInvoiceGeneration)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-validate.ts`

❌ **Line 100:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 240:** Table 'purchaseOrders' not found in schema

```
.from(purchaseOrders)
```

💡 **Suggestion:** Did you mean 'purchase_orders'?

---

❌ **Line 308:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\routes-user-lifecycle.ts`

❌ **Line 242:** Table 'bulkUserOperations' not found in schema

```
const operation = await db.query.bulkUserOperations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 267:** Table 'onboardingChecklists' not found in schema

```
const checklist = await db.query.onboardingChecklists.findFirst({
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 291:** Table 'onboardingChecklists' not found in schema

```
const checklist = await db.query.onboardingChecklists.findFirst({
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 333:** Table 'checklist' not found in schema

```
console.error('Failed to update checklist item:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 334:** Table 'checklist' not found in schema

```
res.status(500).json({ error: 'Failed to update checklist item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 385:** Table 'offboardingWorkflows' not found in schema

```
const workflow = await db.query.offboardingWorkflows.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 476:** Table 'accessReviews' not found in schema

```
const review = await db.query.accessReviews.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 485:** Table 'accessReviewCertifications' not found in schema

```
const certifications = await db.query.accessReviewCertifications.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 575:** Table 'userImpersonationSessions' not found in schema

```
const sessions = await db.query.userImpersonationSessions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 602:** Table 'userLifecycleEvents' not found in schema

```
const events = await db.query.userLifecycleEvents.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-universal-search.ts`

❌ **Line 62:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 169:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

### `server\routes-today-dashboard.ts`

❌ **Line 56:** Table 'activities' not found in schema

```
(await db.query.activities?.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 71:** Table 'activities' not found in schema

```
(await db.query.activities?.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 84:** Table 'activities' not found in schema

```
(await db.query.activities?.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 98:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 116:** Table 'businessRecords' not found in schema

```
? await db.query.businessRecords?.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 225:** Table 'businessRecords' not found in schema

```
(await db.query.businessRecords?.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 239:** Table 'activities' not found in schema

```
(await db.query.activities?.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-territory-management.ts`

❌ **Line 128:** Table 'territory' not found in schema

```
res.status(500).json({ message: 'Failed to update territory' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 307:** Table 'assignment' not found in schema

```
res.status(500).json({ message: 'Failed to update assignment rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 382:** Table 'rep' not found in schema

```
res.status(500).json({ message: 'Failed to update rep capacity' });
```

💡 **Suggestion:** Similar tables: sales_representatives

---

### `server\routes-tenant-onboarding.ts`

❌ **Line 143:** Table 'tenantOnboardingSessions' not found in schema

```
const session = await db.query.tenantOnboardingSessions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 302:** Table 'integrationSetupLogs' not found in schema

```
const integrations = await db.query.integrationSetupLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 394:** Table 'dataImportValidations' not found in schema

```
const validation = await db.query.dataImportValidations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 469:** Table 'tenantHealthScores' not found in schema

```
const healthScore = await db.query.tenantHealthScores.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 529:** Table 'tenantCloneOperations' not found in schema

```
const operation = await db.query.tenantCloneOperations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 557:** Table 'onboardingAnalytics' not found in schema

```
const analytics = await db.query.onboardingAnalytics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 563:** Table 'tenantOnboardingSessions' not found in schema

```
const sessions = await db.query.tenantOnboardingSessions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 596:** Table 'tenantOnboardingSessions' not found in schema

```
const sessions = await db.query.tenantOnboardingSessions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-templates.ts`

❌ **Line 22:** Table 'projectTemplates' not found in schema

```
.from(projectTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 41:** Table 'projectTemplates' not found in schema

```
.from(projectTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 95:** Table 'template' not found in schema

```
res.status(500).json({ error: 'Failed to update template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 126:** Table 'projectTemplates' not found in schema

```
.from(projectTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 173:** Table 'template' not found in schema

```
message: 'Project created from template successfully',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 177:** Table 'template' not found in schema

```
res.status(500).json({ error: 'Failed to create project from template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 228:** Table 'project' not found in schema

```
console.error('Error creating template from project:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 229:** Table 'project' not found in schema

```
res.status(500).json({ error: 'Failed to create template from project' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-technician-management.ts`

❌ **Line 66:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 77:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 138:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 212:** Table 'technician' not found in schema

```
res.status(500).json({ error: 'Failed to update technician' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 230:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 293:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 340:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\routes-tasks.ts`

❌ **Line 151:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 170:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-subscriptions.ts`

❌ **Line 42:** Table 'subscriptionPlans' not found in schema

```
.from(subscriptionPlans)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 48:** Table 'subscriptionFeatures' not found in schema

```
.from(subscriptionFeatures)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 67:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 83:** Table 'subscriptionFeatures' not found in schema

```
.from(subscriptionFeatures)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 165:** Table 'tenantSubscriptions' not found in schema

```
const existing = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 381:** Table 'subscriptionFeatures' not found in schema

```
.from(subscriptionFeatures)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 452:** Table 'subscriptionNotifications' not found in schema

```
.from(subscriptionNotifications)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 534:** Table 'notification' not found in schema

```
res.status(500).json({ error: 'Failed to update notification' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 552:** Table 'subscriptionEvents' not found in schema

```
.from(subscriptionEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 580:** Table 'discounts' not found in schema

```
const discount = await db.query.discounts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 702:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 786:** Table 'subscriptionAddons' not found in schema

```
const addon = await db.query.subscriptionAddons.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 968:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 980:** Table 'subscriptionPlans' not found in schema

```
const newPlan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-software-products.ts`

❌ **Line 36:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 74:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 130:** Table 'software' not found in schema

```
res.status(500).json({ error: 'Failed to update software product' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 163:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 185:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 204:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 226:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 231:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 236:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 248:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 280:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

### `server\routes-social-media.ts`

❌ **Line 180:** Table 'socialMediaPosts' not found in schema

```
.from(socialMediaPosts)
```

💡 **Suggestion:** Did you mean 'social_media_posts'?

---

❌ **Line 270:** Table 'post' not found in schema

```
res.status(500).json({ message: 'Failed to update post' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 318:** Table 'socialMediaPosts' not found in schema

```
.from(socialMediaPosts)
```

💡 **Suggestion:** Did you mean 'social_media_posts'?

---

❌ **Line 355:** Table 'socialMediaCronJobs' not found in schema

```
.from(socialMediaCronJobs)
```

💡 **Suggestion:** Did you mean 'social_media_cron_jobs'?

---

❌ **Line 416:** Table 'cron' not found in schema

```
res.status(500).json({ message: 'Failed to update cron job' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 459:** Table 'socialMediaCronJobs' not found in schema

```
.from(socialMediaCronJobs)
```

💡 **Suggestion:** Did you mean 'social_media_cron_jobs'?

---

### `server\routes-signup-crm.ts`

❌ **Line 34:** Table 'platformSignups' not found in schema

```
let query = db.select().from(platformSignups);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 43:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 83:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 94:** Table 'trialActivityLog' not found in schema

```
.from(trialActivityLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 102:** Table 'trialCommunications' not found in schema

```
.from(trialCommunications)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 109:** Table 'conversionFunnelEvents' not found in schema

```
.from(conversionFunnelEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 151:** Table 'signup' not found in schema

```
res.status(500).json({ error: 'Failed to update signup' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 170:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 179:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 189:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 196:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 202:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 249:** Table 'conversionFunnelEvents' not found in schema

```
.from(conversionFunnelEvents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 353:** Table 'platformSignups' not found in schema

```
.from(platformSignups)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-settings.ts`

❌ **Line 118:** Table 'profile' not found in schema

```
res.status(500).json({ message: 'Failed to update profile' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 154:** Table 'password' not found in schema

```
res.status(500).json({ message: 'Failed to update password' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'preferences' not found in schema

```
res.status(500).json({ message: 'Failed to update preferences' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 203:** Table 'accessibility' not found in schema

```
res.status(500).json({ message: 'Failed to update accessibility settings' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-service-dispatch.ts`

❌ **Line 78:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 95:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 290:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 363:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 374:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 465:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 615:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 691:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 715:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

### `server\routes-service-analysis.ts`

❌ **Line 38:** Table 'serviceCallAnalysis' not found in schema

```
.from(serviceCallAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 119:** Table 'servicePartsUsed' not found in schema

```
.from(servicePartsUsed)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 160:** Table 'serviceCallAnalysis' not found in schema

```
.from(serviceCallAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 195:** Table 'partsOrders' not found in schema

```
.from(partsOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 231:** Table 'parts' not found in schema

```
res.status(500).json({ error: 'Failed to update parts order' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 267:** Table 'partsOrderItems' not found in schema

```
.from(partsOrderItems)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 290:** Table 'serviceCallAnalysis' not found in schema

```
.from(serviceCallAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 300:** Table 'partsOrders' not found in schema

```
.from(partsOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 331:** Table 'serviceCallAnalysis' not found in schema

```
.from(serviceCallAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-seo.ts`

❌ **Line 60:** Table 'seoSettings' not found in schema

```
.from(seoSettings)
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 81:** Table 'seoSettings' not found in schema

```
.from(seoSettings)
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

❌ **Line 190:** Table 'seoAuditHistory' not found in schema

```
.from(seoAuditHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 213:** Table 'seoAuditHistory' not found in schema

```
.from(seoAuditHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 278:** Table 'seoKeywords' not found in schema

```
.from(seoKeywords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 354:** Table 'seoKeywordHistory' not found in schema

```
.from(seoKeywordHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 379:** Table 'seoKeywords' not found in schema

```
.from(seoKeywords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 468:** Table 'seoCrawlResults' not found in schema

```
.from(seoCrawlResults)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 540:** Table 'seoCoreWebVitals' not found in schema

```
.from(seoCoreWebVitals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 597:** Table 'seoPageScores' not found in schema

```
.from(seoPageScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 666:** Table 'seoImageAnalysis' not found in schema

```
.from(seoImageAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 728:** Table 'seoLinkAnalysis' not found in schema

```
.from(seoLinkAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 964:** Table 'seoContentOptimization' not found in schema

```
.from(seoContentOptimization)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1030:** Table 'seoAlerts' not found in schema

```
.from(seoAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1123:** Table 'seoMonitoringLog' not found in schema

```
.from(seoMonitoringLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1181:** Table 'seoCompetitorAnalysis' not found in schema

```
.from(seoCompetitorAnalysis)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1219:** Table 'seoKeywords' not found in schema

```
.from(seoKeywords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1469:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1492:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1515:** Table 'caseStudies' not found in schema

```
.from(caseStudies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1537:** Table 'landingPages' not found in schema

```
.from(landingPages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1559:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-security-compliance.ts`

❌ **Line 93:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 100:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 143:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 202:** Table 'dataAccessLogs' not found in schema

```
.from(dataAccessLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 209:** Table 'dataAccessLogs' not found in schema

```
.from(dataAccessLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 254:** Table 'gdprRequests' not found in schema

```
.from(gdprRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 261:** Table 'gdprRequests' not found in schema

```
.from(gdprRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 318:** Table 'gdprRequests' not found in schema

```
const request = await db.query.gdprRequests.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 381:** Table 'securitySessions' not found in schema

```
.from(securitySessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 388:** Table 'securitySessions' not found in schema

```
.from(securitySessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 449:** Table 'complianceSettings' not found in schema

```
const settings = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 487:** Table 'complianceSettings' not found in schema

```
const existingSettings = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 503:** Table 'compliance' not found in schema

```
res.status(500).json({ message: 'Failed to update compliance settings' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 527:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 537:** Table 'dataAccessLogs' not found in schema

```
.from(dataAccessLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 549:** Table 'securitySessions' not found in schema

```
.from(securitySessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 560:** Table 'gdprRequests' not found in schema

```
.from(gdprRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'dataAccessLogs' not found in schema

```
.from(dataAccessLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-salesforce-integration.ts`

❌ **Line 343:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 356:** Table 'enhancedContacts' not found in schema

```
.from(enhancedContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 369:** Table 'opportunities' not found in schema

```
.from(opportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 382:** Table 'enhancedProducts' not found in schema

```
.from(enhancedProducts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-sales-pipeline.ts`

❌ **Line 77:** Table 'required' not found in schema

```
ELSE 'Update required'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 208:** Table 'opportunity' not found in schema

```
res.status(500).json({ message: 'Failed to update opportunity stage' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-sales-handoff.ts`

❌ **Line 40:** Table 'salesHandoffChecklists' not found in schema

```
const handoffs = await db.query.salesHandoffChecklists.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 58:** Table 'salesHandoffChecklists' not found in schema

```
const handoff = await db.query.salesHandoffChecklists.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 70:** Table 'handoffTasks' not found in schema

```
const tasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 99:** Table 'handoffTaskTemplates' not found in schema

```
const template = await db.query.handoffTaskTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 135:** Table 'handoffTasks' not found in schema

```
const tasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 159:** Table 'handoff' not found in schema

```
res.status(500).json({ error: 'Failed to update handoff' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 170:** Table 'handoffTasks' not found in schema

```
const tasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 224:** Table 'handoffTaskTemplates' not found in schema

```
const templates = await db.query.handoffTaskTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 277:** Table 'template' not found in schema

```
res.status(500).json({ error: 'Failed to update template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 304:** Table 'handoffTasks' not found in schema

```
const tasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 356:** Table 'handoffTasks' not found in schema

```
const allTasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 375:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 404:** Table 'handoffTasks' not found in schema

```
const allTasks = await db.query.handoffTasks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 451:** Table 'implementationProjects' not found in schema

```
const projects = await db.query.implementationProjects.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 469:** Table 'implementationProjects' not found in schema

```
const project = await db.query.implementationProjects.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 530:** Table 'project' not found in schema

```
res.status(500).json({ error: 'Failed to update project' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 542:** Table 'implementationProjects' not found in schema

```
const project = await db.query.implementationProjects.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-sales-forecasting.ts`

❌ **Line 37:** Table 'salesForecasts' not found in schema

```
.from(salesForecasts)
```

💡 **Suggestion:** Did you mean 'sales_forecasts'?

---

❌ **Line 57:** Table 'forecastPipelineItems' not found in schema

```
.from(forecastPipelineItems)
```

💡 **Suggestion:** Did you mean 'forecast_pipeline_items'?

---

❌ **Line 86:** Table 'salesForecasts' not found in schema

```
.from(salesForecasts)
```

💡 **Suggestion:** Did you mean 'sales_forecasts'?

---

❌ **Line 291:** Table 'forecastMetrics' not found in schema

```
.from(forecastMetrics)
```

💡 **Suggestion:** Did you mean 'forecast_metrics'?

---

❌ **Line 370:** Table 'pipeline' not found in schema

```
res.status(500).json({ message: 'Failed to update pipeline item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 382:** Table 'forecastRules' not found in schema

```
.from(forecastRules)
```

💡 **Suggestion:** Did you mean 'forecast_rules'?

---

❌ **Line 413:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 427:** Table 'forecastMetrics' not found in schema

```
.from(forecastMetrics)
```

💡 **Suggestion:** Did you mean 'forecast_metrics'?

---

### `server\routes-root-admin.ts`

❌ **Line 107:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 181:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 414:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 567:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 576:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 633:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 641:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 647:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 660:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 707:** Table 'rbacAuditLog' not found in schema

```
.from(rbacAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-reports.ts`

❌ **Line 31:** Table 'serviceTickets' not found in schema

```
const tickets = await db.query.serviceTickets.findMany({
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 189:** Table 'serviceTickets' not found in schema

```
const customerTickets = await db.query.serviceTickets.findMany({
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 404:** Table 'serviceTickets' not found in schema

```
const periodTickets = await db.query.serviceTickets.findMany({
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\routes-reporting.ts`

❌ **Line 51:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 126:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 259:** Table 'kpiDefinitions' not found in schema

```
.from(kpiDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 280:** Table 'kpiValues' not found in schema

```
.from(kpiValues)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 334:** Table 'kpiValues' not found in schema

```
.from(kpiValues)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 475:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 606:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 622:** Table 'kpiDefinitions' not found in schema

```
.from(kpiDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 648:** Table 'userReportActivity' not found in schema

```
.from(userReportActivity)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-reporting-definitions.ts`

❌ **Line 545:** Table 'closed' not found in schema

```
description: 'Total revenue from closed won deals in current month',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-reporting-architecture.ts`

❌ **Line 46:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 91:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 126:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 216:** Table 'kpiDefinitions' not found in schema

```
.from(kpiDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 252:** Table 'kpiDefinitions' not found in schema

```
.from(kpiDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'kpiValues' not found in schema

```
.from(kpiValues)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 304:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 345:** Table 'kpiDefinitions' not found in schema

```
.from(kpiDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-renewal-management.ts`

❌ **Line 47:** Table 'contractRenewals' not found in schema

```
const renewals = await db.query.contractRenewals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 65:** Table 'contractRenewals' not found in schema

```
const renewal = await db.query.contractRenewals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 74:** Table 'renewalActivities' not found in schema

```
const activities = await db.query.renewalActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 133:** Table 'renewal' not found in schema

```
res.status(500).json({ error: 'Failed to update renewal' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 211:** Table 'contractRenewals' not found in schema

```
const renewalsNeedingAttention = await db.query.contractRenewals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 237:** Table 'contractRenewals' not found in schema

```
const renewal = await db.query.contractRenewals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 277:** Table 'renewalActivities' not found in schema

```
const activities = await db.query.renewalActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 333:** Table 'renewalPlaybooks' not found in schema

```
const playbooks = await db.query.renewalPlaybooks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 386:** Table 'playbook' not found in schema

```
res.status(500).json({ error: 'Failed to update playbook' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 396:** Table 'contractRenewals' not found in schema

```
const renewal = await db.query.contractRenewals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 405:** Table 'renewalPlaybooks' not found in schema

```
const playbooks = await db.query.renewalPlaybooks.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 473:** Table 'expansionOpportunities' not found in schema

```
const opportunities = await db.query.expansionOpportunities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 531:** Table 'expansion' not found in schema

```
res.status(500).json({ error: 'Failed to update expansion opportunity' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-remote-monitoring.ts`

❌ **Line 22:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 31:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 42:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 246:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 332:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 434:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 451:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 549:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 602:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 713:** Table 'alert' not found in schema

```
res.status(500).json({ message: 'Failed to update alert configuration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-quickbooks-integration.ts`

❌ **Line 193:** Table 'QuickBooks' not found in schema

```
console.log(`Synced ${transformedCustomers.length} customers from QuickBooks`);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 201:** Table 'QuickBooks' not found in schema

```
res.status(500).json({ error: 'Failed to sync customers from QuickBooks' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 256:** Table 'QuickBooks' not found in schema

```
res.status(500).json({ error: 'Failed to sync items from QuickBooks' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-purchase-orders.ts`

❌ **Line 128:** Table 'purchase' not found in schema

```
res.status(500).json({ error: 'Failed to update purchase order' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 186:** Table 'purchase' not found in schema

```
res.status(500).json({ error: 'Failed to update purchase order status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 255:** Table 'purchase' not found in schema

```
res.status(500).json({ error: 'Failed to update purchase order item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 364:** Table 'vendor' not found in schema

```
res.status(500).json({ error: 'Failed to update vendor' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 419:** Table 'purchase' not found in schema

```
res.status(500).json({ error: 'Failed to update purchase order status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-proposals.ts`

❌ **Line 139:** Table 'proposal' not found in schema

```
res.status(500).json({ error: 'Failed to update proposal template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 150:** Table 'equipmentPackages' not found in schema

```
.from(equipmentPackages)
```

💡 **Suggestion:** Did you mean 'equipment_packages'?

---

❌ **Line 301:** Table 'proposalLineItems' not found in schema

```
.from(proposalLineItems)
```

💡 **Suggestion:** Did you mean 'proposal_line_items'?

---

❌ **Line 452:** Table 'proposal' not found in schema

```
res.status(500).json({ error: 'Failed to update proposal' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 533:** Table 'proposalLineItems' not found in schema

```
.from(proposalLineItems)
```

💡 **Suggestion:** Did you mean 'proposal_line_items'?

---

❌ **Line 550:** Table 'proposal' not found in schema

```
res.status(500).json({ error: 'Failed to update proposal' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 619:** Table 'proposal' not found in schema

```
res.status(500).json({ error: 'Failed to update proposal status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 635:** Table 'proposalLineItems' not found in schema

```
.from(proposalLineItems)
```

💡 **Suggestion:** Did you mean 'proposal_line_items'?

---

❌ **Line 690:** Table 'line' not found in schema

```
res.status(500).json({ error: 'Failed to update line item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 811:** Table 'proposalLineItems' not found in schema

```
.from(proposalLineItems)
```

💡 **Suggestion:** Did you mean 'proposal_line_items'?

---

❌ **Line 845:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 854:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 864:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 880:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 899:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 1005:** Table 'proposal' not found in schema

```
notes: `Auto-created from proposal ${proposal.proposalNumber}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1012:** Table 'proposal' not found in schema

```
console.error('[CONTRACTS] Failed to create contract from proposal:', e);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1036:** Table 'proposalLineItems' not found in schema

```
.from(proposalLineItems)
```

💡 **Suggestion:** Did you mean 'proposal_line_items'?

---

❌ **Line 1052:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 1069:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 1108:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 1113:** Table 'serviceProducts' not found in schema

```
.from(serviceProducts)
```

💡 **Suggestion:** Did you mean 'service_products'?

---

❌ **Line 1118:** Table 'softwareProducts' not found in schema

```
.from(softwareProducts)
```

💡 **Suggestion:** Did you mean 'software_products'?

---

❌ **Line 1125:** Table 'professionalServices' not found in schema

```
.from(professionalServices)
```

💡 **Suggestion:** Did you mean 'professional_services'?

---

❌ **Line 1130:** Table 'productAccessories' not found in schema

```
.from(productAccessories)
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

### `server\routes-product-pricing.ts`

❌ **Line 128:** Table 'pricing' not found in schema

```
res.status(500).json({ error: 'Failed to update pricing settings' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 225:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 297:** Table 'product' not found in schema

```
res.status(500).json({ error: 'Failed to update product pricing' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 338:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 373:** Table 'dealer' not found in schema

```
res.status(500).json({ error: 'Failed to bulk update dealer costs' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 412:** Table 'enhancedQuotePricing' not found in schema

```
.from(enhancedQuotePricing)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 442:** Table 'enhancedQuotePricingLineItems' not found in schema

```
.from(enhancedQuotePricingLineItems)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 530:** Table 'enhancedQuotePricing' not found in schema

```
.from(enhancedQuotePricing)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 682:** Table 'approval' not found in schema

```
res.status(500).json({ error: 'Failed to update approval status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 716:** Table 'priceChangeApprovals' not found in schema

```
.from(priceChangeApprovals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-product-models.ts`

❌ **Line 54:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 97:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 163:** Table 'product' not found in schema

```
res.status(500).json({ error: 'Failed to update product model' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 206:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 230:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 257:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 285:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 290:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 295:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 307:** Table 'productModels' not found in schema

```
.from(productModels)
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 364:** Table 'stock' not found in schema

```
res.status(500).json({ error: 'Failed to bulk update stock' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-print-cost-calculator.ts`

❌ **Line 149:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 212:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 223:** Table 'calculatorLeads' not found in schema

```
.from(calculatorLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 336:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 386:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 418:** Table 'industryBenchmarks' not found in schema

```
.from(industryBenchmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 444:** Table 'calculatorLeads' not found in schema

```
let query = db.select().from(calculatorLeads);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 476:** Table 'calculatorLeads' not found in schema

```
.from(calculatorLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 487:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 494:** Table 'emailSequenceTracking' not found in schema

```
.from(emailSequenceTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 546:** Table 'lead' not found in schema

```
res.status(500).json({ message: 'Failed to update lead' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 558:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 561:** Table 'calculatorLeads' not found in schema

```
const totalLeads = await db.select({ count: sql<number>`count(*)` }).from(calculatorLeads);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 566:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 572:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 578:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 587:** Table 'calculatorSessions' not found in schema

```
.from(calculatorSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 596:** Table 'calculatorLeads' not found in schema

```
.from(calculatorLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-pricing.ts`

❌ **Line 46:** Table 'company' not found in schema

```
res.status(500).json({ message: 'Failed to update company pricing settings' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 111:** Table 'product' not found in schema

```
res.status(500).json({ message: 'Failed to update product pricing' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 198:** Table 'quote' not found in schema

```
res.status(500).json({ message: 'Failed to update quote pricing' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'quote' not found in schema

```
res.status(500).json({ message: 'Failed to update quote line item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-preventive-maintenance.ts`

❌ **Line 382:** Table 'firmware' not found in schema

```
{ item: 'Update firmware if available', required: false, estimatedTime: 15 },
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 447:** Table 'software' not found in schema

```
{ item: 'Update software and firmware', required: true, estimatedTime: 20 },
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'maintenance' not found in schema

```
res.status(500).json({ message: 'Failed to update maintenance schedule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-predictive-service-dispatch.ts`

❌ **Line 113:** Table 'serviceCallsEnhanced' not found in schema

```
.from(serviceCallsEnhanced)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 132:** Table 'equipmentMetrics' not found in schema

```
.from(equipmentMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 143:** Table 'equipmentMetrics' not found in schema

```
.from(equipmentMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 157:** Table 'serviceCallsEnhanced' not found in schema

```
.from(serviceCallsEnhanced)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'serviceCallsEnhanced' not found in schema

```
.from(serviceCallsEnhanced)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 262:** Table 'serviceCallsEnhanced' not found in schema

```
.from(serviceCallsEnhanced)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 284:** Table 'equipmentMetrics' not found in schema

```
const latestMetric = await db.query.equipmentMetrics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 345:** Table 'equipmentMetrics' not found in schema

```
const metrics = await db.query.equipmentMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 363:** Table 'serviceCallsEnhanced' not found in schema

```
const scheduledMaintenance = await db.query.serviceCallsEnhanced.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 410:** Table 'technicianResourcesEnhanced' not found in schema

```
const technicians = await db.query.technicianResourcesEnhanced.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 464:** Table 'equipmentMetrics' not found in schema

```
.from(equipmentMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-predictive-maintenance-hub.ts`

❌ **Line 120:** Table 'clientCollectedMetrics' not found in schema

```
const recentMetrics = await db.query.clientCollectedMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 523:** Table 'clientCollectedMetrics' not found in schema

```
const metrics = await db.query.clientCollectedMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-predictive-analytics.ts`

❌ **Line 85:** Table 'supplier' not found in schema

```
recommendation: 'Pre-order 28 Canon imageRUNNER units from supplier',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-platform-deals.ts`

❌ **Line 115:** Table 'platformDeals' not found in schema

```
const deals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 128:** Table 'platformDeals' not found in schema

```
.from(platformDeals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 177:** Table 'platformDeals' not found in schema

```
.from(platformDeals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'platformDeals' not found in schema

```
const allDeals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 269:** Table 'platformDeals' not found in schema

```
.from(platformDeals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 280:** Table 'platformDeals' not found in schema

```
const closedDeals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 331:** Table 'platformDeals' not found in schema

```
const deal = await db.query.platformDeals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 341:** Table 'platformBusinessRecords' not found in schema

```
? await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 347:** Table 'platformActivities' not found in schema

```
const activities = await db.query.platformActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 439:** Table 'platformDeals' not found in schema

```
const currentDeal = await db.query.platformDeals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 489:** Table 'deal' not found in schema

```
error: 'Failed to update deal',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 509:** Table 'platformDeals' not found in schema

```
const currentDeal = await db.query.platformDeals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-platform-customer-success.ts`

❌ **Line 86:** Table 'platformHealthScores' not found in schema

```
const healthScores = await db.query.platformHealthScores.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 97:** Table 'platformBusinessRecords' not found in schema

```
? await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 111:** Table 'platformHealthScores' not found in schema

```
.from(platformHealthScores)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 144:** Table 'platformHealthScores' not found in schema

```
const healthScore = await db.query.platformHealthScores.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'platformBusinessRecords' not found in schema

```
const businessRecord = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 234:** Table 'platformHealthScores' not found in schema

```
const previousHealthScore = await db.query.platformHealthScores.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 378:** Table 'platformChurnPredictions' not found in schema

```
const predictions = await db.query.platformChurnPredictions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 389:** Table 'platformBusinessRecords' not found in schema

```
? await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 429:** Table 'platformBusinessRecords' not found in schema

```
const businessRecord = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 437:** Table 'platformHealthScores' not found in schema

```
const healthScore = await db.query.platformHealthScores.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 571:** Table 'platformSuccessInterventions' not found in schema

```
const interventions = await db.query.platformSuccessInterventions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 658:** Table 'intervention' not found in schema

```
error: 'Failed to update intervention',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-platform-business-records.ts`

❌ **Line 174:** Table 'platformBusinessRecords' not found in schema

```
const latestRecord = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 222:** Table 'platformBusinessRecords' not found in schema

```
const records = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 232:** Table 'platformBusinessRecords' not found in schema

```
.from(platformBusinessRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 274:** Table 'platformBusinessRecords' not found in schema

```
.from(platformBusinessRecords);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 288:** Table 'platformBusinessRecords' not found in schema

```
.from(platformBusinessRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 299:** Table 'platformBusinessRecords' not found in schema

```
.from(platformBusinessRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 310:** Table 'platformBusinessRecords' not found in schema

```
.from(platformBusinessRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 348:** Table 'platformBusinessRecords' not found in schema

```
const record = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 363:** Table 'platformContacts' not found in schema

```
response.contacts = await db.query.platformContacts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 371:** Table 'platformDeals' not found in schema

```
response.deals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 379:** Table 'platformActivities' not found in schema

```
response.activities = await db.query.platformActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 388:** Table 'platformLeadScoreCalculations' not found in schema

```
response.leadScore = await db.query.platformLeadScoreCalculations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 395:** Table 'platformHealthScores' not found in schema

```
response.healthScore = await db.query.platformHealthScores.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 402:** Table 'platformChurnPredictions' not found in schema

```
response.churnPrediction = await db.query.platformChurnPredictions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 427:** Table 'platformActivities' not found in schema

```
const activities = await db.query.platformActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 437:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 515:** Table 'platformBusinessRecords' not found in schema

```
const currentRecord = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 563:** Table 'business' not found in schema

```
error: 'Failed to update business record',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 583:** Table 'platformBusinessRecords' not found in schema

```
const record = await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 666:** Table 'records' not found in schema

```
error: 'Failed to bulk update records',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 723:** Table 'platformBusinessRecords' not found in schema

```
const records = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-platform-analytics.ts`

❌ **Line 62:** Table 'platformCohortAnalysis' not found in schema

```
const cohorts = await db.query.platformCohortAnalysis.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 125:** Table 'platformBusinessRecords' not found in schema

```
const cohortCustomers = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 214:** Table 'platformBusinessRecords' not found in schema

```
const activeTenants = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 232:** Table 'platformBusinessRecords' not found in schema

```
const churnedTenants = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 273:** Table 'platformBusinessRecords' not found in schema

```
const newCustomers = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 328:** Table 'platformBusinessRecords' not found in schema

```
const allRecords = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 360:** Table 'platformDeals' not found in schema

```
const deals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 466:** Table 'platformActivityReports' not found in schema

```
const reports = await db.query.platformActivityReports.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 559:** Table 'platformDeals' not found in schema

```
const openDeals = await db.query.platformDeals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 646:** Table 'platformChurnPredictions' not found in schema

```
const predictions = await db.query.platformChurnPredictions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 674:** Table 'platformBusinessRecords' not found in schema

```
const churnedTenants = await db.query.platformBusinessRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 728:** Table 'platformActivities' not found in schema

```
const activities = await db.query.platformActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 822:** Table 'platformSalesGoals' not found in schema

```
const goals = await db.query.platformSalesGoals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 906:** Table 'platformHealthScores' not found in schema

```
const healthScores = await db.query.platformHealthScores.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-platform-activities.ts`

❌ **Line 101:** Table 'platformActivities' not found in schema

```
const activities = await db.query.platformActivities.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 111:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 171:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 193:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 202:** Table 'platformActivities' not found in schema

```
.from(platformActivities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 232:** Table 'platformActivities' not found in schema

```
const activity = await db.query.platformActivities.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 242:** Table 'platformBusinessRecords' not found in schema

```
? await db.query.platformBusinessRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 249:** Table 'platformDeals' not found in schema

```
? await db.query.platformDeals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 619:** Table 'activity' not found in schema

```
error: 'Failed to update activity',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-pipeline-configuration.ts`

❌ **Line 59:** Table 'pipelineTemplates' not found in schema

```
.from(pipelineTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 86:** Table 'pipelineTemplates' not found in schema

```
.from(pipelineTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 97:** Table 'pipelineStages' not found in schema

```
.from(pipelineStages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'pipelineTemplates' not found in schema

```
.from(pipelineTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 257:** Table 'pipeline' not found in schema

```
res.status(500).json({ message: 'Failed to update pipeline template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 322:** Table 'pipelineTemplates' not found in schema

```
.from(pipelineTemplates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 346:** Table 'pipelineStages' not found in schema

```
.from(pipelineStages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 403:** Table 'pipelineStages' not found in schema

```
.from(pipelineStages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 472:** Table 'pipeline' not found in schema

```
res.status(500).json({ message: 'Failed to update pipeline stage' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 586:** Table 'pipelineStages' not found in schema

```
.from(pipelineStages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 593:** Table 'pipelineStages' not found in schema

```
.from(pipelineStages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 685:** Table 'dealStageHistory' not found in schema

```
.from(dealStageHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 726:** Table 'dealStageHistory' not found in schema

```
.from(dealStageHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 765:** Table 'dealStageHistory' not found in schema

```
.from(dealStageHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-pagination.ts`

❌ **Line 87:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 93:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 138:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 143:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 189:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 194:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

### `server\routes-opportunities.ts`

❌ **Line 55:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 102:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 157:** Table 'opportunity' not found in schema

```
res.status(500).json({ error: 'Failed to update opportunity' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 171:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 181:** Table 'opportunity' not found in schema

```
description: `Converted from opportunity: ${opportunity.contactName}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 231:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 241:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 248:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 282:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-onboarding.ts`

❌ **Line 428:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 506:** Table 'quoteLineItems' not found in schema

```
.from(quoteLineItems)
```

💡 **Suggestion:** Did you mean 'quote_line_items'?

---

❌ **Line 531:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-oid-mappings.ts`

❌ **Line 139:** Table 'OID' not found in schema

```
res.status(500).json({ error: 'Failed to update OID mapping' });
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\routes-modular-dashboard.ts`

❌ **Line 143:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 163:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 202:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 226:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 246:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 251:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 295:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 317:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\routes-modular-dashboard-broken.ts`

❌ **Line 116:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 127:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 155:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 166:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 177:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 212:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 223:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 254:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 273:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 296:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

### `server\routes-mobile.ts`

❌ **Line 336:** Table 'firmware' not found in schema

```
'Update firmware',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 489:** Table 'job' not found in schema

```
res.status(500).json({ message: 'Failed to update job status' });
```

💡 **Suggestion:** Similar tables: social_media_cron_jobs

---

### `server\routes-mobile-technician.ts`

❌ **Line 47:** Table 'phoneInTickets' not found in schema

```
const tickets = await db.query.phoneInTickets.findMany({
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 70:** Table 'businessRecords' not found in schema

```
const customers = await db.query.businessRecords.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 117:** Table 'phoneInTickets' not found in schema

```
const tickets = await db.query.phoneInTickets.findMany({
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 144:** Table 'phoneInTickets' not found in schema

```
const ticket = await db.query.phoneInTickets.findFirst({
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 157:** Table 'servicePhotos' not found in schema

```
const photos = await db.query.servicePhotos.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 203:** Table 'failed' not found in schema

```
res.status(500).json({ message: 'Update failed' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 389:** Table 'phoneInTickets' not found in schema

```
const ticket = await db.query.phoneInTickets.findFirst({
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 444:** Table 'phoneInTickets' not found in schema

```
const recentTickets = await db.query.phoneInTickets.findMany({
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 548:** Table 'phoneInTickets' not found in schema

```
.from(phoneInTickets)
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

### `server\routes-manufacturer-integration.ts`

❌ **Line 27:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 72:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 117:** Table 'integration' not found in schema

```
res.status(500).json({ message: 'Failed to update integration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 203:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 232:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 282:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 336:** Table 'integrationAuditLogs' not found in schema

```
.from(integrationAuditLogs)
```

💡 **Suggestion:** Did you mean 'integration_audit_logs'?

---

❌ **Line 365:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 370:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 380:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 385:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 395:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

### `server\routes-lead-assignment.ts`

❌ **Line 28:** Table 'salesTerritories' not found in schema

```
const territories = await db.query.salesTerritories.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 46:** Table 'salesTerritories' not found in schema

```
const territory = await db.query.salesTerritories.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 102:** Table 'territory' not found in schema

```
res.status(500).json({ error: 'Failed to update territory' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 138:** Table 'leadAssignmentRules' not found in schema

```
const rules = await db.query.leadAssignmentRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 156:** Table 'leadAssignmentRules' not found in schema

```
const rule = await db.query.leadAssignmentRules.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 212:** Table 'assignment' not found in schema

```
res.status(500).json({ error: 'Failed to update assignment rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 246:** Table 'repCapacity' not found in schema

```
const capacity = await db.query.repCapacity.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 269:** Table 'repCapacity' not found in schema

```
const capacities = await db.query.repCapacity.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 295:** Table 'repCapacity' not found in schema

```
const existing = await db.query.repCapacity.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 343:** Table 'rep' not found in schema

```
res.status(500).json({ error: 'Failed to update rep availability' });
```

💡 **Suggestion:** Similar tables: sales_representatives

---

❌ **Line 355:** Table 'leadAssignmentHistory' not found in schema

```
const history = await db.query.leadAssignmentHistory.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 376:** Table 'leadAssignmentHistory' not found in schema

```
const assignments = await db.query.leadAssignmentHistory.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 425:** Table 'leadAssignmentQueue' not found in schema

```
let query = db.query.leadAssignmentQueue.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 431:** Table 'leadAssignmentQueue' not found in schema

```
query = db.query.leadAssignmentQueue.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 512:** Table 'leadAssignmentRules' not found in schema

```
const rules = await db.query.leadAssignmentRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 557:** Table 'salesTerritories' not found in schema

```
const territory = await db.query.salesTerritories.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-knowledge-base.ts`

❌ **Line 82:** Table 'knowledgeCategories' not found in schema

```
.from(knowledgeCategories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 101:** Table 'knowledgeCategories' not found in schema

```
.from(knowledgeCategories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 171:** Table 'category' not found in schema

```
res.status(400).json({ message: 'Failed to update category', error });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 282:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 291:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 337:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 458:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 512:** Table 'article' not found in schema

```
res.status(400).json({ message: 'Failed to update article', error });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 644:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 751:** Table 'articleFeedback' not found in schema

```
.from(articleFeedback)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 781:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 790:** Table 'knowledgeCategories' not found in schema

```
.from(knowledgeCategories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 801:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 815:** Table 'knowledgeSearchQueries' not found in schema

```
.from(knowledgeSearchQueries)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-intelligent-alerts.ts`

❌ **Line 79:** Table 'alertTriageResults' not found in schema

```
const triage = await db.query.alertTriageResults.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 181:** Table 'automatedContainmentLogs' not found in schema

```
let query = db.query.automatedContainmentLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 194:** Table 'automatedContainmentLogs' not found in schema

```
const logs = await db.query.automatedContainmentLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 256:** Table 'incidentCorrelations' not found in schema

```
const correlations = await db.query.incidentCorrelations.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 275:** Table 'incidentCorrelations' not found in schema

```
const correlation = await db.query.incidentCorrelations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 309:** Table 'incidentResolutionPatterns' not found in schema

```
const patterns = await db.query.incidentResolutionPatterns.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 506:** Table 'proactiveThreatDetection' not found in schema

```
const threats = await db.query.proactiveThreatDetection.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 546:** Table 'threat' not found in schema

```
console.error('Failed to update threat:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 547:** Table 'threat' not found in schema

```
res.status(500).json({ error: 'Failed to update threat status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 571:** Table 'alertRoutingRules' not found in schema

```
const rules = await db.query.alertRoutingRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 651:** Table 'routing' not found in schema

```
console.error('Failed to update routing rule:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 652:** Table 'routing' not found in schema

```
res.status(500).json({ error: 'Failed to update routing rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-integrations.ts`

❌ **Line 58:** Table 'integration' not found in schema

```
res.status(500).json({ error: 'Failed to update integration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-integrations-real.ts`

❌ **Line 24:** Table 'platformIntegrations' not found in schema

```
const integrations = await db.query.platformIntegrations.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 95:** Table 'integration' not found in schema

```
res.status(500).json({ error: 'Failed to update integration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 107:** Table 'platformIntegrations' not found in schema

```
const integration = await db.query.platformIntegrations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 157:** Table 'platformIntegrations' not found in schema

```
const integration = await db.query.platformIntegrations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 267:** Table 'integrationSyncLogs' not found in schema

```
const logs = await db.query.integrationSyncLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-incident-response.ts`

❌ **Line 445:** Table 'escalation' not found in schema

```
'Update escalation procedures',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-import.ts`

❌ **Line 849:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-gdpr-core.ts`

❌ **Line 601:** Table 'DPA' not found in schema

```
.json({ message: error instanceof Error ? error.message : 'Failed to update DPA' });
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 995:** Table 'duplicate' not found in schema

```
res.status(500).json({ message: 'Failed to update duplicate detection rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-export.ts`

❌ **Line 18:** Table 'onboardingChecklists' not found in schema

```
.from(onboardingChecklists)
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 27:** Table 'onboardingEquipment' not found in schema

```
.from(onboardingEquipment)
```

💡 **Suggestion:** Did you mean 'onboarding_equipment'?

---

❌ **Line 54:** Table 'onboardingChecklists' not found in schema

```
.from(onboardingChecklists)
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 63:** Table 'onboardingEquipment' not found in schema

```
.from(onboardingEquipment)
```

💡 **Suggestion:** Did you mean 'onboarding_equipment'?

---

❌ **Line 93:** Table 'onboardingChecklists' not found in schema

```
.from(onboardingChecklists)
```

💡 **Suggestion:** Did you mean 'onboarding_checklists'?

---

❌ **Line 102:** Table 'onboardingEquipment' not found in schema

```
.from(onboardingEquipment)
```

💡 **Suggestion:** Did you mean 'onboarding_equipment'?

---

### `server\routes-esignature.ts`

❌ **Line 215:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 283:** Table 'signature' not found in schema

```
res.status(500).json({ message: 'Failed to update signature request status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-erp-integration.ts`

❌ **Line 381:** Table 'creation' not found in schema

```
description: 'Automated end-to-end order processing from creation to payment',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 419:** Table 'requisition' not found in schema

```
description: 'Automated procurement process from requisition to payment',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-equipment-lifecycle-state-machine.ts`

❌ **Line 176:** Table 'equipmentLifecycle' not found in schema

```
.from(equipmentLifecycle)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'current' not found in schema

```
: 'Transition not allowed from current stage',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table 'equipmentLifecycle' not found in schema

```
.from(equipmentLifecycle)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-equipment-disposal.ts`

❌ **Line 99:** Table 'equipmentLifecycle' not found in schema

```
.from(equipmentLifecycle)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 183:** Table 'equipmentDisposal' not found in schema

```
let query = db.select().from(equipmentDisposal).where(eq(equipmentDisposal.tenantId, tenantId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 228:** Table 'equipmentDisposal' not found in schema

```
.from(equipmentDisposal)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 315:** Table 'disposal' not found in schema

```
console.error('Update disposal status error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 344:** Table 'equipmentDisposal' not found in schema

```
.from(equipmentDisposal)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-enhanced-tasks.ts`

❌ **Line 267:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-enhanced-service.ts`

❌ **Line 173:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 281:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 347:** Table 'phoneInTickets' not found in schema

```
.from(phoneInTickets)
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 377:** Table 'technicianTicketSessions' not found in schema

```
.from(technicianTicketSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 426:** Table 'technicianTicketSessions' not found in schema

```
.from(technicianTicketSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 482:** Table 'workflowSteps' not found in schema

```
.from(workflowSteps)
```

💡 **Suggestion:** Did you mean 'workflow_steps'?

---

❌ **Line 510:** Table 'technicianTicketSessions' not found in schema

```
.from(technicianTicketSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 527:** Table 'workflow' not found in schema

```
res.status(500).json({ error: 'Failed to update workflow step' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 562:** Table 'ticketPartsRequests' not found in schema

```
.from(ticketPartsRequests)
```

💡 **Suggestion:** Did you mean 'ticket_parts_requests'?

---

❌ **Line 631:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 660:** Table 'workflowSteps' not found in schema

```
.from(workflowSteps)
```

💡 **Suggestion:** Did you mean 'workflow_steps'?

---

❌ **Line 768:** Table 'phoneInTickets' not found in schema

```
.from(phoneInTickets)
```

💡 **Suggestion:** Did you mean 'phone_in_tickets'?

---

❌ **Line 793:** Table 'phone' not found in schema

```
workOrderNotes: `Converted from phone-in ticket ${id}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 830:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 856:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-enhanced-rbac.ts`

❌ **Line 91:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 98:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 584:** Table 'userRoleAssignments' not found in schema

```
.from(userRoleAssignments)
```

💡 **Suggestion:** Did you mean 'user_role_assignments'?

---

### `server\routes-email-parser.ts`

❌ **Line 68:** Table 'emailMonitorConfig' not found in schema

```
const config = await db.query.emailMonitorConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 131:** Table 'emailMonitorConfig' not found in schema

```
const existingConfig = await db.query.emailMonitorConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'processedEmails' not found in schema

```
db.query.processedEmails.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 271:** Table 'processedEmails' not found in schema

```
.from(processedEmails)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 300:** Table 'emailMonitorConfig' not found in schema

```
const config = await db.query.emailMonitorConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 322:** Table 'processedEmails' not found in schema

```
.from(processedEmails)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-dod-enforcement.ts`

❌ **Line 61:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 171:** Table 'purchaseOrders' not found in schema

```
.from(purchaseOrders)
```

💡 **Suggestion:** Did you mean 'purchase_orders'?

---

❌ **Line 235:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-document-management.ts`

❌ **Line 235:** Table 'required' not found in schema

```
description: 'Annual safety procedure review and update required',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-document-automation.ts`

❌ **Line 70:** Table 'documentTemplates' not found in schema

```
const templates = await db.query.documentTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 89:** Table 'documentTemplates' not found in schema

```
const template = await db.query.documentTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 132:** Table 'documentTemplates' not found in schema

```
const template = await db.query.documentTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 162:** Table 'documentTemplates' not found in schema

```
const template = await db.query.documentTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 249:** Table 'generatedDocuments' not found in schema

```
const document = await db.query.generatedDocuments.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 279:** Table 'generatedDocuments' not found in schema

```
const documents = await db.query.generatedDocuments.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 303:** Table 'generatedDocuments' not found in schema

```
const documents = await db.query.generatedDocuments.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 326:** Table 'generatedDocuments' not found in schema

```
const document = await db.query.generatedDocuments.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 404:** Table 'documentUploads' not found in schema

```
const upload = await db.query.documentUploads.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 424:** Table 'documentUploads' not found in schema

```
const uploads = await db.query.documentUploads.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 444:** Table 'documentUploads' not found in schema

```
const upload = await db.query.documentUploads.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 478:** Table 'documentFieldMappings' not found in schema

```
const mappings = await db.query.documentFieldMappings.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-device-monitoring.ts`

❌ **Line 32:** Table 'clientCollectedMetrics' not found in schema

```
const metrics = await db.query.clientCollectedMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 58:** Table 'clientCollectedMetrics' not found in schema

```
const metrics = await db.query.clientCollectedMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 82:** Table 'tonerAlerts' not found in schema

```
const alerts = await db.query.tonerAlerts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 115:** Table 'tonerAlerts' not found in schema

```
const alerts = await db.query.tonerAlerts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 142:** Table 'tonerAlerts' not found in schema

```
const alert = await db.query.tonerAlerts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'tonerAlerts' not found in schema

```
const alert = await db.query.tonerAlerts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 222:** Table 'clientCollectedMetrics' not found in schema

```
.from(clientCollectedMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 230:** Table 'tonerAlerts' not found in schema

```
.from(tonerAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-demo-scheduling.ts`

❌ **Line 22:** Table 'demoSchedules' not found in schema

```
.from(demoSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 97:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 216:** Table 'demo' not found in schema

```
res.status(500).json({ message: 'Failed to update demo status' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 291:** Table 'checklist' not found in schema

```
res.status(500).json({ message: 'Failed to update checklist item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-deals.ts`

❌ **Line 216:** Table 'deal' not found in schema

```
res.status(500).json({ message: 'Failed to update deal' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-deals-management.ts`

❌ **Line 131:** Table 'dealActivities' not found in schema

```
.from(dealActivities)
```

💡 **Suggestion:** Did you mean 'deal_activities'?

---

❌ **Line 208:** Table 'deal' not found in schema

```
res.status(500).json({ error: 'Failed to update deal' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 247:** Table 'dealStages' not found in schema

```
.from(dealStages)
```

💡 **Suggestion:** Did you mean 'deal_stages'?

---

❌ **Line 295:** Table 'dealActivities' not found in schema

```
.from(dealActivities)
```

💡 **Suggestion:** Did you mean 'deal_activities'?

---

### `server\routes-deal-desk.ts`

❌ **Line 54:** Table 'approvalRules' not found in schema

```
.from(approvalRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 117:** Table 'approval' not found in schema

```
res.status(500).json({ error: 'Failed to update approval rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 223:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 284:** Table 'approvalComments' not found in schema

```
.from(approvalComments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 376:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 387:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 402:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 413:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 432:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 490:** Table 'discountAnalytics' not found in schema

```
.from(discountAnalytics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 511:** Table 'approvalDelegations' not found in schema

```
.from(approvalDelegations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-data-enrichment.ts`

❌ **Line 120:** Table 'enrichedContacts' not found in schema

```
let query = db.select().from(enrichedContacts).where(eq(enrichedContacts.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 192:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 201:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 239:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 292:** Table 'enriched' not found in schema

```
res.status(500).json({ message: 'Failed to update enriched contact' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 358:** Table 'enrichedCompanies' not found in schema

```
.from(enrichedCompanies)
```

💡 **Suggestion:** Did you mean 'enriched_companies'?

---

❌ **Line 367:** Table 'enrichedCompanies' not found in schema

```
.from(enrichedCompanies)
```

💡 **Suggestion:** Did you mean 'enriched_companies'?

---

❌ **Line 395:** Table 'enrichedCompanies' not found in schema

```
.from(enrichedCompanies)
```

💡 **Suggestion:** Did you mean 'enriched_companies'?

---

❌ **Line 454:** Table 'enrichedIntentData' not found in schema

```
.from(enrichedIntentData)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 484:** Table 'prospectingCampaigns' not found in schema

```
.from(prospectingCampaigns)
```

💡 **Suggestion:** Did you mean 'prospecting_campaigns'?

---

❌ **Line 572:** Table 'ZoomInfo' not found in schema

```
message: `Successfully imported ${results.length} contacts from ZoomInfo`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 628:** Table 'Apollo.io' not found in schema

```
message: `Successfully imported ${results.length} contacts from Apollo.io`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 653:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 663:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 673:** Table 'enrichedContacts' not found in schema

```
.from(enrichedContacts)
```

💡 **Suggestion:** Did you mean 'enriched_contacts'?

---

❌ **Line 683:** Table 'enrichedCompanies' not found in schema

```
.from(enrichedCompanies)
```

💡 **Suggestion:** Did you mean 'enriched_companies'?

---

### `server\routes-dashboard-layouts.ts`

❌ **Line 59:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 121:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 177:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 297:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 315:** Table 'opportunities' not found in schema

```
.from(opportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 381:** Table 'opportunities' not found in schema

```
.from(opportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 412:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-dashboard-customization.ts`

❌ **Line 44:** Table 'dashboardWidgets' not found in schema

```
const query = db.select().from(dashboardWidgets).where(eq(dashboardWidgets.isActive, true));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 82:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 112:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 192:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 209:** Table 'layout' not found in schema

```
res.status(500).json({ error: 'Failed to update layout' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 248:** Table 'userDashboardPreferences' not found in schema

```
.from(userDashboardPreferences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 322:** Table 'preferences' not found in schema

```
res.status(500).json({ error: 'Failed to update preferences' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 346:** Table 'dashboardLayouts' not found in schema

```
.from(dashboardLayouts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 387:** Table 'dashboardSnapshots' not found in schema

```
.from(dashboardSnapshots)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-customer-success.ts`

❌ **Line 408:** Table 'last' not found in schema

```
message: 'Usage down 38% from last month - investigate cause',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-customer-portal.ts`

❌ **Line 155:** Table 'customerPortalAccess' not found in schema

```
db.select().from(customerPortalAccess).where(eq(customerPortalAccess.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 158:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 162:** Table 'customerMeterSubmissions' not found in schema

```
.from(customerMeterSubmissions)
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 164:** Table 'customerSupplyOrders' not found in schema

```
db.select().from(customerSupplyOrders).where(eq(customerSupplyOrders.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'customer_supply_orders'?

---

❌ **Line 165:** Table 'customerPayments' not found in schema

```
db.select().from(customerPayments).where(eq(customerPayments.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'customer_payments'?

---

❌ **Line 166:** Table 'customerNotifications' not found in schema

```
db.select().from(customerNotifications).where(eq(customerNotifications.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'customer_notifications'?

---

❌ **Line 205:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 232:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 260:** Table 'customerMeterSubmissions' not found in schema

```
.from(customerMeterSubmissions)
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 283:** Table 'customerPortalAccess' not found in schema

```
db.select().from(customerPortalAccess).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 284:** Table 'customerServiceRequests' not found in schema

```
db.select().from(customerServiceRequests).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 285:** Table 'customerMeterSubmissions' not found in schema

```
db.select().from(customerMeterSubmissions).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 286:** Table 'customerSupplyOrders' not found in schema

```
db.select().from(customerSupplyOrders).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_supply_orders'?

---

❌ **Line 287:** Table 'customerPayments' not found in schema

```
db.select().from(customerPayments).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_payments'?

---

❌ **Line 288:** Table 'customerNotifications' not found in schema

```
db.select().from(customerNotifications).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_notifications'?

---

❌ **Line 289:** Table 'customerPortalActivityLog' not found in schema

```
db.select().from(customerPortalActivityLog).limit(1),
```

💡 **Suggestion:** Did you mean 'customer_portal_activity_log'?

---

❌ **Line 1185:** Table 'customerSatisfactionSurveys' not found in schema

```
.from(customerSatisfactionSurveys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1230:** Table 'customerSatisfactionSurveys' not found in schema

```
.from(customerSatisfactionSurveys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1260:** Table 'customerSatisfactionSurveyQuestions' not found in schema

```
.from(customerSatisfactionSurveyQuestions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1267:** Table 'customerSatisfactionSurveyResponses' not found in schema

```
.from(customerSatisfactionSurveyResponses)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1319:** Table 'customerSatisfactionSurveys' not found in schema

```
.from(customerSatisfactionSurveys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1411:** Table 'customerSatisfactionSurveys' not found in schema

```
.from(customerSatisfactionSurveys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1449:** Table 'customerSatisfactionSurveyQuestions' not found in schema

```
.from(customerSatisfactionSurveyQuestions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1619:** Table 'customerSatisfactionSurveys' not found in schema

```
.from(customerSatisfactionSurveys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-customer-numbers.ts`

❌ **Line 51:** Table 'customerNumberConfig' not found in schema

```
.from(customerNumberConfig)
```

💡 **Suggestion:** Did you mean 'customer_number_config'?

---

❌ **Line 145:** Table 'customerNumberConfig' not found in schema

```
.from(customerNumberConfig)
```

💡 **Suggestion:** Did you mean 'customer_number_config'?

---

❌ **Line 173:** Table 'customerNumberConfig' not found in schema

```
.from(customerNumberConfig)
```

💡 **Suggestion:** Did you mean 'customer_number_config'?

---

❌ **Line 220:** Table 'customerNumberConfig' not found in schema

```
.from(customerNumberConfig)
```

💡 **Suggestion:** Did you mean 'customer_number_config'?

---

❌ **Line 248:** Table 'configuration' not found in schema

```
res.status(500).json({ error: 'Failed to update configuration' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 283:** Table 'customerNumberConfig' not found in schema

```
.from(customerNumberConfig)
```

💡 **Suggestion:** Did you mean 'customer_number_config'?

---

❌ **Line 344:** Table 'customerNumberHistory' not found in schema

```
.from(customerNumberHistory)
```

💡 **Suggestion:** Did you mean 'customer_number_history'?

---

### `server\routes-custom-reports.ts`

❌ **Line 179:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 276:** Table 'table' not found in schema

```
.from(table)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 419:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 473:** Table 'custom' not found in schema

```
res.status(500).json({ message: error.message || 'Failed to update custom report' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 536:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 580:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 675:** Table 'table' not found in schema

```
.from(table)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-csv-import.ts`

❌ **Line 355:** Table 'mappings' not found in schema

```
res.status(500).json({ message: error.message || 'Failed to update mappings' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-cross-module.ts`

❌ **Line 41:** Table 'cross' not found in schema

```
message: 'Service ticket created from cross-module integration',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 44:** Table 'customer' not found in schema

```
console.error('Error triggering service from customer:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-crm-goals.ts`

❌ **Line 77:** Table 'salesGoals' not found in schema

```
.from(salesGoals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 124:** Table 'salesTeams' not found in schema

```
.from(salesTeams)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 171:** Table 'salesTeamMembers' not found in schema

```
.from(salesTeamMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 237:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 286:** Table 'goalProgress' not found in schema

```
.from(goalProgress)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 331:** Table 'leadActivities' not found in schema

```
.from(leadActivities)
```

💡 **Suggestion:** Did you mean 'lead_activities'?

---

❌ **Line 358:** Table 'customerActivities' not found in schema

```
.from(customerActivities)
```

💡 **Suggestion:** Did you mean 'customer_activities'?

---

❌ **Line 417:** Table 'salesGoals' not found in schema

```
.from(salesGoals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 423:** Table 'salesTeams' not found in schema

```
.from(salesTeams)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 429:** Table 'salesTeamMembers' not found in schema

```
.from(salesTeamMembers)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 440:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 467:** Table 'salesMetrics' not found in schema

```
.from(salesMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 508:** Table 'conversionFunnel' not found in schema

```
.from(conversionFunnel)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 533:** Table 'managerInsights' not found in schema

```
.from(managerInsights)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 563:** Table 'salesMetrics' not found in schema

```
.from(salesMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 828:** Table 'salesMetrics' not found in schema

```
.from(salesMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-contract-renewal.ts`

❌ **Line 67:** Table 'contractRenewalTracking' not found in schema

```
const contracts = await db.query.contractRenewalTracking.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 212:** Table 'renewalProposals' not found in schema

```
const proposals = await db.query.renewalProposals.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 241:** Table 'renewalProposals' not found in schema

```
const proposal = await db.query.renewalProposals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 304:** Table 'proposal' not found in schema

```
error: 'Failed to update proposal status',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 323:** Table 'contractRenewalTracking' not found in schema

```
const contract = await db.query.contractRenewalTracking.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 389:** Table 'contract' not found in schema

```
error: 'Failed to update contract',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 426:** Table 'rules' not found in schema

```
error: 'Failed to update rules',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-contract-alerts.ts`

❌ **Line 65:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 217:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 299:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 313:** Table 'renewalOpportunities' not found in schema

```
.from(renewalOpportunities)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-content-marketing.ts`

❌ **Line 89:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 98:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 118:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 135:** Table 'contentFaqs' not found in schema

```
.from(contentFaqs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 142:** Table 'contentCitations' not found in schema

```
.from(contentCitations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 161:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 264:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 272:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 292:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 324:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 392:** Table 'caseStudies' not found in schema

```
.from(caseStudies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 410:** Table 'caseStudies' not found in schema

```
.from(caseStudies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 460:** Table 'landingPages' not found in schema

```
.from(landingPages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 615:** Table 'contentAnalytics' not found in schema

```
.from(contentAnalytics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 626:** Table 'contentAnalytics' not found in schema

```
.from(contentAnalytics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 641:** Table 'contentAnalytics' not found in schema

```
.from(contentAnalytics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 678:** Table 'blogPosts' not found in schema

```
.from(blogPosts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 687:** Table 'guides' not found in schema

```
.from(guides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 696:** Table 'caseStudies' not found in schema

```
.from(caseStudies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 705:** Table 'landingPages' not found in schema

```
.from(landingPages)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 802:** Table 'seoSettings' not found in schema

```
const [settings] = await db.select({ llmsTxt: seoSettings.llmsTxt }).from(seoSettings).limit(1);
```

💡 **Suggestion:** Did you mean 'seo_settings'?

---

### `server\routes-contacts.ts`

❌ **Line 121:** Table 'company' not found in schema

```
res.status(500).json({ error: 'Failed to update company contact' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 388:** Table 'contact' not found in schema

```
res.status(500).json({ error: 'Failed to update contact' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 481:** Table 'contact' not found in schema

```
res.status(500).json({ message: 'Failed to update contact' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-company-ids.ts`

❌ **Line 53:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 124:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-companies.ts`

❌ **Line 117:** Table 'company' not found in schema

```
res.status(500).json({ message: 'Failed to update company' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-client-monitoring.ts`

❌ **Line 54:** Table 'monitoringClients' not found in schema

```
.from(monitoringClients)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 176:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 286:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 474:** Table 'monitoringClients' not found in schema

```
.from(monitoringClients)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 532:** Table 'monitoringClients' not found in schema

```
.from(monitoringClients)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 573:** Table 'monitoring' not found in schema

```
res.status(500).json({ message: 'Failed to update monitoring client' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 648:** Table 'clientActivityLogs' not found in schema

```
.from(clientActivityLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 672:** Table 'clientDiscoveredDevices' not found in schema

```
.from(clientDiscoveredDevices)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 714:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 750:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 997:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1004:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1151:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1159:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1228:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1239:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1269:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1276:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1332:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1340:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1397:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1412:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 1598:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 1687:** Table 'oidMappings' not found in schema

```
let query = db.select().from(oidMappings);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1745:** Table 'oidMappings' not found in schema

```
.from(oidMappings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1753:** Table 'oidMappings' not found in schema

```
.from(oidMappings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1819:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 1848:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 1917:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

### `server\routes-client-metrics.ts`

❌ **Line 113:** Table 'tonerAlerts' not found in schema

```
const existingAlert = await db.query.tonerAlerts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 187:** Table 'clientRegistrations' not found in schema

```
const client = await db.query.clientRegistrations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 404:** Table 'monitoredDevices' not found in schema

```
const devices = await db.query.monitoredDevices.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 512:** Table 'clientRegistrations' not found in schema

```
const clients = await db.query.clientRegistrations.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 536:** Table 'clientRegistrations' not found in schema

```
const client = await db.query.clientRegistrations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 548:** Table 'clientActivityLogs' not found in schema

```
const activity = await db.query.clientActivityLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 558:** Table 'monitoredDevices' not found in schema

```
const deviceCount = await db.query.monitoredDevices.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'tonerAlerts' not found in schema

```
const activeAlerts = await db.query.tonerAlerts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 607:** Table 'clientRegistrations' not found in schema

```
const client = await db.query.clientRegistrations.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-clickup-tasks.ts`

❌ **Line 261:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-catalog.ts`

❌ **Line 132:** Table 'master' not found in schema

```
message: 'Platform admin required to update master products',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 157:** Table 'master' not found in schema

```
message: 'Failed to update master product',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 344:** Table 'CSV' not found in schema

```
console.error('Error enabling products from CSV:', error);
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 346:** Table 'CSV' not found in schema

```
message: 'Failed to enable from CSV',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 371:** Table 'masterProductModels' not found in schema

```
const products = await db.select().from(masterProductModels);
```

💡 **Suggestion:** Did you mean 'master_product_models'?

---

### `server\routes-business-records.ts`

❌ **Line 160:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 169:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 205:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 225:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

❌ **Line 326:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 365:** Table 'business' not found in schema

```
res.status(500).json({ message: 'Failed to update business record' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 400:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 516:** Table 'to' not found in schema

```
description: `Bulk status update to "${status}"${notes ? `: ${notes}` : ''}`,
```

💡 **Suggestion:** Similar tables: mfa_factors, one_time_tokens, refresh_tokens

---

❌ **Line 550:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 608:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 617:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 705:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 714:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 745:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 766:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

### `server\routes-business-process-optimization.ts`

❌ **Line 99:** Table 'lead' not found in schema

```
'Standardized process for onboarding new customers from lead to active account',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 200:** Table 'account' not found in schema

```
'Update account status',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 464:** Table 'lead' not found in schema

```
'Comprehensive workflow for onboarding new customers from lead qualification to active service',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 632:** Table 'workflow' not found in schema

```
res.status(500).json({ message: 'Failed to update workflow' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-breach-detection.ts`

❌ **Line 45:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 99:** Table 'purchaseOrders' not found in schema

```
.from(purchaseOrders)
```

💡 **Suggestion:** Did you mean 'purchase_orders'?

---

❌ **Line 124:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 177:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

### `server\routes-automation.ts`

❌ **Line 175:** Table 'automation' not found in schema

```
res.status(500).json({ error: 'Failed to update automation rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 353:** Table 'automated' not found in schema

```
res.status(500).json({ error: 'Failed to update automated task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-auto-supply-replenishment.ts`

❌ **Line 63:** Table 'supplyMonitoring' not found in schema

```
let query = db.query.supplyMonitoring.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 200:** Table 'autoSupplyOrders' not found in schema

```
const order = await db.query.autoSupplyOrders.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 255:** Table 'order' not found in schema

```
error: 'Failed to update order status',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 292:** Table 'rules' not found in schema

```
error: 'Failed to update rules',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 311:** Table 'supplyMonitoring' not found in schema

```
const supply = await db.query.supplyMonitoring.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 380:** Table 'supply' not found in schema

```
error: 'Failed to update supply',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-auto-lead-routing.ts`

❌ **Line 120:** Table 'leadAssignmentHistory' not found in schema

```
.from(leadAssignmentHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 137:** Table 'leadAssignmentHistory' not found in schema

```
.from(leadAssignmentHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 156:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'repCapacity' not found in schema

```
.from(repCapacity)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 188:** Table 'leadAssignmentHistory' not found in schema

```
.from(leadAssignmentHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 294:** Table 'configuration' not found in schema

```
error: 'Failed to update configuration',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 312:** Table 'businessRecords' not found in schema

```
const lead = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes-admin-workflows.ts`

❌ **Line 57:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 74:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 107:** Table 'activityReports' not found in schema

```
.from(activityReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-admin-subscriptions.ts`

❌ **Line 65:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 78:** Table 'tenantSubscriptions' not found in schema

```
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tenantSubscriptions);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 101:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 209:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'discounts' not found in schema

```
.from(discounts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 279:** Table 'discounts' not found in schema

```
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(discounts);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 302:** Table 'discounts' not found in schema

```
const discount = await db.query.discounts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 313:** Table 'discountRedemptions' not found in schema

```
.from(discountRedemptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 384:** Table 'discounts' not found in schema

```
const existing = await db.query.discounts.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 462:** Table 'discount' not found in schema

```
console.error('Failed to update discount:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 463:** Table 'discount' not found in schema

```
res.status(500).json({ error: 'Failed to update discount' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 505:** Table 'subscriptionPlans' not found in schema

```
const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 541:** Table 'plan' not found in schema

```
console.error('Failed to update plan:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 542:** Table 'plan' not found in schema

```
res.status(500).json({ error: 'Failed to update plan' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 562:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 571:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 580:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 594:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 630:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-activities.ts`

❌ **Line 133:** Table 'activity' not found in schema

```
res.status(500).json({ message: 'Failed to update activity' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes-accessibility.ts`

❌ **Line 48:** Table 'userAccessibilityPreferences' not found in schema

```
const preferences = await db.query.userAccessibilityPreferences.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 100:** Table 'userAccessibilityPreferences' not found in schema

```
const existing = await db.query.userAccessibilityPreferences.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 132:** Table 'accessibility' not found in schema

```
return res.status(500).json({ message: 'Failed to update accessibility preferences' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'accessibilityFeedback' not found in schema

```
let query = db.select().from(accessibilityFeedback);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 296:** Table 'feedback' not found in schema

```
return res.status(500).json({ message: 'Failed to update feedback' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 364:** Table 'accessibilityAuditLog' not found in schema

```
.from(accessibilityAuditLog)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\rbac-initializer.ts`

❌ **Line 27:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 102:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 212:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 230:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

### `server\manufacturer-integration-service.ts`

❌ **Line 609:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 678:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

### `server\enhanced-rbac-service.ts`

❌ **Line 180:** Table 'userRoleAssignments' not found in schema

```
.from(userRoleAssignments)
```

💡 **Suggestion:** Did you mean 'user_role_assignments'?

---

❌ **Line 212:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 249:** Table 'permissionOverrides' not found in schema

```
.from(permissionOverrides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 319:** Table 'enhancedRoles' not found in schema

```
const role = await db.select().from(enhancedRoles).where(eq(enhancedRoles.id, roleId)).limit(1);
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 447:** Table 'permissionCache' not found in schema

```
.from(permissionCache)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 518:** Table 'permissions' not found in schema

```
.from(permissions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 532:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles);
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 544:** Table 'enhancedRoles' not found in schema

```
.from(enhancedRoles)
```

💡 **Suggestion:** Did you mean 'enhanced_roles'?

---

❌ **Line 573:** Table 'permissions' not found in schema

```
.from(permissions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\enhanced-rbac-seeder.ts`

❌ **Line 80:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 836:** Table 'permissions' not found in schema

```
.from(permissions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\auth-routes.ts`

❌ **Line 129:** Table 'loginAttempts' not found in schema

```
.from(loginAttempts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 161:** Table 'loginAttempts' not found in schema

```
.from(loginAttempts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 530:** Table 'emailVerifications' not found in schema

```
.from(emailVerifications)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 615:** Table 'emailVerifications' not found in schema

```
.from(emailVerifications)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 733:** Table 'passwordResets' not found in schema

```
.from(passwordResets)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 771:** Table 'passwordResets' not found in schema

```
.from(passwordResets)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\apollo-storage.ts`

❌ **Line 24:** Table 'centralizedApolloContacts' not found in schema

```
.from(centralizedApolloContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 34:** Table 'centralizedApolloContacts' not found in schema

```
.from(centralizedApolloContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 87:** Table 'tenantApolloLeads' not found in schema

```
.from(tenantApolloLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 105:** Table 'tenantApolloLeads' not found in schema

```
.from(tenantApolloLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 117:** Table 'tenantApolloLeads' not found in schema

```
.from(tenantApolloLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 194:** Table 'apolloSearchCache' not found in schema

```
.from(apolloSearchCache)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 266:** Table 'apolloApiUsage' not found in schema

```
.from(apolloApiUsage)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\utils\company-id-generator.ts`

❌ **Line 20:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 91:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 169:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 187:** Table 'record' not found in schema

```
console.error(`Failed to update record ${record.id}:`, error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\utils\apiErrorHandler.example.ts`

❌ **Line 94:** Table 'customer' not found in schema

```
return ApiErrorHandlers.database(res, 'update customer', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\storage\security-storage.ts`

❌ **Line 101:** Table 'complianceSettings' not found in schema

```
const settings = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 152:** Table 'complianceSettings' not found in schema

```
const existing = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 189:** Table 'complianceSettings' not found in schema

```
const settings = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 216:** Table 'complianceSettings' not found in schema

```
const existing = await db.query.complianceSettings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 301:** Table 'securitySessions' not found in schema

```
.from(securitySessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\workflow-execution-service.ts`

❌ **Line 40:** Table 'workflowExecutions' not found in schema

```
const execution = await db.query.workflowExecutions.findFirst({
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

❌ **Line 67:** Table 'workflowStepsAutomation' not found in schema

```
const steps = await db.query.workflowStepsAutomation.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 255:** Table 'assignmentGroups' not found in schema

```
const group = await db.query.assignmentGroups.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 313:** Table 'workflowExecutionSteps' not found in schema

```
const stepExecution = await db.query.workflowExecutionSteps.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 460:** Table 'workflowApprovals' not found in schema

```
const approval = await db.query.workflowApprovals.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\workflow-event-service.ts`

❌ **Line 52:** Table 'workflowTriggers' not found in schema

```
const triggers = await db.query.workflowTriggers.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 91:** Table 'workflowVersions' not found in schema

```
const version = await db.query.workflowVersions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 157:** Table 'workflowConditions' not found in schema

```
const conditions = await db.query.workflowConditions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 331:** Table 'workflowExecutions' not found in schema

```
const queuedExecutions = await db.query.workflowExecutions.findMany({
```

💡 **Suggestion:** Did you mean 'workflow_executions'?

---

### `server\services\white-label-service.ts`

❌ **Line 21:** Table 'whiteLabelConfig' not found in schema

```
const config = await db.query.whiteLabelConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 92:** Table 'whiteLabelEmailTemplates' not found in schema

```
return await db.query.whiteLabelEmailTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 105:** Table 'whiteLabelEmailTemplates' not found in schema

```
const template = await db.query.whiteLabelEmailTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 124:** Table 'whiteLabelEmailTemplates' not found in schema

```
const existing = await db.query.whiteLabelEmailTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 399:** Table 'whiteLabelPresets' not found in schema

```
return await db.query.whiteLabelPresets.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 409:** Table 'whiteLabelPresets' not found in schema

```
const preset = await db.query.whiteLabelPresets.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\warehouse-reporting-service.ts`

❌ **Line 128:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 174:** Table 'uniqueTechnicians' not found in schema

```
Array.from(uniqueTechnicians).map(async (techId) => {
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 205:** Table 'warehouseKittingOperations' not found in schema

```
.from(warehouseKittingOperations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\user-lifecycle-service.ts`

❌ **Line 111:** Table 'userProvisioningTemplates' not found in schema

```
return await db.query.userProvisioningTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 121:** Table 'userProvisioningTemplates' not found in schema

```
return await db.query.userProvisioningTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 134:** Table 'userProvisioningTemplates' not found in schema

```
const template = await db.query.userProvisioningTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 148:** Table 'userProvisioningTemplates' not found in schema

```
const template = await db.query.userProvisioningTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 638:** Table 'offboardingWorkflows' not found in schema

```
const workflow = await db.query.offboardingWorkflows.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 741:** Table 'offboardingWorkflows' not found in schema

```
const workflow = await db.query.offboardingWorkflows.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 809:** Table 'accessReviews' not found in schema

```
return await db.query.accessReviews.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 877:** Table 'userImpersonationSessions' not found in schema

```
const session = await db.query.userImpersonationSessions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\usage-tracking-service.ts`

❌ **Line 39:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 52:** Table 'usageMetrics' not found in schema

```
let usage = await db.query.usageMetrics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 194:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 229:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 246:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 319:** Table 'dailyUsageSnapshots' not found in schema

```
const existing = await db.query.dailyUsageSnapshots.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 355:** Table 'dailyUsageSnapshots' not found in schema

```
.from(dailyUsageSnapshots)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 474:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 486:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\unified-meter-collection-service.ts`

❌ **Line 71:** Table 'integration' not found in schema

```
console.error(`Failed to collect from integration ${integration.id}:`, error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 150:** Table 'device' not found in schema

```
`Successfully collected ${result.metrics.length} metrics from device ${device.serialNumber || device.deviceId}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 166:** Table 'device' not found in schema

```
`Failed to collect metrics from device ${device.serialNumber || device.deviceId}: ${result.error}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 179:** Table 'device' not found in schema

```
console.error(`Failed to collect from device ${device.deviceId}:`, error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 186:** Table 'device' not found in schema

```
`Exception collecting from device ${device.serialNumber || device.deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 393:** Table 'device' not found in schema

```
`Manual collection from device ${device.serialNumber || device.deviceId}: ${result.success ? `${result.metrics.length} metrics collected` : result.error}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\ticket-creation-service.ts`

❌ **Line 83:** Table 'businessRecords' not found in schema

```
let customer = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 96:** Table 'email' not found in schema

```
console.log('[TicketCreation] Creating new customer from email');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 200:** Table 'email' not found in schema

```
description += `\n\n---\n*Created automatically from email on ${new Date().toLocaleString()}*`;
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 282:** Table 'businessRecords' not found in schema

```
const customer = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 398:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

❌ **Line 492:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\services\territory-management-service.ts`

❌ **Line 97:** Table 'salesTerritories' not found in schema

```
(await db.query.salesTerritories.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 140:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 147:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 211:** Table 'salesTerritories' not found in schema

```
const territories = await db.query.salesTerritories.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 393:** Table 'leadAssignmentRules' not found in schema

```
.from(leadAssignmentRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 400:** Table 'leadAssignmentRules' not found in schema

```
.from(leadAssignmentRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 412:** Table 'leadAssignmentRules' not found in schema

```
(await db.query.leadAssignmentRules.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 448:** Table 'repCapacity' not found in schema

```
let capacity = await db.query.repCapacity.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 504:** Table 'repCapacity' not found in schema

```
.from(repCapacity)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 511:** Table 'repCapacity' not found in schema

```
.from(repCapacity)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 540:** Table 'repCapacity' not found in schema

```
const availableReps = await db.query.repCapacity.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'leadAssignmentHistory' not found in schema

```
return await db.query.leadAssignmentHistory.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 595:** Table 'leadAssignmentHistory' not found in schema

```
.from(leadAssignmentHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 602:** Table 'leadAssignmentHistory' not found in schema

```
.from(leadAssignmentHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 632:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 636:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 640:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 645:** Table 'salesTerritories' not found in schema

```
.from(salesTerritories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 649:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 659:** Table 'repCapacity' not found in schema

```
.from(repCapacity)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\tenant-onboarding-service.ts`

❌ **Line 116:** Table 'tenantOnboardingTemplates' not found in schema

```
return await db.query.tenantOnboardingTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 129:** Table 'tenantOnboardingTemplates' not found in schema

```
const template = await db.query.tenantOnboardingTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 155:** Table 'tenantOnboardingTemplates' not found in schema

```
template = await db.query.tenantOnboardingTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 217:** Table 'tenantOnboardingSessions' not found in schema

```
const session = await db.query.tenantOnboardingSessions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 405:** Table 'tenantOnboardingSessions' not found in schema

```
const session = await db.query.tenantOnboardingSessions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 643:** Table 'integrationSetupLogs' not found in schema

```
const log = await db.query.integrationSetupLogs.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1181:** Table 'integrationSetupLogs' not found in schema

```
const integrations = await db.query.integrationSetupLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\team-alert-service.ts`

❌ **Line 53:** Table 'alertConfigurations' not found in schema

```
.from(alertConfigurations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 155:** Table 'alertConfigurations' not found in schema

```
.from(alertConfigurations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 276:** Table 'alertInstances' not found in schema

```
.from(alertInstances)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 588:** Table 'alertInstances' not found in schema

```
.from(alertInstances)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\subscription-service.ts`

❌ **Line 91:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 220:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 235:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 245:** Table 'usageMetrics' not found in schema

```
const usage = await db.query.usageMetrics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 349:** Table 'tenantSubscriptions' not found in schema

```
const currentSubscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 361:** Table 'subscriptionPlans' not found in schema

```
const currentPlan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 366:** Table 'subscriptionPlans' not found in schema

```
const newPlan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 430:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 445:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 526:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 597:** Table 'tenantSubscriptions' not found in schema

```
const subscription = await db.query.tenantSubscriptions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 675:** Table 'subscriptionPlans' not found in schema

```
const plan = await db.query.subscriptionPlans.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 764:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 801:** Table 'tenantSubscriptions' not found in schema

```
.from(tenantSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\sso-service.ts`

❌ **Line 115:** Table 'ssoProviderConfigs' not found in schema

```
.from(ssoProviderConfigs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 128:** Table 'ssoProviderConfigs' not found in schema

```
.from(ssoProviderConfigs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 235:** Table 'authnRequest' not found in schema

```
const encodedRequest = Buffer.from(authnRequest).toString('base64');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 299:** Table 'relayStateData' not found in schema

```
const encodedRelayState = Buffer.from(relayStateData).toString('base64');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 452:** Table 'ssoProviderConfigs' not found in schema

```
.from(ssoProviderConfigs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 594:** Table 'SAML' not found in schema

```
throw new Error('Unable to extract email from SAML response');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 662:** Table 'OIDC' not found in schema

```
throw new Error('Unable to extract email from OIDC response');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 786:** Table 'ssoUserMappings' not found in schema

```
.from(ssoUserMappings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1034:** Table 'ssoProviderConfigs' not found in schema

```
.from(ssoProviderConfigs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1068:** Table 'ssoSessions' not found in schema

```
.from(ssoSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1089:** Table 'ssoProviderConfigs' not found in schema

```
.from(ssoProviderConfigs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1113:** Table 'ssoSessions' not found in schema

```
.from(ssoSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\service-checklist-templates.ts`

❌ **Line 40:** Table 'device' not found in schema

```
helpText: 'Record total page count from device display',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 134:** Table 'maintenance' not found in schema

```
task: 'Update maintenance sticker with date and meter',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 198:** Table 'new' not found in schema

```
task: 'Remove all protective seals/tape from new cartridge',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 260:** Table 'display' not found in schema

```
task: 'Note jam location code from display',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 459:** Table 'network' not found in schema

```
task: 'Test print from network computer',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 561:** Table 'computer' not found in schema

```
task: 'Ping device from computer',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 583:** Table 'firmware' not found in schema

```
task: 'Update firmware if outdated',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 590:** Table 'multiple' not found in schema

```
task: 'Test print from multiple computers',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\seo-service.ts`

❌ **Line 250:** Table 'indexing' not found in schema

```
message: 'Page is blocked from indexing',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\product-pricing-service.ts`

❌ **Line 105:** Table 'enhancedProductPricing' not found in schema

```
const pricing = await db.query.enhancedProductPricing.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 123:** Table 'enhancedProductPricing' not found in schema

```
return db.query.enhancedProductPricing.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 163:** Table 'productModels' not found in schema

```
const product = await db.query.productModels.findFirst({
```

💡 **Suggestion:** Did you mean 'product_models'?

---

❌ **Line 200:** Table 'productAccessories' not found in schema

```
const accessory = await db.query.productAccessories.findFirst({
```

💡 **Suggestion:** Did you mean 'product_accessories'?

---

❌ **Line 447:** Table 'companyPricingSettings' not found in schema

```
const settings = await db.query.companyPricingSettings.findFirst({
```

💡 **Suggestion:** Did you mean 'company_pricing_settings'?

---

❌ **Line 478:** Table 'companyPricingSettings' not found in schema

```
const settings = await db.query.companyPricingSettings.findFirst({
```

💡 **Suggestion:** Did you mean 'company_pricing_settings'?

---

❌ **Line 655:** Table 'pricing' not found in schema

```
`Failed to update pricing for ${update.productId} (${update.productType}/${update.pricingTier}):`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\print-cost-calculator-service.ts`

❌ **Line 604:** Table '3' not found in schema

```
'Request MPS proposals from 3 vendors',
```

💡 **Suggestion:** Similar tables: s3_multipart_uploads, s3_multipart_uploads_parts

---

### `server\services\pricing-service.ts`

❌ **Line 212:** Table 'companyPricingSettings' not found in schema

```
.from(companyPricingSettings)
```

💡 **Suggestion:** Did you mean 'company_pricing_settings'?

---

### `server\services\predictive-service-dispatch-service.ts`

❌ **Line 175:** Table 'clientCollectedMetrics' not found in schema

```
return db.query.clientCollectedMetrics.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 392:** Table 'repCapacity' not found in schema

```
const technicians = await db.query.repCapacity.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\performance-monitor.ts`

❌ **Line 388:** Table 'ai_tasks' not found in schema

```
query: 'SELECT * FROM ai_tasks WHERE tenant_id = ? AND status = ?',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 394:** Table 'calendar_events' not found in schema

```
'SELECT COUNT(*) FROM calendar_events WHERE user_id = ? AND start_time BETWEEN ? AND ?',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\pdf-generation-service.ts`

❌ **Line 654:** Table 'invoiceLineItems' not found in schema

```
.from(invoiceLineItems)
```

💡 **Suggestion:** Did you mean 'invoice_line_items'?

---

### `server\services\payment-audit-service.ts`

❌ **Line 607:** Table 'paymentAuditTrail' not found in schema

```
.from(paymentAuditTrail)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 614:** Table 'paymentAuditTrail' not found in schema

```
.from(paymentAuditTrail)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 656:** Table 'paymentMethodChanges' not found in schema

```
.from(paymentMethodChanges)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 663:** Table 'paymentMethodChanges' not found in schema

```
.from(paymentMethodChanges)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 693:** Table 'paymentAuditTrail' not found in schema

```
.from(paymentAuditTrail)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 776:** Table 'paymentAuditTrail' not found in schema

```
.from(paymentAuditTrail)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 796:** Table 'paymentMethodChanges' not found in schema

```
.from(paymentMethodChanges)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\oauth-token-refresh.ts`

❌ **Line 293:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 327:** Table 'integration' not found in schema

```
console.error('Failed to update integration tokens:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 360:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 418:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 461:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 488:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

### `server\services\mileage-service.ts`

❌ **Line 60:** Table 'mileageReimbursementRates' not found in schema

```
.from(mileageReimbursementRates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 145:** Table 'GPS' not found in schema

```
console.error('Error calculating mileage from GPS:', error);
```

💡 **Suggestion:** Similar tables: gps_tracking_points

---

❌ **Line 180:** Table 'technicianMileage' not found in schema

```
.from(technicianMileage)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 245:** Table 'technicianMileage' not found in schema

```
.from(technicianMileage)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 507:** Table 'irsMileageLogs' not found in schema

```
.from(irsMileageLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\manufacturer-integration-service.ts`

❌ **Line 52:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 71:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 99:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 158:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 204:** Table 'device' not found in schema

```
`Collected ${results.length} metrics from device ${device.serialNumber || device.deviceId}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 217:** Table 'deviceRegistrations' not found in schema

```
.from(deviceRegistrations)
```

💡 **Suggestion:** Did you mean 'device_registrations'?

---

❌ **Line 252:** Table 'deviceMetrics' not found in schema

```
.from(deviceMetrics)
```

💡 **Suggestion:** Did you mean 'device_metrics'?

---

❌ **Line 265:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 350:** Table 'integrationAuditLogs' not found in schema

```
.from(integrationAuditLogs)
```

💡 **Suggestion:** Did you mean 'integration_audit_logs'?

---

❌ **Line 386:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

❌ **Line 418:** Table 'manufacturerIntegrations' not found in schema

```
.from(manufacturerIntegrations)
```

💡 **Suggestion:** Did you mean 'manufacturer_integrations'?

---

### `server\services\lead-intelligence-service.ts`

❌ **Line 92:** Table 'leadScoringRules' not found in schema

```
.from(leadScoringRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 206:** Table 'bantQualificationCriteria' not found in schema

```
.from(bantQualificationCriteria)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 218:** Table 'leadEngagementTracking' not found in schema

```
.from(leadEngagementTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 271:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 348:** Table 'centralizedApolloContacts' not found in schema

```
.from(centralizedApolloContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 412:** Table 'tenantApolloLeads' not found in schema

```
.from(tenantApolloLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 466:** Table 'centralizedApolloContacts' not found in schema

```
.from(centralizedApolloContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 517:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 525:** Table 'leadScoringFactors' not found in schema

```
.from(leadScoringFactors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 531:** Table 'bantQualificationCriteria' not found in schema

```
.from(bantQualificationCriteria)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 539:** Table 'leadEngagementTracking' not found in schema

```
.from(leadEngagementTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 552:** Table 'leadQualificationHistory' not found in schema

```
.from(leadQualificationHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 560:** Table 'tenantApolloLeads' not found in schema

```
.from(tenantApolloLeads)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 685:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 697:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 723:** Table 'leadScoringFactors' not found in schema

```
.from(leadScoringFactors)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 737:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 783:** Table 'leadScoreCalculations' not found in schema

```
.from(leadScoreCalculations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\knowledge-base-service.ts`

❌ **Line 62:** Table 'knowledgeCategories' not found in schema

```
const parentCategory = await db.query.knowledgeCategories.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 117:** Table 'knowledgeCategories' not found in schema

```
const categories = await db.query.knowledgeCategories.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 137:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 245:** Table 'knowledgeArticles' not found in schema

```
const currentArticle = await db.query.knowledgeArticles.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 307:** Table 'article' not found in schema

```
console.error('Failed to update article:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 324:** Table 'knowledgeArticles' not found in schema

```
const article = await db.query.knowledgeArticles.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 398:** Table 'knowledgeArticles' not found in schema

```
const articles = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 498:** Table 'aiContentGenerationQueue' not found in schema

```
const queueItem = await db.query.aiContentGenerationQueue.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 658:** Table 'knowledgeArticles' not found in schema

```
const allArticles = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 678:** Table 'knowledgeCategories' not found in schema

```
const categories = await db.query.knowledgeCategories.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\intelligent-alerts-service.ts`

❌ **Line 221:** Table 'auditLogs' not found in schema

```
const recentLogs = await db.query.auditLogs.findMany({
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 237:** Table 'alertTriageResults' not found in schema

```
const relatedAlerts = await db.query.alertTriageResults.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 384:** Table 'alertTriageResults' not found in schema

```
const pastIncidents = await db.query.alertTriageResults.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 454:** Table 'incidentResolutionPatterns' not found in schema

```
const patterns = await db.query.incidentResolutionPatterns.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 512:** Table 'alertRoutingRules' not found in schema

```
const rules = await db.query.alertRoutingRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 733:** Table 'alertTriageResults' not found in schema

```
.from(alertTriageResults)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 821:** Table 'securitySessions' not found in schema

```
const sessions = await db.query.securitySessions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1175:** Table 'alertTriageResults' not found in schema

```
const relatedIncidents = await db.query.alertTriageResults.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1268:** Table 'proactiveThreatDetection' not found in schema

```
const existing = await db.query.proactiveThreatDetection.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1295:** Table 'normal' not found in schema

```
detectionReason: `Deviation of ${deviation}% from normal behavior`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1333:** Table 'incidentResolutionPatterns' not found in schema

```
const existing = await db.query.incidentResolutionPatterns.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\integrations-service.ts`

❌ **Line 78:** Table 'Lead' not found in schema

```
const query = `SELECT Id, Name, Email, Phone, Company FROM Lead`;
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 128:** Table 'Invoice' not found in schema

```
const query = 'select * from Invoice';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\incident-response-service.ts`

❌ **Line 63:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 110:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 165:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 172:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 188:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 533:** Table 'incidentTimeline' not found in schema

```
.from(incidentTimeline)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 560:** Table 'incidentEscalations' not found in schema

```
.from(incidentEscalations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 587:** Table 'level' not found in schema

```
description: `Incident escalated from level ${currentLevel} to level ${newLevel}. Reason: ${reason}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 621:** Table 'incidentEscalations' not found in schema

```
.from(incidentEscalations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 738:** Table 'incidents' not found in schema

```
.from(incidents)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\gpt5-service.ts`

❌ **Line 78:** Table 'the' not found in schema

```
'Looks up customer data, lead information, and business records from the Printyx CRM system',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\services\geofence-alerts-service.ts`

❌ **Line 168:** Table 'geofenceAlertRules' not found in schema

```
.from(geofenceAlertRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 413:** Table 'geofences' not found in schema

```
.from(geofences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 425:** Table 'technicianLocations' not found in schema

```
.from(technicianLocations)
```

💡 **Suggestion:** Did you mean 'technician_locations'?

---

❌ **Line 521:** Table 'technicianDwellSessions' not found in schema

```
.from(technicianDwellSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 571:** Table 'technicianDwellSessions' not found in schema

```
.from(technicianDwellSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 708:** Table 'geofenceAlerts' not found in schema

```
.from(geofenceAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 737:** Table 'geofenceAlerts' not found in schema

```
.from(geofenceAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\gdpr-data-export-service.ts`

❌ **Line 115:** Table 'personalDataExports' not found in schema

```
const exportRequest = await db.query.personalDataExports.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table 'businessRecords' not found in schema

```
data.businessRecord = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 268:** Table 'enhancedContacts' not found in schema

```
data.contacts = await db.query.enhancedContacts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 290:** Table 'auditLogs' not found in schema

```
data.auditLogs = await db.query.auditLogs.findMany({
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 303:** Table 'dataAccessLogs' not found in schema

```
data.dataAccessLogs = await db.query.dataAccessLogs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 316:** Table 'consentRecords' not found in schema

```
(await db.query.consentRecords?.findMany?.({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 326:** Table 'consentAuditTrail' not found in schema

```
(await db.query.consentAuditTrail?.findMany?.({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 336:** Table 'gdprRequests' not found in schema

```
data.gdprRequests = await db.query.gdprRequests.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 435:** Table 'personalDataExports' not found in schema

```
(await db.query.personalDataExports.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 473:** Table 'personalDataExports' not found in schema

```
.from(personalDataExports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 480:** Table 'personalDataExports' not found in schema

```
.from(personalDataExports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 541:** Table 'dataExportTemplates' not found in schema

```
return await db.query.dataExportTemplates.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 555:** Table 'dataExportTemplates' not found in schema

```
(await db.query.dataExportTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\equipment-lifecycle-state-machine.ts`

❌ **Line 234:** Table 'equipmentLifecycle' not found in schema

```
.from(equipmentLifecycle)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 329:** Table 'equipmentLifecycleTransitions' not found in schema

```
.from(equipmentLifecycleTransitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 358:** Table 'equipmentLifecycleTransitions' not found in schema

```
.from(equipmentLifecycleTransitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 395:** Table 'equipmentLifecycleTransitions' not found in schema

```
.from(equipmentLifecycleTransitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\email-monitor-service.ts`

❌ **Line 229:** Table 'processedEmails' not found in schema

```
const existing = await db.query.processedEmails.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 289:** Table 'email' not found in schema

```
`[EmailMonitor] ✓ Ticket ${ticket.id} created from email ${emailId} (${duration}ms)`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 292:** Table 'email' not found in schema

```
console.error('[EmailMonitor] Error creating ticket from email:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 323:** Table 'emailMonitorConfig' not found in schema

```
return await db.query.emailMonitorConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 390:** Table 'emailMonitorConfig' not found in schema

```
const config = await db.query.emailMonitorConfig.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 464:** Table 'emailMonitorConfig' not found in schema

```
const configs = await db.query.emailMonitorConfig.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\dpa-management-service.ts`

❌ **Line 37:** Table 'both' not found in schema

```
description: 'Awaiting signatures from both parties',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 112:** Table 'dataProcessingAgreements' not found in schema

```
(await db.query.dataProcessingAgreements.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 228:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 330:** Table 'dataProcessingAgreements' not found in schema

```
return await db.query.dataProcessingAgreements.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 395:** Table 'dpaComplianceChecks' not found in schema

```
(await db.query.dpaComplianceChecks.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 420:** Table 'dpaComplianceChecks' not found in schema

```
.from(dpaComplianceChecks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 427:** Table 'dpaComplianceChecks' not found in schema

```
.from(dpaComplianceChecks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 459:** Table 'dataProcessingAgreements' not found in schema

```
return await db.query.dataProcessingAgreements.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 557:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 561:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 566:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 571:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 582:** Table 'dataProcessingAgreements' not found in schema

```
.from(dataProcessingAgreements)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\document-ocr-ai-service.ts`

❌ **Line 160:** Table 'documentFieldMappings' not found in schema

```
fieldMapping = await db.query.documentFieldMappings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 185:** Table 'Claude' not found in schema

```
throw new Error('Unexpected response type from Claude');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 346:** Table 'documentFieldMappings' not found in schema

```
fieldMapping = await db.query.documentFieldMappings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 401:** Table 'documentFieldMappings' not found in schema

```
const fieldMapping = await db.query.documentFieldMappings.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 461:** Table 'documentUploads' not found in schema

```
const upload = await db.query.documentUploads.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\document-generation-service.ts`

❌ **Line 139:** Table 'businessRecords' not found in schema

```
const record = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 176:** Table 'serviceCalls' not found in schema

```
const serviceCall = await db.query.serviceCalls.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 361:** Table 'documentTemplates' not found in schema

```
const template = await db.query.documentTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 466:** Table 'template' not found in schema

```
console.log(`Generated document ${generatedDoc.id} from template ${templateId}`);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 514:** Table 'documentTemplates' not found in schema

```
const template = await db.query.documentTemplates.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\data-retention-service.ts`

❌ **Line 74:** Table 'dataRetentionPolicies' not found in schema

```
.from(dataRetentionPolicies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 106:** Table 'dataRetentionPolicies' not found in schema

```
.from(dataRetentionPolicies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 113:** Table 'dataRetentionPolicies' not found in schema

```
.from(dataRetentionPolicies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 205:** Table 'dataPurgeJobs' not found in schema

```
.from(dataPurgeJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 243:** Table 'dataPurgeJobs' not found in schema

```
.from(dataPurgeJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 250:** Table 'dataPurgeJobs' not found in schema

```
.from(dataPurgeJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 585:** Table 'dataRetentionPolicies' not found in schema

```
.from(dataRetentionPolicies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 659:** Table 'dataRetentionPolicies' not found in schema

```
.from(dataRetentionPolicies)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\customer-portal-service.ts`

❌ **Line 107:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 169:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 275:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 280:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 287:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 322:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 339:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 374:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 433:** Table 'failed' not found in schema

```
throw new Error('Service request update failed - request not found or tenant mismatch');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 501:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 517:** Table 'customerServiceRequestStatusHistory' not found in schema

```
.from(customerServiceRequestStatusHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 577:** Table 'customerMeterSubmissions' not found in schema

```
.from(customerMeterSubmissions)
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 677:** Table 'customerSupplyOrders' not found in schema

```
.from(customerSupplyOrders)
```

💡 **Suggestion:** Did you mean 'customer_supply_orders'?

---

❌ **Line 746:** Table 'customerPayments' not found in schema

```
.from(customerPayments)
```

💡 **Suggestion:** Did you mean 'customer_payments'?

---

❌ **Line 777:** Table 'customerNotifications' not found in schema

```
.from(customerNotifications)
```

💡 **Suggestion:** Did you mean 'customer_notifications'?

---

❌ **Line 852:** Table 'customerServiceRequests' not found in schema

```
.from(customerServiceRequests)
```

💡 **Suggestion:** Did you mean 'customer_service_requests'?

---

❌ **Line 864:** Table 'customerPayments' not found in schema

```
.from(customerPayments)
```

💡 **Suggestion:** Did you mean 'customer_payments'?

---

❌ **Line 876:** Table 'customerMeterSubmissions' not found in schema

```
.from(customerMeterSubmissions)
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 891:** Table 'customerNotifications' not found in schema

```
.from(customerNotifications)
```

💡 **Suggestion:** Did you mean 'customer_notifications'?

---

❌ **Line 903:** Table 'customerSupplyOrders' not found in schema

```
.from(customerSupplyOrders)
```

💡 **Suggestion:** Did you mean 'customer_supply_orders'?

---

❌ **Line 940:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 1005:** Table 'customerPortalAccess' not found in schema

```
.from(customerPortalAccess)
```

💡 **Suggestion:** Did you mean 'customer_portal_access'?

---

❌ **Line 1393:** Table 'customerMeterSubmissions' not found in schema

```
.from(customerMeterSubmissions)
```

💡 **Suggestion:** Did you mean 'customer_meter_submissions'?

---

❌ **Line 2170:** Table 'customerMaintenanceAppointments' not found in schema

```
.from(customerMaintenanceAppointments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2208:** Table 'customerMaintenanceAppointments' not found in schema

```
.from(customerMaintenanceAppointments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2274:** Table 'customerMaintenanceAppointments' not found in schema

```
.from(customerMaintenanceAppointments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 2327:** Table 'customerMaintenanceAppointments' not found in schema

```
.from(customerMaintenanceAppointments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\customer-notification-service.ts`

❌ **Line 80:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\services\csv-import-service.ts`

❌ **Line 621:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 654:** Table 'enhancedContacts' not found in schema

```
.from(enhancedContacts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 720:** Table 'inventoryItems' not found in schema

```
.from(inventoryItems)
```

💡 **Suggestion:** Did you mean 'inventory_items'?

---

❌ **Line 851:** Table 'csvImportJobs' not found in schema

```
const [job] = await db.select().from(csvImportJobs).where(eq(csvImportJobs.id, jobId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 937:** Table 'csvImportDuplicates' not found in schema

```
.from(csvImportDuplicates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1001:** Table 'csvImportJobs' not found in schema

```
const [job] = await db.select().from(csvImportJobs).where(eq(csvImportJobs.id, jobId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1016:** Table 'csvImportDuplicates' not found in schema

```
.from(csvImportDuplicates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1138:** Table 'csvImportJobs' not found in schema

```
const [job] = await db.select().from(csvImportJobs).where(eq(csvImportJobs.id, jobId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1160:** Table 'csvImportJobs' not found in schema

```
.from(csvImportJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\contract-renewal-workflow.ts`

❌ **Line 127:** Table 'serviceContracts' not found in schema

```
.from(serviceContracts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\contract-renewal-service.ts`

❌ **Line 72:** Table 'contractRenewalTracking' not found in schema

```
const contract = await db.query.contractRenewalTracking.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 259:** Table 'contractRenewalTracking' not found in schema

```
const contract = await db.query.contractRenewalTracking.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 402:** Table 'contractRenewalTracking' not found in schema

```
const contract = await db.query.contractRenewalTracking.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 509:** Table 'contractRenewalTracking' not found in schema

```
const contracts = await db.query.contractRenewalTracking.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 589:** Table 'contractRenewalTracking' not found in schema

```
.from(contractRenewalTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 599:** Table 'contractRenewalTracking' not found in schema

```
.from(contractRenewalTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 610:** Table 'contractRenewalTracking' not found in schema

```
.from(contractRenewalTracking)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 620:** Table 'renewalProposals' not found in schema

```
.from(renewalProposals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 626:** Table 'contractRenewalTracking' not found in schema

```
const atRiskContracts = await db.query.contractRenewalTracking.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 640:** Table 'renewalAnalytics' not found in schema

```
const analytics = await db.query.renewalAnalytics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 663:** Table 'contractRenewalTracking' not found in schema

```
return db.query.contractRenewalTracking.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 677:** Table 'contractRenewalTracking' not found in schema

```
return db.query.contractRenewalTracking.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 692:** Table 'renewalAutomationRules' not found in schema

```
let rules = await db.query.renewalAutomationRules.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\content-gap-analysis-service.ts`

❌ **Line 110:** Table 'knowledgeSearchQueries' not found in schema

```
.from(knowledgeSearchQueries)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 141:** Table 'search' not found in schema

```
console.log(`  Found ${gaps.length} content gaps from search patterns`);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 162:** Table 'articleFeedback' not found in schema

```
.from(articleFeedback)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 178:** Table 'outdated' not found in schema

```
outdated: 'Update outdated content',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 210:** Table 'feedback' not found in schema

```
console.log(`  Found ${gaps.length} content gaps from feedback`);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 289:** Table 'feature' not found in schema

```
console.log(`  Found ${gaps.length} content gaps from feature coverage`);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 306:** Table 'knowledgeCategories' not found in schema

```
.from(knowledgeCategories)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 316:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\contact-deduplication-service.ts`

❌ **Line 178:** Table 'duplicateDetectionRules' not found in schema

```
(await db.query.duplicateDetectionRules.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 200:** Table 'duplicateDetectionRules' not found in schema

```
return await db.query.duplicateDetectionRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 322:** Table 'businessRecords' not found in schema

```
return await db.query.businessRecords.findMany({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 329:** Table 'enhancedContacts' not found in schema

```
return await db.query.enhancedContacts.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 460:** Table 'duplicateMatches' not found in schema

```
const existing = await db.query.duplicateMatches.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 540:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 547:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 787:** Table 'contactMergeHistory' not found in schema

```
const history = await db.query.contactMergeHistory.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 891:** Table 'contactMergeHistory' not found in schema

```
return await db.query.contactMergeHistory.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 930:** Table 'duplicateScanJobs' not found in schema

```
const job = await db.query.duplicateScanJobs.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1050:** Table 'duplicateScanJobs' not found in schema

```
.from(duplicateScanJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1057:** Table 'duplicateScanJobs' not found in schema

```
.from(duplicateScanJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1079:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1083:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1089:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1095:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1101:** Table 'duplicateMatches' not found in schema

```
.from(duplicateMatches)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1103:** Table 'duplicateScanJobs' not found in schema

```
db.query.duplicateScanJobs.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\consent-management-service.ts`

❌ **Line 115:** Table 'consentRecords' not found in schema

```
const existingConsent = await db.query.consentRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 191:** Table 'consentRecords' not found in schema

```
const existingConsent = await db.query.consentRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 259:** Table 'consentRecords' not found in schema

```
const existingConsent = await db.query.consentRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 300:** Table 'consentRecords' not found in schema

```
return await db.query.consentRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 319:** Table 'consentRecords' not found in schema

```
(await db.query.consentRecords.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 352:** Table 'consentRecords' not found in schema

```
const consents = await db.query.consentRecords.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 486:** Table 'consentAuditTrail' not found in schema

```
return await db.query.consentAuditTrail.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 528:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 535:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 594:** Table 'consentPreferencesTemplate' not found in schema

```
return await db.query.consentPreferencesTemplate.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 611:** Table 'consentPreferencesTemplate' not found in schema

```
(await db.query.consentPreferencesTemplate.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 636:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 640:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 645:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 650:** Table 'consentRecords' not found in schema

```
.from(consentRecords)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\company-deduplication-service.ts`

❌ **Line 125:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 389:** Table 'companyContacts' not found in schema

```
.from(companyContacts)
```

💡 **Suggestion:** Did you mean 'company_contacts'?

---

❌ **Line 396:** Table 'businessRecordActivities' not found in schema

```
.from(businessRecordActivities)
```

💡 **Suggestion:** Did you mean 'business_record_activities'?

---

### `server\services\change-management-service.ts`

❌ **Line 46:** Table 'changeRequests' not found in schema

```
.from(changeRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 102:** Table 'changeRequests' not found in schema

```
.from(changeRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 152:** Table 'changeRequests' not found in schema

```
.from(changeRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 159:** Table 'changeRequests' not found in schema

```
.from(changeRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 185:** Table 'a' not found in schema

```
throw new Error('Cannot update a closed change request');
```

💡 **Suggestion:** Similar tables: schema_migrations, tenants, audit_log_entries

---

❌ **Line 302:** Table 'changeApprovals' not found in schema

```
.from(changeApprovals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 422:** Table 'changeApprovals' not found in schema

```
.from(changeApprovals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 600:** Table 'current' not found in schema

```
throw new Error('Change cannot be rolled back from current status');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 643:** Table 'current' not found in schema

```
throw new Error('Change cannot be cancelled from current status');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 713:** Table 'changeHistory' not found in schema

```
.from(changeHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 724:** Table 'changeApprovals' not found in schema

```
.from(changeApprovals)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 749:** Table 'changeRequests' not found in schema

```
.from(changeRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\billing-engine-service.ts`

❌ **Line 266:** Table 'contract' not found in schema

```
console.error('Error generating invoice from contract:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 298:** Table 'autoInvoiceGeneration' not found in schema

```
.from(autoInvoiceGeneration)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 766:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 858:** Table 'autoInvoiceGeneration' not found in schema

```
.from(autoInvoiceGeneration)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 949:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 970:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 1175:** Table 'Printyx' not found in schema

```
subject: `Invoice ${invoice.invoiceNumber} from Printyx`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\billing-analytics-service.ts`

❌ **Line 339:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 496:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\services\automated-billing-service.ts`

❌ **Line 63:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 105:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 278:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 473:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 598:** Table 'meterReadings' not found in schema

```
.from(meterReadings)
```

💡 **Suggestion:** Did you mean 'meter_readings'?

---

❌ **Line 607:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 619:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\auto-supply-replenishment-service.ts`

❌ **Line 57:** Table 'supplyMonitoring' not found in schema

```
const supply = await db.query.supplyMonitoring.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 69:** Table 'supplyUsageHistory' not found in schema

```
const usageHistory = await db.query.supplyUsageHistory.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 256:** Table 'supplyMonitoring' not found in schema

```
const supply = await db.query.supplyMonitoring.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 273:** Table 'autoSupplyOrders' not found in schema

```
const existingOrder = await db.query.autoSupplyOrders.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 334:** Table 'supplyMonitoring' not found in schema

```
const supplies = await db.query.supplyMonitoring.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 399:** Table 'supplyMonitoring' not found in schema

```
.from(supplyMonitoring)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 404:** Table 'supplyMonitoring' not found in schema

```
.from(supplyMonitoring)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 413:** Table 'supplyMonitoring' not found in schema

```
.from(supplyMonitoring)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 418:** Table 'autoSupplyOrders' not found in schema

```
.from(autoSupplyOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 436:** Table 'autoSupplyOrders' not found in schema

```
.from(autoSupplyOrders)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 443:** Table 'supplyReplenishmentAnalytics' not found in schema

```
const analytics = await db.query.supplyReplenishmentAnalytics.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 477:** Table 'supplyMonitoring' not found in schema

```
return db.query.supplyMonitoring.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 488:** Table 'autoSupplyOrders' not found in schema

```
return db.query.autoSupplyOrders.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 499:** Table 'supplyReplenishmentRules' not found in schema

```
let rules = await db.query.supplyReplenishmentRules.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\auto-lead-routing-service.ts`

❌ **Line 94:** Table 'businessRecords' not found in schema

```
const lead = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 147:** Table 'leadScoringRules' not found in schema

```
const rules = await db.query.leadScoringRules.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 178:** Table 'bantQualificationCriteria' not found in schema

```
const bantData = await db.query.bantQualificationCriteria.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 330:** Table 'repCapacity' not found in schema

```
const reps = await db.query.repCapacity.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 378:** Table 'salesTerritories' not found in schema

```
const territories = await db.query.salesTerritories.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\audit-archival-service.ts`

❌ **Line 68:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 117:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 155:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 162:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 239:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 268:** Table 'archiveData' not found in schema

```
const compressedBuffer = await gzipAsync(Buffer.from(archiveData));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'auditArchiveJobs' not found in schema

```
.from(auditArchiveJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 601:** Table 'auditArchiveJobs' not found in schema

```
.from(auditArchiveJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 608:** Table 'auditArchiveJobs' not found in schema

```
.from(auditArchiveJobs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 634:** Table 'auditLogs' not found in schema

```
.from(auditLogs)
```

💡 **Suggestion:** Did you mean 'audit_logs'?

---

❌ **Line 658:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 686:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 757:** Table 'auditLogArchives' not found in schema

```
.from(auditLogArchives)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\approval-workflow-service.ts`

❌ **Line 54:** Table 'approvalRules' not found in schema

```
.from(approvalRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 292:** Table 'approvalDelegations' not found in schema

```
.from(approvalDelegations)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 363:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 479:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 548:** Table 'approvalRequests' not found in schema

```
.from(approvalRequests)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\api-key-service.ts`

❌ **Line 155:** Table 'apiKeys' not found in schema

```
.from(apiKeys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 268:** Table 'apiKeys' not found in schema

```
const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 329:** Table 'apiKeyRateLimits' not found in schema

```
.from(apiKeyRateLimits)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 411:** Table 'apiKeyRateLimits' not found in schema

```
.from(apiKeyRateLimits)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 548:** Table 'apiKeys' not found in schema

```
.from(apiKeys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 577:** Table 'apiKeys' not found in schema

```
.from(apiKeys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 586:** Table 'apiKeys' not found in schema

```
.from(apiKeys)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 741:** Table 'apiKeyUsageLogs' not found in schema

```
.from(apiKeyUsageLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\ai-employee-service.ts`

❌ **Line 173:** Table 'ai_employees' not found in schema

```
let query = `SELECT * FROM ai_employees WHERE tenant_id = '${tenantId}'`;
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 843:** Table 'ai_employee_tasks' not found in schema

```
let query = `SELECT * FROM ai_employee_tasks WHERE tenant_id = '${tenantId}' AND employee_id = '${employeeId}'`;
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 892:** Table 'ai_employee_workflows' not found in schema

```
let query = `SELECT * FROM ai_employee_workflows WHERE tenant_id = '${tenantId}' AND status = 'active'`;
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\ai-email-parser-service.ts`

❌ **Line 102:** Table 'Claude' not found in schema

```
throw new Error('Unexpected response type from Claude');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 226:** Table 'businessRecords' not found in schema

```
const customer = await db.query.businessRecords.findFirst({
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\services\ai-documentation-service.ts`

❌ **Line 240:** Table 'meeting' not found in schema

```
console.log('🎙️ Generating document from meeting transcription:', meetingId);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 255:** Table 'meeting' not found in schema

```
description: `AI-generated ${documentType.replace('_', ' ')} from meeting`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'meeting' not found in schema

```
console.log('✅ Document generated from meeting successfully');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 266:** Table 'meeting' not found in schema

```
console.error('Failed to generate document from meeting:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\seed-knowledge-base.ts`

❌ **Line 165:** Table 'knowledgeCategories' not found in schema

```
const existingCategories = await db.select().from(knowledgeCategories);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\workflow-automation-routes.ts`

❌ **Line 119:** Table 'workflow' not found in schema

```
console.error('Update workflow error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 120:** Table 'workflow' not found in schema

```
res.status(500).json({ error: 'Failed to update workflow' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 246:** Table 'trigger' not found in schema

```
console.error('Update trigger error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 247:** Table 'trigger' not found in schema

```
res.status(500).json({ error: 'Failed to update trigger' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 344:** Table 'step' not found in schema

```
console.error('Update step error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 345:** Table 'step' not found in schema

```
res.status(500).json({ error: 'Failed to update step' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 567:** Table 'template' not found in schema

```
changelog: `Cloned from template: ${template.name}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 762:** Table 'assignment' not found in schema

```
console.error('Update assignment group error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 763:** Table 'assignment' not found in schema

```
res.status(500).json({ error: 'Failed to update assignment group' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\team-collaboration-routes.ts`

❌ **Line 555:** Table 'client' not found in schema

```
description: 'Added notes from client discovery call',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\task-routes.ts`

❌ **Line 81:** Table 'CRM' not found in schema

```
title: 'Update CRM with quarterly activities',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 206:** Table 'task' not found in schema

```
res.status(500).json({ error: 'Failed to update task' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 375:** Table 'website' not found in schema

```
title: 'Follow up with potential lead from website inquiry',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 426:** Table 'website' not found in schema

```
title: 'Follow up with potential lead from website inquiry',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\sso-routes.ts`

❌ **Line 203:** Table 'SSO' not found in schema

```
res.status(500).json({ error: 'Failed to update SSO provider' });
```

💡 **Suggestion:** Similar tables: sso_domains, sso_providers, master_product_accessories

---

❌ **Line 622:** Table 'metadata' not found in schema

```
res.status(500).json({ error: 'Failed to import SSO provider from metadata' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\signature-routes.ts`

❌ **Line 152:** Table 'integration' not found in schema

```
res.status(500).json({ error: 'Failed to update integration credential' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 321:** Table 'signature' not found in schema

```
res.status(500).json({ error: 'Failed to update signature request' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 497:** Table 'signer' not found in schema

```
res.status(500).json({ error: 'Failed to update signer' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\reporting-api.ts`

❌ **Line 386:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 459:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 487:** Table 'userReportPreferences' not found in schema

```
.from(userReportPreferences)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 527:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 693:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 782:** Table 'reportDefinitions' not found in schema

```
.from(reportDefinitions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 851:** Table 'reportSchedules' not found in schema

```
.from(reportSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 891:** Table 'reportSchedules' not found in schema

```
.from(reportSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 935:** Table 'reportExecutions' not found in schema

```
.from(reportExecutions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\reading-history-routes.ts`

❌ **Line 68:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 78:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 128:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 186:** Table 'reading' not found in schema

```
message: 'Failed to update reading history',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 218:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 265:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 273:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 307:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 358:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\mileage-routes.ts`

❌ **Line 190:** Table 'mileageReports' not found in schema

```
.from(mileageReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 261:** Table 'mileageReports' not found in schema

```
.from(mileageReports)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 373:** Table 'mileageReimbursementRates' not found in schema

```
.from(mileageReimbursementRates)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 550:** Table 'vehicleAssignments' not found in schema

```
.from(vehicleAssignments)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\mfa-routes.ts`

❌ **Line 847:** Table 'your' not found in schema

```
message: 'Enter the code from your authenticator app',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\meeting-transcription-routes.ts`

❌ **Line 402:** Table 'successful' not found in schema

```
context: 'To handle increased demand from successful client acquisition',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 699:** Table 'an' not found in schema

```
contextBefore: 'From an operational perspective,',
```

💡 **Suggestion:** Similar tables: tenants, instances, commission_analytics

---

### `server\routes\manufacturer-order-routes.ts`

❌ **Line 158:** Table 'manufacturer' not found in schema

```
console.error('Update manufacturer connection error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 159:** Table 'manufacturer' not found in schema

```
res.status(500).json({ error: 'Failed to update manufacturer connection' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 240:** Table 'connection' not found in schema

```
console.error('Update connection health error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 241:** Table 'connection' not found in schema

```
res.status(500).json({ error: 'Failed to update connection health' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 337:** Table 'manufacturer' not found in schema

```
console.error('Update manufacturer order error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 338:** Table 'manufacturer' not found in schema

```
res.status(500).json({ error: 'Failed to update manufacturer order' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 445:** Table 'order' not found in schema

```
console.error('Update order fulfillment error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 446:** Table 'order' not found in schema

```
res.status(500).json({ error: 'Failed to update order fulfillment' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 584:** Table 'order' not found in schema

```
console.error('Update order line item error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 585:** Table 'order' not found in schema

```
res.status(500).json({ error: 'Failed to update order line item' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 637:** Table 'line' not found in schema

```
console.error('Update line item shipment error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 638:** Table 'line' not found in schema

```
res.status(500).json({ error: 'Failed to update line item shipment' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 739:** Table 'order' not found in schema

```
console.error('Update order confirmation error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 740:** Table 'order' not found in schema

```
res.status(500).json({ error: 'Failed to update order confirmation' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 886:** Table 'order' not found in schema

```
console.error('Update order shipment error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 887:** Table 'order' not found in schema

```
res.status(500).json({ error: 'Failed to update order shipment' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 939:** Table 'shipment' not found in schema

```
console.error('Update shipment tracking error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 940:** Table 'shipment' not found in schema

```
res.status(500).json({ error: 'Failed to update shipment tracking' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1088:** Table 'order' not found in schema

```
console.error('Update order exception error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1089:** Table 'order' not found in schema

```
res.status(500).json({ error: 'Failed to update order exception' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\lead-scoring-routes.ts`

❌ **Line 142:** Table 'scoring' not found in schema

```
console.error('Update scoring rule error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 143:** Table 'scoring' not found in schema

```
res.status(500).json({ error: 'Failed to update scoring rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 597:** Table 'BANT' not found in schema

```
console.error('Create/update BANT qualification error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\knowledge-base-routes.ts`

❌ **Line 213:** Table 'article' not found in schema

```
console.error('Failed to update article:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\knowledge-base-admin-routes.ts`

❌ **Line 69:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 80:** Table 'articleViews' not found in schema

```
.from(articleViews)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 90:** Table 'articleFeedback' not found in schema

```
.from(articleFeedback)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 101:** Table 'aiContentGenerationQueue' not found in schema

```
.from(aiContentGenerationQueue)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 105:** Table 'knowledgeArticles' not found in schema

```
const topArticles = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 115:** Table 'knowledgeArticles' not found in schema

```
const needsReview = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 190:** Table 'failed' not found in schema

```
console.error('Bulk update failed:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 263:** Table 'articleFeedback' not found in schema

```
const feedback = await db.query.articleFeedback.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 274:** Table 'knowledgeArticles' not found in schema

```
const article = await db.query.knowledgeArticles.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 358:** Table 'aiContentGenerationQueue' not found in schema

```
const queue = await db.query.aiContentGenerationQueue.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 421:** Table 'articleVersions' not found in schema

```
const versions = await db.query.articleVersions.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 460:** Table 'articleVersions' not found in schema

```
const versionToRestore = await db.query.articleVersions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 585:** Table 'knowledgeArticles' not found in schema

```
const articles = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 646:** Table 'articleViews' not found in schema

```
.from(articleViews)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 665:** Table 'knowledgeArticles' not found in schema

```
.from(knowledgeArticles)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 670:** Table 'knowledgeSearchQueries' not found in schema

```
const searchTrends = await db.query.knowledgeSearchQueries.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\gps-tracking-routes.ts`

❌ **Line 101:** Table 'technician' not found in schema

```
console.error('Update technician location error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 102:** Table 'technician' not found in schema

```
res.status(500).json({ error: 'Failed to update technician location' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 782:** Table 'ETA' not found in schema

```
console.error('Update ETA arrival error:', error);
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 783:** Table 'ETA' not found in schema

```
res.status(500).json({ error: 'Failed to update ETA arrival' });
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 914:** Table 'geofence' not found in schema

```
console.error('Update geofence error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 915:** Table 'geofence' not found in schema

```
res.status(500).json({ error: 'Failed to update geofence' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\geofence-alerts-routes.ts`

❌ **Line 55:** Table 'geofenceAlertRules' not found in schema

```
.from(geofenceAlertRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 76:** Table 'geofenceAlertRules' not found in schema

```
.from(geofenceAlertRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 145:** Table 'geofenceAlertRules' not found in schema

```
.from(geofenceAlertRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 174:** Table 'alert' not found in schema

```
console.error('Update alert rule error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'alert' not found in schema

```
res.status(500).json({ error: 'Failed to update alert rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 193:** Table 'geofenceAlertRules' not found in schema

```
.from(geofenceAlertRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 251:** Table 'geofenceAlerts' not found in schema

```
.from(geofenceAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 299:** Table 'geofenceAlerts' not found in schema

```
.from(geofenceAlerts)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 517:** Table 'technicianDwellSessions' not found in schema

```
.from(technicianDwellSessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 630:** Table 'geofenceAlertSubscriptions' not found in schema

```
.from(geofenceAlertSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 686:** Table 'geofenceAlertSubscriptions' not found in schema

```
.from(geofenceAlertSubscriptions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\email-marketing-routes.ts`

❌ **Line 104:** Table 'email' not found in schema

```
res.status(500).json({ error: 'Failed to update email template' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 208:** Table 'email' not found in schema

```
res.status(500).json({ error: 'Failed to update email campaign' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 350:** Table 'email' not found in schema

```
res.status(500).json({ error: 'Failed to update email send' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 497:** Table 'email' not found in schema

```
res.status(500).json({ error: 'Failed to update email list' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\customer-success-routes.ts`

❌ **Line 101:** Table 'health' not found in schema

```
console.error('Update health score error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 102:** Table 'health' not found in schema

```
res.status(500).json({ error: 'Failed to update health score' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 276:** Table 'churn' not found in schema

```
console.error('Update churn prediction error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 277:** Table 'churn' not found in schema

```
res.status(500).json({ error: 'Failed to update churn prediction' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 442:** Table 'intervention' not found in schema

```
console.error('Update intervention error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 443:** Table 'intervention' not found in schema

```
res.status(500).json({ error: 'Failed to update intervention' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 676:** Table 'journey' not found in schema

```
console.error('Update journey error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 677:** Table 'journey' not found in schema

```
res.status(500).json({ error: 'Failed to update journey' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 858:** Table 'renewal' not found in schema

```
console.error('Update renewal opportunity error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 859:** Table 'renewal' not found in schema

```
res.status(500).json({ error: 'Failed to update renewal opportunity' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\chrome-extension-routes.ts`

❌ **Line 132:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 150:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 168:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes\calendar-routes.ts`

❌ **Line 213:** Table 'calendar' not found in schema

```
res.status(500).json({ error: 'Failed to update calendar event' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\billing.ts`

❌ **Line 100:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 147:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 193:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 210:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 240:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 437:** Table 'invoiceLineItems' not found in schema

```
.from(invoiceLineItems)
```

💡 **Suggestion:** Did you mean 'invoice_line_items'?

---

❌ **Line 521:** Table 'invoice' not found in schema

```
res.status(500).json({ error: 'Failed to update invoice' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 683:** Table 'Printyx' not found in schema

```
subject: `Invoice ${invoice.invoiceNumber} from Printyx`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 858:** Table 'autoInvoiceGeneration' not found in schema

```
.from(autoInvoiceGeneration)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1031:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1061:** Table 'subscriptionPaymentMethods' not found in schema

```
.from(subscriptionPaymentMethods)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1090:** Table 'billing' not found in schema

```
console.error('Failed to update billing address:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1097:** Table 'billing' not found in schema

```
res.status(500).json({ error: 'Failed to update billing address' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1238:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1247:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1276:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1336:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1357:** Table 'billing' not found in schema

```
error: 'Failed to update billing rule',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1375:** Table 'billingRules' not found in schema

```
.from(billingRules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\automated-billing-routes.ts`

❌ **Line 49:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 134:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 172:** Table 'billing' not found in schema

```
console.error('Update billing schedule error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 173:** Table 'billing' not found in schema

```
res.status(500).json({ error: 'Failed to update billing schedule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 191:** Table 'billingSchedules' not found in schema

```
.from(billingSchedules)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 357:** Table 'invoiceGenerationLogs' not found in schema

```
.from(invoiceGenerationLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\article-ratings-routes.ts`

❌ **Line 59:** Table 'articleRatings' not found in schema

```
.from(articleRatings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 70:** Table 'articleVotes' not found in schema

```
.from(articleVotes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 83:** Table 'articleRatings' not found in schema

```
.from(articleRatings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 153:** Table 'readingHistory' not found in schema

```
.from(readingHistory)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 168:** Table 'articleRatings' not found in schema

```
.from(articleRatings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 240:** Table 'articleRatings' not found in schema

```
.from(articleRatings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 293:** Table 'articleVotes' not found in schema

```
.from(articleVotes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 354:** Table 'articleVotes' not found in schema

```
.from(articleVotes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 385:** Table 'articleRatings' not found in schema

```
.from(articleRatings)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 424:** Table 'articleVotes' not found in schema

```
.from(articleVotes)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\article-bookmarks-routes.ts`

❌ **Line 57:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 80:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 133:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 186:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 218:** Table 'bookmark' not found in schema

```
message: 'Failed to update bookmark',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 236:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 279:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 318:** Table 'articleBookmarks' not found in schema

```
.from(articleBookmarks)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\apollo-routes.ts`

❌ **Line 204:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

❌ **Line 316:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\routes\ai-search-knowledge-routes.ts`

❌ **Line 534:** Table 'traditional' not found in schema

```
'Strong focus on AI-powered features differentiates from traditional collaboration tools',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\ai-documentation-routes.ts`

❌ **Line 61:** Table 'Q4' not found in schema

```
description: 'Comprehensive minutes from Q4 strategic planning session',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 211:** Table 'Q4' not found in schema

```
description: 'Comprehensive minutes from Q4 strategic planning session',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 271:** Table 'successful' not found in schema

```
context: 'To handle increased demand from successful client acquisition',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 315:** Table 'transcription' not found in schema

```
'Generate professional meeting minutes from transcription',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 373:** Table 'meeting' not found in schema

```
changes: ['Initial AI generation from meeting transcription'],
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 374:** Table 'meeting' not found in schema

```
changesSummary: 'Document created from meeting transcription',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 439:** Table 'meeting' not found in schema

```
console.error('Error generating document from meeting:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 440:** Table 'meeting' not found in schema

```
res.status(500).json({ error: 'Failed to generate document from meeting' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 741:** Table 'transcription' not found in schema

```
'Generate professional meeting minutes from transcription',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\routes\advanced-billing-routes.ts`

❌ **Line 114:** Table 'billing' not found in schema

```
.json({ error: 'Forbidden: Admin or Manager role required to update billing rules' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 131:** Table 'billing' not found in schema

```
console.error('Update billing rule error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 132:** Table 'billing' not found in schema

```
res.status(500).json({ error: 'Failed to update billing rule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 471:** Table 'billing' not found in schema

```
console.error('Update billing dispute error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 472:** Table 'billing' not found in schema

```
res.status(500).json({ error: 'Failed to update billing dispute' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 926:** Table 'billing' not found in schema

```
.json({ error: 'Forbidden: Admin or Manager role required to update billing schedules' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 943:** Table 'billing' not found in schema

```
console.error('Update billing schedule error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 944:** Table 'billing' not found in schema

```
res.status(500).json({ error: 'Failed to update billing schedule' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1090:** Table 'credit' not found in schema

```
console.error('Update credit memo error:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1091:** Table 'credit' not found in schema

```
res.status(500).json({ error: 'Failed to update credit memo' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\openapi\config.ts`

❌ **Line 661:** Table 'business' not found in schema

```
summary: 'Update business record',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 662:** Table 'an' not found in schema

```
description: 'Update an existing business record',
```

💡 **Suggestion:** Similar tables: tenants, instances, commission_analytics

---

### `server\middleware\supabase-auth.ts`

❌ **Line 260:** Table 'database' not found in schema

```
console.warn('[Auth] Could not fetch user from database:', dbError);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\middleware\subscription.ts`

❌ **Line 72:** Table 'your' not found in schema

```
message = 'Your payment is past due. Please update your payment method.';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\middleware\session-timeout.ts`

❌ **Line 406:** Table 'securitySessions' not found in schema

```
.from(securitySessions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\middleware\ip-whitelist.ts`

❌ **Line 452:** Table 'IP' not found in schema

```
console.error('Failed to update IP whitelist:', error);
```

💡 **Suggestion:** Similar tables: customer_equipment, equipment, equipment_asset_tracking

---

❌ **Line 455:** Table 'IP' not found in schema

```
error: 'Failed to update IP whitelist settings',
```

💡 **Suggestion:** Similar tables: customer_equipment, equipment, equipment_asset_tracking

---

### `server\middleware\hierarchical-query-builder.ts`

❌ **Line 197:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 205:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 223:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 238:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 271:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 279:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 304:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

❌ **Line 313:** Table 'organizationalUnits' not found in schema

```
.from(organizationalUnits)
```

💡 **Suggestion:** Did you mean 'organizational_units'?

---

### `server\middleware\enhanced-rbac-middleware.ts`

❌ **Line 104:** Table 'permissionCache' not found in schema

```
.from(permissionCache)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 147:** Table 'permissionSet' not found in schema

```
const permissionsArray = Array.from(permissionSet);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 230:** Table 'userRoleAssignments' not found in schema

```
.from(userRoleAssignments)
```

💡 **Suggestion:** Did you mean 'user_role_assignments'?

---

❌ **Line 272:** Table 'permissions' not found in schema

```
.from(permissions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 340:** Table 'rolePermissions' not found in schema

```
.from(rolePermissions)
```

💡 **Suggestion:** Did you mean 'role_permissions'?

---

❌ **Line 356:** Table 'permissionOverrides' not found in schema

```
.from(permissionOverrides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 519:** Table 'userRoleAssignments' not found in schema

```
.from(userRoleAssignments)
```

💡 **Suggestion:** Did you mean 'user_role_assignments'?

---

❌ **Line 915:** Table 'permissions' not found in schema

```
.from(permissions)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 926:** Table 'permissionOverrides' not found in schema

```
.from(permissionOverrides)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 988:** Table 'a' not found in schema

```
message: 'This action requires approval from a supervisor.',
```

💡 **Suggestion:** Similar tables: schema_migrations, tenants, audit_log_entries

---

❌ **Line 1153:** Table 'permissions' not found in schema

```
return Array.from(permissions);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\integrations\routes.ts`

❌ **Line 72:** Table 'integrationMetrics' not found in schema

```
.from(integrationMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 86:** Table 'integrationApiLogs' not found in schema

```
.from(integrationApiLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\integrations\integration-service.ts`

❌ **Line 151:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 411:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 458:** Table 'Account' not found in schema

```
'SELECT Id, Name, Website, Phone, Industry, BillingStreet, BillingCity, BillingState FROM Account LIMIT 100';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 462:** Table 'Contact' not found in schema

```
'SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId FROM Contact LIMIT 100';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 466:** Table 'Opportunity' not found in schema

```
'SELECT Id, Name, Amount, StageName, CloseDate, AccountId FROM Opportunity LIMIT 100';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\integrations\error-monitor.ts`

❌ **Line 405:** Table 'integration' not found in schema

```
console.error(`Failed to update integration status:`, error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 416:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

### `server\integrations\dashboard-service.ts`

❌ **Line 46:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

❌ **Line 75:** Table 'integrationMetrics' not found in schema

```
.from(integrationMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 137:** Table 'integrationMetrics' not found in schema

```
.from(integrationMetrics)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 153:** Table 'integrationApiLogs' not found in schema

```
.from(integrationApiLogs)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 341:** Table 'systemIntegrations' not found in schema

```
.from(systemIntegrations)
```

💡 **Suggestion:** Did you mean 'system_integrations'?

---

### `server\cli\kb-cli.ts`

❌ **Line 136:** Table 'an' not found in schema

```
.description('Update an existing article')
```

💡 **Suggestion:** Similar tables: tenants, instances, commission_analytics

---

❌ **Line 242:** Table 'knowledgeArticles' not found in schema

```
const drafts = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 251:** Table 'knowledgeArticles' not found in schema

```
const drafts = await db.query.knowledgeArticles.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 494:** Table 'articleFeedback' not found in schema

```
const feedback = await db.query.articleFeedback.findMany({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 505:** Table 'knowledgeArticles' not found in schema

```
const article = await db.query.knowledgeArticles.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\data\article-templates.ts`

❌ **Line 378:** Table 'simple' not found in schema

```
guidance: 'Ordered troubleshooting steps from simple to complex',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 687:** Table 'previous' not found in schema

```
guidance: 'Resolved issues from previous versions',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\manufacturer-adapters\xerox-adapter.ts`

❌ **Line 368:** Table 'Xerox' not found in schema

```
console.error('Failed to update Xerox device config:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\manufacturer-adapters\hp-adapter.ts`

❌ **Line 385:** Table 'HP' not found in schema

```
console.error('Failed to update HP device config:', error);
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\services\manufacturer-adapters\fmaudit-adapter.ts`

❌ **Line 388:** Table 'FMAudit' not found in schema

```
console.error('Failed to update FMAudit device config:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\services\manufacturer-adapters\canon-adapter.ts`

❌ **Line 322:** Table 'Canon' not found in schema

```
console.error('Failed to update Canon device config:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\articles\troubleshooting.ts`

❌ **Line 129:** Table 'manufacturer' not found in schema

```
'**Contact manufacturer**: Some registrations require manual approval from manufacturer portal',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 156:** Table 'IP' not found in schema

```
'Ping device, update IP if changed, check device power',
```

💡 **Suggestion:** Similar tables: customer_equipment, equipment, equipment_asset_tracking

---

❌ **Line 161:** Table 'device' not found in schema

```
'Update device model in Printyx, verify SNMP community string',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 216:** Table 'external' not found in schema

```
'**Webhook Inspector**: See incoming webhooks from external systems',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 403:** Table 'browser' not found in schema

```
'Update browser to latest version',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\articles\service-management.ts`

❌ **Line 54:** Table 'multiple' not found in schema

```
"Service calls can originate from multiple sources: customer portal, phone calls, equipment alerts, or preventive maintenance schedules. Here's how to create one manually:",
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 61:** Table 'business' not found in schema

```
'**Select Customer**: Search and select from business records',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 204:** Table 'accepting' not found in schema

```
'Everything technicians need to know about using the Printyx mobile app. From accepting service calls to capturing customer signatures on-site.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 221:** Table 'the' not found in schema

```
"The Printyx mobile app is your technician's command center. Download from the App Store (iOS) or Google Play (Android) and log in with your Printyx credentials.",
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 246:** Table 'arrival' not found in schema

```
'⏱️ **Time Tracking**: The app automatically tracks billable time from arrival to departure. No more manual timesheets!',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 279:** Table 'your' not found in schema

```
content: 'When using parts from your service van inventory:',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 287:** Table 'your' not found in schema

```
'Part is automatically deducted from your van inventory',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 288:** Table 'warehouse' not found in schema

```
"If part isn't in your van, order from warehouse for next-day delivery",
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 307:** Table 'warehouse' not found in schema

```
['Awaiting Parts', 'Need additional parts', 'Order from warehouse'],
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 328:** Table 'warehouse' not found in schema

```
'Order the part from warehouse inventory',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 483:** Table 'fleet' not found in schema

```
'Monitors meter readings from fleet monitoring',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\articles\meter-billing.ts`

❌ **Line 13:** Table 'tedious' not found in schema

```
'Master usage-based billing with automated meter collection, tiered pricing, and contract billing. Transform meter billing from tedious manual work to a streamlined revenue engine.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 80:** Table 'business' not found in schema

```
'**Select Customer**: Choose from business records',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 247:** Table 'usage' not found in schema

```
'**Overage Revenue**: Income from usage above base minimums',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\articles\getting-started.ts`

❌ **Line 13:** Table 'initial' not found in schema

```
'Learn the basics of Printyx and get your copier dealership up and running in minutes. This comprehensive guide covers everything from initial setup to your first customer interaction.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 324:** Table 'lower' not found in schema

```
'Higher-level roles automatically inherit all permissions from lower-level roles. For example, a Manager has all Standard User permissions plus additional management capabilities.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\seeds\articles\crm-sales.ts`

❌ **Line 115:** Table 'Lead' not found in schema

```
"When a lead is ready to become a customer (e.g., they've signed a contract), simply change the status from 'Lead' to 'Customer'. That's it! All data is automatically retained.",
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'Lead' not found in schema

```
title: 'Sales Pipeline Management: From Lead to Close',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 196:** Table 'initial' not found in schema

```
'The sales pipeline visualizes your opportunities from initial contact through closed-won. Each stage represents a milestone in your sales process, helping you forecast revenue and identify bottlenecks.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 268:** Table 'stage' not found in schema

```
'**Conversion Rates**: Percentage moving from stage to stage',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 270:** Table 'prospect' not found in schema

```
'**Sales Velocity**: Time from prospect to close',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 326:** Table 'your' not found in schema

```
"Printyx's quote builder helps you create professional quotes quickly. Pull from your product catalog, apply pricing rules, and generate polished PDFs ready for customer review.",
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 338:** Table 'business' not found in schema

```
'**Step 2**: Select the customer/lead from business records',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 339:** Table 'your' not found in schema

```
'**Step 3**: Add products from your catalog (search by model, type, or manufacturer)',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 358:** Table 'business' not found in schema

```
['Customer Info', '✅ Yes', 'Auto-populated from business record'],
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 466:** Table 'your' not found in schema

```
'🤖 **AI Insight**: The model continuously learns from your closed-won and closed-lost deals, improving accuracy over time. Scores automatically recalculate as new data arrives.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 477:** Table '0' not found in schema

```
content: "Scores range from 0-100. Here's how to use them strategically:",
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `server\database-updater\examples\basic-usage.ts`

❌ **Line 143:** Table 'example...' not found in schema

```
console.log('🔄 Configuration update example...');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 173:** Table 'failed' not found in schema

```
console.error('❌ Configuration update failed:', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\database-updater\updaters\ServiceTicketUpdater.ts`

❌ **Line 228:** Table 'Network' not found in schema

```
'Cannot Print from Network',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 304:** Table 'any' not found in schema

```
'Equipment suddenly lost network connectivity yesterday. Customer unable to print from any networked computers. Local IT team unable to resolve. Static IP configuration appears correct.',
```

💡 **Suggestion:** Similar tables: company_contacts, company_pricing_settings

---

❌ **Line 497:** Table 'serviceTickets' not found in schema

```
.from(serviceTickets)
```

💡 **Suggestion:** Did you mean 'service_tickets'?

---

### `server\database-updater\updaters\BusinessRecordActivityUpdater.ts`

❌ **Line 399:** Table 'businessRecords' not found in schema

```
.from(businessRecords)
```

💡 **Suggestion:** Did you mean 'business_records'?

---

### `server\database-updater\seeders\report-seeder.ts`

❌ **Line 3113:** Table 'department' not found in schema

```
description: 'Employee performance metrics aggregated from department-specific KPIs',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\database-updater\seeders\rbac-seeder.ts`

❌ **Line 461:** Table 'assigned' not found in schema

```
description: 'Update assigned tickets',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 586:** Table 'warehouse' not found in schema

```
description: 'Request parts from warehouse',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 606:** Table 'vendors' not found in schema

```
description: 'Order parts from vendors',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1990:** Table 'permissions' not found in schema

```
const existing = await db.query.permissions.findFirst({
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `server\database-updater\seeders\kpi-seeder.ts`

❌ **Line 716:** Table 'stock' not found in schema

```
description: 'Percentage of orders filled completely from stock',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1317:** Table 'all' not found in schema

```
description: 'Total monthly recurring revenue from all tenants',
```

💡 **Suggestion:** Similar tables: mfa_challenges, equipment_installations

---

### `server\database-updater\api\updater-routes.ts`

❌ **Line 140:** Table 'configuration' not found in schema

```
logger.error('Failed to update configuration', error);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\hooks\useSupabaseAuth.ts`

❌ **Line 205:** Table 'backend' not found in schema

```
console.log('✅ User profile fetched from backend API successfully');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 216:** Table 'any' not found in schema

```
console.warn('No user profile found from any source, using auth metadata');
```

💡 **Suggestion:** Similar tables: company_contacts, company_pricing_settings

---

### `client\src\hooks\useOptimisticMutations.ts`

❌ **Line 127:** Table 'ticket' not found in schema

```
description: 'Failed to update ticket status. Please try again.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'inventory.' not found in schema

```
description: 'Failed to update inventory. Please try again.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\data\emailCampaigns.ts`

❌ **Line 144:** Table 'collective' not found in schema

```
'**Data network effects**\nMore dealers = better AI predictions for all. Our ML models improve daily from collective data.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 147:** Table 'scratch' not found in schema

```
'1. Rebuild their APIs from scratch (12-18 months)\n2. Convince partners to build integrations for a platform with no users\n3. Catch up on 2+ years of ecosystem development',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 197:** Table 'e' not found in schema

```
'**What happens if you subscribe:**\n• Immediate full access continues\n• Data migration support (if coming from e-automate)\n• Dedicated onboarding specialist\n• Priority support\n• Weekly feature updates',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\lib\seo\seoConfig.ts`

❌ **Line 250:** Table 'real' not found in schema

```
'See how copier dealers are transforming their business with Printyx. Real results from real customers.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\ContactManager.tsx`

❌ **Line 197:** Table 'contact' not found in schema

```
description: 'Failed to update contact',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 848:** Table 'Contact' not found in schema

```
{isLoading ? 'Saving...' : initialData ? 'Update Contact' : 'Create Contact'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\ActivityTimeline.tsx`

❌ **Line 176:** Table 'activity' not found in schema

```
description: error instanceof Error ? error.message : 'Failed to update activity',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\workflow-automation.tsx`

❌ **Line 121:** Table 'workflow' not found in schema

```
if (!response.ok) throw new Error('Failed to update workflow');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 135:** Table 'workflow.' not found in schema

```
description: 'Failed to update workflow. Please try again.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\Vendors.tsx`

❌ **Line 168:** Table 'vendor' not found in schema

```
description: 'Failed to update vendor',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 292:** Table 'vendor' not found in schema

```
? 'Update vendor information and settings.'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\Supplies.tsx`

❌ **Line 139:** Table 'selectedIds' not found in schema

```
const ids = Array.from(selectedIds);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\SoftwareProducts.tsx`

❌ **Line 132:** Table 'software' not found in schema

```
description: 'Failed to update software product',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 333:** Table 'selectedIds' not found in schema

```
console.log('Bulk deleting items:', Array.from(selectedIds));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 334:** Table 'selectedIds' not found in schema

```
bulkDeleteMutation.mutate(Array.from(selectedIds));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1837:** Table 'Product' not found in schema

```
{updateProductMutation.isPending ? 'Updating...' : 'Update Product'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\Settings.tsx`

❌ **Line 234:** Table 'profile' not found in schema

```
toast({ title: 'Failed to update profile', variant: 'destructive' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 246:** Table 'password' not found in schema

```
title: 'Failed to update password',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 260:** Table 'preferences' not found in schema

```
toast({ title: 'Failed to update preferences', variant: 'destructive' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 271:** Table 'accessibility' not found in schema

```
toast({ title: 'Failed to update accessibility settings', variant: 'destructive' });
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\RootAdminSEO.tsx`

❌ **Line 438:** Table 'Page' not found in schema

```
{upsertPage.isPending ? 'Saving...' : 'Add / Update Page'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\QuotesManagement.tsx`

❌ **Line 210:** Table 'quote' not found in schema

```
description: 'Failed to update quote status',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 615:** Table 'draft' not found in schema

```
'Track quote status from draft to accepted',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\QuoteBuilderPage.tsx`

❌ **Line 45:** Table 'quote' not found in schema

```
? `Creating proposal from quote ${sourceQuoteId} with template ${templateId}`
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\QuickBooksIntegration.tsx`

❌ **Line 122:** Table 'QuickBooks' not found in schema

```
description: 'Failed to sync customers from QuickBooks',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 140:** Table 'QuickBooks' not found in schema

```
description: 'Failed to sync items from QuickBooks',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PurchaseOrders.tsx`

❌ **Line 434:** Table 'vendor' not found in schema

```
description="Manage procurement workflows from vendor selection through receiving"
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ProfessionalServices.tsx`

❌ **Line 151:** Table 'selectedIds' not found in schema

```
const ids = Array.from(selectedIds);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ProductModels.tsx`

❌ **Line 109:** Table 'successful' not found in schema

```
console.log('Update successful, updated model:', updatedModel);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 125:** Table 'product' not found in schema

```
description: 'Failed to update product model',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 238:** Table 'selectedIds' not found in schema

```
console.log('Bulk deleting items:', Array.from(selectedIds));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 239:** Table 'selectedIds' not found in schema

```
bulkDeleteMutation.mutate(Array.from(selectedIds));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ProductHubUnified.tsx`

❌ **Line 371:** Table 'selectedProducts' not found in schema

```
masterProductIds: Array.from(selectedProducts),
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ProductCatalog.tsx`

❌ **Line 347:** Table 'selectedProducts' not found in schema

```
masterProductIds: Array.from(selectedProducts),
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ProductAccessories.tsx`

❌ **Line 123:** Table 'product' not found in schema

```
description: 'Failed to update product accessory',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PricingSettings.tsx`

❌ **Line 70:** Table 'pricing' not found in schema

```
description: error.message || 'Failed to update pricing settings',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PriceApprovals.tsx`

❌ **Line 166:** Table 'sales' not found in schema

```
description="Review and approve price change requests from sales reps"
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformTerritories.tsx`

❌ **Line 186:** Table 'territory' not found in schema

```
if (!response.ok) throw new Error('Failed to update territory');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 729:** Table 'Territory' not found in schema

```
{editingTerritory ? 'Update Territory' : 'Create Territory'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformLeadScoring.tsx`

❌ **Line 240:** Table 'scoring' not found in schema

```
if (!response.ok) throw new Error('Failed to update scoring rule');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 950:** Table 'Rule' not found in schema

```
{editingRule ? 'Update Rule' : 'Create Rule'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformDealDetail.tsx`

❌ **Line 135:** Table 'deal' not found in schema

```
if (!response.ok) throw new Error('Failed to update deal');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformConfiguration.tsx`

❌ **Line 220:** Table 'Email' not found in schema

```
name: 'From Email',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformBusinessRecordDetail.tsx`

❌ **Line 168:** Table 'record' not found in schema

```
if (!response.ok) throw new Error('Failed to update record');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 182:** Table 'business' not found in schema

```
description: 'Failed to update business record',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PlatformAssignmentRules.tsx`

❌ **Line 208:** Table 'assignment' not found in schema

```
if (!response.ok) throw new Error('Failed to update assignment rule');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 948:** Table 'Rule' not found in schema

```
{editingRule ? 'Update Rule' : 'Create Rule'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\PipelineConfiguration.tsx`

❌ **Line 115:** Table 'Field' not found in schema

```
{ value: 'update_field', label: 'Update Field', icon: Edit },
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\OnboardingDetails.tsx`

❌ **Line 92:** Table 'checklist' not found in schema

```
description: error.message || 'Failed to update checklist',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\OnboardingDashboard.tsx`

❌ **Line 180:** Table 'completed' not found in schema

```
description: `Service record created from completed installation: ${checklistData.checklistTitle}`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\OidManagement.tsx`

❌ **Line 159:** Table 'OID' not found in schema

```
if (!res.ok) throw new Error('Failed to update OID mapping');
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\pages\my-tasks.tsx`

❌ **Line 112:** Table 'task' not found in schema

```
if (!response.ok) throw new Error('Failed to update task');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 125:** Table 'task.' not found in schema

```
description: 'Failed to update task. Please try again.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ManagedServices.tsx`

❌ **Line 153:** Table 'selectedIds' not found in schema

```
const ids = Array.from(selectedIds);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\LeaseForm.tsx`

❌ **Line 142:** Table 'lease' not found in schema

```
description: 'Failed to update lease',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 174:** Table 'lease' not found in schema

```
{isEditMode ? 'Update lease details' : 'Set up a new equipment lease'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 494:** Table 'Lease' not found in schema

```
{isPending ? 'Saving...' : isEditMode ? 'Update Lease' : 'Create Lease'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\LeadsManagement.tsx`

❌ **Line 484:** Table 'lead' not found in schema

```
description: 'Failed to update lead',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1713:** Table 'Lead' not found in schema

```
{isLoading ? 'Saving...' : initialData ? 'Update Lead' : 'Create Lead'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\LeadDetail.tsx`

❌ **Line 412:** Table 'Failed' not found in schema

```
title: 'Update Failed',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 413:** Table 'lead' not found in schema

```
description: error.message || 'Failed to update lead information.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\JournalEntries.tsx`

❌ **Line 141:** Table 'journal' not found in schema

```
description: 'Failed to update journal entry',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 269:** Table 'journal' not found in schema

```
? 'Update journal entry information.'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\Invoices.tsx`

❌ **Line 544:** Table 'meter' not found in schema

```
: 'Generate your first invoice from meter readings to start billing customers.'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\IntegrationsManagement.tsx`

❌ **Line 85:** Table 'Phone' not found in schema

```
label: 'From Phone Number',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 100:** Table 'Email' not found in schema

```
{ name: 'fromEmail', label: 'From Email', type: 'email' },
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 143:** Table 'copier' not found in schema

```
description: 'Automated meter collection from copier devices',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\IntegrationMarketplaceDashboard.tsx`

❌ **Line 130:** Table 'E' not found in schema

```
description: 'Migrate data from E-Automate or maintain parallel sync during transition',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 132:** Table 'E' not found in schema

```
'Seamlessly migrate from E-Automate to Printyx or run both systems in parallel. Import customers, contracts, equipment, and service history.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 391:** Table 'Print' not found in schema

```
description: 'Automated meter reading collection from Print Audit',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\EquipmentLifecycle.tsx`

❌ **Line 190:** Table 'procurement' not found in schema

```
description: 'Complete workflow from procurement to customer delivery',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\EnhancedProductModels.tsx`

❌ **Line 129:** Table 'product' not found in schema

```
description: 'Failed to update product model',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 281:** Table 'selectedIds' not found in schema

```
bulkDeleteMutation.mutate(Array.from(selectedIds));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\EnhancedProductAccessories.tsx`

❌ **Line 242:** Table 'selectedIds' not found in schema

```
const ids = Array.from(selectedIds);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 425:** Table 'accessory' not found in schema

```
? 'Update accessory information'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\EnhancedOnboardingForm.tsx`

❌ **Line 850:** Table 'quote' not found in schema

```
description: `Successfully imported ${equipmentFromQuote.length} equipment items from quote "${selectedQuote.quoteNumber}".`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\DealsManagement.tsx`

❌ **Line 841:** Table 'close' not found in schema

```
description: error.message || 'Failed to update close date',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\DatabaseManagement.tsx`

❌ **Line 1222:** Table 'information_schema.table_privileges' not found in schema

```
"SELECT * FROM information_schema.table_privileges WHERE grantee != 'postgres' LIMIT 20;",
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\customers.tsx`

❌ **Line 426:** Table 'industries' not found in schema

```
return Array.from(industries).sort();
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 431:** Table 'states' not found in schema

```
return Array.from(states).sort();
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 436:** Table 'sources' not found in schema

```
return Array.from(sources).sort();
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1399:** Table 'Customer' not found in schema

```
: 'Update Customer'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\CustomerDetail.tsx`

❌ **Line 409:** Table 'Failed' not found in schema

```
title: 'Update Failed',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 410:** Table 'customer' not found in schema

```
description: error.message || 'Failed to update customer information.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ConversationalAIDashboard.tsx`

❌ **Line 225:** Table 'existing' not found in schema

```
return "I'll help you manage your tasks and projects. I can create new tasks, update existing ones, set priorities and deadlines, and even suggest optimal scheduling based on your workload. What tasks would you like me to help you with?";
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ChartOfAccounts.tsx`

❌ **Line 154:** Table 'account' not found in schema

```
description: 'Failed to update account',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 319:** Table 'account' not found in schema

```
? 'Update account information and settings.'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\BillingRules.tsx`

❌ **Line 98:** Table 'rule' not found in schema

```
title: 'Failed to update rule',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\Billing.tsx`

❌ **Line 157:** Table 'address' not found in schema

```
title: 'Failed to update address',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\assignment-groups.tsx`

❌ **Line 406:** Table 'Group' not found in schema

```
? 'Update Group'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ApprovalRulesConfiguration.tsx`

❌ **Line 650:** Table 'Rule' not found in schema

```
{saveMutation.isPending ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\ApolloLeadEnrichment.tsx`

❌ **Line 245:** Table 'selectedContacts' not found in schema

```
bulkAddMutation.mutate(Array.from(selectedContacts));
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 446:** Table 'cache' not found in schema

```
{searchResults.fromCache && ' (from cache)'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\AIDocumentationDashboard.tsx`

❌ **Line 148:** Table 'Q4' not found in schema

```
description: 'Comprehensive minutes from Q4 strategic planning session',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\pages\AdvancedWorkflowsDashboard.tsx`

❌ **Line 187:** Table 'lead' not found in schema

```
description: 'End-to-end copier sales from lead qualification to equipment delivery',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 206:** Table 'ticket' not found in schema

```
description: 'Complete service request handling from ticket to resolution',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 227:** Table 'bid' not found in schema

```
description: 'Complete project management from bid to completion',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 267:** Table 'inquiry' not found in schema

```
description: 'Complete member journey from inquiry to long-term retention',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\AdminCommandCenter.tsx`

❌ **Line 128:** Table 'CSV' not found in schema

```
description: 'Import users from CSV file',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\pages\AccountsReceivable.tsx`

❌ **Line 185:** Table 'invoice' not found in schema

```
description: 'Failed to update invoice',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 320:** Table 'invoice' not found in schema

```
? 'Update invoice information and payment details.'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\AccountsPayable.tsx`

❌ **Line 186:** Table 'account' not found in schema

```
description: 'Failed to update account payable',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 321:** Table 'bill' not found in schema

```
? 'Update bill information and payment details.'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\training\SOPModal.tsx`

❌ **Line 193:** Table 'approved' not found in schema

```
description: 'Finalize signed contracts from approved proposals',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\training\ProcessHelpBanner.tsx`

❌ **Line 31:** Table 'approved' not found in schema

```
description: 'Execute signed contracts from approved proposals',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\ui\bulk-operations-toolbar.tsx`

❌ **Line 267:** Table 'selectedIds' not found in schema

```
selectedIds: Array.from(selectedIds),
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\tasks\TemplatesView.tsx`

❌ **Line 76:** Table 'template' not found in schema

```
description: 'Project created from template successfully',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 84:** Table 'template' not found in schema

```
description: 'Failed to create project from template',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\tasks\TaskList.tsx`

❌ **Line 128:** Table 'CRM' not found in schema

```
title: 'Update CRM with quarterly activities',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\components\tasks\MyTasksView.tsx`

❌ **Line 99:** Table 'task' not found in schema

```
description: 'Failed to update task',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 118:** Table 'task' not found in schema

```
description: 'Failed to update task',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\service\ServiceTicketAnalysis.tsx`

❌ **Line 521:** Table 'the' not found in schema

```
placeholder="Any feedback from the customer..."
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\components\proposal-builder\QuoteTransformer.tsx`

❌ **Line 157:** Table 'the' not found in schema

```
'Here are the key benefits and value propositions that set us apart from the competition.',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

### `client\src\components\pwa\PWAInstallPrompt.tsx`

❌ **Line 40:** Table 'your' not found in schema

```
'Printyx has been installed successfully. You can now access it from your home screen.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 45:** Table 'your' not found in schema

```
description: 'You can install Printyx anytime from your browser menu.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\mobile\MobileServiceDispatch.tsx`

❌ **Line 65:** Table 'tray' not found in schema

```
issueDescription: 'Paper jam error code E000001-0001, unable to print from tray 2',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\mobile\MobileInventoryScanner.tsx`

❌ **Line 368:** Table 'Inventory' not found in schema

```
{scanAction === 'remove' && `Remove ${quantity} from Inventory`}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 369:** Table 'Count' not found in schema

```
{scanAction === 'count' && `Update Count to ${quantity}`}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\knowledge-base\ArticleRatingWidget.tsx`

❌ **Line 330:** Table 'Rating' not found in schema

```
{userRatingData?.hasRated ? 'Update Rating' : 'Submit Rating'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\customer\customer-360-view.tsx`

❌ **Line 561:** Table 'upgrading' not found in schema

```
description: `Print volume increased 40% over last quarter. Customer may benefit from upgrading to a higher-capacity model to reduce per-page costs.`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\components\billing\billing-rule-dialog.tsx`

❌ **Line 176:** Table 'your' not found in schema

```
? 'Update your billing rule configuration'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 582:** Table 'Rule' not found in schema

```
{saveMutation.isPending ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\marketing\Homepage.tsx`

❌ **Line 93:** Table 'E' not found in schema

```
'What makes Printyx different from E-Automate and other legacy dealer management systems?',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 114:** Table 'our' not found in schema

```
question: 'How quickly can we migrate from our current system to Printyx?',
```

💡 **Suggestion:** Table not found in DATABASE_SCHEMA.md

---

❌ **Line 116:** Table 'E' not found in schema

```
'Most dealers complete migration in 2-4 weeks with our white-glove migration support. We handle data import from E-Automate, QuickBooks, Salesforce, and CSV files. Our team maps your workflows, trains your staff, and provides dedicated support during the transition. Migration support is included in all plans.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 119:** Table 'switching' not found in schema

```
question: 'What kind of ROI can we expect from switching to Printyx?',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 227:** Table 'meter' not found in schema

```
'Deep understanding of copier dealer operations from meter billing quirks to service dispatch realities. Every feature designed for real workflows, not abstract ERP concepts. Defensible through execution excellence.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\marketing\CaseStudies.tsx`

❌ **Line 71:** Table 'e' not found in schema

```
'The migration from e-automate was smoother than we expected. Within a month, our technicians were more productive and happier with the tools. We should have done this years ago.',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\admin\KnowledgeBaseAdminDashboard.tsx`

❌ **Line 130:** Table 'failed' not found in schema

```
if (!res.ok) throw new Error('Bulk update failed');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `client\src\pages\admin\ArticleEditor.tsx`

❌ **Line 229:** Table 'article' not found in schema

```
{isNew ? 'Create a new knowledge base article' : 'Update article content'}
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `shared\csv-import-schema.ts`

❌ **Line 511:** Table 'external' not found in schema

```
description: 'ID from external system',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 1222:** Table 'EA' not found in schema

```
example: 'Sync from EA',
```

💡 **Suggestion:** Similar tables: deal_activities, deal_stages, deals

---

### `supabase\functions\territories\index.ts`

❌ **Line 272:** Table 'territory' not found in schema

```
return createCorsResponse({ error: 'Failed to update territory' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\technicians\index.ts`

❌ **Line 307:** Table 'technician' not found in schema

```
return createCorsResponse({ error: 'Failed to update technician' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\teams\index.ts`

❌ **Line 148:** Table 'team' not found in schema

```
return createCorsResponse({ error: 'Failed to update team' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\tasks\index.ts`

❌ **Line 226:** Table 'task' not found in schema

```
return createCorsResponse({ error: 'Failed to update task' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\settings\index.ts`

❌ **Line 129:** Table 'tenant' not found in schema

```
return createCorsResponse({ error: 'Failed to update tenant settings' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 175:** Table 'dashboard' not found in schema

```
return createCorsResponse({ error: 'Failed to update dashboard layout' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\roles\index.ts`

❌ **Line 135:** Table 'role' not found in schema

```
return createCorsResponse({ error: 'Failed to update role' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\quotes\index.ts`

❌ **Line 319:** Table 'quote' not found in schema

```
return createCorsResponse({ error: 'Failed to update quote' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\proposals\index.ts`

❌ **Line 312:** Table 'proposal' not found in schema

```
return createCorsResponse({ error: 'Failed to update proposal' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\projects\index.ts`

❌ **Line 220:** Table 'project' not found in schema

```
return createCorsResponse({ error: 'Failed to update project' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\pricing\index.ts`

❌ **Line 118:** Table 'pricing' not found in schema

```
return createCorsResponse({ error: 'Failed to update pricing settings' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 327:** Table 'product' not found in schema

```
return createCorsResponse({ error: 'Failed to update product pricing' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\pipeline\index.ts`

❌ **Line 129:** Table 'pipeline' not found in schema

```
return createCorsResponse({ error: 'Failed to update pipeline stage' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\opportunities\index.ts`

❌ **Line 191:** Table 'opportunity' not found in schema

```
return createCorsResponse({ error: 'Failed to update opportunity' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\onboarding\index.ts`

❌ **Line 333:** Table 'checklist' not found in schema

```
return createCorsResponse({ error: 'Failed to update checklist' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\meter-readings\index.ts`

❌ **Line 210:** Table 'meter' not found in schema

```
return createCorsResponse({ error: 'Failed to update meter reading' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\locations\index.ts`

❌ **Line 172:** Table 'location' not found in schema

```
return createCorsResponse({ error: 'Failed to update location' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\leases\index.ts`

❌ **Line 331:** Table 'lease' not found in schema

```
return createCorsResponse({ error: 'Failed to update lease' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\invoices\index.ts`

❌ **Line 266:** Table 'invoice' not found in schema

```
return createCorsResponse({ error: 'Failed to update invoice' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\import\index.ts`

❌ **Line 483:** Table 'contact' not found in schema

```
console.error(`[IMPORT] ❌ Failed to update contact:`, updateError);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\inventory\index.ts`

❌ **Line 442:** Table 'inventory' not found in schema

```
return createCorsResponse({ error: 'Failed to update inventory item' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\deals\index.ts`

❌ **Line 185:** Table 'deal' not found in schema

```
return createCorsResponse({ error: 'Failed to update deal' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\dashboard\index.ts`

❌ **Line 53:** Table 'last' not found in schema

```
subtitle: '+12% from last month',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\customers\index.ts`

❌ **Line 308:** Table 'customer' not found in schema

```
return createCorsResponse({ error: 'Failed to update customer' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\contracts\index.ts`

❌ **Line 228:** Table 'contract' not found in schema

```
return createCorsResponse({ error: 'Failed to update contract' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\contacts\index.ts`

❌ **Line 122:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 140:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 176:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 183:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 218:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 226:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 236:** Table 'contact' not found in schema

```
return createCorsResponse({ error: 'Failed to update contact' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 245:** Table 'tableName' not found in schema

```
.from(tableName)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\companies\index.ts`

❌ **Line 576:** Table 'company' not found in schema

```
return createCorsResponse({ error: 'Failed to update company' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\company-contacts\index.ts`

❌ **Line 235:** Table 'contact' not found in schema

```
{ error: 'Failed to update contact', details: error.message },
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\catalog\index.ts`

❌ **Line 360:** Table 'product' not found in schema

```
return createCorsResponse({ error: 'Failed to update product model' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\business-records\index.ts`

❌ **Line 136:** Table 'table' not found in schema

```
.from(table)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 334:** Table 'business' not found in schema

```
return createCorsResponse({ error: 'Failed to update business record' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\appointments\index.ts`

❌ **Line 207:** Table 'appointment' not found in schema

```
return createCorsResponse({ error: 'Failed to update appointment' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `supabase\functions\activities\index.ts`

❌ **Line 199:** Table 'activity' not found in schema

```
return createCorsResponse({ error: 'Failed to update activity' }, 500, req);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `scripts\setup-stripe-products.ts`

❌ **Line 359:** Table 'database' not found in schema

```
console.log('2. Run: npm run db:push (to update database schema if needed)');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 360:** Table 'plan' not found in schema

```
console.log('3. Run: npx tsx server/update-stripe-ids.ts (to update plan records in database)');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `scripts\migrate-users-to-supabase.ts`

❌ **Line 82:** Table 'legacy' not found in schema

```
console.log('Fetching users from legacy database...');
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `scripts\database-schema-reporter.ts`

❌ **Line 579:** Table 'allColumns' not found in schema

```
Array.from(allColumns)
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `scripts\comprehensive-system-check.ts`

❌ **Line 146:** Table 'routes' not found in schema

```
return Array.from(routes);
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 233:** Table 'validApiEndpoints' not found in schema

```
suggestion: `Create '${functionName}' edge function or express route. Available endpoints: ${Array.from(validApiEndpoints).slice(0, 10).join(', ')}...`,
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `migrations\meeting-transcription-migration.sql`

❌ **Line 372:** Table 'meetings' not found in schema

```
COMMENT ON TABLE meeting_highlights IS 'Key moments and highlights extracted from meetings with AI analysis';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

❌ **Line 375:** Table 'meeting' not found in schema

```
COMMENT ON TABLE meeting_content_analytics IS 'Aggregated analytics and insights from meeting content analysis';
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `migrations\ai-employees-migration.sql`

❌ **Line 410:** Table 'initial' not found in schema

```
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Customer Support Workflow', 'customer_support', 'Handle customer support requests from initial contact to resolution',
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

### `database\seed_test_data.sql`

❌ **Line 288:** Table 'vendors' not found in schema

```
-- UNION ALL SELECT 'vendors', id, vendor_name FROM vendors WHERE vendor_name LIKE 'SEED_TEST_%'
```

💡 **Suggestion:** Similar tables: extensions, schema_migrations, tenants

---

## ⚠️ Invalid Column References

Found 1263 issue(s)

### `server\websocket-service.ts`

⚠️ **Line 348:** Column 'startsWith' not found in table 'subscription'

```
if (subscription.startsWith('kpi:')) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 382:** Column 'startsWith' not found in table 'subscription'

```
if (subscription.startsWith('report:')) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\storage.ts`

⚠️ **Line 2199:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 2200:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 2202:** Column 'roleId' not found in table 'users'

```
roleId: users.roleId,
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 2203:** Column 'isActive' not found in table 'users'

```
isActive: users.isActive,
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 2206:** Column 'tenantId' not found in table 'users'

```
.where(eq(users.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 2260:** Column 'domain' not found in table 'tenants'

```
domain: tenants.domain,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 2277:** Column 'roleId' not found in table 'users'

```
.leftJoin(roles, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 2278:** Column 'teamId' not found in table 'users'

```
.leftJoin(teams, eq(users.teamId, teams.id))
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 2294:** Column 'tenantId' not found in table 'customers'

```
let query = db.select().from(customers).where(eq(customers.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 2322:** Column 'teamId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 2322:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 2357:** Column 'tenantId' not found in table 'leads'

```
let query = db.select().from(leads).where(eq(leads.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'leads.tenant_id'?

---

⚠️ **Line 2361:** Column 'ownerId' not found in table 'leads'

```
query = query.where(eq(leads.ownerId, userId));
```

💡 **Suggestion:** Did you mean 'leads.owner_id'?

---

⚠️ **Line 2367:** Column 'teamId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 2367:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 2371:** Column 'ownerId' not found in table 'leads'

```
leads.ownerId,
```

💡 **Suggestion:** Did you mean 'leads.owner_id'?

---

⚠️ **Line 2398:** Column 'userId' not found in table 'technicians'

```
.innerJoin(users, eq(technicians.userId, users.id))
```

💡 **Suggestion:** Did you mean 'technicians.user_id'?

---

⚠️ **Line 2399:** Column 'teamId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 2399:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 2420:** Column 'tenantId' not found in table 'contracts'

```
let query = db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 2424:** Column 'assignedSalespersonId' not found in table 'contracts'

```
query = query.where(eq(contracts.assignedSalespersonId, userId));
```

💡 **Suggestion:** Column not found in table 'contracts'

---

⚠️ **Line 2430:** Column 'teamId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 2430:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 2434:** Column 'assignedSalespersonId' not found in table 'contracts'

```
contracts.assignedSalespersonId,
```

💡 **Suggestion:** Column not found in table 'contracts'

---

⚠️ **Line 2445:** Column 'tenantId' not found in table 'customers'

```
return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 2453:** Column 'tenantId' not found in table 'customers'

```
.where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 2475:** Column 'tenantId' not found in table 'customers'

```
.where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 2483:** Column 'tenantId' not found in table 'customers'

```
.where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 2493:** Column 'customerId' not found in table 'equipment'

```
.where(and(eq(equipment.customerId, customerId), eq(equipment.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 2493:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.customerId, customerId), eq(equipment.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 2518:** Column 'customerId' not found in table 'invoices'

```
.where(and(eq(invoices.customerId, customerId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 2518:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.customerId, customerId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 2519:** Column 'invoiceDate' not found in table 'invoices'

```
.orderBy(desc(invoices.invoiceDate));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 2546:** Column 'customerId' not found in table 'contracts'

```
.where(and(eq(contracts.customerId, customerId), eq(contracts.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 2546:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.customerId, customerId), eq(contracts.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 2555:** Column 'tenantId' not found in table 'companies'

```
return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 2562:** Column 'tenantId' not found in table 'companies'

```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 2576:** Column 'businessName' not found in table 'companies'

```
.where(and(eq(companies.businessName, name.trim()), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.business_name'?

---

⚠️ **Line 2576:** Column 'tenantId' not found in table 'companies'

```
.where(and(eq(companies.businessName, name.trim()), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 2597:** Column 'tenantId' not found in table 'companies'

```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 2605:** Column 'tenantId' not found in table 'companies'

```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 2858:** Column 'tenantId' not found in table 'quotes'

```
return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 2868:** Column 'tenantId' not found in table 'equipment'

```
return await db.select().from(equipment).where(eq(equipment.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 2880:** Column 'tenantId' not found in table 'contracts'

```
return await db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 2942:** Column 'tenantId' not found in table 'technicians'

```
return await db.select().from(technicians).where(eq(technicians.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 2988:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 2994:** Column 'tenantId' not found in table 'invoices'

```
return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 3030:** Column 'tenantId' not found in table 'leads'

```
.where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'leads.tenant_id'?

---

⚠️ **Line 3670:** Column 'tenantId' not found in table 'tasks'

```
let query = db.select().from(tasks).where(eq(tasks.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 3673:** Column 'assignedTo' not found in table 'tasks'

```
query = query.where(eq(tasks.assignedTo, userId));
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 3676:** Column 'createdAt' not found in table 'tasks'

```
return await query.orderBy(desc(tasks.createdAt)).limit(50);
```

💡 **Suggestion:** Did you mean 'tasks.created_at'?

---

⚠️ **Line 3683:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 3696:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 3706:** Column 'actualHours' not found in table 'tasks'

```
avgHours: sql<number>`AVG(${tasks.actualHours})`,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 3709:** Column 'tenantId' not found in table 'tasks'

```
.where(eq(tasks.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 3712:** Column 'assignedTo' not found in table 'tasks'

```
baseQuery = baseQuery.where(eq(tasks.assignedTo, userId));
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 3742:** Column 'tenantId' not found in table 'tasks'

```
eq(tasks.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 3743:** Column 'dueDate' not found in table 'tasks'

```
lt(tasks.dueDate, new Date()),
```

💡 **Suggestion:** Did you mean 'tasks.due_date'?

---

⚠️ **Line 3757:** Column 'tenantId' not found in table 'projects'

```
.where(eq(projects.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'projects.tenant_id'?

---

⚠️ **Line 3758:** Column 'createdAt' not found in table 'projects'

```
.orderBy(desc(projects.createdAt));
```

💡 **Suggestion:** Did you mean 'projects.created_at'?

---

⚠️ **Line 4075:** Column 'tenantId' not found in table 'supplies'

```
.where(eq(supplies.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

⚠️ **Line 4076:** Column 'productName' not found in table 'supplies'

```
.orderBy(supplies.productName);
```

💡 **Suggestion:** Did you mean 'supplies.product_name'?

---

⚠️ **Line 4083:** Column 'productCode' not found in table 'supplies'

```
.where(and(eq(supplies.productCode, productCode), eq(supplies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'supplies.product_code'?

---

⚠️ **Line 4083:** Column 'tenantId' not found in table 'supplies'

```
.where(and(eq(supplies.productCode, productCode), eq(supplies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

⚠️ **Line 4100:** Column 'tenantId' not found in table 'supplies'

```
.where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

⚠️ **Line 4108:** Column 'tenantId' not found in table 'supplies'

```
.where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

⚠️ **Line 4469:** Column 'companyName' not found in table 'deals'

```
companyName: deals.companyName,
```

💡 **Suggestion:** Did you mean 'deals.company_name'?

---

⚠️ **Line 4470:** Column 'primaryContactName' not found in table 'deals'

```
primaryContactName: deals.primaryContactName,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_name'?

---

⚠️ **Line 4471:** Column 'primaryContactEmail' not found in table 'deals'

```
primaryContactEmail: deals.primaryContactEmail,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_email'?

---

⚠️ **Line 4472:** Column 'primaryContactPhone' not found in table 'deals'

```
primaryContactPhone: deals.primaryContactPhone,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_phone'?

---

⚠️ **Line 4474:** Column 'dealType' not found in table 'deals'

```
dealType: deals.dealType,
```

💡 **Suggestion:** Did you mean 'deals.deal_type'?

---

⚠️ **Line 4476:** Column 'expectedCloseDate' not found in table 'deals'

```
expectedCloseDate: deals.expectedCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.expected_close_date'?

---

⚠️ **Line 4477:** Column 'productsInterested' not found in table 'deals'

```
productsInterested: deals.productsInterested,
```

💡 **Suggestion:** Did you mean 'deals.products_interested'?

---

⚠️ **Line 4478:** Column 'estimatedMonthlyValue' not found in table 'deals'

```
estimatedMonthlyValue: deals.estimatedMonthlyValue,
```

💡 **Suggestion:** Did you mean 'deals.estimated_monthly_value'?

---

⚠️ **Line 4482:** Column 'stageId' not found in table 'deals'

```
stageId: deals.stageId,
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4485:** Column 'ownerId' not found in table 'deals'

```
ownerId: deals.ownerId,
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 4486:** Column 'firstName' not found in table 'users'

```
ownerName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4487:** Column 'createdAt' not found in table 'deals'

```
createdAt: deals.createdAt,
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 4488:** Column 'updatedAt' not found in table 'deals'

```
updatedAt: deals.updatedAt,
```

💡 **Suggestion:** Did you mean 'deals.updated_at'?

---

⚠️ **Line 4491:** Column 'stageId' not found in table 'deals'

```
.leftJoin(dealStages, eq(deals.stageId, dealStages.id))
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4492:** Column 'ownerId' not found in table 'deals'

```
.leftJoin(users, eq(deals.ownerId, users.id))
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 4493:** Column 'tenantId' not found in table 'deals'

```
.where(eq(deals.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 4496:** Column 'stageId' not found in table 'deals'

```
query = query.where(eq(deals.stageId, stageId));
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4500:** Column 'leadId' not found in table 'deals'

```
query = query.where(eq(deals.leadId, leadId));
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 4507:** Column 'companyName' not found in table 'deals'

```
like(deals.companyName, `%${search}%`),
```

💡 **Suggestion:** Did you mean 'deals.company_name'?

---

⚠️ **Line 4508:** Column 'primaryContactName' not found in table 'deals'

```
like(deals.primaryContactName, `%${search}%`),
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_name'?

---

⚠️ **Line 4513:** Column 'createdAt' not found in table 'deals'

```
return await query.orderBy(desc(deals.createdAt));
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 4523:** Column 'companyName' not found in table 'deals'

```
companyName: deals.companyName,
```

💡 **Suggestion:** Did you mean 'deals.company_name'?

---

⚠️ **Line 4524:** Column 'primaryContactName' not found in table 'deals'

```
primaryContactName: deals.primaryContactName,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_name'?

---

⚠️ **Line 4525:** Column 'primaryContactEmail' not found in table 'deals'

```
primaryContactEmail: deals.primaryContactEmail,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_email'?

---

⚠️ **Line 4526:** Column 'primaryContactPhone' not found in table 'deals'

```
primaryContactPhone: deals.primaryContactPhone,
```

💡 **Suggestion:** Did you mean 'deals.primary_contact_phone'?

---

⚠️ **Line 4528:** Column 'dealType' not found in table 'deals'

```
dealType: deals.dealType,
```

💡 **Suggestion:** Did you mean 'deals.deal_type'?

---

⚠️ **Line 4530:** Column 'expectedCloseDate' not found in table 'deals'

```
expectedCloseDate: deals.expectedCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.expected_close_date'?

---

⚠️ **Line 4531:** Column 'productsInterested' not found in table 'deals'

```
productsInterested: deals.productsInterested,
```

💡 **Suggestion:** Did you mean 'deals.products_interested'?

---

⚠️ **Line 4532:** Column 'estimatedMonthlyValue' not found in table 'deals'

```
estimatedMonthlyValue: deals.estimatedMonthlyValue,
```

💡 **Suggestion:** Did you mean 'deals.estimated_monthly_value'?

---

⚠️ **Line 4536:** Column 'stageId' not found in table 'deals'

```
stageId: deals.stageId,
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4539:** Column 'ownerId' not found in table 'deals'

```
ownerId: deals.ownerId,
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 4540:** Column 'firstName' not found in table 'users'

```
ownerName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4541:** Column 'createdAt' not found in table 'deals'

```
createdAt: deals.createdAt,
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 4542:** Column 'updatedAt' not found in table 'deals'

```
updatedAt: deals.updatedAt,
```

💡 **Suggestion:** Did you mean 'deals.updated_at'?

---

⚠️ **Line 4545:** Column 'stageId' not found in table 'deals'

```
.leftJoin(dealStages, eq(deals.stageId, dealStages.id))
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4546:** Column 'ownerId' not found in table 'deals'

```
.leftJoin(users, eq(deals.ownerId, users.id))
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 4547:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 4575:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 4598:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 4664:** Column 'firstName' not found in table 'users'

```
userName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4864:** Column 'businessName' not found in table 'companies'

```
companyName: companies.businessName,
```

💡 **Suggestion:** Did you mean 'companies.business_name'?

---

⚠️ **Line 4870:** Column 'firstName' not found in table 'users'

```
ownerName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4972:** Column 'firstName' not found in table 'users'

```
eq(users.firstName, name),
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4973:** Column 'lastName' not found in table 'users'

```
eq(users.lastName, name),
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 4974:** Column 'firstName' not found in table 'users'

```
like(sql`${users.firstName} || ' ' || ${users.lastName}`, `%${name}%`),
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 4974:** Column 'lastName' not found in table 'users'

```
like(sql`${users.firstName} || ' ' || ${users.lastName}`, `%${name}%`),
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 4993:** Column 'subdomainPrefix' not found in table 'tenants'

```
or(eq(tenants.slug, slug), eq(tenants.subdomainPrefix, slug), eq(tenants.pathPrefix, slug)),
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 4993:** Column 'pathPrefix' not found in table 'tenants'

```
or(eq(tenants.slug, slug), eq(tenants.subdomainPrefix, slug), eq(tenants.pathPrefix, slug)),
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 6874:** Column 'twoFactorEnabled' not found in table 'users'

```
twoFactorEnabled: users.twoFactorEnabled,
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 7030:** Column 'tenantId' not found in table 'users'

```
.where(eq(users.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 7038:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.twoFactorEnabled, true)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 7038:** Column 'twoFactorEnabled' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.twoFactorEnabled, true)));
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 7093:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 7094:** Column 'twoFactorEnabled' not found in table 'users'

```
or(eq(users.twoFactorEnabled, false), isNull(users.twoFactorEnabled)),
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 7094:** Column 'twoFactorEnabled' not found in table 'users'

```
or(eq(users.twoFactorEnabled, false), isNull(users.twoFactorEnabled)),
```

💡 **Suggestion:** Column not found in table 'users'

---

### `server\seed-workflow-events.ts`

⚠️ **Line 390:** Column 'installed' not found in table 'equipment'

```
eventName: 'equipment.installed',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\seed-toner-workflow.ts`

⚠️ **Line 193:** Column 'productCode' not found in table 'supplies'

```
sql`${supplies.productCode} = ${product.productCode} AND ${supplies.tenantId} = ${DEFAULT_TENANT_ID}`,
```

💡 **Suggestion:** Did you mean 'supplies.product_code'?

---

⚠️ **Line 193:** Column 'tenantId' not found in table 'supplies'

```
sql`${supplies.productCode} = ${product.productCode} AND ${supplies.tenantId} = ${DEFAULT_TENANT_ID}`,
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

### `server\seed-signature-data.ts`

⚠️ **Line 15:** Column 'findMany' not found in table 'tenants'

```
const tenants = await db.query.tenants.findMany({ limit: 1 });
```

💡 **Suggestion:** Column not found in table 'tenants'

---

### `server\seed-sales-workflow-automation.ts`

⚠️ **Line 24:** Column 'findMany' not found in table 'tenants'

```
const tenants = await db.query.tenants.findMany({ limit: 1 });
```

💡 **Suggestion:** Column not found in table 'tenants'

---

### `server\seed-sales-metrics.ts`

⚠️ **Line 24:** Column 'tenantId' not found in table 'users'

```
const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenant.id)).limit(5);
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

### `server\seed-field-service-data.ts`

⚠️ **Line 15:** Column 'findMany' not found in table 'tenants'

```
const tenants = await db.query.tenants.findMany({ limit: 1 });
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 46:** Column 'findMany' not found in table 'technicians'

```
const technicians = await db.query.technicians.findMany({
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 58:** Column 'findMany' not found in table 'users'

```
const users = await db.query.users.findMany({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 599:** Column 'jpg' not found in table 'equipment'

```
fileName: 'inst-002-old-equipment.jpg',
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 603:** Column 'jpg' not found in table 'equipment'

```
objectPath: 'public/service-photos/inst-002-old-equipment.jpg',
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 613:** Column 'jpg' not found in table 'equipment'

```
fileName: 'inst-002-new-equipment.jpg',
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 617:** Column 'jpg' not found in table 'equipment'

```
objectPath: 'public/service-photos/inst-002-new-equipment.jpg',
```

💡 **Suggestion:** Similar columns: id

---

### `server\seed-customer-success.ts`

⚠️ **Line 32:** Column 'tenantId' not found in table 'contracts'

```
.where(eq(contracts.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

### `server\seed-crm-goals.ts`

⚠️ **Line 28:** Column 'tenantId' not found in table 'users'

```
.where(eq(users.tenantId, tenant.id))
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

### `server\security-compliance.ts`

⚠️ **Line 311:** Column 'findFirst' not found in table 'users'

```
user: await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 312:** Column 'tenantId' not found in table 'users'

```
where: (users, { eq, and }) => and(eq(users.tenantId, tenantId), eq(users.id, subjectId)),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 403:** Column 'sessionId' not found in table 'sessions'

```
and(eq(sessions.sessionId, sessionId), eq(sessions.isActive, true)),
```

💡 **Suggestion:** Column not found in table 'sessions'

---

⚠️ **Line 403:** Column 'isActive' not found in table 'sessions'

```
and(eq(sessions.sessionId, sessionId), eq(sessions.isActive, true)),
```

💡 **Suggestion:** Column not found in table 'sessions'

---

### `server\routes.ts`

⚠️ **Line 888:** Column 'zipCode' not found in table 'locations'

```
zipCode: locations.zipCode,
```

💡 **Suggestion:** Similar columns: code

---

⚠️ **Line 889:** Column 'regionId' not found in table 'locations'

```
regionId: locations.regionId,
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 891:** Column 'locationManagerId' not found in table 'locations'

```
managerId: locations.locationManagerId,
```

💡 **Suggestion:** Column not found in table 'locations'

---

⚠️ **Line 892:** Column 'isActive' not found in table 'locations'

```
isActive: locations.isActive,
```

💡 **Suggestion:** Did you mean 'locations.is_active'?

---

⚠️ **Line 895:** Column 'regionId' not found in table 'locations'

```
.leftJoin(regions, eq(locations.regionId, regions.id))
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 896:** Column 'tenantId' not found in table 'locations'

```
.where(eq(locations.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'locations.tenant_id'?

---

⚠️ **Line 931:** Column 'regionId' not found in table 'locations'

```
.leftJoin(locations, eq(regions.id, locations.regionId))
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 932:** Column 'tenantId' not found in table 'regions'

```
.where(eq(regions.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'regions.tenant_id'?

---

⚠️ **Line 976:** Column 'regionId' not found in table 'locations'

```
.leftJoin(regions, eq(locations.regionId, regions.id))
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 977:** Column 'tenantId' not found in table 'locations'

```
.where(eq(locations.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'locations.tenant_id'?

---

⚠️ **Line 1011:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 1016:** Column 'totalAmount' not found in table 'invoices'

```
total: sql<number>`coalesce(sum(${invoices.totalAmount}::numeric), 0)::numeric`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 1021:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 1022:** Column 'createdAt' not found in table 'invoices'

```
sql`date_trunc('month', ${invoices.createdAt}) = date_trunc('month', current_date)`,
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 1085:** Column 'monthlyBase' not found in table 'contracts'

```
accountValue: sql<number>`coalesce(sum(${contracts.monthlyBase}::numeric), 0)::numeric`,
```

💡 **Suggestion:** Did you mean 'contracts.monthly_base'?

---

⚠️ **Line 1089:** Column 'customerId' not found in table 'contracts'

```
.leftJoin(contracts, eq(businessRecords.id, contracts.customerId))
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 1094:** Column 'monthlyBase' not found in table 'contracts'

```
.orderBy(desc(sql`coalesce(sum(${contracts.monthlyBase}::numeric), 0)`))
```

💡 **Suggestion:** Did you mean 'contracts.monthly_base'?

---

⚠️ **Line 5513:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.tenantId, tenantId), inArray(contracts.id, contractIds)));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 5645:** Column 'contractNumber' not found in table 'contracts'

```
contractNumber: contracts.contractNumber,
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 5646:** Column 'monthlyBase' not found in table 'contracts'

```
monthlyBase: contracts.monthlyBase,
```

💡 **Suggestion:** Did you mean 'contracts.monthly_base'?

---

⚠️ **Line 5647:** Column 'totalAmount' not found in table 'invoices'

```
totalRevenue: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 5648:** Column 'amountPaid' not found in table 'invoices'

```
totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}::numeric), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 5652:** Column 'contractId' not found in table 'invoices'

```
.leftJoin(invoices, eq(contracts.id, invoices.contractId))
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 5653:** Column 'tenantId' not found in table 'contracts'

```
.where(eq(contracts.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 5654:** Column 'contractNumber' not found in table 'contracts'

```
.groupBy(contracts.id, contracts.contractNumber, contracts.monthlyBase)
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 5654:** Column 'monthlyBase' not found in table 'contracts'

```
.groupBy(contracts.id, contracts.contractNumber, contracts.monthlyBase)
```

💡 **Suggestion:** Did you mean 'contracts.monthly_base'?

---

⚠️ **Line 5655:** Column 'totalAmount' not found in table 'invoices'

```
.orderBy(desc(sql`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`))
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 5663:** Column 'tenantId' not found in table 'contracts'

```
.where(eq(contracts.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 6861:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 6862:** Column 'createdAt' not found in table 'invoices'

```
createdAt: invoices.createdAt,
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 6863:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 6865:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 6870:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 6874:** Column 'createdAt' not found in table 'invoices'

```
.orderBy(desc(invoices.createdAt))
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 8368:** Column 'js' not found in table 'proposals'

```
const proposalsRouter = await import('./routes-proposals.js');
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 8372:** Column 'js' not found in table 'documents'

```
const documentsRouter = await import('./routes-documents.js');
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 9564:** Column 'totalAmount' not found in table 'invoices'

```
totalRevenue: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 9568:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 9574:** Column 'totalAmount' not found in table 'invoices'

```
.having(sql`sum(${invoices.totalAmount}) > 0`)
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 12305:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber || `SN-${equipmentId}`,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 12308:** Column 'customerId' not found in table 'equipment'

```
customerId: equipment.customerId,
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

### `server\routes-validate.ts`

⚠️ **Line 35:** Column 'businessRecordId' not found in table 'quotes'

```
businessRecordId: quotes.businessRecordId,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 37:** Column 'totalAmount' not found in table 'quotes'

```
totalAmount: quotes.totalAmount,
```

💡 **Suggestion:** Did you mean 'quotes.total_amount'?

---

⚠️ **Line 39:** Column 'validUntil' not found in table 'quotes'

```
validUntil: quotes.validUntil,
```

💡 **Suggestion:** Did you mean 'quotes.valid_until'?

---

⚠️ **Line 42:** Column 'tenantId' not found in table 'quotes'

```
.where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 143:** Column 'businessRecordId' not found in table 'proposals'

```
businessRecordId: proposals.businessRecordId,
```

💡 **Suggestion:** Did you mean 'proposals.business_record_id'?

---

⚠️ **Line 145:** Column 'proposalType' not found in table 'proposals'

```
proposalType: proposals.proposalType,
```

💡 **Suggestion:** Did you mean 'proposals.proposal_type'?

---

⚠️ **Line 146:** Column 'executiveSummary' not found in table 'proposals'

```
executiveSummary: proposals.executiveSummary,
```

💡 **Suggestion:** Did you mean 'proposals.executive_summary'?

---

⚠️ **Line 147:** Column 'solutionOverview' not found in table 'proposals'

```
solutionOverview: proposals.solutionOverview,
```

💡 **Suggestion:** Did you mean 'proposals.solution_overview'?

---

⚠️ **Line 148:** Column 'investmentSummary' not found in table 'proposals'

```
investmentSummary: proposals.investmentSummary,
```

💡 **Suggestion:** Did you mean 'proposals.investment_summary'?

---

⚠️ **Line 149:** Column 'termsAndConditions' not found in table 'proposals'

```
termsAndConditions: proposals.termsAndConditions,
```

💡 **Suggestion:** Did you mean 'proposals.terms_and_conditions'?

---

⚠️ **Line 152:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

### `server\routes-universal-search.ts`

⚠️ **Line 112:** Column 'stage' not found in table 'deals'

```
stage: deals.stage,
```

💡 **Suggestion:** Similar columns: status, stage_id

---

⚠️ **Line 114:** Column 'expectedCloseDate' not found in table 'deals'

```
expectedCloseDate: deals.expectedCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.expected_close_date'?

---

⚠️ **Line 118:** Column 'businessRecordId' not found in table 'deals'

```
.leftJoin(businessRecords, eq(deals.businessRecordId, businessRecords.id))
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 121:** Column 'tenantId' not found in table 'deals'

```
eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 216:** Column 'quoteNumber' not found in table 'quotes'

```
quoteNumber: quotes.quoteNumber,
```

💡 **Suggestion:** Did you mean 'quotes.quote_number'?

---

⚠️ **Line 218:** Column 'totalAmount' not found in table 'quotes'

```
totalAmount: quotes.totalAmount,
```

💡 **Suggestion:** Did you mean 'quotes.total_amount'?

---

⚠️ **Line 219:** Column 'validUntil' not found in table 'quotes'

```
validUntil: quotes.validUntil,
```

💡 **Suggestion:** Did you mean 'quotes.valid_until'?

---

⚠️ **Line 223:** Column 'businessRecordId' not found in table 'quotes'

```
.leftJoin(businessRecords, eq(quotes.businessRecordId, businessRecords.id))
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 226:** Column 'tenantId' not found in table 'quotes'

```
eq(quotes.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 228:** Column 'quoteNumber' not found in table 'quotes'

```
ilike(quotes.quoteNumber, searchTerm),
```

💡 **Suggestion:** Did you mean 'quotes.quote_number'?

---

### `server\routes-today-dashboard.ts`

⚠️ **Line 138:** Column 'tenantId' not found in table 'deals'

```
eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 140:** Column 'dealStage' not found in table 'deals'

```
eq(deals.dealStage, 'prospecting'),
```

💡 **Suggestion:** Similar columns: deal_type

---

⚠️ **Line 141:** Column 'dealStage' not found in table 'deals'

```
eq(deals.dealStage, 'qualification'),
```

💡 **Suggestion:** Similar columns: deal_type

---

⚠️ **Line 142:** Column 'dealStage' not found in table 'deals'

```
eq(deals.dealStage, 'proposal'),
```

💡 **Suggestion:** Similar columns: deal_type

---

⚠️ **Line 143:** Column 'dealStage' not found in table 'deals'

```
eq(deals.dealStage, 'negotiation'),
```

💡 **Suggestion:** Similar columns: deal_type

---

⚠️ **Line 179:** Column 'tenantId' not found in table 'deals'

```
eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 180:** Column 'dealStage' not found in table 'deals'

```
eq(deals.dealStage, 'closed-won'),
```

💡 **Suggestion:** Similar columns: deal_type

---

⚠️ **Line 181:** Column 'actualCloseDate' not found in table 'deals'

```
gte(deals.actualCloseDate!, weekStart),
```

💡 **Suggestion:** Did you mean 'deals.actual_close_date'?

---

⚠️ **Line 182:** Column 'actualCloseDate' not found in table 'deals'

```
lte(deals.actualCloseDate!, weekEnd),
```

💡 **Suggestion:** Did you mean 'deals.actual_close_date'?

---

⚠️ **Line 184:** Column 'actualCloseDate' not found in table 'deals'

```
orderBy: [desc(deals.actualCloseDate)],
```

💡 **Suggestion:** Did you mean 'deals.actual_close_date'?

---

⚠️ **Line 201:** Column 'tenantId' not found in table 'deals'

```
where: eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

### `server\routes-templates.ts`

⚠️ **Line 192:** Column 'tenantId' not found in table 'projects'

```
.where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'projects.tenant_id'?

---

⚠️ **Line 202:** Column 'projectId' not found in table 'tasks'

```
.where(and(eq(tasks.projectId, projectId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 202:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.projectId, projectId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

### `server\routes-technician-management.ts`

⚠️ **Line 42:** Column 'specialties' not found in table 'technicians'

```
specialties: technicians.specialties,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 45:** Column 'location' not found in table 'technicians'

```
location: technicians.location,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 46:** Column 'availability' not found in table 'technicians'

```
availability: technicians.availability,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 47:** Column 'skillLevel' not found in table 'technicians'

```
skillLevel: technicians.skillLevel,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 48:** Column 'hourlyRate' not found in table 'technicians'

```
hourlyRate: technicians.hourlyRate,
```

💡 **Suggestion:** Did you mean 'technicians.hourly_rate'?

---

⚠️ **Line 49:** Column 'emergencyContact' not found in table 'technicians'

```
emergencyContact: technicians.emergencyContact,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 50:** Column 'employeeId' not found in table 'technicians'

```
employeeId: technicians.employeeId,
```

💡 **Suggestion:** Did you mean 'technicians.employee_id'?

---

⚠️ **Line 51:** Column 'hireDate' not found in table 'technicians'

```
hireDate: technicians.hireDate,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 52:** Column 'lastTrainingDate' not found in table 'technicians'

```
lastTrainingDate: technicians.lastTrainingDate,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 53:** Column 'performanceRating' not found in table 'technicians'

```
performanceRating: technicians.performanceRating,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 54:** Column 'createdAt' not found in table 'technicians'

```
createdAt: technicians.createdAt,
```

💡 **Suggestion:** Did you mean 'technicians.created_at'?

---

⚠️ **Line 55:** Column 'updatedAt' not found in table 'technicians'

```
updatedAt: technicians.updatedAt,
```

💡 **Suggestion:** Did you mean 'technicians.updated_at'?

---

⚠️ **Line 58:** Column 'tenantId' not found in table 'technicians'

```
.where(eq(technicians.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 119:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 202:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 248:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 277:** Column 'specialties' not found in table 'technicians'

```
specialties: technicians.specialties,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 278:** Column 'location' not found in table 'technicians'

```
location: technicians.location,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 280:** Column 'availability' not found in table 'technicians'

```
availability: technicians.availability,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 283:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'active')));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 372:** Column 'tenantId' not found in table 'technicians'

```
.where(eq(technicians.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 377:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'active')));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 384:** Column 'tenantId' not found in table 'technicians'

```
eq(technicians.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 386:** Column 'availability' not found in table 'technicians'

```
eq(technicians.availability, 'available'),
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 395:** Column 'tenantId' not found in table 'technicians'

```
eq(technicians.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 397:** Column 'availability' not found in table 'technicians'

```
eq(technicians.availability, 'busy'),
```

💡 **Suggestion:** Column not found in table 'technicians'

---

### `server\routes-subscriptions.ts`

⚠️ **Line 989:** Column 'billingCycle' not found in table 'subscription'

```
const cycle = (billingCycle as string) || subscription.billingCycle;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 1000:** Column 'findFirst' not found in table 'tenants'

```
const tenant = await db.query.tenants.findFirst({
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 1012:** Column 'stripeSubscriptionId' not found in table 'subscription'

```
subscription.stripeSubscriptionId,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 1017:** Column 'planId' not found in table 'subscription'

```
currentPlan: subscription.planId,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\routes-service-dispatch.ts`

⚠️ **Line 87:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'available')));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 277:** Column 'location' not found in table 'technicians'

```
location: technicians.location,
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 282:** Column 'tenantId' not found in table 'technicians'

```
.where(eq(technicians.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 478:** Column 'tenantId' not found in table 'technicians'

```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'available')));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 545:** Column 'tenantId' not found in table 'technicians'

```
.where(eq(technicians.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

### `server\routes-root-admin.ts`

⚠️ **Line 49:** Column 'roleId' not found in table 'users'

```
roleId: users.roleId,
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 52:** Column 'canAccessAllTenants' not found in table 'roles'

```
canAccessAllTenants: roles.canAccessAllTenants,
```

💡 **Suggestion:** Did you mean 'roles.can_access_all_tenants'?

---

⚠️ **Line 55:** Column 'roleId' not found in table 'users'

```
.leftJoin(roles, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 93:** Column 'lastActivity' not found in table 'tenants'

```
.where(gte(tenants.lastActivity, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))); // Last 30 days
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 102:** Column 'lastLogin' not found in table 'users'

```
.where(gte(users.lastLogin, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // Last 7 days
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 143:** Column 'subscription' not found in table 'tenants'

```
subscription: tenants.subscription,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 144:** Column 'lastActivity' not found in table 'tenants'

```
lastActivity: tenants.lastActivity,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 145:** Column 'storageUsed' not found in table 'tenants'

```
storageUsed: tenants.storageUsed,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 146:** Column 'apiCalls' not found in table 'tenants'

```
apiCalls: tenants.apiCalls,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 147:** Column 'billingStatus' not found in table 'tenants'

```
billingStatus: tenants.billingStatus,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 151:** Column 'tenantId' not found in table 'users'

```
.leftJoin(users, eq(users.tenantId, tenants.id))
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 153:** Column 'lastActivity' not found in table 'tenants'

```
.orderBy(desc(tenants.lastActivity));
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 307:** Column 'roleId' not found in table 'users'

```
roleId: users.roleId,
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 308:** Column 'tenantId' not found in table 'users'

```
tenantId: users.tenantId,
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 310:** Column 'lastLogin' not found in table 'users'

```
lastLogin: users.lastLogin,
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 311:** Column 'createdAt' not found in table 'users'

```
createdAt: users.createdAt,
```

💡 **Suggestion:** Did you mean 'users.created_at'?

---

⚠️ **Line 314:** Column 'roleId' not found in table 'users'

```
.leftJoin(roles, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 315:** Column 'tenantId' not found in table 'users'

```
.leftJoin(tenants, eq(users.tenantId, tenants.id));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 335:** Column 'lastLogin' not found in table 'users'

```
const userList = await query.orderBy(desc(users.lastLogin)).limit(100);
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 384:** Column 'canAccessAllTenants' not found in table 'roles'

```
canAccessAllTenants: roles.canAccessAllTenants,
```

💡 **Suggestion:** Did you mean 'roles.can_access_all_tenants'?

---

⚠️ **Line 385:** Column 'createdAt' not found in table 'roles'

```
createdAt: roles.createdAt,
```

💡 **Suggestion:** Did you mean 'roles.created_at'?

---

⚠️ **Line 389:** Column 'roleId' not found in table 'users'

```
.leftJoin(users, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

### `server\routes-reports.ts`

⚠️ **Line 88:** Column 'findMany' not found in table 'deals'

```
const allDeals = await db.query.deals.findMany({
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 89:** Column 'tenantId' not found in table 'deals'

```
where: eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 141:** Column 'findMany' not found in table 'invoices'

```
const invoiceList = await db.query.invoices.findMany({
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 143:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 144:** Column 'invoiceDate' not found in table 'invoices'

```
gte(invoices.invoiceDate, fromDate),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 145:** Column 'invoiceDate' not found in table 'invoices'

```
lte(invoices.invoiceDate, toDate),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 180:** Column 'findMany' not found in table 'customers'

```
const allCustomers = await db.query.customers.findMany({
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 181:** Column 'tenantId' not found in table 'customers'

```
where: and(eq(customers.tenantId, tenantId), eq(customers.recordType, 'customer')),
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 181:** Column 'recordType' not found in table 'customers'

```
where: and(eq(customers.tenantId, tenantId), eq(customers.recordType, 'customer')),
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 197:** Column 'findMany' not found in table 'invoices'

```
const customerInvoices = await db.query.invoices.findMany({
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 198:** Column 'tenantId' not found in table 'invoices'

```
where: and(eq(invoices.tenantId, tenantId), gte(invoices.invoiceDate, ninetyDaysAgo)),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 198:** Column 'invoiceDate' not found in table 'invoices'

```
where: and(eq(invoices.tenantId, tenantId), gte(invoices.invoiceDate, ninetyDaysAgo)),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 202:** Column 'findMany' not found in table 'contracts'

```
const activeContracts = await db.query.contracts.findMany({
```

💡 **Suggestion:** Column not found in table 'contracts'

---

⚠️ **Line 203:** Column 'tenantId' not found in table 'contracts'

```
where: and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 399:** Column 'findMany' not found in table 'technicians'

```
const techList = await db.query.technicians.findMany({
```

💡 **Suggestion:** Column not found in table 'technicians'

---

⚠️ **Line 400:** Column 'tenantId' not found in table 'technicians'

```
where: eq(technicians.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

### `server\routes-proposals.ts`

⚠️ **Line 192:** Column 'proposalNumber' not found in table 'proposals'

```
proposalNumber: proposals.proposalNumber,
```

💡 **Suggestion:** Did you mean 'proposals.proposal_number'?

---

⚠️ **Line 195:** Column 'businessRecordId' not found in table 'proposals'

```
businessRecordId: proposals.businessRecordId,
```

💡 **Suggestion:** Did you mean 'proposals.business_record_id'?

---

⚠️ **Line 196:** Column 'proposalType' not found in table 'proposals'

```
proposalType: proposals.proposalType,
```

💡 **Suggestion:** Did you mean 'proposals.proposal_type'?

---

⚠️ **Line 198:** Column 'totalAmount' not found in table 'proposals'

```
totalAmount: proposals.totalAmount,
```

💡 **Suggestion:** Did you mean 'proposals.total_amount'?

---

⚠️ **Line 199:** Column 'validUntil' not found in table 'proposals'

```
validUntil: proposals.validUntil,
```

💡 **Suggestion:** Did you mean 'proposals.valid_until'?

---

⚠️ **Line 200:** Column 'sentAt' not found in table 'proposals'

```
sentAt: proposals.sentAt,
```

💡 **Suggestion:** Did you mean 'proposals.sent_at'?

---

⚠️ **Line 201:** Column 'viewedAt' not found in table 'proposals'

```
viewedAt: proposals.viewedAt,
```

💡 **Suggestion:** Did you mean 'proposals.viewed_at'?

---

⚠️ **Line 202:** Column 'acceptedAt' not found in table 'proposals'

```
acceptedAt: proposals.acceptedAt,
```

💡 **Suggestion:** Did you mean 'proposals.accepted_at'?

---

⚠️ **Line 203:** Column 'createdBy' not found in table 'proposals'

```
createdBy: proposals.createdBy,
```

💡 **Suggestion:** Did you mean 'proposals.created_by'?

---

⚠️ **Line 204:** Column 'assignedTo' not found in table 'proposals'

```
assignedTo: proposals.assignedTo,
```

💡 **Suggestion:** Did you mean 'proposals.assigned_to'?

---

⚠️ **Line 205:** Column 'createdAt' not found in table 'proposals'

```
createdAt: proposals.createdAt,
```

💡 **Suggestion:** Did you mean 'proposals.created_at'?

---

⚠️ **Line 211:** Column 'businessRecordId' not found in table 'proposals'

```
.leftJoin(businessRecords, eq(proposals.businessRecordId, businessRecords.id));
```

💡 **Suggestion:** Did you mean 'proposals.business_record_id'?

---

⚠️ **Line 213:** Column 'tenantId' not found in table 'proposals'

```
const conditions: any[] = [eq(proposals.tenantId, req.user.tenantId)];
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 220:** Column 'businessRecordId' not found in table 'proposals'

```
conditions.push(eq(proposals.businessRecordId, businessRecordId as string));
```

💡 **Suggestion:** Did you mean 'proposals.business_record_id'?

---

⚠️ **Line 227:** Column 'createdAt' not found in table 'proposals'

```
conditions.push(sql`${proposals.createdAt} < NOW() - INTERVAL '${n} days'`);
```

💡 **Suggestion:** Did you mean 'proposals.created_at'?

---

⚠️ **Line 233:** Column 'createdAt' not found in table 'proposals'

```
const result = await query.orderBy(desc(proposals.createdAt));
```

💡 **Suggestion:** Did you mean 'proposals.created_at'?

---

⚠️ **Line 289:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 418:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 484:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 528:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 581:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 758:** Column 'openCount' not found in table 'proposals'

```
openCount: sql`${proposals.openCount} + 1`,
```

💡 **Suggestion:** Did you mean 'proposals.open_count'?

---

⚠️ **Line 791:** Column 'proposalNumber' not found in table 'proposals'

```
.select({ proposalNumber: proposals.proposalNumber })
```

💡 **Suggestion:** Did you mean 'proposals.proposal_number'?

---

⚠️ **Line 794:** Column 'tenantId' not found in table 'proposals'

```
and(eq(proposals.tenantId, tenantId), sql`${proposals.proposalNumber} LIKE ${prefix + '%'}`),
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 794:** Column 'proposalNumber' not found in table 'proposals'

```
and(eq(proposals.tenantId, tenantId), sql`${proposals.proposalNumber} LIKE ${prefix + '%'}`),
```

💡 **Suggestion:** Did you mean 'proposals.proposal_number'?

---

⚠️ **Line 796:** Column 'proposalNumber' not found in table 'proposals'

```
.orderBy(desc(proposals.proposalNumber))
```

💡 **Suggestion:** Did you mean 'proposals.proposal_number'?

---

⚠️ **Line 822:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 908:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), eq(deals.title, title)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 934:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, existing[0].id), eq(deals.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 966:** Column 'contractNumber' not found in table 'contracts'

```
.select({ contractNumber: contracts.contractNumber })
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 969:** Column 'tenantId' not found in table 'contracts'

```
and(eq(contracts.tenantId, tenantId), sql`${contracts.contractNumber} LIKE ${prefix + '%'}`),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 969:** Column 'contractNumber' not found in table 'contracts'

```
and(eq(contracts.tenantId, tenantId), sql`${contracts.contractNumber} LIKE ${prefix + '%'}`),
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 971:** Column 'contractNumber' not found in table 'contracts'

```
.orderBy(desc(contracts.contractNumber))
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 1026:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

### `server\routes-product-pricing.ts`

⚠️ **Line 407:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 408:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 526:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 527:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 711:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 712:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

### `server\routes-proactive-maintenance.ts`

⚠️ **Line 32:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 33:** Column 'make' not found in table 'equipment'

```
make: equipment.make,
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 35:** Column 'customerId' not found in table 'equipment'

```
customerId: equipment.customerId,
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 38:** Column 'currentMeterReading' not found in table 'equipment'

```
meterReading: equipment.currentMeterReading,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 39:** Column 'lastServiceDate' not found in table 'equipment'

```
lastServiceDate: equipment.lastServiceDate,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 40:** Column 'nextServiceDue' not found in table 'equipment'

```
nextServiceDue: equipment.nextServiceDue,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 41:** Column 'installDate' not found in table 'equipment'

```
installDate: equipment.installDate,
```

💡 **Suggestion:** Did you mean 'equipment.install_date'?

---

⚠️ **Line 45:** Column 'customerId' not found in table 'equipment'

```
.leftJoin(businessRecords, eq(equipment.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 46:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')))
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 47:** Column 'nextServiceDue' not found in table 'equipment'

```
.orderBy(equipment.nextServiceDue);
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 190:** Column 'customerId' not found in table 'equipment'

```
customerId: equipment.customerId,
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 191:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 192:** Column 'make' not found in table 'equipment'

```
make: equipment.make,
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 197:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

### `server\routes-predictive-service-dispatch.ts`

⚠️ **Line 277:** Column 'findFirst' not found in table 'equipment'

```
const device = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 278:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.id, service.equipmentId), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 333:** Column 'findFirst' not found in table 'equipment'

```
const device = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 334:** Column 'serialNumber' not found in table 'equipment'

```
where: and(eq(equipment.serialNumber, serialNumber), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 334:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.serialNumber, serialNumber), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

### `server\routes-predictive-maintenance-hub.ts`

⚠️ **Line 46:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 47:** Column 'make' not found in table 'equipment'

```
make: equipment.make,
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 49:** Column 'customerId' not found in table 'equipment'

```
customerId: equipment.customerId,
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 52:** Column 'currentMeterReading' not found in table 'equipment'

```
meterReading: equipment.currentMeterReading,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 53:** Column 'lastServiceDate' not found in table 'equipment'

```
lastServiceDate: equipment.lastServiceDate,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 54:** Column 'nextServiceDue' not found in table 'equipment'

```
nextServiceDue: equipment.nextServiceDue,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 55:** Column 'installDate' not found in table 'equipment'

```
installDate: equipment.installDate,
```

💡 **Suggestion:** Did you mean 'equipment.install_date'?

---

⚠️ **Line 59:** Column 'customerId' not found in table 'equipment'

```
.leftJoin(businessRecords, eq(equipment.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 60:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')))
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 61:** Column 'nextServiceDue' not found in table 'equipment'

```
.orderBy(equipment.nextServiceDue);
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 259:** Column 'customerId' not found in table 'equipment'

```
customerId: equipment.customerId,
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 260:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 261:** Column 'make' not found in table 'equipment'

```
make: equipment.make,
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 266:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 425:** Column 'serialNumber' not found in table 'equipment'

```
.select({ serialNumber: equipment.serialNumber })
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 427:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 499:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 500:** Column 'make' not found in table 'equipment'

```
make: equipment.make,
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 504:** Column 'tenantId' not found in table 'equipment'

```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

### `server\routes-pipeline-configuration.ts`

⚠️ **Line 279:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.pipelineTemplateId, id)));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 279:** Column 'pipelineTemplateId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.pipelineTemplateId, id)));
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 530:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.currentStageId, id)));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 530:** Column 'currentStageId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.currentStageId, id)));
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 573:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, user.tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

### `server\routes-pagination.ts`

⚠️ **Line 217:** Column 'tenantId' not found in table 'invoices'

```
const conditions = [eq(invoices.tenantId, tenantId)];
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 222:** Column 'invoiceNumber' not found in table 'invoices'

```
ilike(invoices.invoiceNumber, `%${search}%`),
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 232:** Column 'customerId' not found in table 'invoices'

```
conditions.push(eq(invoices.customerId, req.query.customerId as string));
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 246:** Column 'createdAt' not found in table 'invoices'

```
.orderBy(sortDirection(invoices[sortBy as keyof typeof invoices] || invoices.createdAt))
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

### `server\routes-opportunities.ts`

⚠️ **Line 45:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 89:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 114:** Column 'customerId' not found in table 'quotes'

```
.where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'quotes.customer_id'?

---

⚠️ **Line 114:** Column 'tenantId' not found in table 'quotes'

```
.where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 115:** Column 'createdAt' not found in table 'quotes'

```
.orderBy(desc(quotes.createdAt));
```

💡 **Suggestion:** Did you mean 'quotes.created_at'?

---

⚠️ **Line 121:** Column 'customerId' not found in table 'deals'

```
.where(and(eq(deals.customerId, opportunityId), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 121:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.customerId, opportunityId), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 122:** Column 'createdAt' not found in table 'deals'

```
.orderBy(desc(deals.createdAt));
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

### `server\routes-onboarding.ts`

⚠️ **Line 461:** Column 'tenantId' not found in table 'quotes'

```
let query = db.select().from(quotes).where(eq(quotes.tenantId, tenantId)).limit(Number(limit));
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 466:** Column 'tenantId' not found in table 'quotes'

```
eq(quotes.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 467:** Column 'leadId' not found in table 'quotes'

```
or(eq(quotes.leadId, businessRecordId), eq(quotes.customerId, businessRecordId)),
```

💡 **Suggestion:** Did you mean 'quotes.lead_id'?

---

⚠️ **Line 467:** Column 'customerId' not found in table 'quotes'

```
or(eq(quotes.leadId, businessRecordId), eq(quotes.customerId, businessRecordId)),
```

💡 **Suggestion:** Did you mean 'quotes.customer_id'?

---

⚠️ **Line 475:** Column 'tenantId' not found in table 'quotes'

```
eq(quotes.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 477:** Column 'quoteNumber' not found in table 'quotes'

```
ilike(quotes.quoteNumber, `%${search}%`),
```

💡 **Suggestion:** Did you mean 'quotes.quote_number'?

---

### `server\routes-modular-dashboard.ts`

⚠️ **Line 104:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 107:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 126:** Column 'tenantId' not found in table 'deals'

```
.where(eq(deals.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 180:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 183:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 272:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 275:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 306:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 309:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 312:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\routes-modular-dashboard-broken.ts`

⚠️ **Line 26:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 28:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`)),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 31:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 33:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${previousMonth}`)),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 41:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), ...(userId ? [eq(deals.ownerId, userId)] : []))),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 41:** Column 'ownerId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), ...(userId ? [eq(deals.ownerId, userId)] : []))),
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 65:** Column 'tenantId' not found in table 'deals'

```
eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 67:** Column 'ownerId' not found in table 'deals'

```
...(userId ? [eq(deals.ownerId, userId)] : []),
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 76:** Column 'tenantId' not found in table 'deals'

```
eq(deals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 78:** Column 'ownerId' not found in table 'deals'

```
...(userId ? [eq(deals.ownerId, userId)] : []),
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 96:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 98:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 262:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 265:** Column 'totalAmount' not found in table 'invoices'

```
.select({ total: sum(invoices.totalAmount) })
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 268:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\routes-mobile-technician.ts`

⚠️ **Line 64:** Column 'findMany' not found in table 'equipment'

```
const equipmentList = await db.query.equipment.findMany({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 65:** Column 'tenantId' not found in table 'equipment'

```
where: eq(equipment.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 76:** Column 'findFirst' not found in table 'users'

```
const technician = await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 77:** Column 'tenantId' not found in table 'users'

```
where: and(eq(users.id, technicianId), eq(users.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 432:** Column 'findFirst' not found in table 'equipment'

```
const equipmentItem = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 433:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 475:** Column 'findFirst' not found in table 'equipment'

```
const equipmentItem = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 477:** Column 'tenantId' not found in table 'equipment'

```
eq(equipment.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 480:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber ? eq(equipment.serialNumber, serialNumber) : undefined,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

### `server\routes-equipment-qr.ts`

⚠️ **Line 22:** Column 'findFirst' not found in table 'equipment'

```
const equipmentItem = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 23:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 56:** Column 'findFirst' not found in table 'equipment'

```
const equipmentItem = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 57:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 187:** Column 'findMany' not found in table 'equipment'

```
const equipmentItems = await db.query.equipment.findMany({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 189:** Column 'tenantId' not found in table 'equipment'

```
eq(equipment.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

### `server\routes-equipment-lifecycle-state-machine.ts`

⚠️ **Line 191:** Column 'currentStage' not found in table 'equipment'

```
const currentStage = equipment.currentStage;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 275:** Column 'currentStage' not found in table 'equipment'

```
const currentStage = equipment.currentStage;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\routes-equipment-disposal.ts`

⚠️ **Line 115:** Column 'currentStage' not found in table 'equipment'

```
if (equipment.currentStage !== 'retired') {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 119:** Column 'currentStage' not found in table 'equipment'

```
currentStage: equipment.currentStage,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\routes-enhanced-tasks.ts`

⚠️ **Line 31:** Column 'assignedTo' not found in table 'tasks'

```
assignedTo: tasks.assignedTo,
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 32:** Column 'projectId' not found in table 'tasks'

```
projectId: tasks.projectId,
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 33:** Column 'parentTaskId' not found in table 'tasks'

```
parentTaskId: tasks.parentTaskId,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 34:** Column 'dueDate' not found in table 'tasks'

```
dueDate: tasks.dueDate,
```

💡 **Suggestion:** Did you mean 'tasks.due_date'?

---

⚠️ **Line 35:** Column 'startDate' not found in table 'tasks'

```
startDate: tasks.startDate,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 36:** Column 'estimatedHours' not found in table 'tasks'

```
estimatedHours: tasks.estimatedHours,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 37:** Column 'actualHours' not found in table 'tasks'

```
actualHours: tasks.actualHours,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 38:** Column 'completionPercentage' not found in table 'tasks'

```
completionPercentage: tasks.completionPercentage,
```

💡 **Suggestion:** Did you mean 'tasks.completion_percentage'?

---

⚠️ **Line 39:** Column 'dependencies' not found in table 'tasks'

```
dependencies: tasks.dependencies,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 40:** Column 'watchers' not found in table 'tasks'

```
watchers: tasks.watchers,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 41:** Column 'timeTracked' not found in table 'tasks'

```
timeTracked: tasks.timeTracked,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 42:** Column 'commentCount' not found in table 'tasks'

```
commentCount: tasks.commentCount,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 43:** Column 'attachmentCount' not found in table 'tasks'

```
attachmentCount: tasks.attachmentCount,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 45:** Column 'customFields' not found in table 'tasks'

```
customFields: tasks.customFields,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 46:** Column 'createdBy' not found in table 'tasks'

```
createdBy: tasks.createdBy,
```

💡 **Suggestion:** Did you mean 'tasks.created_by'?

---

⚠️ **Line 47:** Column 'createdAt' not found in table 'tasks'

```
createdAt: tasks.createdAt,
```

💡 **Suggestion:** Did you mean 'tasks.created_at'?

---

⚠️ **Line 48:** Column 'updatedAt' not found in table 'tasks'

```
updatedAt: tasks.updatedAt,
```

💡 **Suggestion:** Did you mean 'tasks.updated_at'?

---

⚠️ **Line 49:** Column 'completedAt' not found in table 'tasks'

```
completedAt: tasks.completedAt,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 52:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 53:** Column 'profileImageUrl' not found in table 'users'

```
assignedToAvatar: users.profileImageUrl,
```

💡 **Suggestion:** Did you mean 'users.profile_image_url'?

---

⚠️ **Line 62:** Column 'assignedTo' not found in table 'tasks'

```
.leftJoin(users, eq(tasks.assignedTo, users.id))
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 63:** Column 'projectId' not found in table 'tasks'

```
.leftJoin(projects, eq(tasks.projectId, projects.id))
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 64:** Column 'createdBy' not found in table 'tasks'

```
.leftJoin(sql`${users} as creator`, eq(tasks.createdBy, sql`creator.id`))
```

💡 **Suggestion:** Did you mean 'tasks.created_by'?

---

⚠️ **Line 65:** Column 'tenantId' not found in table 'tasks'

```
.where(eq(tasks.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 69:** Column 'projectId' not found in table 'tasks'

```
query = query.where(eq(tasks.projectId, projectId as string));
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 72:** Column 'assignedTo' not found in table 'tasks'

```
query = query.where(eq(tasks.assignedTo, assignedTo as string));
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 81:** Column 'updatedAt' not found in table 'tasks'

```
const allTasks = await query.orderBy(desc(tasks.updatedAt));
```

💡 **Suggestion:** Did you mean 'tasks.updated_at'?

---

⚠️ **Line 122:** Column 'projectManager' not found in table 'projects'

```
projectManager: projects.projectManager,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 123:** Column 'customerId' not found in table 'projects'

```
customerId: projects.customerId,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 124:** Column 'startDate' not found in table 'projects'

```
startDate: projects.startDate,
```

💡 **Suggestion:** Did you mean 'projects.start_date'?

---

⚠️ **Line 125:** Column 'endDate' not found in table 'projects'

```
endDate: projects.endDate,
```

💡 **Suggestion:** Did you mean 'projects.end_date'?

---

⚠️ **Line 126:** Column 'estimatedBudget' not found in table 'projects'

```
estimatedBudget: projects.estimatedBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 127:** Column 'actualBudget' not found in table 'projects'

```
actualBudget: projects.actualBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 128:** Column 'completionPercentage' not found in table 'projects'

```
completionPercentage: projects.completionPercentage,
```

💡 **Suggestion:** Did you mean 'projects.completion_percentage'?

---

⚠️ **Line 129:** Column 'color' not found in table 'projects'

```
color: projects.color,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 130:** Column 'template' not found in table 'projects'

```
template: projects.template,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 131:** Column 'workflow' not found in table 'projects'

```
workflow: projects.workflow,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 132:** Column 'tags' not found in table 'projects'

```
tags: projects.tags,
```

💡 **Suggestion:** Similar columns: name, status

---

⚠️ **Line 133:** Column 'createdAt' not found in table 'projects'

```
createdAt: projects.createdAt,
```

💡 **Suggestion:** Did you mean 'projects.created_at'?

---

⚠️ **Line 143:** Column 'projectManager' not found in table 'projects'

```
.leftJoin(sql`${users} as pm`, eq(projects.projectManager, sql`pm.id`))
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 145:** Column 'tenantId' not found in table 'projects'

```
.where(eq(projects.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'projects.tenant_id'?

---

⚠️ **Line 151:** Column 'projectManager' not found in table 'projects'

```
projects.projectManager,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 152:** Column 'customerId' not found in table 'projects'

```
projects.customerId,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 153:** Column 'startDate' not found in table 'projects'

```
projects.startDate,
```

💡 **Suggestion:** Did you mean 'projects.start_date'?

---

⚠️ **Line 154:** Column 'endDate' not found in table 'projects'

```
projects.endDate,
```

💡 **Suggestion:** Did you mean 'projects.end_date'?

---

⚠️ **Line 155:** Column 'estimatedBudget' not found in table 'projects'

```
projects.estimatedBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 156:** Column 'actualBudget' not found in table 'projects'

```
projects.actualBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 157:** Column 'completionPercentage' not found in table 'projects'

```
projects.completionPercentage,
```

💡 **Suggestion:** Did you mean 'projects.completion_percentage'?

---

⚠️ **Line 158:** Column 'color' not found in table 'projects'

```
projects.color,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 159:** Column 'template' not found in table 'projects'

```
projects.template,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 160:** Column 'workflow' not found in table 'projects'

```
projects.workflow,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 161:** Column 'tags' not found in table 'projects'

```
projects.tags,
```

💡 **Suggestion:** Similar columns: name, status

---

⚠️ **Line 162:** Column 'createdAt' not found in table 'projects'

```
projects.createdAt,
```

💡 **Suggestion:** Did you mean 'projects.created_at'?

---

⚠️ **Line 166:** Column 'updatedAt' not found in table 'projects'

```
.orderBy(desc(projects.updatedAt));
```

💡 **Suggestion:** Did you mean 'projects.updated_at'?

---

⚠️ **Line 183:** Column 'firstName' not found in table 'users'

```
name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 183:** Column 'lastName' not found in table 'users'

```
name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 185:** Column 'profileImageUrl' not found in table 'users'

```
avatar: users.profileImageUrl,
```

💡 **Suggestion:** Did you mean 'users.profile_image_url'?

---

⚠️ **Line 186:** Column 'role' not found in table 'users'

```
role: users.role,
```

💡 **Suggestion:** Similar columns: role_id

---

⚠️ **Line 189:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 189:** Column 'isActive' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 190:** Column 'firstName' not found in table 'users'

```
.orderBy(users.firstName, users.lastName);
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 190:** Column 'lastName' not found in table 'users'

```
.orderBy(users.firstName, users.lastName);
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 252:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 292:** Column 'commentCount' not found in table 'tasks'

```
commentCount: sql`${tasks.commentCount} + 1`,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 295:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 327:** Column 'timeTracked' not found in table 'tasks'

```
timeTracked: sql`${tasks.timeTracked} + ${req.body.minutes}`,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 330:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 357:** Column 'tenantId' not found in table 'tasks'

```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 375:** Column 'parentTaskId' not found in table 'tasks'

```
.select({ parentTaskId: tasks.parentTaskId })
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 377:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 386:** Column 'parentTaskId' not found in table 'tasks'

```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 386:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 389:** Column 'tenantId' not found in table 'tasks'

```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 409:** Column 'completionPercentage' not found in table 'tasks'

```
completionPercentage: tasks.completionPercentage,
```

💡 **Suggestion:** Did you mean 'tasks.completion_percentage'?

---

⚠️ **Line 413:** Column 'parentTaskId' not found in table 'tasks'

```
.where(eq(tasks.parentTaskId, parentTaskId));
```

💡 **Suggestion:** Column not found in table 'tasks'

---

### `server\routes-enhanced-service.ts`

⚠️ **Line 685:** Column 'phone' not found in table 'customers'

```
phone: customers.phone,
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 686:** Column 'email' not found in table 'customers'

```
email: customers.email,
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 687:** Column 'address' not found in table 'customers'

```
address: customers.address,
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 692:** Column 'tenantId' not found in table 'customers'

```
eq(customers.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 695:** Column 'phone' not found in table 'customers'

```
LOWER(${customers.phone}) LIKE LOWER(${'%' + searchTerm + '%'}) OR
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 696:** Column 'email' not found in table 'customers'

```
LOWER(${customers.email}) LIKE LOWER(${'%' + searchTerm + '%'})
```

💡 **Suggestion:** Column not found in table 'customers'

---

### `server\routes-dod-enforcement.ts`

⚠️ **Line 25:** Column 'customerId' not found in table 'quotes'

```
customerId: quotes.customerId,
```

💡 **Suggestion:** Did you mean 'quotes.customer_id'?

---

⚠️ **Line 26:** Column 'totalAmount' not found in table 'quotes'

```
totalAmount: quotes.totalAmount,
```

💡 **Suggestion:** Did you mean 'quotes.total_amount'?

---

⚠️ **Line 28:** Column 'lineItems' not found in table 'quotes'

```
lineItems: quotes.lineItems,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 31:** Column 'tenantId' not found in table 'quotes'

```
.where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)))
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 104:** Column 'sections' not found in table 'proposals'

```
sections: proposals.sections,
```

💡 **Suggestion:** Column not found in table 'proposals'

---

⚠️ **Line 105:** Column 'branding' not found in table 'proposals'

```
branding: proposals.branding,
```

💡 **Suggestion:** Column not found in table 'proposals'

---

⚠️ **Line 108:** Column 'tenantId' not found in table 'proposals'

```
.where(and(eq(proposals.tenantId, tenantId), eq(proposals.id, proposalId)))
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

### `server\routes-documents.ts`

⚠️ **Line 34:** Column 'tenantId' not found in table 'documents'

```
.where(eq(documents.tenantId, req.tenantId))
```

💡 **Suggestion:** Did you mean 'documents.tenant_id'?

---

⚠️ **Line 35:** Column 'createdAt' not found in table 'documents'

```
.orderBy(documents.createdAt);
```

💡 **Suggestion:** Did you mean 'documents.created_at'?

---

⚠️ **Line 73:** Column 'tenantId' not found in table 'documents'

```
.where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.tenantId)));
```

💡 **Suggestion:** Did you mean 'documents.tenant_id'?

---

⚠️ **Line 92:** Column 'tenantId' not found in table 'documents'

```
.where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.tenantId)));
```

💡 **Suggestion:** Did you mean 'documents.tenant_id'?

---

### `server\routes-deals-management.ts`

⚠️ **Line 60:** Column 'tenantId' not found in table 'deals'

```
? and(eq(deals.tenantId, tenantId), scopeFilter)
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 61:** Column 'tenantId' not found in table 'deals'

```
: eq(deals.tenantId, tenantId);
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 70:** Column 'stage' not found in table 'deals'

```
stage: deals.stage,
```

💡 **Suggestion:** Similar columns: status, stage_id

---

⚠️ **Line 72:** Column 'expectedCloseDate' not found in table 'deals'

```
expectedCloseDate: deals.expectedCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.expected_close_date'?

---

⚠️ **Line 73:** Column 'actualCloseDate' not found in table 'deals'

```
actualCloseDate: deals.actualCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.actual_close_date'?

---

⚠️ **Line 74:** Column 'assignedToId' not found in table 'deals'

```
assignedToId: deals.assignedToId,
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 76:** Column 'customerId' not found in table 'deals'

```
customerId: deals.customerId,
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 77:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 78:** Column 'createdAt' not found in table 'deals'

```
createdAt: deals.createdAt,
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 79:** Column 'updatedAt' not found in table 'deals'

```
updatedAt: deals.updatedAt,
```

💡 **Suggestion:** Did you mean 'deals.updated_at'?

---

⚠️ **Line 82:** Column 'customerId' not found in table 'deals'

```
.leftJoin(businessRecords, eq(deals.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 83:** Column 'assignedToId' not found in table 'deals'

```
.leftJoin(users, eq(deals.assignedToId, users.id))
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 85:** Column 'createdAt' not found in table 'deals'

```
.orderBy(desc(deals.createdAt));
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 108:** Column 'stage' not found in table 'deals'

```
stage: deals.stage,
```

💡 **Suggestion:** Similar columns: status, stage_id

---

⚠️ **Line 110:** Column 'expectedCloseDate' not found in table 'deals'

```
expectedCloseDate: deals.expectedCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.expected_close_date'?

---

⚠️ **Line 111:** Column 'actualCloseDate' not found in table 'deals'

```
actualCloseDate: deals.actualCloseDate,
```

💡 **Suggestion:** Did you mean 'deals.actual_close_date'?

---

⚠️ **Line 112:** Column 'assignedToId' not found in table 'deals'

```
assignedToId: deals.assignedToId,
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 114:** Column 'customerId' not found in table 'deals'

```
customerId: deals.customerId,
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 115:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 116:** Column 'createdAt' not found in table 'deals'

```
createdAt: deals.createdAt,
```

💡 **Suggestion:** Did you mean 'deals.created_at'?

---

⚠️ **Line 117:** Column 'updatedAt' not found in table 'deals'

```
updatedAt: deals.updatedAt,
```

💡 **Suggestion:** Did you mean 'deals.updated_at'?

---

⚠️ **Line 120:** Column 'customerId' not found in table 'deals'

```
.leftJoin(businessRecords, eq(deals.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 121:** Column 'assignedToId' not found in table 'deals'

```
.leftJoin(users, eq(deals.assignedToId, users.id))
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 122:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 195:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 226:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 292:** Column 'firstName' not found in table 'users'

```
createdByName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 339:** Column 'tenantId' not found in table 'deals'

```
.where(eq(deals.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 344:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'active')));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 352:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'won')));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 357:** Column 'tenantId' not found in table 'deals'

```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'lost')));
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

### `server\routes-crm-goals.ts`

⚠️ **Line 73:** Column 'firstName' not found in table 'users'

```
userName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 74:** Column 'lastName' not found in table 'users'

```
userLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 120:** Column 'firstName' not found in table 'users'

```
managerName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 121:** Column 'lastName' not found in table 'users'

```
managerLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 131:** Column 'firstName' not found in table 'users'

```
.groupBy(salesTeams.id, users.firstName, users.lastName)
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 131:** Column 'lastName' not found in table 'users'

```
.groupBy(salesTeams.id, users.firstName, users.lastName)
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 167:** Column 'firstName' not found in table 'users'

```
userName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 168:** Column 'lastName' not found in table 'users'

```
userLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 179:** Column 'firstName' not found in table 'users'

```
.orderBy(asc(users.firstName));
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 233:** Column 'firstName' not found in table 'users'

```
userName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 234:** Column 'lastName' not found in table 'users'

```
userLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 282:** Column 'firstName' not found in table 'users'

```
assignedUserName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 283:** Column 'lastName' not found in table 'users'

```
assignedUserLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 824:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 825:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

### `server\routes-contract-alerts.ts`

⚠️ **Line 84:** Column 'contractNumber' not found in table 'contracts'

```
contractNumber: contracts.contractNumber,
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 85:** Column 'customerId' not found in table 'contracts'

```
customerId: contracts.customerId,
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 87:** Column 'startDate' not found in table 'contracts'

```
startDate: contracts.startDate,
```

💡 **Suggestion:** Did you mean 'contracts.start_date'?

---

⚠️ **Line 88:** Column 'endDate' not found in table 'contracts'

```
endDate: contracts.endDate,
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 89:** Column 'endDate' not found in table 'contracts'

```
daysUntilExpiration: sql`DATE_PART('day', ${contracts.endDate}::timestamp - NOW())`.as(
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 94:** Column 'contractType' not found in table 'contracts'

```
contractType: contracts.contractType,
```

💡 **Suggestion:** Column not found in table 'contracts'

---

⚠️ **Line 98:** Column 'customerId' not found in table 'contracts'

```
.leftJoin(businessRecords, eq(contracts.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 101:** Column 'tenantId' not found in table 'contracts'

```
eq(contracts.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 103:** Column 'endDate' not found in table 'contracts'

```
lte(contracts.endDate, sql`NOW() + INTERVAL '${sql.raw(String(daysAhead))} days'`),
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 104:** Column 'endDate' not found in table 'contracts'

```
gte(contracts.endDate, sql`NOW()`),
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 107:** Column 'endDate' not found in table 'contracts'

```
.orderBy(asc(contracts.endDate));
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 227:** Column 'contractNumber' not found in table 'contracts'

```
contractNumber: contracts.contractNumber,
```

💡 **Suggestion:** Did you mean 'contracts.contract_number'?

---

⚠️ **Line 228:** Column 'customerId' not found in table 'contracts'

```
customerId: contracts.customerId,
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 232:** Column 'startDate' not found in table 'contracts'

```
startDate: contracts.startDate,
```

💡 **Suggestion:** Did you mean 'contracts.start_date'?

---

⚠️ **Line 233:** Column 'endDate' not found in table 'contracts'

```
endDate: contracts.endDate,
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 234:** Column 'endDate' not found in table 'contracts'

```
daysUntilExpiration: sql`DATE_PART('day', ${contracts.endDate}::timestamp - NOW())`.as(
```

💡 **Suggestion:** Did you mean 'contracts.end_date'?

---

⚠️ **Line 237:** Column 'contractType' not found in table 'contracts'

```
contractType: contracts.contractType,
```

💡 **Suggestion:** Column not found in table 'contracts'

---

⚠️ **Line 241:** Column 'customerId' not found in table 'contracts'

```
.leftJoin(businessRecords, eq(contracts.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 242:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

### `server\routes-client-monitoring.ts`

⚠️ **Line 140:** Column 'productCode' not found in table 'supplies'

```
or(like(supplies.productCode, pattern), like(supplies.productName, pattern)),
```

💡 **Suggestion:** Did you mean 'supplies.product_code'?

---

⚠️ **Line 140:** Column 'productName' not found in table 'supplies'

```
or(like(supplies.productCode, pattern), like(supplies.productName, pattern)),
```

💡 **Suggestion:** Did you mean 'supplies.product_name'?

---

⚠️ **Line 146:** Column 'tenantId' not found in table 'supplies'

```
.where(and(eq(supplies.tenantId, tenantId), eq(supplies.isActive, true), or(...conditions)))
```

💡 **Suggestion:** Did you mean 'supplies.tenant_id'?

---

⚠️ **Line 146:** Column 'isActive' not found in table 'supplies'

```
.where(and(eq(supplies.tenantId, tenantId), eq(supplies.isActive, true), or(...conditions)))
```

💡 **Suggestion:** Did you mean 'supplies.is_active'?

---

### `server\routes-clickup-tasks.ts`

⚠️ **Line 25:** Column 'assignedTo' not found in table 'tasks'

```
assignedTo: tasks.assignedTo,
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 26:** Column 'projectId' not found in table 'tasks'

```
projectId: tasks.projectId,
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 27:** Column 'parentTaskId' not found in table 'tasks'

```
parentTaskId: tasks.parentTaskId,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 28:** Column 'dueDate' not found in table 'tasks'

```
dueDate: tasks.dueDate,
```

💡 **Suggestion:** Did you mean 'tasks.due_date'?

---

⚠️ **Line 29:** Column 'startDate' not found in table 'tasks'

```
startDate: tasks.startDate,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 30:** Column 'estimatedHours' not found in table 'tasks'

```
estimatedHours: tasks.estimatedHours,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 31:** Column 'actualHours' not found in table 'tasks'

```
actualHours: tasks.actualHours,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 32:** Column 'completionPercentage' not found in table 'tasks'

```
completionPercentage: tasks.completionPercentage,
```

💡 **Suggestion:** Did you mean 'tasks.completion_percentage'?

---

⚠️ **Line 33:** Column 'dependencies' not found in table 'tasks'

```
dependencies: tasks.dependencies,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 34:** Column 'watchers' not found in table 'tasks'

```
watchers: tasks.watchers,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 35:** Column 'timeTracked' not found in table 'tasks'

```
timeTracked: tasks.timeTracked,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 36:** Column 'commentCount' not found in table 'tasks'

```
commentCount: tasks.commentCount,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 37:** Column 'attachmentCount' not found in table 'tasks'

```
attachmentCount: tasks.attachmentCount,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 39:** Column 'customFields' not found in table 'tasks'

```
customFields: tasks.customFields,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 40:** Column 'createdBy' not found in table 'tasks'

```
createdBy: tasks.createdBy,
```

💡 **Suggestion:** Did you mean 'tasks.created_by'?

---

⚠️ **Line 41:** Column 'createdAt' not found in table 'tasks'

```
createdAt: tasks.createdAt,
```

💡 **Suggestion:** Did you mean 'tasks.created_at'?

---

⚠️ **Line 42:** Column 'updatedAt' not found in table 'tasks'

```
updatedAt: tasks.updatedAt,
```

💡 **Suggestion:** Did you mean 'tasks.updated_at'?

---

⚠️ **Line 43:** Column 'completedAt' not found in table 'tasks'

```
completedAt: tasks.completedAt,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 46:** Column 'firstName' not found in table 'users'

```
assignedToName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 47:** Column 'profileImageUrl' not found in table 'users'

```
assignedToAvatar: users.profileImageUrl,
```

💡 **Suggestion:** Did you mean 'users.profile_image_url'?

---

⚠️ **Line 56:** Column 'assignedTo' not found in table 'tasks'

```
.leftJoin(users, eq(tasks.assignedTo, users.id))
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 57:** Column 'projectId' not found in table 'tasks'

```
.leftJoin(projects, eq(tasks.projectId, projects.id))
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 58:** Column 'createdBy' not found in table 'tasks'

```
.leftJoin(sql`${users} as creator`, eq(tasks.createdBy, sql`creator.id`))
```

💡 **Suggestion:** Did you mean 'tasks.created_by'?

---

⚠️ **Line 59:** Column 'tenantId' not found in table 'tasks'

```
.where(eq(tasks.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 63:** Column 'projectId' not found in table 'tasks'

```
query = query.where(eq(tasks.projectId, projectId as string));
```

💡 **Suggestion:** Did you mean 'tasks.project_id'?

---

⚠️ **Line 66:** Column 'assignedTo' not found in table 'tasks'

```
query = query.where(eq(tasks.assignedTo, assignedTo as string));
```

💡 **Suggestion:** Did you mean 'tasks.assigned_to'?

---

⚠️ **Line 75:** Column 'updatedAt' not found in table 'tasks'

```
const allTasks = await query.orderBy(desc(tasks.updatedAt));
```

💡 **Suggestion:** Did you mean 'tasks.updated_at'?

---

⚠️ **Line 116:** Column 'projectManager' not found in table 'projects'

```
projectManager: projects.projectManager,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 117:** Column 'customerId' not found in table 'projects'

```
customerId: projects.customerId,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 118:** Column 'startDate' not found in table 'projects'

```
startDate: projects.startDate,
```

💡 **Suggestion:** Did you mean 'projects.start_date'?

---

⚠️ **Line 119:** Column 'endDate' not found in table 'projects'

```
endDate: projects.endDate,
```

💡 **Suggestion:** Did you mean 'projects.end_date'?

---

⚠️ **Line 120:** Column 'estimatedBudget' not found in table 'projects'

```
estimatedBudget: projects.estimatedBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 121:** Column 'actualBudget' not found in table 'projects'

```
actualBudget: projects.actualBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 122:** Column 'completionPercentage' not found in table 'projects'

```
completionPercentage: projects.completionPercentage,
```

💡 **Suggestion:** Did you mean 'projects.completion_percentage'?

---

⚠️ **Line 123:** Column 'color' not found in table 'projects'

```
color: projects.color,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 124:** Column 'template' not found in table 'projects'

```
template: projects.template,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 125:** Column 'workflow' not found in table 'projects'

```
workflow: projects.workflow,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 126:** Column 'tags' not found in table 'projects'

```
tags: projects.tags,
```

💡 **Suggestion:** Similar columns: name, status

---

⚠️ **Line 127:** Column 'createdAt' not found in table 'projects'

```
createdAt: projects.createdAt,
```

💡 **Suggestion:** Did you mean 'projects.created_at'?

---

⚠️ **Line 137:** Column 'projectManager' not found in table 'projects'

```
.leftJoin(sql`${users} as pm`, eq(projects.projectManager, sql`pm.id`))
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 139:** Column 'tenantId' not found in table 'projects'

```
.where(eq(projects.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'projects.tenant_id'?

---

⚠️ **Line 145:** Column 'projectManager' not found in table 'projects'

```
projects.projectManager,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 146:** Column 'customerId' not found in table 'projects'

```
projects.customerId,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 147:** Column 'startDate' not found in table 'projects'

```
projects.startDate,
```

💡 **Suggestion:** Did you mean 'projects.start_date'?

---

⚠️ **Line 148:** Column 'endDate' not found in table 'projects'

```
projects.endDate,
```

💡 **Suggestion:** Did you mean 'projects.end_date'?

---

⚠️ **Line 149:** Column 'estimatedBudget' not found in table 'projects'

```
projects.estimatedBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 150:** Column 'actualBudget' not found in table 'projects'

```
projects.actualBudget,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 151:** Column 'completionPercentage' not found in table 'projects'

```
projects.completionPercentage,
```

💡 **Suggestion:** Did you mean 'projects.completion_percentage'?

---

⚠️ **Line 152:** Column 'color' not found in table 'projects'

```
projects.color,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 153:** Column 'template' not found in table 'projects'

```
projects.template,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 154:** Column 'workflow' not found in table 'projects'

```
projects.workflow,
```

💡 **Suggestion:** Column not found in table 'projects'

---

⚠️ **Line 155:** Column 'tags' not found in table 'projects'

```
projects.tags,
```

💡 **Suggestion:** Similar columns: name, status

---

⚠️ **Line 156:** Column 'createdAt' not found in table 'projects'

```
projects.createdAt,
```

💡 **Suggestion:** Did you mean 'projects.created_at'?

---

⚠️ **Line 160:** Column 'updatedAt' not found in table 'projects'

```
.orderBy(desc(projects.updatedAt));
```

💡 **Suggestion:** Did you mean 'projects.updated_at'?

---

⚠️ **Line 177:** Column 'firstName' not found in table 'users'

```
name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 177:** Column 'lastName' not found in table 'users'

```
name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 179:** Column 'profileImageUrl' not found in table 'users'

```
avatar: users.profileImageUrl,
```

💡 **Suggestion:** Did you mean 'users.profile_image_url'?

---

⚠️ **Line 180:** Column 'role' not found in table 'users'

```
role: users.role,
```

💡 **Suggestion:** Similar columns: role_id

---

⚠️ **Line 183:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 183:** Column 'isActive' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 184:** Column 'firstName' not found in table 'users'

```
.orderBy(users.firstName, users.lastName);
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 184:** Column 'lastName' not found in table 'users'

```
.orderBy(users.firstName, users.lastName);
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 246:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 286:** Column 'commentCount' not found in table 'tasks'

```
commentCount: sql`${tasks.commentCount} + 1`,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 289:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 321:** Column 'timeTracked' not found in table 'tasks'

```
timeTracked: sql`${tasks.timeTracked} + ${req.body.minutes}`,
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 324:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 351:** Column 'tenantId' not found in table 'tasks'

```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 369:** Column 'parentTaskId' not found in table 'tasks'

```
.select({ parentTaskId: tasks.parentTaskId })
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 371:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 380:** Column 'parentTaskId' not found in table 'tasks'

```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Column not found in table 'tasks'

---

⚠️ **Line 380:** Column 'tenantId' not found in table 'tasks'

```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 383:** Column 'tenantId' not found in table 'tasks'

```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 403:** Column 'completionPercentage' not found in table 'tasks'

```
completionPercentage: tasks.completionPercentage,
```

💡 **Suggestion:** Did you mean 'tasks.completion_percentage'?

---

⚠️ **Line 407:** Column 'parentTaskId' not found in table 'tasks'

```
.where(eq(tasks.parentTaskId, parentTaskId));
```

💡 **Suggestion:** Column not found in table 'tasks'

---

### `server\routes-breach-detection.ts`

⚠️ **Line 77:** Column 'tenantId' not found in table 'proposals'

```
eq(proposals.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'proposals.tenant_id'?

---

⚠️ **Line 79:** Column 'createdAt' not found in table 'proposals'

```
lt(proposals.createdAt, fourteenDaysAgo),
```

💡 **Suggestion:** Did you mean 'proposals.created_at'?

---

⚠️ **Line 152:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 154:** Column 'createdAt' not found in table 'invoices'

```
lt(invoices.createdAt, twentyFourHoursAgo),
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

### `server\routes-admin-subscriptions.ts`

⚠️ **Line 110:** Column 'tenantId' not found in table 'subscription'

```
const status = await SubscriptionService.getSubscriptionStatus(subscription.tenantId);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 217:** Column 'isTrialing' not found in table 'subscription'

```
if (!subscription.isTrialing || !subscription.trialEndDate) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 217:** Column 'trialEndDate' not found in table 'subscription'

```
if (!subscription.isTrialing || !subscription.trialEndDate) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 223:** Column 'trialEndDate' not found in table 'subscription'

```
const newTrialEndDate = new Date(subscription.trialEndDate);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\reporting-rbac-middleware.ts`

⚠️ **Line 248:** Column 'roleId' not found in table 'users'

```
.leftJoin(roles, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 249:** Column 'primaryLocationId' not found in table 'users'

```
.leftJoin(locations, eq(users.primaryLocationId, locations.id))
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 250:** Column 'regionId' not found in table 'locations'

```
.leftJoin(regions, eq(locations.regionId, regions.id))
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 383:** Column 'tenantId' not found in table 'locations'

```
.where(eq(locations.tenantId, user.tenantId));
```

💡 **Suggestion:** Did you mean 'locations.tenant_id'?

---

⚠️ **Line 392:** Column 'tenantId' not found in table 'locations'

```
.where(and(eq(locations.tenantId, user.tenantId), eq(locations.regionId, user.regionId)));
```

💡 **Suggestion:** Did you mean 'locations.tenant_id'?

---

⚠️ **Line 392:** Column 'regionId' not found in table 'locations'

```
.where(and(eq(locations.tenantId, user.tenantId), eq(locations.regionId, user.regionId)));
```

💡 **Suggestion:** Did you mean 'locations.region_id'?

---

⚠️ **Line 419:** Column 'tenantId' not found in table 'regions'

```
.where(eq(regions.tenantId, user.tenantId));
```

💡 **Suggestion:** Did you mean 'regions.tenant_id'?

---

### `server\enhanced-rbac-seeder.ts`

⚠️ **Line 267:** Column 'install' not found in table 'equipment'

```
code: 'equipment.install',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 276:** Column 'configure' not found in table 'equipment'

```
code: 'equipment.configure',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 285:** Column 'remote_access' not found in table 'equipment'

```
code: 'equipment.remote_access',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 607:** Column 'remote_access' not found in table 'equipment'

```
permissions: ['ticket.view_location', 'equipment.remote_access', 'user.create_regional'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 647:** Column 'remote_access' not found in table 'equipment'

```
permissions: ['ticket.view_location', 'equipment.remote_access', 'ticket.assign'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 693:** Column 'configure' not found in table 'equipment'

```
permissions: ['ticket.view_location', 'ticket.assign', 'equipment.configure'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 722:** Column 'configure' not found in table 'equipment'

```
permissions: ['ticket.view_team', 'ticket.assign', 'equipment.configure'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 746:** Column 'install' not found in table 'equipment'

```
permissions: ['ticket.view_team', 'equipment.install', 'equipment.configure'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 746:** Column 'configure' not found in table 'equipment'

```
permissions: ['ticket.view_team', 'equipment.install', 'equipment.configure'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 776:** Column 'install' not found in table 'equipment'

```
permissions: ['ticket.view_own', 'ticket.create', 'equipment.install'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 909:** Column 'configure' not found in table 'equipment'

```
'equipment.configure',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 910:** Column 'remote_access' not found in table 'equipment'

```
'equipment.remote_access',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 940:** Column 'install' not found in table 'equipment'

```
permissions: ['ticket.view_own', 'equipment.install', 'equipment.configure', 'lead.create'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 940:** Column 'configure' not found in table 'equipment'

```
permissions: ['ticket.view_own', 'equipment.install', 'equipment.configure', 'lead.create'],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\auth-setup.ts`

⚠️ **Line 310:** Column 'tenantId' not found in table 'teams'

```
.where(and(eq(teams.department, 'sales'), eq(teams.tenantId, demoTenant.id)));
```

💡 **Suggestion:** Did you mean 'teams.tenant_id'?

---

⚠️ **Line 318:** Column 'tenantId' not found in table 'teams'

```
.where(and(eq(teams.department, 'service'), eq(teams.tenantId, demoTenant.id)));
```

💡 **Suggestion:** Did you mean 'teams.tenant_id'?

---

### `server\utils\apiErrorHandler.example.ts`

⚠️ **Line 25:** Column 'findFirst' not found in table 'customers'

```
const customer = await db.query.customers.findFirst({
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 52:** Column 'findFirst' not found in table 'customers'

```
const existing = await db.query.customers.findFirst({
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 53:** Column 'email' not found in table 'customers'

```
where: eq(customers.email, email),
```

💡 **Suggestion:** Column not found in table 'customers'

---

### `server\storage\security-storage.ts`

⚠️ **Line 255:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 256:** Column 'lastName' not found in table 'users'

```
lastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 261:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 263:** Column 'role' not found in table 'users'

```
eq(users.role, 'admin'),
```

💡 **Suggestion:** Similar columns: role_id

---

⚠️ **Line 264:** Column 'role' not found in table 'users'

```
eq(users.role, 'super_admin'),
```

💡 **Suggestion:** Similar columns: role_id

---

⚠️ **Line 265:** Column 'role' not found in table 'users'

```
eq(users.role, 'platform_admin'),
```

💡 **Suggestion:** Similar columns: role_id

---

### `server\services\workflow-triggers.ts`

⚠️ **Line 209:** Column 'delivered' not found in table 'equipment'

```
'equipment.delivered': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 230:** Column 'installation_complete' not found in table 'equipment'

```
'equipment.installation_complete': async (event: TriggerEvent): Promise<TaskTemplate[]> => {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\services\workflow-event-service.ts`

⚠️ **Line 383:** Column 'installed' not found in table 'equipment'

```
EQUIPMENT_INSTALLED: 'equipment.installed',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\services\warehouse-reporting-service.ts`

⚠️ **Line 181:** Column 'findFirst' not found in table 'users'

```
const userQuery = await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

### `server\services\usage-tracking-service.ts`

⚠️ **Line 62:** Column 'currentPeriodStart' not found in table 'subscription'

```
const periodStart = subscription.currentPeriodStart;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 63:** Column 'currentPeriodEnd' not found in table 'subscription'

```
const periodEnd = subscription.currentPeriodEnd;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 111:** Column 'apiCalls' not found in table 'tenants'

```
apiCalls: sql`${tenants.apiCalls} + 1`,
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 173:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 174:** Column 'isActive' not found in table 'users'

```
eq(users.isActive, true),
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 175:** Column 'lastLoginAt' not found in table 'users'

```
gte(users.lastLoginAt, thirtyDaysAgo),
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 183:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 183:** Column 'isActive' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 189:** Column 'tenantId' not found in table 'locations'

```
.where(and(eq(locations.tenantId, tenantId), eq(locations.isActive, true)));
```

💡 **Suggestion:** Did you mean 'locations.tenant_id'?

---

⚠️ **Line 189:** Column 'isActive' not found in table 'locations'

```
.where(and(eq(locations.tenantId, tenantId), eq(locations.isActive, true)));
```

💡 **Suggestion:** Did you mean 'locations.is_active'?

---

⚠️ **Line 242:** Column 'isFree' not found in table 'subscription'

```
if (subscription.isFree) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 247:** Column 'planId' not found in table 'subscription'

```
where: eq(subscriptionPlans.id, subscription.planId),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 255:** Column 'customLimits' not found in table 'subscription'

```
const customLimits = (subscription.customLimits as any) || {};
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 410:** Column 'isActive' not found in table 'tenants'

```
.where(eq(tenants.isActive, true));
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 432:** Column 'isActive' not found in table 'tenants'

```
.where(eq(tenants.isActive, true));
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 487:** Column 'planId' not found in table 'subscription'

```
where: eq(subscriptionPlans.id, subscription.planId),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 495:** Column 'customLimits' not found in table 'subscription'

```
const customLimits = (subscription.customLimits as any) || {};
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\services\trial-management-service.ts`

⚠️ **Line 152:** Column 'firstName' not found in table 'users'

```
firstName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 153:** Column 'tenantId' not found in table 'users'

```
tenantId: users.tenantId,
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 156:** Column 'tenantId' not found in table 'users'

```
.where(sql`${users.tenantId} IS NOT NULL`);
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 215:** Column 'tenantId' not found in table 'users'

```
tenantId: users.tenantId,
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 218:** Column 'tenantId' not found in table 'users'

```
.where(sql`${users.tenantId} IS NOT NULL`);
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

### `server\services\ticket-creation-service.ts`

⚠️ **Line 124:** Column 'findMany' not found in table 'equipment'

```
const customerEquipment = await db.query.equipment.findMany({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 125:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customerId)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 125:** Column 'customerId' not found in table 'equipment'

```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customerId)),
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 268:** Column 'findMany' not found in table 'users'

```
const technicians = await db.query.users.findMany({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 270:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, this.tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 271:** Column 'role' not found in table 'users'

```
eq(users.role, 'Technician'),
```

💡 **Suggestion:** Similar columns: role_id

---

⚠️ **Line 288:** Column 'findFirst' not found in table 'equipment'

```
equipmentData = await db.query.equipment.findFirst({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\services\team-reporting-service.ts`

⚠️ **Line 769:** Column 'quote_volume' not found in table 'quotes'

```
COALESCE(quotes.quote_volume, 0) as quote_volume,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 770:** Column 'quote_win_rate' not found in table 'quotes'

```
COALESCE(quotes.quote_win_rate, 0) as quote_win_rate,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 799:** Column 'owner_id' not found in table 'quotes'

```
) quotes ON quotes.owner_id = u.id
```

💡 **Suggestion:** Column not found in table 'quotes'

---

### `server\services\team-alert-service.ts`

⚠️ **Line 346:** Column 'findFirst' not found in table 'users'

```
const user = await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

### `server\services\subscription-service.ts`

⚠️ **Line 236:** Column 'planId' not found in table 'subscription'

```
where: eq(subscriptionPlans.id, subscription.planId),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 262:** Column 'customLimits' not found in table 'subscription'

```
const customLimits = (subscription.customLimits as any) || {};
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 299:** Column 'currentPeriodEnd' not found in table 'subscription'

```
(subscription.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 304:** Column 'isTrialing' not found in table 'subscription'

```
if (subscription.isTrialing && subscription.trialEndDate) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 304:** Column 'trialEndDate' not found in table 'subscription'

```
if (subscription.isTrialing && subscription.trialEndDate) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 307:** Column 'trialEndDate' not found in table 'subscription'

```
Math.ceil((subscription.trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 319:** Column 'isTrialing' not found in table 'subscription'

```
isTrialing: subscription.isTrialing,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 486:** Column 'currentPeriodEnd' not found in table 'subscription'

```
cancelAt: subscription.currentPeriodEnd,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 500:** Column 'currentPeriodEnd' not found in table 'subscription'

```
cancelDate: immediate ? now : subscription.currentPeriodEnd,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 512:** Column 'currentPeriodEnd' not found in table 'subscription'

```
: `Your subscription will end on ${subscription.currentPeriodEnd.toLocaleDateString()}.`,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 540:** Column 'billingCycle' not found in table 'subscription'

```
subscription.billingCycle === 'annual'
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 573:** Column 'trialEndDate' not found in table 'subscription'

```
trialEndDate: subscription.trialEndDate,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 605:** Column 'trialEndDate' not found in table 'subscription'

```
if (!subscription || !subscription.trialEndDate) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 610:** Column 'trialEndDate' not found in table 'subscription'

```
if (subscription.trialEndDate > now) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 616:** Column 'stripeCustomerId' not found in table 'subscription'

```
!!subscription.stripeCustomerId || !!subscription.stripePaymentIntentId;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 616:** Column 'stripePaymentIntentId' not found in table 'subscription'

```
!!subscription.stripeCustomerId || !!subscription.stripePaymentIntentId;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 649:** Column 'trialEndDate' not found in table 'subscription'

```
trialEndDate: subscription.trialEndDate,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 775:** Column 'trialEndDate' not found in table 'subscription'

```
(subscription.trialEndDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 781:** Column 'tenantId' not found in table 'subscription'

```
tenantId: subscription.tenantId,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 806:** Column 'isFree' not found in table 'subscription'

```
if (subscription.isFree) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 810:** Column 'tenantId' not found in table 'subscription'

```
const status = await this.getSubscriptionStatus(subscription.tenantId);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 832:** Column 'tenantId' not found in table 'subscription'

```
tenantId: subscription.tenantId,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 863:** Column 'tenantId' not found in table 'subscription'

```
tenantId: subscription.tenantId,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\services\stripe-service.ts`

⚠️ **Line 97:** Column 'findFirst' not found in table 'tenants'

```
const tenant = await db.query.tenants.findFirst({
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 137:** Column 'findFirst' not found in table 'tenants'

```
const tenant = await db.query.tenants.findFirst({
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 153:** Column 'findFirst' not found in table 'users'

```
const adminUser = await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 154:** Column 'tenantId' not found in table 'users'

```
where: eq(users.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 294:** Column 'items' not found in table 'subscription'

```
id: subscription.items.data[0].id,
```

💡 **Suggestion:** Similar columns: filters

---

⚠️ **Line 354:** Column 'data' not found in table 'invoices'

```
return invoices.data;
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 427:** Column 'customer' not found in table 'subscription'

```
const customerId = subscription.customer as string;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 717:** Column 'findFirst' not found in table 'tenants'

```
const tenant = await db.query.tenants.findFirst({
```

💡 **Suggestion:** Column not found in table 'tenants'

---

⚠️ **Line 744:** Column 'retrieve' not found in table 'sessions'

```
return await stripe.checkout.sessions.retrieve(sessionId, {
```

💡 **Suggestion:** Column not found in table 'sessions'

---

⚠️ **Line 812:** Column 'items' not found in table 'subscription'

```
id: subscription.items.data[0].id,
```

💡 **Suggestion:** Similar columns: filters

---

### `server\services\predictive-service-dispatch-service.ts`

⚠️ **Line 17:** Column 'firstName' not found in table 'users'

```
.select({ firstName: users.firstName, lastName: users.lastName })
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 17:** Column 'lastName' not found in table 'users'

```
.select({ firstName: users.firstName, lastName: users.lastName })
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

### `server\services\pdf-generation-service.ts`

⚠️ **Line 614:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 615:** Column 'customerId' not found in table 'invoices'

```
customerId: invoices.customerId,
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 619:** Column 'contractId' not found in table 'invoices'

```
contractId: invoices.contractId,
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 620:** Column 'issueDate' not found in table 'invoices'

```
issueDate: invoices.issueDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 621:** Column 'invoiceDate' not found in table 'invoices'

```
invoiceDate: invoices.invoiceDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 622:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 623:** Column 'subtotal' not found in table 'invoices'

```
subtotal: invoices.subtotal,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 624:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 626:** Column 'balance' not found in table 'invoices'

```
balance: invoices.balance,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 627:** Column 'paid' not found in table 'invoices'

```
paid: invoices.paid,
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 628:** Column 'tax' not found in table 'invoices'

```
tax: invoices.tax,
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 630:** Column 'invoiceStatus' not found in table 'invoices'

```
invoiceStatus: invoices.invoiceStatus,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 631:** Column 'paymentTerms' not found in table 'invoices'

```
paymentTerms: invoices.paymentTerms,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 632:** Column 'paymentDate' not found in table 'invoices'

```
paymentDate: invoices.paymentDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 633:** Column 'paymentMethod' not found in table 'invoices'

```
paymentMethod: invoices.paymentMethod,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 635:** Column 'notes' not found in table 'invoices'

```
notes: invoices.notes,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 636:** Column 'billingPeriodStart' not found in table 'invoices'

```
billingPeriodStart: invoices.billingPeriodStart,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_start'?

---

⚠️ **Line 637:** Column 'billingPeriodEnd' not found in table 'invoices'

```
billingPeriodEnd: invoices.billingPeriodEnd,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_end'?

---

⚠️ **Line 638:** Column 'tenantId' not found in table 'invoices'

```
tenantId: invoices.tenantId,
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 639:** Column 'createdAt' not found in table 'invoices'

```
createdAt: invoices.createdAt,
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 640:** Column 'updatedAt' not found in table 'invoices'

```
updatedAt: invoices.updatedAt,
```

💡 **Suggestion:** Did you mean 'invoices.updated_at'?

---

⚠️ **Line 643:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 644:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\services\payment-audit-service.ts`

⚠️ **Line 190:** Column 'customer' not found in table 'subscription'

```
stripeCustomerId: subscription.customer as string,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 191:** Column 'items' not found in table 'subscription'

```
amount: subscription.items.data[0]?.price?.unit_amount || 0,
```

💡 **Suggestion:** Similar columns: filters

---

⚠️ **Line 192:** Column 'currency' not found in table 'subscription'

```
currency: subscription.currency,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 209:** Column 'customer' not found in table 'subscription'

```
stripeCustomerId: subscription.customer as string,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 229:** Column 'customer' not found in table 'subscription'

```
stripeCustomerId: subscription.customer as string,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 233:** Column 'cancel_at' not found in table 'subscription'

```
cancelAt: subscription.cancel_at,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 234:** Column 'canceled_at' not found in table 'subscription'

```
canceledAt: subscription.canceled_at,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\services\intelligent-alerts-service.ts`

⚠️ **Line 784:** Column 'isActive' not found in table 'users'

```
.select({ id: users.id, email: users.email, isActive: users.isActive })
```

💡 **Suggestion:** Did you mean 'users.is_active'?

---

⚠️ **Line 1042:** Column 'accessScope' not found in table 'users'

```
accessScope: users.accessScope,
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 1043:** Column 'roleId' not found in table 'users'

```
roleId: users.roleId,
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

### `server\services\gdpr-data-export-service.ts`

⚠️ **Line 249:** Column 'findFirst' not found in table 'users'

```
data.user = await db.query.users.findFirst({
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 250:** Column 'tenantId' not found in table 'users'

```
where: and(eq(users.tenantId, tenantId), eq(users.id, subjectId)),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

### `server\services\equipment-lifecycle-state-machine.ts`

⚠️ **Line 246:** Column 'currentStage' not found in table 'equipment'

```
const fromStage = equipment.currentStage;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\services\document-generation-service.ts`

⚠️ **Line 151:** Column 'findFirst' not found in table 'quotes'

```
const quote = await db.query.quotes.findFirst({
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 153:** Column 'tenantId' not found in table 'quotes'

```
and(eq(quotes.id, contextIds.quoteId!), eq(quotes.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 165:** Column 'findFirst' not found in table 'deals'

```
const deal = await db.query.deals.findFirst({
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 167:** Column 'tenantId' not found in table 'deals'

```
and(eq(deals.id, contextIds.dealId!), eq(deals.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 187:** Column 'findFirst' not found in table 'invoices'

```
const invoice = await db.query.invoices.findFirst({
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 189:** Column 'tenantId' not found in table 'invoices'

```
and(eq(invoices.id, contextIds.invoiceId!), eq(invoices.tenantId, tenantId)),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\services\customer-portal-service.ts`

⚠️ **Line 1287:** Column 'hasOwnProperty' not found in table 'equipment'

```
if (equipment.hasOwnProperty(field)) {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1760:** Column 'lastReading' not found in table 'equipment'

```
if (new Date(reading.readingDate) > new Date(equipment.lastReading)) {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1761:** Column 'lastReading' not found in table 'equipment'

```
equipment.lastReading = reading.readingDate;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1769:** Column 'totalImpressions' not found in table 'equipment'

```
equipment.totalImpressions += delta.totalImpressions;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1770:** Column 'deltaCount' not found in table 'equipment'

```
equipment.deltaCount += 1;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1776:** Column 'deltaCount' not found in table 'equipment'

```
equipment.deltaCount > 0 ? (equipment.totalImpressions / equipment.deltaCount) * 30 : 0;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1776:** Column 'totalImpressions' not found in table 'equipment'

```
equipment.deltaCount > 0 ? (equipment.totalImpressions / equipment.deltaCount) * 30 : 0;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1776:** Column 'deltaCount' not found in table 'equipment'

```
equipment.deltaCount > 0 ? (equipment.totalImpressions / equipment.deltaCount) * 30 : 0;
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1785:** Column 'equipmentId' not found in table 'equipment'

```
equipmentId: equipment.equipmentId,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1786:** Column 'equipmentName' not found in table 'equipment'

```
equipmentName: equipment.equipmentName,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1787:** Column 'serialNumber' not found in table 'equipment'

```
serialNumber: equipment.serialNumber,
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 1788:** Column 'totalImpressions' not found in table 'equipment'

```
totalImpressions: equipment.totalImpressions,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1793:** Column 'lastReading' not found in table 'equipment'

```
lastReading: equipment.lastReading,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `server\services\csv-import-service.ts`

⚠️ **Line 665:** Column 'tenantId' not found in table 'equipment'

```
const whereConditions: any[] = [eq(equipment.tenantId, tenantId)];
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

### `server\services\contract-renewal-workflow.ts`

⚠️ **Line 166:** Column 'tenantId' not found in table 'tasks'

```
eq(tasks.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'tasks.tenant_id'?

---

⚠️ **Line 167:** Column 'relatedRecordId' not found in table 'tasks'

```
eq(tasks.relatedRecordId, contract.id),
```

💡 **Suggestion:** Column not found in table 'tasks'

---

### `server\services\company-deduplication-service.ts`

⚠️ **Line 100:** Column 'tenantId' not found in table 'companies'

```
.where(eq(companies.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 101:** Column 'createdAt' not found in table 'companies'

```
.orderBy(companies.createdAt);
```

💡 **Suggestion:** Did you mean 'companies.created_at'?

---

⚠️ **Line 182:** Column 'tenantId' not found in table 'companies'

```
.where(and(eq(companies.id, survivorId), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 200:** Column 'tenantId' not found in table 'companies'

```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 265:** Column 'tenantId' not found in table 'companies'

```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 352:** Column 'tenantId' not found in table 'companies'

```
const candidates = await db.select().from(companies).where(eq(companies.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 385:** Column 'tenantId' not found in table 'companies'

```
.where(and(inArray(companies.id, companyIds), eq(companies.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

### `server\services\billing-engine-service.ts`

⚠️ **Line 816:** Column 'totalAmount' not found in table 'invoices'

```
total: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 817:** Column 'totalAmount' not found in table 'invoices'

```
paid: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} = 'paid'), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 817:** Column 'invoiceStatus' not found in table 'invoices'

```
paid: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} = 'paid'), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 818:** Column 'balance' not found in table 'invoices'

```
outstanding: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} != 'paid'), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 818:** Column 'invoiceStatus' not found in table 'invoices'

```
outstanding: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} != 'paid'), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 823:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 824:** Column 'invoiceDate' not found in table 'invoices'

```
gte(invoices.invoiceDate, start),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 825:** Column 'invoiceDate' not found in table 'invoices'

```
lte(invoices.invoiceDate, end),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 837:** Column 'paymentDate' not found in table 'invoices'

```
avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 837:** Column 'invoiceDate' not found in table 'invoices'

```
avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 842:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 843:** Column 'invoiceStatus' not found in table 'invoices'

```
eq(invoices.invoiceStatus, 'paid'),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 844:** Column 'invoiceDate' not found in table 'invoices'

```
gte(invoices.invoiceDate, start),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 845:** Column 'invoiceDate' not found in table 'invoices'

```
lte(invoices.invoiceDate, end),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 846:** Column 'paymentDate' not found in table 'invoices'

```
isNotNull(invoices.paymentDate),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 935:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 1083:** Column 'invoiceNumber' not found in table 'invoices'

```
.select({ invoiceNumber: invoices.invoiceNumber })
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 1085:** Column 'tenantId' not found in table 'invoices'

```
.where(eq(invoices.tenantId, tenantId))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 1086:** Column 'createdAt' not found in table 'invoices'

```
.orderBy(desc(invoices.createdAt))
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 1151:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 1152:** Column 'customerId' not found in table 'invoices'

```
customerId: invoices.customerId,
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 1155:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 1156:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 1157:** Column 'balance' not found in table 'invoices'

```
balance: invoices.balance,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 1160:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 1161:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 1196:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\services\billing-analytics-service.ts`

⚠️ **Line 172:** Column 'invoiceDate' not found in table 'invoices'

```
month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 173:** Column 'totalAmount' not found in table 'invoices'

```
revenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 178:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 179:** Column 'invoiceDate' not found in table 'invoices'

```
gte(invoices.invoiceDate, startDate),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 180:** Column 'invoiceStatus' not found in table 'invoices'

```
sql`${invoices.invoiceStatus} IN ('paid', 'partial')`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 183:** Column 'invoiceDate' not found in table 'invoices'

```
.groupBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`)
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 184:** Column 'invoiceDate' not found in table 'invoices'

```
.orderBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`);
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 333:** Column 'totalAmount' not found in table 'invoices'

```
totalRevenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 335:** Column 'invoiceDate' not found in table 'invoices'

```
lastInvoiceDate: sql<Date>`MAX(${invoices.invoiceDate})`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 336:** Column 'paymentDate' not found in table 'invoices'

```
avgDaysToPayment: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 336:** Column 'invoiceDate' not found in table 'invoices'

```
avgDaysToPayment: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 337:** Column 'paymentDate' not found in table 'invoices'

```
latePaymentCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.paymentDate} > ${invoices.dueDate})`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 337:** Column 'dueDate' not found in table 'invoices'

```
latePaymentCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.paymentDate} > ${invoices.dueDate})`,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 340:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 491:** Column 'totalAmount' not found in table 'invoices'

```
totalRevenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 493:** Column 'invoiceDate' not found in table 'invoices'

```
firstInvoiceDate: sql<Date>`MIN(${invoices.invoiceDate})`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 494:** Column 'invoiceDate' not found in table 'invoices'

```
lastInvoiceDate: sql<Date>`MAX(${invoices.invoiceDate})`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 497:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

### `server\services\automated-billing-service.ts`

⚠️ **Line 127:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.id, schedule.contractId), eq(contracts.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 140:** Column 'customerId' not found in table 'contracts'

```
eq(contracts.customerId, schedule.customerId),
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 141:** Column 'tenantId' not found in table 'contracts'

```
eq(contracts.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 150:** Column 'tenantId' not found in table 'contracts'

```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')));
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 263:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 264:** Column 'contractId' not found in table 'invoices'

```
eq(invoices.contractId, contract.id),
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 265:** Column 'billingPeriodStart' not found in table 'invoices'

```
gte(invoices.billingPeriodStart, periodStart),
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_start'?

---

⚠️ **Line 266:** Column 'billingPeriodEnd' not found in table 'invoices'

```
lte(invoices.billingPeriodEnd, periodEnd),
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_end'?

---

⚠️ **Line 422:** Column 'rows' not found in table 'equipment'

```
for (const row of equipment.rows as any[]) {
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 587:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'open')));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 593:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

### `server\services\auto-lead-routing-service.ts`

⚠️ **Line 23:** Column 'firstName' not found in table 'users'

```
.select({ firstName: users.firstName, lastName: users.lastName })
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 23:** Column 'lastName' not found in table 'users'

```
.select({ firstName: users.firstName, lastName: users.lastName })
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

### `server\services\approval-workflow-service.ts`

⚠️ **Line 245:** Column 'firstName' not found in table 'users'

```
userName: users.firstName,
```

💡 **Suggestion:** Did you mean 'users.first_name'?

---

⚠️ **Line 246:** Column 'lastName' not found in table 'users'

```
userLastName: users.lastName,
```

💡 **Suggestion:** Did you mean 'users.last_name'?

---

⚠️ **Line 250:** Column 'roleId' not found in table 'users'

```
.leftJoin(roles, eq(users.roleId, roles.id))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 251:** Column 'tenantId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.roleId, approver.roleId)))
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 251:** Column 'roleId' not found in table 'users'

```
.where(and(eq(users.tenantId, tenantId), eq(users.roleId, approver.roleId)))
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

### `server\services\api-key-service.ts`

⚠️ **Line 285:** Column 'minute' not found in table 'buckets'

```
const minuteRemaining = Math.max(0, minuteLimit - buckets.minute.count);
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 286:** Column 'hour' not found in table 'buckets'

```
const hourRemaining = Math.max(0, hourLimit - buckets.hour.count);
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 287:** Column 'day' not found in table 'buckets'

```
const dayRemaining = Math.max(0, dayLimit - buckets.day.count);
```

💡 **Suggestion:** Similar columns: id, name

---

⚠️ **Line 304:** Column 'minute' not found in table 'buckets'

```
minute: buckets.minute.end,
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 305:** Column 'hour' not found in table 'buckets'

```
hour: buckets.hour.end,
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 306:** Column 'day' not found in table 'buckets'

```
day: buckets.day.end,
```

💡 **Suggestion:** Similar columns: id, name

---

⚠️ **Line 438:** Column 'minute' not found in table 'buckets'

```
.where(eq(apiKeyRateLimits.id, buckets.minute.id)),
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 445:** Column 'hour' not found in table 'buckets'

```
.where(eq(apiKeyRateLimits.id, buckets.hour.id)),
```

💡 **Suggestion:** Column not found in table 'buckets'

---

⚠️ **Line 452:** Column 'day' not found in table 'buckets'

```
.where(eq(apiKeyRateLimits.id, buckets.day.id)),
```

💡 **Suggestion:** Similar columns: id, name

---

### `server\services\ai-email-parser-service.ts`

⚠️ **Line 237:** Column 'findMany' not found in table 'equipment'

```
equipmentList = await db.query.equipment.findMany({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 238:** Column 'tenantId' not found in table 'equipment'

```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customer.id)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 238:** Column 'customerId' not found in table 'equipment'

```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customer.id)),
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

### `server\routes\billing.ts`

⚠️ **Line 286:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 287:** Column 'customerId' not found in table 'invoices'

```
customerId: invoices.customerId,
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 289:** Column 'contractId' not found in table 'invoices'

```
contractId: invoices.contractId,
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 290:** Column 'externalCustomerId' not found in table 'invoices'

```
ticketId: invoices.externalCustomerId,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 291:** Column 'issueDate' not found in table 'invoices'

```
issueDate: invoices.issueDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 292:** Column 'invoiceDate' not found in table 'invoices'

```
invoiceDate: invoices.invoiceDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 293:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 294:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 295:** Column 'balance' not found in table 'invoices'

```
balance: invoices.balance,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 296:** Column 'paid' not found in table 'invoices'

```
paid: invoices.paid,
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 298:** Column 'invoiceStatus' not found in table 'invoices'

```
invoiceStatus: invoices.invoiceStatus,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 299:** Column 'paymentTerms' not found in table 'invoices'

```
paymentTerms: invoices.paymentTerms,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 301:** Column 'billingPeriodStart' not found in table 'invoices'

```
billingPeriodStart: invoices.billingPeriodStart,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_start'?

---

⚠️ **Line 302:** Column 'billingPeriodEnd' not found in table 'invoices'

```
billingPeriodEnd: invoices.billingPeriodEnd,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_end'?

---

⚠️ **Line 303:** Column 'createdAt' not found in table 'invoices'

```
createdAt: invoices.createdAt,
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 304:** Column 'updatedAt' not found in table 'invoices'

```
updatedAt: invoices.updatedAt,
```

💡 **Suggestion:** Did you mean 'invoices.updated_at'?

---

⚠️ **Line 307:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id));
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 310:** Column 'tenantId' not found in table 'invoices'

```
const conditions = [eq(invoices.tenantId, tenantId)];
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 313:** Column 'invoiceStatus' not found in table 'invoices'

```
conditions.push(eq(invoices.invoiceStatus, status as string));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 317:** Column 'customerId' not found in table 'invoices'

```
conditions.push(eq(invoices.customerId, customerId as string));
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 321:** Column 'contractId' not found in table 'invoices'

```
conditions.push(eq(invoices.contractId, contractId as string));
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 325:** Column 'externalCustomerId' not found in table 'invoices'

```
conditions.push(eq(invoices.externalCustomerId, ticketId as string));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 329:** Column 'invoiceDate' not found in table 'invoices'

```
conditions.push(gte(invoices.invoiceDate, new Date(fromDate as string)));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 333:** Column 'invoiceDate' not found in table 'invoices'

```
conditions.push(lte(invoices.invoiceDate, new Date(toDate as string)));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 338:** Column 'invoiceStatus' not found in table 'invoices'

```
conditions.push(and(eq(invoices.invoiceStatus, 'open'), sql`${invoices.dueDate} < NOW()`)!);
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 338:** Column 'dueDate' not found in table 'invoices'

```
conditions.push(and(eq(invoices.invoiceStatus, 'open'), sql`${invoices.dueDate} < NOW()`)!);
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 344:** Column 'externalCustomerId' not found in table 'invoices'

```
isNotNull(invoices.externalCustomerId),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 345:** Column 'createdAt' not found in table 'invoices'

```
gte(invoices.createdAt, sql`NOW() - INTERVAL '7 days'`),
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 352:** Column 'createdAt' not found in table 'invoices'

```
.orderBy(desc(invoices.createdAt))
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 398:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 399:** Column 'customerId' not found in table 'invoices'

```
customerId: invoices.customerId,
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 403:** Column 'contractId' not found in table 'invoices'

```
contractId: invoices.contractId,
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 404:** Column 'issueDate' not found in table 'invoices'

```
issueDate: invoices.issueDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 405:** Column 'invoiceDate' not found in table 'invoices'

```
invoiceDate: invoices.invoiceDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 406:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 407:** Column 'subtotal' not found in table 'invoices'

```
subtotal: invoices.subtotal,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 408:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 410:** Column 'balance' not found in table 'invoices'

```
balance: invoices.balance,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 411:** Column 'paid' not found in table 'invoices'

```
paid: invoices.paid,
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 412:** Column 'tax' not found in table 'invoices'

```
tax: invoices.tax,
```

💡 **Suggestion:** Similar columns: id

---

⚠️ **Line 414:** Column 'invoiceStatus' not found in table 'invoices'

```
invoiceStatus: invoices.invoiceStatus,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 415:** Column 'paymentTerms' not found in table 'invoices'

```
paymentTerms: invoices.paymentTerms,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 416:** Column 'paymentDate' not found in table 'invoices'

```
paymentDate: invoices.paymentDate,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 417:** Column 'paymentMethod' not found in table 'invoices'

```
paymentMethod: invoices.paymentMethod,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 418:** Column 'paymentNotes' not found in table 'invoices'

```
paymentNotes: invoices.paymentNotes,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 420:** Column 'notes' not found in table 'invoices'

```
notes: invoices.notes,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 421:** Column 'billingPeriodStart' not found in table 'invoices'

```
billingPeriodStart: invoices.billingPeriodStart,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_start'?

---

⚠️ **Line 422:** Column 'billingPeriodEnd' not found in table 'invoices'

```
billingPeriodEnd: invoices.billingPeriodEnd,
```

💡 **Suggestion:** Did you mean 'invoices.billing_period_end'?

---

⚠️ **Line 423:** Column 'createdAt' not found in table 'invoices'

```
createdAt: invoices.createdAt,
```

💡 **Suggestion:** Did you mean 'invoices.created_at'?

---

⚠️ **Line 424:** Column 'updatedAt' not found in table 'invoices'

```
updatedAt: invoices.updatedAt,
```

💡 **Suggestion:** Did you mean 'invoices.updated_at'?

---

⚠️ **Line 427:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 428:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 511:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 536:** Column 'invoiceStatus' not found in table 'invoices'

```
.select({ status: invoices.status, invoiceStatus: invoices.invoiceStatus })
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 538:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 554:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 586:** Column 'invoiceNumber' not found in table 'invoices'

```
invoiceNumber: invoices.invoiceNumber,
```

💡 **Suggestion:** Did you mean 'invoices.invoice_number'?

---

⚠️ **Line 587:** Column 'customerId' not found in table 'invoices'

```
customerId: invoices.customerId,
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 590:** Column 'totalAmount' not found in table 'invoices'

```
totalAmount: invoices.totalAmount,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 592:** Column 'dueDate' not found in table 'invoices'

```
dueDate: invoices.dueDate,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

⚠️ **Line 593:** Column 'balance' not found in table 'invoices'

```
balance: invoices.balance,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 595:** Column 'invoiceStatus' not found in table 'invoices'

```
invoiceStatus: invoices.invoiceStatus,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 598:** Column 'customerId' not found in table 'invoices'

```
.leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 599:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 705:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 746:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 771:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 794:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 960:** Column 'tenantId' not found in table 'invoices'

```
.where(eq(invoices.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 965:** Column 'totalAmount' not found in table 'invoices'

```
totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Did you mean 'invoices.total_amount'?

---

⚠️ **Line 968:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'paid')));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 968:** Column 'invoiceStatus' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'paid')));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 973:** Column 'balance' not found in table 'invoices'

```
totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 976:** Column 'tenantId' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'sent')));
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 976:** Column 'invoiceStatus' not found in table 'invoices'

```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'sent')));
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 981:** Column 'balance' not found in table 'invoices'

```
totalValue: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)), 0)`,
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 986:** Column 'tenantId' not found in table 'invoices'

```
eq(invoices.tenantId, tenantId),
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 987:** Column 'invoiceStatus' not found in table 'invoices'

```
eq(invoices.invoiceStatus, 'sent'),
```

💡 **Suggestion:** Column not found in table 'invoices'

---

⚠️ **Line 988:** Column 'dueDate' not found in table 'invoices'

```
sql`${invoices.dueDate} < CURRENT_DATE`,
```

💡 **Suggestion:** Did you mean 'invoices.due_date'?

---

### `server\middleware\mfa-enforcement.ts`

⚠️ **Line 344:** Column 'tenantId' not found in table 'users'

```
const allUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

### `server\middleware\hierarchical-query-builder.ts`

⚠️ **Line 344:** Column 'tenantId' not found in table 'users'

```
.where(eq(users.tenantId, this.userContext.tenantId));
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 358:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, this.userContext.tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 359:** Column 'primaryLocationId' not found in table 'users'

```
inArray(users.primaryLocationId, locationIds),
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 371:** Column 'tenantId' not found in table 'users'

```
eq(users.tenantId, this.userContext.tenantId),
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 372:** Column 'managerId' not found in table 'users'

```
or(eq(users.managerId, this.userContext.id), eq(users.id, this.userContext.id)),
```

💡 **Suggestion:** Column not found in table 'users'

---

### `server\integrations\webhook-service.ts`

⚠️ **Line 123:** Column 'created' not found in table 'subscription'

```
case 'subscription.created':
```

💡 **Suggestion:** Similar columns: created_at

---

⚠️ **Line 124:** Column 'updated' not found in table 'subscription'

```
case 'subscription.updated':
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 125:** Column 'deleted' not found in table 'subscription'

```
case 'subscription.deleted':
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `server\integrations\dashboard-service.ts`

⚠️ **Line 545:** Column 'created' not found in table 'subscription'

```
event: 'subscription.created',
```

💡 **Suggestion:** Similar columns: created_at

---

### `server\services\manufacturer-adapters\xerox-adapter.ts`

⚠️ **Line 292:** Column 'forEach' not found in table 'supplies'

```
supplies.forEach((supply: any) => {
```

💡 **Suggestion:** Column not found in table 'supplies'

---

### `server\database-updater\updaters\ServiceTicketUpdater.ts`

⚠️ **Line 526:** Column 'tenantId' not found in table 'equipment'

```
and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, this.customerId!)),
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 526:** Column 'customerId' not found in table 'equipment'

```
and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, this.customerId!)),
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

### `client\src\hooks\useSupabaseAuth.ts`

⚠️ **Line 144:** Column 'unsubscribe' not found in table 'subscription'

```
subscription.unsubscribe();
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `client\src\hooks\useSubscription.ts`

⚠️ **Line 328:** Column 'usage' not found in table 'subscription'

```
const usage = subscription.usage[metric];
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 329:** Column 'limits' not found in table 'subscription'

```
const limit = subscription.limits[metric];
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `client\src\components\SubscriptionBanner.tsx`

⚠️ **Line 27:** Column 'subscription' not found in table 'subscription'

```
if (subscription.subscription?.isFree) {
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 33:** Column 'isTrialing' not found in table 'subscription'

```
subscription.isTrialing &&
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 34:** Column 'trialDaysRemaining' not found in table 'subscription'

```
subscription.trialDaysRemaining !== undefined &&
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 35:** Column 'trialDaysRemaining' not found in table 'subscription'

```
subscription.trialDaysRemaining <= 7
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 38:** Column 'trialDaysRemaining' not found in table 'subscription'

```
subscription.trialDaysRemaining <= 1
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 40:** Column 'trialDaysRemaining' not found in table 'subscription'

```
: subscription.trialDaysRemaining <= 3
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 66:** Column 'trialDaysRemaining' not found in table 'subscription'

```
{subscription.trialDaysRemaining === 0 ? (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 71:** Column 'trialDaysRemaining' not found in table 'subscription'

```
) : subscription.trialDaysRemaining === 1 ? (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 73:** Column 'plan' not found in table 'subscription'

```
<strong>Trial ending tomorrow!</strong> Your {subscription.plan?.name} trial ends
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 78:** Column 'plan' not found in table 'subscription'

```
<strong>Trial ending soon:</strong> Your {subscription.plan?.name} trial ends in{' '}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 79:** Column 'trialDaysRemaining' not found in table 'subscription'

```
{subscription.trialDaysRemaining} days.
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 110:** Column 'isOverLimit' not found in table 'subscription'

```
if (subscription.isOverLimit && subscription.overageDetails) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 110:** Column 'overageDetails' not found in table 'subscription'

```
if (subscription.isOverLimit && subscription.overageDetails) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 111:** Column 'overageDetails' not found in table 'subscription'

```
const overages = Object.entries(subscription.overageDetails);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 160:** Column 'usage' not found in table 'subscription'

```
if (subscription.usage && subscription.limits) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 160:** Column 'limits' not found in table 'subscription'

```
if (subscription.usage && subscription.limits) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 164:** Column 'limits' not found in table 'subscription'

```
subscription.limits.users !== -1 &&
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 165:** Column 'usage' not found in table 'subscription'

```
subscription.usage.users >= subscription.limits.users * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 165:** Column 'limits' not found in table 'subscription'

```
subscription.usage.users >= subscription.limits.users * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 167:** Column 'usage' not found in table 'subscription'

```
const pct = Math.round((subscription.usage.users / subscription.limits.users) * 100);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 167:** Column 'limits' not found in table 'subscription'

```
const pct = Math.round((subscription.usage.users / subscription.limits.users) * 100);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 168:** Column 'usage' not found in table 'subscription'

```
warnings.push(`Users: ${subscription.usage.users}/${subscription.limits.users} (${pct}%)`);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 168:** Column 'limits' not found in table 'subscription'

```
warnings.push(`Users: ${subscription.usage.users}/${subscription.limits.users} (${pct}%)`);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 172:** Column 'limits' not found in table 'subscription'

```
subscription.limits.storage !== -1 &&
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 173:** Column 'usage' not found in table 'subscription'

```
subscription.usage.storage >= subscription.limits.storage * 1024 * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 173:** Column 'limits' not found in table 'subscription'

```
subscription.usage.storage >= subscription.limits.storage * 1024 * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 175:** Column 'usage' not found in table 'subscription'

```
const usedGB = Math.round(subscription.usage.storage / 1024);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 177:** Column 'usage' not found in table 'subscription'

```
(subscription.usage.storage / (subscription.limits.storage * 1024)) * 100,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 177:** Column 'limits' not found in table 'subscription'

```
(subscription.usage.storage / (subscription.limits.storage * 1024)) * 100,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 179:** Column 'limits' not found in table 'subscription'

```
warnings.push(`Storage: ${usedGB}/${subscription.limits.storage}GB (${pct}%)`);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 183:** Column 'limits' not found in table 'subscription'

```
subscription.limits.apiCalls !== -1 &&
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 184:** Column 'usage' not found in table 'subscription'

```
subscription.usage.apiCalls >= subscription.limits.apiCalls * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 184:** Column 'limits' not found in table 'subscription'

```
subscription.usage.apiCalls >= subscription.limits.apiCalls * 0.8
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 186:** Column 'usage' not found in table 'subscription'

```
const pct = Math.round((subscription.usage.apiCalls / subscription.limits.apiCalls) * 100);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 186:** Column 'limits' not found in table 'subscription'

```
const pct = Math.round((subscription.usage.apiCalls / subscription.limits.apiCalls) * 100);
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 188:** Column 'usage' not found in table 'subscription'

```
`API Calls: ${subscription.usage.apiCalls.toLocaleString()}/${subscription.limits.apiCalls.toLocaleString()} (${pct}%)`,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 188:** Column 'limits' not found in table 'subscription'

```
`API Calls: ${subscription.usage.apiCalls.toLocaleString()}/${subscription.limits.apiCalls.toLocaleString()} (${pct}%)`,
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 229:** Column 'subscription' not found in table 'subscription'

```
if (subscription.subscription?.status === 'past_due') {
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 260:** Column 'subscription' not found in table 'subscription'

```
if (subscription.subscription?.status === 'canceled') {
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 261:** Column 'daysUntilRenewal' not found in table 'subscription'

```
const daysRemaining = subscription.daysUntilRenewal || 0;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 307:** Column 'subscription' not found in table 'subscription'

```
if (subscription.subscription?.isFree) {
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 316:** Column 'isTrialing' not found in table 'subscription'

```
if (subscription.isTrialing) {
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 317:** Column 'trialDaysRemaining' not found in table 'subscription'

```
const days = subscription.trialDaysRemaining || 0;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 336:** Column 'plan' not found in table 'subscription'

```
{subscription.plan?.name}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `client\src\pages\SubscriptionSettings.tsx`

⚠️ **Line 118:** Column 'subscription' not found in table 'subscription'

```
const isFree = subscription.subscription?.isFree;
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 119:** Column 'isTrialing' not found in table 'subscription'

```
const isTrialing = subscription.isTrialing;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 120:** Column 'trialDaysRemaining' not found in table 'subscription'

```
const trialDaysRemaining = subscription.trialDaysRemaining || 0;
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 151:** Column 'plan' not found in table 'subscription'

```
<h3 className="text-2xl font-bold">{subscription.plan?.name}</h3>
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 154:** Column 'subscription' not found in table 'subscription'

```
${subscription.subscription?.amount}/
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 155:** Column 'subscription' not found in table 'subscription'

```
{subscription.subscription?.billingCycle === 'annual' ? 'year' : 'month'}
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 178:** Column 'subscription' not found in table 'subscription'

```
<span className="font-medium capitalize">{subscription.subscription?.status}</span>
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 183:** Column 'subscription' not found in table 'subscription'

```
{subscription.subscription?.billingCycle}
```

💡 **Suggestion:** Similar columns: subscription_id

---

⚠️ **Line 186:** Column 'daysUntilRenewal' not found in table 'subscription'

```
{subscription.daysUntilRenewal && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 190:** Column 'daysUntilRenewal' not found in table 'subscription'

```
{subscription.daysUntilRenewal} day
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 191:** Column 'daysUntilRenewal' not found in table 'subscription'

```
{subscription.daysUntilRenewal !== 1 ? 's' : ''}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 257:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.users === -1 ? 'Unlimited' : subscription.limits?.users}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 257:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.users === -1 ? 'Unlimited' : subscription.limits?.users}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 266:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.storage === -1
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 268:** Column 'limits' not found in table 'subscription'

```
: `${subscription.limits?.storage}GB`}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 277:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.apiCalls === -1
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 279:** Column 'limits' not found in table 'subscription'

```
: `${subscription.limits?.apiCalls.toLocaleString()}/mo`}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 288:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.locations === -1
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 290:** Column 'limits' not found in table 'subscription'

```
: subscription.limits?.locations}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 299:** Column 'limits' not found in table 'subscription'

```
{subscription.limits?.businessRecords === -1
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 301:** Column 'limits' not found in table 'subscription'

```
: subscription.limits?.businessRecords.toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 309:** Column 'usage' not found in table 'subscription'

```
{!isFree && subscription.usage && subscription.limits && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 309:** Column 'limits' not found in table 'subscription'

```
{!isFree && subscription.usage && subscription.limits && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 315:** Column 'daysUntilRenewal' not found in table 'subscription'

```
{subscription.daysUntilRenewal && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 318:** Column 'daysUntilRenewal' not found in table 'subscription'

```
• Resets in {subscription.daysUntilRenewal} day
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 319:** Column 'daysUntilRenewal' not found in table 'subscription'

```
{subscription.daysUntilRenewal !== 1 ? 's' : ''}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 329:** Column 'usage' not found in table 'subscription'

```
current={subscription.usage.users}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 330:** Column 'limits' not found in table 'subscription'

```
limit={subscription.limits.users}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 336:** Column 'usage' not found in table 'subscription'

```
current={Math.round(subscription.usage.storage / 1024)}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 337:** Column 'limits' not found in table 'subscription'

```
limit={subscription.limits.storage}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 343:** Column 'usage' not found in table 'subscription'

```
current={subscription.usage.apiCalls}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 344:** Column 'limits' not found in table 'subscription'

```
limit={subscription.limits.apiCalls}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 350:** Column 'usage' not found in table 'subscription'

```
current={subscription.usage.locations}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 351:** Column 'limits' not found in table 'subscription'

```
limit={subscription.limits.locations}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 357:** Column 'usage' not found in table 'subscription'

```
current={subscription.usage.businessRecords}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 358:** Column 'limits' not found in table 'subscription'

```
limit={subscription.limits.businessRecords}
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 363:** Column 'isOverLimit' not found in table 'subscription'

```
{subscription.isOverLimit && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 378:** Column 'plan' not found in table 'subscription'

```
{!isFree && subscription.plan && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 386:** Column 'plan' not found in table 'subscription'

```
{subscription.plan.slug === 'starter' && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

⚠️ **Line 436:** Column 'plan' not found in table 'subscription'

```
{subscription.plan.slug === 'professional' && (
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `client\src\pages\RemoteMonitoring.tsx`

⚠️ **Line 218:** Column 'lastPing' not found in table 'equipment'

```
lastPing: new Date(equipment.lastPing),
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 220:** Column 'currentMetrics' not found in table 'equipment'

```
...equipment.currentMetrics,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 221:** Column 'currentMetrics' not found in table 'equipment'

```
lastJobCompleted: new Date(equipment.currentMetrics.lastJobCompleted),
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 224:** Column 'maintenance' not found in table 'equipment'

```
...equipment.maintenance,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 225:** Column 'maintenance' not found in table 'equipment'

```
nextScheduled: new Date(equipment.maintenance.nextScheduled),
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 226:** Column 'maintenance' not found in table 'equipment'

```
lastCompleted: new Date(equipment.maintenance.lastCompleted),
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 227:** Column 'maintenance' not found in table 'equipment'

```
predictiveAlerts: equipment.maintenance.predictiveAlerts.map((alert: any) => ({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 232:** Column 'alerts' not found in table 'equipment'

```
alerts: equipment.alerts.map((alert: any) => ({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 432:** Column 'equipmentId' not found in table 'equipment'

```
<Card key={equipment.equipmentId} className="hover:shadow-md transition-shadow">
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 437:** Column 'connectionStatus' not found in table 'equipment'

```
{getStatusIcon(equipment.status, equipment.connectionStatus)}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 442:** Column 'connectionStatus' not found in table 'equipment'

```
{equipment.connectionStatus === 'connected' ? (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 469:** Column 'serialNumber' not found in table 'equipment'

```
{equipment.serialNumber}
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 474:** Column 'lastPing' not found in table 'equipment'

```
{format(equipment.lastPing, 'MMM dd, HH:mm')}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 484:** Column 'uptime' not found in table 'equipment'

```
{equipment.uptime.toFixed(1)}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 487:** Column 'uptime' not found in table 'equipment'

```
<Progress value={equipment.uptime} className="mt-1 h-2" />
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 491:** Column 'performance' not found in table 'equipment'

```
{equipment.performance.utilizationRate}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 495:** Column 'performance' not found in table 'equipment'

```
value={equipment.performance.utilizationRate}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 501:** Column 'performance' not found in table 'equipment'

```
{equipment.performance.efficiency.toFixed(1)}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 505:** Column 'performance' not found in table 'equipment'

```
value={equipment.performance.efficiency}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 511:** Column 'maintenance' not found in table 'equipment'

```
{equipment.maintenance.maintenanceScore}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 515:** Column 'maintenance' not found in table 'equipment'

```
value={equipment.maintenance.maintenanceScore}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 526:** Column 'currentMetrics' not found in table 'equipment'

```
{Object.entries(equipment.currentMetrics.tonerLevels).map(
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 543:** Column 'currentMetrics' not found in table 'equipment'

```
{Object.entries(equipment.currentMetrics.paperLevels).map(
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 561:** Column 'currentMetrics' not found in table 'equipment'

```
{equipment.currentMetrics.temperature && (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 569:** Column 'currentMetrics' not found in table 'equipment'

```
<span>{equipment.currentMetrics.temperature}°C</span>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 573:** Column 'currentMetrics' not found in table 'equipment'

```
<span>{equipment.currentMetrics.humidity}% humidity</span>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 577:** Column 'environmental' not found in table 'equipment'

```
<span>{equipment.environmental.powerConsumption}W</span>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 581:** Column 'environmental' not found in table 'equipment'

```
<span>Rating: {equipment.environmental.energyEfficiency}</span>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 588:** Column 'alerts' not found in table 'equipment'

```
{equipment.alerts.length > 0 && (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 591:** Column 'alerts' not found in table 'equipment'

```
Active Alerts ({equipment.alerts.length})
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 594:** Column 'alerts' not found in table 'equipment'

```
{equipment.alerts.slice(0, 3).map((alert) => (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 621:** Column 'alerts' not found in table 'equipment'

```
{equipment.alerts.length > 3 && (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 623:** Column 'alerts' not found in table 'equipment'

```
+{equipment.alerts.length - 3} more alerts
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 631:** Column 'maintenance' not found in table 'equipment'

```
{equipment.maintenance.predictiveAlerts.length > 0 && (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 637:** Column 'maintenance' not found in table 'equipment'

```
{equipment.maintenance.predictiveAlerts.map((alert, idx) => (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 663:** Column 'performance' not found in table 'equipment'

```
{equipment.performance.dailyPageCount.toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 669:** Column 'performance' not found in table 'equipment'

```
Weekly: {equipment.performance.weeklyPageCount.toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 672:** Column 'performance' not found in table 'equipment'

```
Monthly: {equipment.performance.monthlyPageCount.toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 675:** Column 'performance' not found in table 'equipment'

```
Avg Job: {equipment.performance.averageJobSize.toFixed(1)} pages
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 681:** Column 'maintenance' not found in table 'equipment'

```
<div>{format(equipment.maintenance.nextScheduled, 'MMM dd, yyyy')}</div>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 690:** Column 'equipmentId' not found in table 'equipment'

```
onClick={() => setSelectedEquipment(equipment.equipmentId)}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 699:** Column 'alerts' not found in table 'equipment'

```
{equipment.alerts.length > 0 && <Button size="sm">Resolve Alerts</Button>}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 832:** Column 'equipmentId' not found in table 'equipment'

```
<div key={equipment.equipmentId} className="border rounded-lg p-3">
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 837:** Column 'customerName' not found in table 'equipment'

```
{equipment.customerName}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 842:** Column 'priority' not found in table 'equipment'

```
equipment.priority === 'critical'
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 847:** Column 'priority' not found in table 'equipment'

```
{equipment.priority}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 852:** Column 'issues' not found in table 'equipment'

```
{equipment.issues.map((issue: string, idx: number) => (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 861:** Column 'estimatedRevenueLoss' not found in table 'equipment'

```
{equipment.estimatedRevenueLoss.toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1045:** Column 'alerts' not found in table 'equipment'

```
equipment.alerts.map((alert) => ({
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1047:** Column 'equipmentId' not found in table 'equipment'

```
equipmentId: equipment.equipmentId,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `client\src\pages\QuotesManagement.tsx`

⚠️ **Line 535:** Column 'savedFilters' not found in table 'quotes'

```
storageKey="quotes.savedFilters"
```

💡 **Suggestion:** Column not found in table 'quotes'

---

### `client\src\pages\Pricing.tsx`

⚠️ **Line 165:** Column 'plan' not found in table 'subscription'

```
plans.findIndex((p) => p.slug === subscription.plan?.slug) <
```

💡 **Suggestion:** Column not found in table 'subscription'

---

### `client\src\pages\ExecutiveDashboard.tsx`

⚠️ **Line 483:** Column 'churnRate' not found in table 'customers'

```
(executiveSummary?.customers.churnRate || 0) <= 5
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 485:** Column 'churnRate' not found in table 'customers'

```
: (executiveSummary?.customers.churnRate || 0) <= 10
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 490:** Column 'churnRate' not found in table 'customers'

```
{executiveSummary?.customers.churnRate.toFixed(1) || 0}%
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 496:** Column 'totalActive' not found in table 'customers'

```
{executiveSummary?.customers.totalActive?.toLocaleString() || '0'}
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 500:** Column 'newAcquisitions' not found in table 'customers'

```
+{executiveSummary?.customers.newAcquisitions || 0} new this period
```

💡 **Suggestion:** Column not found in table 'customers'

---

### `client\src\pages\EquipmentLifecycleHub.tsx`

⚠️ **Line 1171:** Column 'equipment_brand' not found in table 'equipment'

```
{equipment.equipment_brand} {equipment.equipment_model}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1171:** Column 'equipment_model' not found in table 'equipment'

```
{equipment.equipment_brand} {equipment.equipment_model}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1174:** Column 'customer_name' not found in table 'equipment'

```
{equipment.customer_name} • {equipment.progress_percentage}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1174:** Column 'progress_percentage' not found in table 'equipment'

```
{equipment.customer_name} • {equipment.progress_percentage}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1179:** Column 'stage_status' not found in table 'equipment'

```
{getStatusIcon(equipment.stage_status)}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1187:** Column 'equipment_id' not found in table 'equipment'

```
id: equipment.equipment_id,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 1188:** Column 'current_stage' not found in table 'equipment'

```
stage: equipment.current_stage,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `client\src\pages\DealsManagement.tsx`

⚠️ **Line 576:** Column 'visibleColumns' not found in table 'deals'

```
typeof window !== 'undefined' ? localStorage.getItem('deals.visibleColumns') : null;
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 594:** Column 'visibleColumns' not found in table 'deals'

```
localStorage.setItem('deals.visibleColumns', JSON.stringify(visibleColumns));
```

💡 **Suggestion:** Column not found in table 'deals'

---

### `client\src\pages\customers.tsx`

⚠️ **Line 676:** Column 'savedFilters' not found in table 'customers'

```
storageKey="customers.savedFilters"
```

💡 **Suggestion:** Column not found in table 'customers'

---

### `client\src\components\tasks\TaskBoardView.tsx`

⚠️ **Line 116:** Column 'forEach' not found in table 'tasks'

```
tasks.forEach((task) => {
```

💡 **Suggestion:** Column not found in table 'tasks'

---

### `client\src\components\layout\context-panel.tsx`

⚠️ **Line 166:** Column 'currentMeter' not found in table 'equipment'

```
value: equipment.currentMeter || 0,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 172:** Column 'nextPM' not found in table 'equipment'

```
value: equipment.nextPM || 'Not scheduled',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 177:** Column 'healthScore' not found in table 'equipment'

```
value: `${equipment.healthScore || 85}%`,
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 178:** Column 'healthScore' not found in table 'equipment'

```
trend: equipment.healthScore > 80 ? 'up' : 'down',
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `client\src\components\customer-portal\UsageAnalyticsDashboard.tsx`

⚠️ **Line 481:** Column 'equipmentId' not found in table 'equipment'

```
key={equipment.equipmentId}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 483:** Column 'equipmentId' not found in table 'equipment'

```
data-testid={`equipment-card-${equipment.equipmentId}`}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 487:** Column 'equipmentName' not found in table 'equipment'

```
<h4 className="font-medium">{equipment.equipmentName}</h4>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 489:** Column 'serialNumber' not found in table 'equipment'

```
Serial: {equipment.serialNumber}
```

💡 **Suggestion:** Did you mean 'equipment.serial_number'?

---

⚠️ **Line 495:** Column 'trendDirection' not found in table 'equipment'

```
equipment.trendDirection === 'up'
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 497:** Column 'trendDirection' not found in table 'equipment'

```
: equipment.trendDirection === 'down'
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 502:** Column 'trendDirection' not found in table 'equipment'

```
{equipment.trendDirection === 'up' ? (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 504:** Column 'trendDirection' not found in table 'equipment'

```
) : equipment.trendDirection === 'down' ? (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 509:** Column 'trendDirection' not found in table 'equipment'

```
{equipment.trendDirection}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 517:** Column 'totalImpressions' not found in table 'equipment'

```
<p className="font-medium">{equipment.totalImpressions.toLocaleString()}</p>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 522:** Column 'monthlyAverage' not found in table 'equipment'

```
{Math.round(equipment.monthlyAverage).toLocaleString()}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 527:** Column 'utilizationRate' not found in table 'equipment'

```
<p className="font-medium">{equipment.utilizationRate.toFixed(1)}%</p>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 531:** Column 'efficiency' not found in table 'equipment'

```
<p className="font-medium">{equipment.efficiency.toFixed(1)}%</p>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `client\src\components\customer-portal\EquipmentHealthDashboard.tsx`

⚠️ **Line 304:** Column 'equipmentName' not found in table 'equipment'

```
<h4 className="font-medium">{equipment.equipmentName}</h4>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 306:** Column 'make' not found in table 'equipment'

```
{equipment.make} {equipment.model} • {equipment.location}
```

💡 **Suggestion:** Similar columns: model

---

⚠️ **Line 314:** Column 'overallHealthScore' not found in table 'equipment'

```
className={`text-lg font-semibold ${getHealthColor(equipment.overallHealthScore)}`}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 316:** Column 'overallHealthScore' not found in table 'equipment'

```
{equipment.overallHealthScore}%
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 323:** Column 'connectionStatus' not found in table 'equipment'

```
{equipment.connectionStatus.isOnline ? (
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `client\src\components\customer\customer-360-view.tsx`

⚠️ **Line 504:** Column 'currentMeter' not found in table 'equipment'

```
<p className="text-sm font-medium">{equipment.currentMeter.toLocaleString()}</p>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 508:** Column 'avgMonthlyVolume' not found in table 'equipment'

```
<p className="text-sm font-medium">{equipment.avgMonthlyVolume.toLocaleString()}</p>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 513:** Column 'nextMaintenance' not found in table 'equipment'

```
{formatDistanceToNow(new Date(equipment.nextMaintenance), { addSuffix: true })}
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 521:** Column 'healthScore' not found in table 'equipment'

```
<div className="text-2xl font-bold">{equipment.healthScore}%</div>
```

💡 **Suggestion:** Column not found in table 'equipment'

---

### `shared\schema.ts`

⚠️ **Line 3692:** Column 'tenantId' not found in table 'teams'

```
fields: [teams.tenantId],
```

💡 **Suggestion:** Did you mean 'teams.tenant_id'?

---

⚠️ **Line 3696:** Column 'managerId' not found in table 'teams'

```
fields: [teams.managerId],
```

💡 **Suggestion:** Did you mean 'teams.manager_id'?

---

⚠️ **Line 3700:** Column 'parentTeamId' not found in table 'teams'

```
fields: [teams.parentTeamId],
```

💡 **Suggestion:** Did you mean 'teams.parent_team_id'?

---

⚠️ **Line 3709:** Column 'tenantId' not found in table 'users'

```
fields: [users.tenantId],
```

💡 **Suggestion:** Did you mean 'users.tenant_id'?

---

⚠️ **Line 3713:** Column 'roleId' not found in table 'users'

```
fields: [users.roleId],
```

💡 **Suggestion:** Did you mean 'users.role_id'?

---

⚠️ **Line 3717:** Column 'teamId' not found in table 'users'

```
fields: [users.teamId],
```

💡 **Suggestion:** Did you mean 'users.team_id'?

---

⚠️ **Line 3721:** Column 'managerId' not found in table 'users'

```
fields: [users.managerId],
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 3749:** Column 'tenantId' not found in table 'companies'

```
fields: [companies.tenantId],
```

💡 **Suggestion:** Did you mean 'companies.tenant_id'?

---

⚠️ **Line 3849:** Column 'tenantId' not found in table 'quotes'

```
fields: [quotes.tenantId],
```

💡 **Suggestion:** Did you mean 'quotes.tenant_id'?

---

⚠️ **Line 3853:** Column 'leadId' not found in table 'quotes'

```
fields: [quotes.leadId],
```

💡 **Suggestion:** Did you mean 'quotes.lead_id'?

---

⚠️ **Line 3857:** Column 'customerId' not found in table 'quotes'

```
fields: [quotes.customerId],
```

💡 **Suggestion:** Did you mean 'quotes.customer_id'?

---

⚠️ **Line 3861:** Column 'createdBy' not found in table 'quotes'

```
fields: [quotes.createdBy],
```

💡 **Suggestion:** Did you mean 'quotes.created_by'?

---

⚠️ **Line 3950:** Column 'tenantId' not found in table 'customers'

```
fields: [customers.tenantId],
```

💡 **Suggestion:** Did you mean 'customers.tenant_id'?

---

⚠️ **Line 3962:** Column 'tenantId' not found in table 'equipment'

```
fields: [equipment.tenantId],
```

💡 **Suggestion:** Did you mean 'equipment.tenant_id'?

---

⚠️ **Line 3966:** Column 'customerId' not found in table 'equipment'

```
fields: [equipment.customerId],
```

💡 **Suggestion:** Did you mean 'equipment.customer_id'?

---

⚠️ **Line 3976:** Column 'tenantId' not found in table 'contracts'

```
fields: [contracts.tenantId],
```

💡 **Suggestion:** Did you mean 'contracts.tenant_id'?

---

⚠️ **Line 3980:** Column 'customerId' not found in table 'contracts'

```
fields: [contracts.customerId],
```

💡 **Suggestion:** Did you mean 'contracts.customer_id'?

---

⚠️ **Line 4031:** Column 'tenantId' not found in table 'technicians'

```
fields: [technicians.tenantId],
```

💡 **Suggestion:** Did you mean 'technicians.tenant_id'?

---

⚠️ **Line 4035:** Column 'userId' not found in table 'technicians'

```
fields: [technicians.userId],
```

💡 **Suggestion:** Did you mean 'technicians.user_id'?

---

⚠️ **Line 4061:** Column 'tenantId' not found in table 'invoices'

```
fields: [invoices.tenantId],
```

💡 **Suggestion:** Did you mean 'invoices.tenant_id'?

---

⚠️ **Line 4065:** Column 'customerId' not found in table 'invoices'

```
fields: [invoices.customerId],
```

💡 **Suggestion:** Did you mean 'invoices.customer_id'?

---

⚠️ **Line 4069:** Column 'contractId' not found in table 'invoices'

```
fields: [invoices.contractId],
```

💡 **Suggestion:** Did you mean 'invoices.contract_id'?

---

⚠️ **Line 4073:** Column 'createdBy' not found in table 'invoices'

```
fields: [invoices.createdBy],
```

💡 **Suggestion:** Did you mean 'invoices.created_by'?

---

⚠️ **Line 4109:** Column 'tenantId' not found in table 'deals'

```
fields: [deals.tenantId],
```

💡 **Suggestion:** Did you mean 'deals.tenant_id'?

---

⚠️ **Line 4113:** Column 'stageId' not found in table 'deals'

```
fields: [deals.stageId],
```

💡 **Suggestion:** Did you mean 'deals.stage_id'?

---

⚠️ **Line 4117:** Column 'ownerId' not found in table 'deals'

```
fields: [deals.ownerId],
```

💡 **Suggestion:** Did you mean 'deals.owner_id'?

---

⚠️ **Line 4121:** Column 'customerId' not found in table 'deals'

```
fields: [deals.customerId],
```

💡 **Suggestion:** Did you mean 'deals.customer_id'?

---

⚠️ **Line 4125:** Column 'createdById' not found in table 'deals'

```
fields: [deals.createdById],
```

💡 **Suggestion:** Did you mean 'deals.created_by_id'?

---

### `supabase\functions\reports\index.ts`

⚠️ **Line 86:** Column 'data' not found in table 'quotes'

```
const activeQuotes = quotes.data?.filter((q) => q.status === 'sent').length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 87:** Column 'data' not found in table 'quotes'

```
const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 97:** Column 'data' not found in table 'quotes'

```
totalQuotes: quotes.data?.length || 0,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 130:** Column 'data' not found in table 'quotes'

```
const totalQuotes = quotes.data?.length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 131:** Column 'data' not found in table 'quotes'

```
const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 144:** Column 'data' not found in table 'customers'

```
const newCustomers = customers.data?.filter((c) => c.record_type === 'customer').length || 0;
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 145:** Column 'data' not found in table 'customers'

```
const newLeads = customers.data?.filter((c) => c.record_type === 'lead').length || 0;
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 157:** Column 'data' not found in table 'quotes'

```
? quotes.data
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 257:** Column 'data' not found in table 'quotes'

```
quotes.data
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 263:** Column 'data' not found in table 'quotes'

```
}, 0) / (quotes.data?.filter((q) => q.sent_date).length || 1);
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 280:** Column 'data' not found in table 'quotes'

```
quotes.data?.length > 0
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 282:** Column 'data' not found in table 'quotes'

```
(quotes.data?.filter((q) => q.status === 'accepted').length /
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 283:** Column 'data' not found in table 'quotes'

```
quotes.data.length) *
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 325:** Column 'data' not found in table 'customers'

```
customers.data?.filter((c) => c.territory === t.territory_name).length || 0;
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 356:** Column 'data' not found in table 'quotes'

```
quotes.data?.forEach((q) => {
```

💡 **Suggestion:** Column not found in table 'quotes'

---

### `supabase\functions\pipeline\index.ts`

⚠️ **Line 163:** Column 'data' not found in table 'deals'

```
const stageDeals = deals.data?.filter((d) => d.stage === stage.stage_name) || [];
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 179:** Column 'data' not found in table 'deals'

```
totalDeals: deals.data?.length || 0,
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 180:** Column 'data' not found in table 'deals'

```
totalValue: deals.data?.reduce((sum, d) => sum + parseFloat(d.deal_value || '0'), 0) || 0,
```

💡 **Suggestion:** Column not found in table 'deals'

---

### `supabase\functions\onboarding\index.ts`

⚠️ **Line 118:** Column 'data' not found in table 'equipment'

```
equipment: equipment.data || [],
```

💡 **Suggestion:** Column not found in table 'equipment'

---

⚠️ **Line 120:** Column 'data' not found in table 'tasks'

```
tasks: tasks.data || [],
```

💡 **Suggestion:** Similar columns: tags

---

### `supabase\functions\analytics\index.ts`

⚠️ **Line 87:** Column 'data' not found in table 'customers'

```
new: customers.data?.length || 0,
```

💡 **Suggestion:** Column not found in table 'customers'

---

⚠️ **Line 90:** Column 'data' not found in table 'quotes'

```
total: quotes.data?.length || 0,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 91:** Column 'data' not found in table 'quotes'

```
won: quotes.data?.filter((q) => q.status === 'accepted').length || 0,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 92:** Column 'data' not found in table 'quotes'

```
pending: quotes.data?.filter((q) => q.status === 'sent').length || 0,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 94:** Column 'data' not found in table 'quotes'

```
quotes.data?.reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0,
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 123:** Column 'data' not found in table 'quotes'

```
const totalQuotes = quotes.data?.length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 124:** Column 'data' not found in table 'quotes'

```
const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 128:** Column 'data' not found in table 'quotes'

```
quotes.data
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 135:** Column 'data' not found in table 'quotes'

```
const byRep = quotes.data?.reduce((acc: Record<string, any>, q) => {
```

💡 **Suggestion:** Column not found in table 'quotes'

---

⚠️ **Line 227:** Column 'data' not found in table 'tasks'

```
const totalTasks = tasks.data?.length || 0;
```

💡 **Suggestion:** Similar columns: tags

---

⚠️ **Line 228:** Column 'data' not found in table 'tasks'

```
const completedTasks = tasks.data?.filter((t) => t.status === 'completed').length || 0;
```

💡 **Suggestion:** Similar columns: tags

---

⚠️ **Line 231:** Column 'data' not found in table 'users'

```
const userPerformance = users.data?.map((u) => {
```

💡 **Suggestion:** Column not found in table 'users'

---

⚠️ **Line 232:** Column 'data' not found in table 'tasks'

```
const userTasks = tasks.data?.filter((t) => t.assigned_to === u.id) || [];
```

💡 **Suggestion:** Similar columns: tags

---

### `scripts\migrate-business-records-to-companies.ts`

⚠️ **Line 78:** Column 'ts' not found in table 'companies'

```
'**/scripts/migrate-business-records-to-companies.ts', // Don't analyze self
```

💡 **Suggestion:** Similar columns: id, notes, fax

---

### `migrations\ai-enhancement-migration.sql`

⚠️ **Line 57:** Column 'ai_lead_score' not found in table 'business_records'

```
COMMENT ON COLUMN business_records.ai_lead_score IS 'AI-calculated lead score (0-100)';
```

💡 **Suggestion:** Similar columns: lead_score

---

⚠️ **Line 58:** Column 'ai_conversion_probability' not found in table 'business_records'

```
COMMENT ON COLUMN business_records.ai_conversion_probability IS 'AI-predicted conversion probability (0-100)';
```

💡 **Suggestion:** Column not found in table 'business_records'

---

⚠️ **Line 59:** Column 'ai_close_probability' not found in table 'deals'

```
COMMENT ON COLUMN deals.ai_close_probability IS 'AI-predicted close probability (0-100)';
```

💡 **Suggestion:** Column not found in table 'deals'

---

⚠️ **Line 60:** Column 'ai_deal_health_score' not found in table 'deals'

```
COMMENT ON COLUMN deals.ai_deal_health_score IS 'AI-calculated deal health score (0-100)';
```

💡 **Suggestion:** Column not found in table 'deals'

---

## 🎯 Recommendations

### Critical Issues

1. Fix all NEON database references immediately
2. Update invalid table references to match DATABASE_SCHEMA.md
3. Verify all database connection strings point to Supabase (209.145.59.219:5433)

### Warnings

1. Review and fix invalid column references
2. Update deprecated patterns to modern equivalents
3. Ensure camelCase vs snake_case consistency

## Next Steps

1. Review this report and prioritize fixes
2. Update code to reference correct tables and columns
3. Remove all NEON database references
4. Re-run validation: `npx tsx tests/schema-validator.ts`
5. Update DATABASE_SCHEMA.md if schema changes are needed

