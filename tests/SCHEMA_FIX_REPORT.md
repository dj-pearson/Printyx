# Schema Auto-Fix Report

**Generated:** 2026-01-26T22:43:19.735Z
**Mode:** dry-run

## Summary

- **Files Modified:** 324
- **Total Fixes:** 4540

## CASE MISMATCH

Found 4540 fix(es)

### `server\websocket-service.ts`

✅ **Line 251** (high confidence)

**Before:**
```
client.tenantId,
```

**After:**
```
client.tenant_id,
```

---

✅ **Line 264** (high confidence)

**Before:**
```
const kpiData = await this.getCurrentKPIData(client.tenantId, kpiId);
```

**After:**
```
const kpiData = await this.getCurrentKPIData(client.tenant_id, kpiId);
```

---

✅ **Line 361** (high confidence)

**Before:**
```
.map((client) => client.tenantId),
```

**After:**
```
.map((client) => client.tenant_id),
```

---

✅ **Line 398** (high confidence)

**Before:**
```
.map((client) => client.tenantId),
```

**After:**
```
.map((client) => client.tenant_id),
```

---

### `server\test-toner-order.ts`

✅ **Line 67** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, TEST_TENANT_ID),
```

**After:**
```
eq(deviceRegistrations.tenant_id, TEST_TENANT_ID),
```

---

✅ **Line 135** (high confidence)

**Before:**
```
eq(serviceContracts.tenantId, TEST_TENANT_ID),
```

**After:**
```
eq(serviceContracts.tenant_id, TEST_TENANT_ID),
```

---

### `server\storage.ts`

⚠️ **Line 1903** (medium confidence)

**Before:**
```
createdAt: masterProductModels.createdAt,
```

**After:**
```
createdAt: masterProductModels.created_at,
```

---

⚠️ **Line 1904** (medium confidence)

**Before:**
```
updatedAt: masterProductModels.updatedAt,
```

**After:**
```
updatedAt: masterProductModels.updated_at,
```

---

⚠️ **Line 1925** (medium confidence)

**Before:**
```
createdAt: masterProductAccessories.createdAt,
```

**After:**
```
createdAt: masterProductAccessories.created_at,
```

---

⚠️ **Line 1926** (medium confidence)

**Before:**
```
updatedAt: masterProductAccessories.updatedAt,
```

**After:**
```
updatedAt: masterProductAccessories.updated_at,
```

---

⚠️ **Line 1966** (medium confidence)

**Before:**
```
modelQuery.orderBy(desc(masterProductModels.updatedAt)),
```

**After:**
```
modelQuery.orderBy(desc(masterProductModels.updated_at)),
```

---

⚠️ **Line 1967** (medium confidence)

**Before:**
```
accessoryQuery.orderBy(desc(masterProductAccessories.updatedAt)),
```

**After:**
```
accessoryQuery.orderBy(desc(masterProductAccessories.updated_at)),
```

---

⚠️ **Line 1972** (medium confidence)

**Before:**
```
(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
```

**After:**
```
(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
```

---

✅ **Line 2084** (high confidence)

**Before:**
```
tenantId: enabledProducts.tenantId,
```

**After:**
```
tenantId: enabledProducts.tenant_id,
```

---

✅ **Line 2105** (high confidence)

**Before:**
```
.where(and(eq(enabledProducts.tenantId, tenantId), eq(enabledProducts.enabled, true)))
```

**After:**
```
.where(and(eq(enabledProducts.tenant_id, tenantId), eq(enabledProducts.enabled, true)))
```

---

✅ **Line 2121** (high confidence)

**Before:**
```
eq(enabledProducts.tenantId, tenantId),
```

**After:**
```
eq(enabledProducts.tenant_id, tenantId),
```

---

✅ **Line 2206** (high confidence)

**Before:**
```
.where(eq(users.tenantId, tenantId));
```

**After:**
```
.where(eq(users.tenant_id, tenantId));
```

---

✅ **Line 2294** (high confidence)

**Before:**
```
let query = db.select().from(customers).where(eq(customers.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(customers).where(eq(customers.tenant_id, tenantId));
```

---

⚠️ **Line 2304** (medium confidence)

**Before:**
```
eq(userCustomerAssignments.userId, userId),
```

**After:**
```
eq(userCustomerAssignments.user_id, userId),
```

---

✅ **Line 2305** (high confidence)

**Before:**
```
eq(userCustomerAssignments.tenantId, tenantId),
```

**After:**
```
eq(userCustomerAssignments.tenant_id, tenantId),
```

---

✅ **Line 2322** (high confidence)

**Before:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenant_id, tenantId)));
```

---

⚠️ **Line 2330** (medium confidence)

**Before:**
```
userCustomerAssignments.userId,
```

**After:**
```
userCustomerAssignments.user_id,
```

---

⚠️ **Line 2331** (medium confidence)

**Before:**
```
teamUserIds.map((u) => u.userId),
```

**After:**
```
teamUserIds.map((u) => u.user_id),
```

---

✅ **Line 2333** (high confidence)

**Before:**
```
eq(userCustomerAssignments.tenantId, tenantId),
```

**After:**
```
eq(userCustomerAssignments.tenant_id, tenantId),
```

---

✅ **Line 2357** (high confidence)

**Before:**
```
let query = db.select().from(leads).where(eq(leads.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(leads).where(eq(leads.tenant_id, tenantId));
```

---

✅ **Line 2367** (high confidence)

**Before:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenant_id, tenantId)));
```

---

⚠️ **Line 2372** (medium confidence)

**Before:**
```
teamUserIds.map((u) => u.userId),
```

**After:**
```
teamUserIds.map((u) => u.user_id),
```

---

✅ **Line 2386** (high confidence)

**Before:**
```
let query = db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(serviceTickets).where(eq(serviceTickets.tenant_id, tenantId));
```

---

⚠️ **Line 2398** (medium confidence)

**Before:**
```
.innerJoin(users, eq(technicians.userId, users.id))
```

**After:**
```
.innerJoin(users, eq(technicians.user_id, users.id))
```

---

✅ **Line 2399** (high confidence)

**Before:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenant_id, tenantId)));
```

---

✅ **Line 2420** (high confidence)

**Before:**
```
let query = db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(contracts).where(eq(contracts.tenant_id, tenantId));
```

---

✅ **Line 2430** (high confidence)

**Before:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(users.teamId, teamId), eq(users.tenant_id, tenantId)));
```

---

⚠️ **Line 2435** (medium confidence)

**Before:**
```
teamUserIds.map((u) => u.userId),
```

**After:**
```
teamUserIds.map((u) => u.user_id),
```

---

✅ **Line 2445** (high confidence)

**Before:**
```
return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
```

**After:**
```
return await db.select().from(customers).where(eq(customers.tenant_id, tenantId));
```

---

✅ **Line 2453** (high confidence)

**Before:**
```
.where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customers.id, customerId), eq(customers.tenant_id, tenantId)))
```

---

✅ **Line 2475** (high confidence)

**Before:**
```
.where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customers.id, id), eq(customers.tenant_id, tenantId)))
```

---

✅ **Line 2483** (high confidence)

**Before:**
```
.where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(customers.id, id), eq(customers.tenant_id, tenantId)));
```

---

✅ **Line 2493** (high confidence)

**Before:**
```
.where(and(eq(equipment.customerId, customerId), eq(equipment.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(equipment.customerId, customerId), eq(equipment.tenant_id, tenantId)));
```

---

✅ **Line 2505** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.customerId, customerId), eq(meterReadings.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterReadings.customerId, customerId), eq(meterReadings.tenant_id, tenantId)))
```

---

✅ **Line 2518** (high confidence)

**Before:**
```
.where(and(eq(invoices.customerId, customerId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.customerId, customerId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 2532** (high confidence)

**Before:**
```
and(eq(serviceTickets.customerId, customerId), eq(serviceTickets.tenantId, tenantId)),
```

**After:**
```
and(eq(serviceTickets.customerId, customerId), eq(serviceTickets.tenant_id, tenantId)),
```

---

⚠️ **Line 2534** (medium confidence)

**Before:**
```
.orderBy(desc(serviceTickets.createdAt));
```

**After:**
```
.orderBy(desc(serviceTickets.created_at));
```

---

✅ **Line 2546** (high confidence)

**Before:**
```
.where(and(eq(contracts.customerId, customerId), eq(contracts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(contracts.customerId, customerId), eq(contracts.tenant_id, tenantId)));
```

---

✅ **Line 2555** (high confidence)

**Before:**
```
return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
```

**After:**
```
return await db.select().from(companies).where(eq(companies.tenant_id, tenantId));
```

---

✅ **Line 2562** (high confidence)

**Before:**
```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companies.id, id), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 2576** (high confidence)

**Before:**
```
.where(and(eq(companies.businessName, name.trim()), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companies.businessName, name.trim()), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 2597** (high confidence)

**Before:**
```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(companies.id, id), eq(companies.tenant_id, tenantId)))
```

---

✅ **Line 2605** (high confidence)

**Before:**
```
.where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companies.id, id), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 2614** (high confidence)

**Before:**
```
.where(and(eq(companyContacts.companyId, companyId), eq(companyContacts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companyContacts.companyId, companyId), eq(companyContacts.tenant_id, tenantId)));
```

---

✅ **Line 2621** (high confidence)

**Before:**
```
.where(eq(companyContacts.tenantId, tenantId))
```

**After:**
```
.where(eq(companyContacts.tenant_id, tenantId))
```

---

⚠️ **Line 2622** (medium confidence)

**Before:**
```
.orderBy(desc(companyContacts.createdAt));
```

**After:**
```
.orderBy(desc(companyContacts.created_at));
```

---

✅ **Line 2629** (high confidence)

**Before:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenant_id, tenantId)));
```

---

✅ **Line 2648** (high confidence)

**Before:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenant_id, tenantId)))
```

---

✅ **Line 2656** (high confidence)

**Before:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companyContacts.id, id), eq(companyContacts.tenant_id, tenantId)));
```

---

✅ **Line 2811** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 2820** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.urlSlug, urlSlug), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.urlSlug, urlSlug), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 2838** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 2858** (high confidence)

**Before:**
```
return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
```

**After:**
```
return await db.select().from(quotes).where(eq(quotes.tenant_id, tenantId));
```

---

✅ **Line 2868** (high confidence)

**Before:**
```
return await db.select().from(equipment).where(eq(equipment.tenantId, tenantId));
```

**After:**
```
return await db.select().from(equipment).where(eq(equipment.tenant_id, tenantId));
```

---

✅ **Line 2880** (high confidence)

**Before:**
```
return await db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
```

**After:**
```
return await db.select().from(contracts).where(eq(contracts.tenant_id, tenantId));
```

---

✅ **Line 2892** (high confidence)

**Before:**
```
return await db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
```

**After:**
```
return await db.select().from(serviceTickets).where(eq(serviceTickets.tenant_id, tenantId));
```

---

✅ **Line 2910** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenant_id, tenantId)))
```

---

✅ **Line 2917** (high confidence)

**Before:**
```
return await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
```

**After:**
```
return await db.select().from(inventoryItems).where(eq(inventoryItems.tenant_id, tenantId));
```

---

✅ **Line 2935** (high confidence)

**Before:**
```
.where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenant_id, tenantId)))
```

---

✅ **Line 2942** (high confidence)

**Before:**
```
return await db.select().from(technicians).where(eq(technicians.tenantId, tenantId));
```

**After:**
```
return await db.select().from(technicians).where(eq(technicians.tenant_id, tenantId));
```

---

✅ **Line 2954** (high confidence)

**Before:**
```
return await db.select().from(meterReadings).where(eq(meterReadings.tenantId, tenantId));
```

**After:**
```
return await db.select().from(meterReadings).where(eq(meterReadings.tenant_id, tenantId));
```

---

✅ **Line 2968** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.billingStatus, status)));
```

**After:**
```
.where(and(eq(meterReadings.tenant_id, tenantId), eq(meterReadings.billingStatus, status)));
```

---

✅ **Line 2979** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.id, id), eq(meterReadings.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterReadings.id, id), eq(meterReadings.tenant_id, tenantId)))
```

---

✅ **Line 2988** (high confidence)

**Before:**
```
.where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(contracts.id, id), eq(contracts.tenant_id, tenantId)));
```

---

✅ **Line 2994** (high confidence)

**Before:**
```
return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
```

**After:**
```
return await db.select().from(invoices).where(eq(invoices.tenant_id, tenantId));
```

---

⚠️ **Line 3012** (medium confidence)

**Before:**
```
eq(userCustomerAssignments.userId, userId),
```

**After:**
```
eq(userCustomerAssignments.user_id, userId),
```

---

✅ **Line 3013** (high confidence)

**Before:**
```
eq(userCustomerAssignments.tenantId, tenantId),
```

**After:**
```
eq(userCustomerAssignments.tenant_id, tenantId),
```

---

✅ **Line 3030** (high confidence)

**Before:**
```
.where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leads.id, id), eq(leads.tenant_id, tenantId)));
```

---

✅ **Line 3058** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 3100** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 3137** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 3159** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 3174** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 3199** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

⚠️ **Line 3202** (medium confidence)

**Before:**
```
.orderBy(sql`${businessRecordActivities.createdAt} DESC`);
```

**After:**
```
.orderBy(sql`${businessRecordActivities.created_at} DESC`);
```

---

✅ **Line 3231** (high confidence)

**Before:**
```
.where(eq(businessRecordActivities.tenantId, tenantId))
```

**After:**
```
.where(eq(businessRecordActivities.tenant_id, tenantId))
```

---

⚠️ **Line 3232** (medium confidence)

**Before:**
```
.orderBy(desc(businessRecordActivities.createdAt));
```

**After:**
```
.orderBy(desc(businessRecordActivities.created_at));
```

---

✅ **Line 3301** (high confidence)

**Before:**
```
.where(and(eq(leadContacts.leadId, leadId), eq(leadContacts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leadContacts.leadId, leadId), eq(leadContacts.tenant_id, tenantId)));
```

---

✅ **Line 3316** (high confidence)

**Before:**
```
.where(and(eq(leadRelatedRecords.leadId, leadId), eq(leadRelatedRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leadRelatedRecords.leadId, leadId), eq(leadRelatedRecords.tenant_id, tenantId)));
```

---

✅ **Line 3340** (high confidence)

**Before:**
```
tenantId: productModels.tenantId,
```

**After:**
```
tenantId: productModels.tenant_id,
```

---

⚠️ **Line 3341** (medium confidence)

**Before:**
```
createdAt: productModels.createdAt,
```

**After:**
```
createdAt: productModels.created_at,
```

---

⚠️ **Line 3342** (medium confidence)

**Before:**
```
updatedAt: productModels.updatedAt,
```

**After:**
```
updatedAt: productModels.updated_at,
```

---

✅ **Line 3345** (high confidence)

**Before:**
```
.where(eq(productModels.tenantId, tenantId))
```

**After:**
```
.where(eq(productModels.tenant_id, tenantId))
```

---

✅ **Line 3353** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenant_id, tenantId)));
```

---

✅ **Line 3364** (high confidence)

**Before:**
```
.where(and(eq(productModels.productCode, productCode), eq(productModels.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(productModels.productCode, productCode), eq(productModels.tenant_id, tenantId)));
```

---

✅ **Line 3380** (high confidence)

**Before:**
```
eq(productModels.tenantId, tenantId),
```

**After:**
```
eq(productModels.tenant_id, tenantId),
```

---

✅ **Line 3413** (high confidence)

**Before:**
```
eq(productAccessories.tenantId, tenantId),
```

**After:**
```
eq(productAccessories.tenant_id, tenantId),
```

---

✅ **Line 3434** (high confidence)

**Before:**
```
eq(productAccessories.tenantId, tenantId),
```

**After:**
```
eq(productAccessories.tenant_id, tenantId),
```

---

✅ **Line 3454** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 3462** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, id), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 3499** (high confidence)

**Before:**
```
.where(eq(productAccessories.tenantId, tenantId))
```

**After:**
```
.where(eq(productAccessories.tenant_id, tenantId))
```

---

✅ **Line 3513** (high confidence)

**Before:**
```
eq(productAccessories.tenantId, tenantId),
```

**After:**
```
eq(productAccessories.tenant_id, tenantId),
```

---

✅ **Line 3530** (high confidence)

**Before:**
```
eq(accessoryModelCompatibility.tenantId, tenantId),
```

**After:**
```
eq(accessoryModelCompatibility.tenant_id, tenantId),
```

---

✅ **Line 3547** (high confidence)

**Before:**
```
eq(productAccessories.tenantId, tenantId),
```

**After:**
```
eq(productAccessories.tenant_id, tenantId),
```

---

✅ **Line 3561** (high confidence)

**Before:**
```
.where(and(eq(productAccessories.id, id), eq(productAccessories.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(productAccessories.id, id), eq(productAccessories.tenant_id, tenantId)));
```

---

✅ **Line 3573** (high confidence)

**Before:**
```
.where(and(eq(productAccessories.id, id), eq(productAccessories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productAccessories.id, id), eq(productAccessories.tenant_id, tenantId)))
```

---

✅ **Line 3589** (high confidence)

**Before:**
```
eq(accessoryModelCompatibility.tenantId, tenantId),
```

**After:**
```
eq(accessoryModelCompatibility.tenant_id, tenantId),
```

---

✅ **Line 3604** (high confidence)

**Before:**
```
eq(accessoryModelCompatibility.tenantId, tenantId),
```

**After:**
```
eq(accessoryModelCompatibility.tenant_id, tenantId),
```

---

✅ **Line 3627** (high confidence)

**Before:**
```
eq(accessoryModelCompatibility.tenantId, tenantId),
```

**After:**
```
eq(accessoryModelCompatibility.tenant_id, tenantId),
```

---

✅ **Line 3636** (high confidence)

**Before:**
```
.where(and(eq(cpcRates.modelId, modelId), eq(cpcRates.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(cpcRates.modelId, modelId), eq(cpcRates.tenant_id, tenantId)))
```

---

✅ **Line 3650** (high confidence)

**Before:**
```
.where(eq(contractTieredRates.tenantId, tenantId))
```

**After:**
```
.where(eq(contractTieredRates.tenant_id, tenantId))
```

---

✅ **Line 3670** (high confidence)

**Before:**
```
let query = db.select().from(tasks).where(eq(tasks.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(tasks).where(eq(tasks.tenant_id, tenantId));
```

---

⚠️ **Line 3676** (medium confidence)

**Before:**
```
return await query.orderBy(desc(tasks.createdAt)).limit(50);
```

**After:**
```
return await query.orderBy(desc(tasks.created_at)).limit(50);
```

---

✅ **Line 3683** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, id), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 3696** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(tasks.id, id), eq(tasks.tenant_id, tenantId)))
```

---

✅ **Line 3709** (high confidence)

**Before:**
```
.where(eq(tasks.tenantId, tenantId));
```

**After:**
```
.where(eq(tasks.tenant_id, tenantId));
```

---

✅ **Line 3742** (high confidence)

**Before:**
```
eq(tasks.tenantId, tenantId),
```

**After:**
```
eq(tasks.tenant_id, tenantId),
```

---

✅ **Line 3757** (high confidence)

**Before:**
```
.where(eq(projects.tenantId, tenantId))
```

**After:**
```
.where(eq(projects.tenant_id, tenantId))
```

---

⚠️ **Line 3758** (medium confidence)

**Before:**
```
.orderBy(desc(projects.createdAt));
```

**After:**
```
.orderBy(desc(projects.created_at));
```

---

✅ **Line 3777** (high confidence)

**Before:**
```
.where(tenantId ? eq(performanceMetrics.tenantId, tenantId) : sql`TRUE`)
```

**After:**
```
.where(tenantId ? eq(performanceMetrics.tenant_id, tenantId) : sql`TRUE`)
```

---

✅ **Line 3816** (high confidence)

**Before:**
```
tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`,
```

**After:**
```
tenantId ? eq(systemAlerts.tenant_id, tenantId) : sql`TRUE`,
```

---

✅ **Line 3832** (high confidence)

**Before:**
```
tenantId: systemAlerts.tenantId,
```

**After:**
```
tenantId: systemAlerts.tenant_id,
```

---

⚠️ **Line 3838** (medium confidence)

**Before:**
```
createdAt: systemAlerts.createdAt,
```

**After:**
```
createdAt: systemAlerts.created_at,
```

---

⚠️ **Line 3839** (medium confidence)

**Before:**
```
updatedAt: systemAlerts.updatedAt,
```

**After:**
```
updatedAt: systemAlerts.updated_at,
```

---

✅ **Line 3844** (high confidence)

**Before:**
```
.where(tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`)
```

**After:**
```
.where(tenantId ? eq(systemAlerts.tenant_id, tenantId) : sql`TRUE`)
```

---

⚠️ **Line 3845** (medium confidence)

**Before:**
```
.where(gte(systemAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
```

**After:**
```
.where(gte(systemAlerts.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
```

---

⚠️ **Line 3846** (medium confidence)

**Before:**
```
.orderBy(desc(systemAlerts.createdAt))
```

**After:**
```
.orderBy(desc(systemAlerts.created_at))
```

---

✅ **Line 3870** (high confidence)

**Before:**
```
.where(tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`)
```

**After:**
```
.where(tenantId ? eq(systemIntegrations.tenant_id, tenantId) : sql`TRUE`)
```

---

✅ **Line 3890** (high confidence)

**Before:**
```
tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`,
```

**After:**
```
tenantId ? eq(systemIntegrations.tenant_id, tenantId) : sql`TRUE`,
```

---

✅ **Line 3902** (high confidence)

**Before:**
```
.where(eq(professionalServices.tenantId, tenantId))
```

**After:**
```
.where(eq(professionalServices.tenant_id, tenantId))
```

---

✅ **Line 3916** (high confidence)

**Before:**
```
eq(professionalServices.tenantId, tenantId),
```

**After:**
```
eq(professionalServices.tenant_id, tenantId),
```

---

✅ **Line 3937** (high confidence)

**Before:**
```
.where(and(eq(professionalServices.id, id), eq(professionalServices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(professionalServices.id, id), eq(professionalServices.tenant_id, tenantId)))
```

---

✅ **Line 3945** (high confidence)

**Before:**
```
.where(and(eq(professionalServices.id, id), eq(professionalServices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(professionalServices.id, id), eq(professionalServices.tenant_id, tenantId)));
```

---

✅ **Line 3954** (high confidence)

**Before:**
```
.where(eq(serviceProducts.tenantId, tenantId))
```

**After:**
```
.where(eq(serviceProducts.tenant_id, tenantId))
```

---

✅ **Line 3968** (high confidence)

**Before:**
```
.where(eq(softwareProducts.tenantId, tenantId))
```

**After:**
```
.where(eq(softwareProducts.tenant_id, tenantId))
```

---

✅ **Line 3980** (high confidence)

**Before:**
```
and(eq(softwareProducts.productCode, productCode), eq(softwareProducts.tenantId, tenantId)),
```

**After:**
```
and(eq(softwareProducts.productCode, productCode), eq(softwareProducts.tenant_id, tenantId)),
```

---

✅ **Line 3998** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenant_id, tenantId)))
```

---

✅ **Line 4006** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenant_id, tenantId)));
```

---

✅ **Line 4013** (high confidence)

**Before:**
```
.where(and(inArray(softwareProducts.id, ids), eq(softwareProducts.tenantId, tenantId)));
```

**After:**
```
.where(and(inArray(softwareProducts.id, ids), eq(softwareProducts.tenant_id, tenantId)));
```

---

✅ **Line 4053** (high confidence)

**Before:**
```
.where(eq(managedServices.tenantId, tenantId))
```

**After:**
```
.where(eq(managedServices.tenant_id, tenantId))
```

---

✅ **Line 4065** (high confidence)

**Before:**
```
and(eq(managedServices.productCode, productCode), eq(managedServices.tenantId, tenantId)),
```

**After:**
```
and(eq(managedServices.productCode, productCode), eq(managedServices.tenant_id, tenantId)),
```

---

✅ **Line 4075** (high confidence)

**Before:**
```
.where(eq(supplies.tenantId, tenantId))
```

**After:**
```
.where(eq(supplies.tenant_id, tenantId))
```

---

✅ **Line 4083** (high confidence)

**Before:**
```
.where(and(eq(supplies.productCode, productCode), eq(supplies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(supplies.productCode, productCode), eq(supplies.tenant_id, tenantId)));
```

---

✅ **Line 4100** (high confidence)

**Before:**
```
.where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(supplies.id, id), eq(supplies.tenant_id, tenantId)))
```

---

✅ **Line 4108** (high confidence)

**Before:**
```
.where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(supplies.id, id), eq(supplies.tenant_id, tenantId)));
```

---

✅ **Line 4125** (high confidence)

**Before:**
```
.where(and(eq(managedServices.id, id), eq(managedServices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(managedServices.id, id), eq(managedServices.tenant_id, tenantId)))
```

---

✅ **Line 4133** (high confidence)

**Before:**
```
.where(and(eq(managedServices.id, id), eq(managedServices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(managedServices.id, id), eq(managedServices.tenant_id, tenantId)));
```

---

✅ **Line 4159** (high confidence)

**Before:**
```
eq(leadContacts.tenantId, tenantId),
```

**After:**
```
eq(leadContacts.tenant_id, tenantId),
```

---

✅ **Line 4180** (high confidence)

**Before:**
```
.where(and(eq(leadContacts.id, contactId), eq(leadContacts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leadContacts.id, contactId), eq(leadContacts.tenant_id, tenantId)));
```

---

✅ **Line 4200** (high confidence)

**Before:**
```
and(eq(enhancedContacts.companyName, companyName), eq(enhancedContacts.tenantId, tenantId)),
```

**After:**
```
and(eq(enhancedContacts.companyName, companyName), eq(enhancedContacts.tenant_id, tenantId)),
```

---

✅ **Line 4209** (high confidence)

**Before:**
```
return await db.select().from(vendors).where(eq(vendors.tenantId, tenantId));
```

**After:**
```
return await db.select().from(vendors).where(eq(vendors.tenant_id, tenantId));
```

---

✅ **Line 4216** (high confidence)

**Before:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenant_id, tenantId)));
```

---

✅ **Line 4233** (high confidence)

**Before:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenant_id, tenantId)))
```

---

✅ **Line 4241** (high confidence)

**Before:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(vendors.id, id), eq(vendors.tenant_id, tenantId)));
```

---

✅ **Line 4247** (high confidence)

**Before:**
```
return await db.select().from(accountsPayable).where(eq(accountsPayable.tenantId, tenantId));
```

**After:**
```
return await db.select().from(accountsPayable).where(eq(accountsPayable.tenant_id, tenantId));
```

---

✅ **Line 4254** (high confidence)

**Before:**
```
.where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenant_id, tenantId)));
```

---

✅ **Line 4271** (high confidence)

**Before:**
```
.where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenant_id, tenantId)))
```

---

✅ **Line 4281** (high confidence)

**Before:**
```
.where(eq(accountsReceivable.tenantId, tenantId));
```

**After:**
```
.where(eq(accountsReceivable.tenant_id, tenantId));
```

---

✅ **Line 4291** (high confidence)

**Before:**
```
.where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenant_id, tenantId)));
```

---

✅ **Line 4308** (high confidence)

**Before:**
```
.where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenant_id, tenantId)))
```

---

✅ **Line 4315** (high confidence)

**Before:**
```
return await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, tenantId));
```

**After:**
```
return await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenant_id, tenantId));
```

---

✅ **Line 4322** (high confidence)

**Before:**
```
.where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenant_id, tenantId)));
```

---

✅ **Line 4339** (high confidence)

**Before:**
```
.where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenant_id, tenantId)))
```

---

✅ **Line 4346** (high confidence)

**Before:**
```
return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
```

**After:**
```
return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenant_id, tenantId));
```

---

✅ **Line 4353** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenant_id, tenantId)));
```

---

✅ **Line 4370** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenant_id, tenantId)))
```

---

✅ **Line 4385** (high confidence)

**Before:**
```
eq(purchaseOrderItems.tenantId, tenantId),
```

**After:**
```
eq(purchaseOrderItems.tenant_id, tenantId),
```

---

✅ **Line 4403** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenant_id, tenantId)))
```

---

✅ **Line 4413** (high confidence)

**Before:**
```
and(eq(purchaseOrderItems.purchaseOrderId, id), eq(purchaseOrderItems.tenantId, tenantId)),
```

**After:**
```
and(eq(purchaseOrderItems.purchaseOrderId, id), eq(purchaseOrderItems.tenant_id, tenantId)),
```

---

✅ **Line 4419** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenant_id, tenantId)));
```

---

✅ **Line 4427** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenant_id, tenantId)));
```

---

✅ **Line 4445** (high confidence)

**Before:**
```
eq(companyContacts.tenantId, tenantId),
```

**After:**
```
eq(companyContacts.tenant_id, tenantId),
```

---

⚠️ **Line 4487** (medium confidence)

**Before:**
```
createdAt: deals.createdAt,
```

**After:**
```
createdAt: deals.created_at,
```

---

⚠️ **Line 4488** (medium confidence)

**Before:**
```
updatedAt: deals.updatedAt,
```

**After:**
```
updatedAt: deals.updated_at,
```

---

✅ **Line 4493** (high confidence)

**Before:**
```
.where(eq(deals.tenantId, tenantId));
```

**After:**
```
.where(eq(deals.tenant_id, tenantId));
```

---

⚠️ **Line 4513** (medium confidence)

**Before:**
```
return await query.orderBy(desc(deals.createdAt));
```

**After:**
```
return await query.orderBy(desc(deals.created_at));
```

---

⚠️ **Line 4541** (medium confidence)

**Before:**
```
createdAt: deals.createdAt,
```

**After:**
```
createdAt: deals.created_at,
```

---

⚠️ **Line 4542** (medium confidence)

**Before:**
```
updatedAt: deals.updatedAt,
```

**After:**
```
updatedAt: deals.updated_at,
```

---

✅ **Line 4547** (high confidence)

**Before:**
```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)));
```

---

✅ **Line 4556** (high confidence)

**Before:**
```
.where(eq(dealStages.tenantId, deal.tenantId))
```

**After:**
```
.where(eq(dealStages.tenant_id, deal.tenant_id))
```

---

✅ **Line 4575** (high confidence)

**Before:**
```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)))
```

---

✅ **Line 4598** (high confidence)

**Before:**
```
.where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)))
```

---

✅ **Line 4623** (high confidence)

**Before:**
```
tenantId: dealStages.tenantId,
```

**After:**
```
tenantId: dealStages.tenant_id,
```

---

⚠️ **Line 4631** (medium confidence)

**Before:**
```
createdAt: dealStages.createdAt,
```

**After:**
```
createdAt: dealStages.created_at,
```

---

⚠️ **Line 4632** (medium confidence)

**Before:**
```
updatedAt: dealStages.updatedAt,
```

**After:**
```
updatedAt: dealStages.updated_at,
```

---

✅ **Line 4635** (high confidence)

**Before:**
```
.where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.isActive, true)))
```

**After:**
```
.where(and(eq(dealStages.tenant_id, tenantId), eq(dealStages.isActive, true)))
```

---

✅ **Line 4648** (high confidence)

**Before:**
```
.where(and(eq(dealStages.id, id), eq(dealStages.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dealStages.id, id), eq(dealStages.tenant_id, tenantId)))
```

---

⚠️ **Line 4663** (medium confidence)

**Before:**
```
userId: dealActivities.userId,
```

**After:**
```
userId: dealActivities.user_id,
```

---

⚠️ **Line 4665** (medium confidence)

**Before:**
```
createdAt: dealActivities.createdAt,
```

**After:**
```
createdAt: dealActivities.created_at,
```

---

⚠️ **Line 4668** (medium confidence)

**Before:**
```
.leftJoin(users, eq(dealActivities.userId, users.id))
```

**After:**
```
.leftJoin(users, eq(dealActivities.user_id, users.id))
```

---

✅ **Line 4669** (high confidence)

**Before:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenant_id, tenantId)))
```

---

⚠️ **Line 4670** (medium confidence)

**Before:**
```
.orderBy(desc(dealActivities.createdAt));
```

**After:**
```
.orderBy(desc(dealActivities.created_at));
```

---

✅ **Line 4685** (high confidence)

**Before:**
```
eq(companyPricingSettings.tenantId, tenantId),
```

**After:**
```
eq(companyPricingSettings.tenant_id, tenantId),
```

---

✅ **Line 4720** (high confidence)

**Before:**
```
.where(eq(productPricing.tenantId, tenantId))
```

**After:**
```
.where(eq(productPricing.tenant_id, tenantId))
```

---

⚠️ **Line 4721** (medium confidence)

**Before:**
```
.orderBy(desc(productPricing.createdAt));
```

**After:**
```
.orderBy(desc(productPricing.created_at));
```

---

✅ **Line 4736** (high confidence)

**Before:**
```
eq(productPricing.tenantId, tenantId),
```

**After:**
```
eq(productPricing.tenant_id, tenantId),
```

---

✅ **Line 4756** (high confidence)

**Before:**
```
.where(and(eq(productPricing.id, id), eq(productPricing.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productPricing.id, id), eq(productPricing.tenant_id, tenantId)))
```

---

✅ **Line 4764** (high confidence)

**Before:**
```
.where(and(eq(productPricing.id, id), eq(productPricing.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(productPricing.id, id), eq(productPricing.tenant_id, tenantId)));
```

---

✅ **Line 4779** (high confidence)

**Before:**
```
eq(quotePricing.tenantId, tenantId),
```

**After:**
```
eq(quotePricing.tenant_id, tenantId),
```

---

✅ **Line 4798** (high confidence)

**Before:**
```
.where(and(eq(quotePricing.id, id), eq(quotePricing.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(quotePricing.id, id), eq(quotePricing.tenant_id, tenantId)))
```

---

✅ **Line 4813** (high confidence)

**Before:**
```
eq(quotePricingLineItems.tenantId, tenantId),
```

**After:**
```
eq(quotePricingLineItems.tenant_id, tenantId),
```

---

✅ **Line 4834** (high confidence)

**Before:**
```
.where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenant_id, tenantId)))
```

---

✅ **Line 4842** (high confidence)

**Before:**
```
.where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenant_id, tenantId)));
```

---

⚠️ **Line 4868** (medium confidence)

**Before:**
```
createdAt: companyContacts.createdAt,
```

**After:**
```
createdAt: companyContacts.created_at,
```

---

✅ **Line 4873** (high confidence)

**Before:**
```
tenantId: companyContacts.tenantId,
```

**After:**
```
tenantId: companyContacts.tenant_id,
```

---

✅ **Line 4878** (high confidence)

**Before:**
```
.where(eq(companyContacts.tenantId, options.filters.tenantId));
```

**After:**
```
.where(eq(companyContacts.tenant_id, options.filters.tenant_id));
```

---

⚠️ **Line 4919** (medium confidence)

**Before:**
```
query = query.orderBy(desc(companyContacts.createdAt));
```

**After:**
```
query = query.orderBy(desc(companyContacts.created_at));
```

---

✅ **Line 4932** (high confidence)

**Before:**
```
.where(eq(companyContacts.tenantId, options.filters.tenantId));
```

**After:**
```
.where(eq(companyContacts.tenant_id, options.filters.tenant_id));
```

---

⚠️ **Line 5015** (medium confidence)

**Before:**
```
const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
```

**After:**
```
const [settings] = await db.select().from(userSettings).where(eq(userSettings.user_id, userId));
```

---

✅ **Line 5021** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 5024** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

⚠️ **Line 5081** (medium confidence)

**Before:**
```
.where(eq(userSettings.userId, userId))
```

**After:**
```
.where(eq(userSettings.user_id, userId))
```

---

⚠️ **Line 5088** (medium confidence)

**Before:**
```
const result = await db.delete(userSettings).where(eq(userSettings.userId, userId));
```

**After:**
```
const result = await db.delete(userSettings).where(eq(userSettings.user_id, userId));
```

---

⚠️ **Line 5111** (medium confidence)

**Before:**
```
.where(eq(userCustomerAssignments.userId, userId));
```

**After:**
```
.where(eq(userCustomerAssignments.user_id, userId));
```

---

✅ **Line 5234** (high confidence)

**Before:**
```
.where(eq(mobileServiceSessions.tenantId, params.tenantId));
```

**After:**
```
.where(eq(mobileServiceSessions.tenant_id, params.tenant_id));
```

---

⚠️ **Line 5244** (medium confidence)

**Before:**
```
return await query.orderBy(desc(mobileServiceSessions.createdAt));
```

**After:**
```
return await query.orderBy(desc(mobileServiceSessions.created_at));
```

---

✅ **Line 5262** (high confidence)

**Before:**
```
.where(and(eq(mobileServiceSessions.id, id), eq(mobileServiceSessions.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(mobileServiceSessions.id, id), eq(mobileServiceSessions.tenant_id, tenantId)))
```

---

✅ **Line 5274** (high confidence)

**Before:**
```
eq(timeTrackingEntries.tenantId, tenantId),
```

**After:**
```
eq(timeTrackingEntries.tenant_id, tenantId),
```

---

✅ **Line 5290** (high confidence)

**Before:**
```
let query = db.select().from(servicePhotos).where(eq(servicePhotos.tenantId, params.tenantId));
```

**After:**
```
let query = db.select().from(servicePhotos).where(eq(servicePhotos.tenant_id, params.tenant_id));
```

---

✅ **Line 5318** (high confidence)

**Before:**
```
.where(eq(locationHistory.tenantId, params.tenantId));
```

**After:**
```
.where(eq(locationHistory.tenant_id, params.tenant_id));
```

---

✅ **Line 5349** (high confidence)

**Before:**
```
.where(eq(onboardingChecklists.tenantId, tenantId))
```

**After:**
```
.where(eq(onboardingChecklists.tenant_id, tenantId))
```

---

⚠️ **Line 5350** (medium confidence)

**Before:**
```
.orderBy(desc(onboardingChecklists.createdAt));
```

**After:**
```
.orderBy(desc(onboardingChecklists.created_at));
```

---

✅ **Line 5360** (high confidence)

**Before:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenant_id, tenantId)));
```

---

✅ **Line 5379** (high confidence)

**Before:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenant_id, tenantId)))
```

---

✅ **Line 5387** (high confidence)

**Before:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenant_id, tenantId)));
```

---

✅ **Line 5400** (high confidence)

**Before:**
```
eq(onboardingEquipment.tenantId, tenantId),
```

**After:**
```
eq(onboardingEquipment.tenant_id, tenantId),
```

---

⚠️ **Line 5403** (medium confidence)

**Before:**
```
.orderBy(onboardingEquipment.createdAt);
```

**After:**
```
.orderBy(onboardingEquipment.created_at);
```

---

✅ **Line 5421** (high confidence)

**Before:**
```
.where(and(eq(onboardingEquipment.id, id), eq(onboardingEquipment.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(onboardingEquipment.id, id), eq(onboardingEquipment.tenant_id, tenantId)))
```

---

✅ **Line 5436** (high confidence)

**Before:**
```
eq(onboardingNetworkConfig.tenantId, tenantId),
```

**After:**
```
eq(onboardingNetworkConfig.tenant_id, tenantId),
```

---

⚠️ **Line 5439** (medium confidence)

**Before:**
```
.orderBy(onboardingNetworkConfig.createdAt);
```

**After:**
```
.orderBy(onboardingNetworkConfig.created_at);
```

---

✅ **Line 5458** (high confidence)

**Before:**
```
and(eq(onboardingNetworkConfig.id, id), eq(onboardingNetworkConfig.tenantId, tenantId)),
```

**After:**
```
and(eq(onboardingNetworkConfig.id, id), eq(onboardingNetworkConfig.tenant_id, tenantId)),
```

---

✅ **Line 5474** (high confidence)

**Before:**
```
eq(onboardingPrintManagement.tenantId, tenantId),
```

**After:**
```
eq(onboardingPrintManagement.tenant_id, tenantId),
```

---

⚠️ **Line 5477** (medium confidence)

**Before:**
```
.orderBy(onboardingPrintManagement.createdAt);
```

**After:**
```
.orderBy(onboardingPrintManagement.created_at);
```

---

✅ **Line 5496** (high confidence)

**Before:**
```
and(eq(onboardingPrintManagement.id, id), eq(onboardingPrintManagement.tenantId, tenantId)),
```

**After:**
```
and(eq(onboardingPrintManagement.id, id), eq(onboardingPrintManagement.tenant_id, tenantId)),
```

---

✅ **Line 5512** (high confidence)

**Before:**
```
eq(onboardingDynamicSections.tenantId, tenantId),
```

**After:**
```
eq(onboardingDynamicSections.tenant_id, tenantId),
```

---

✅ **Line 5534** (high confidence)

**Before:**
```
and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenantId, tenantId)),
```

**After:**
```
and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenant_id, tenantId)),
```

---

✅ **Line 5544** (high confidence)

**Before:**
```
and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenantId, tenantId)),
```

**After:**
```
and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenant_id, tenantId)),
```

---

✅ **Line 5553** (high confidence)

**Before:**
```
and(eq(onboardingTasks.checklistId, checklistId), eq(onboardingTasks.tenantId, tenantId)),
```

**After:**
```
and(eq(onboardingTasks.checklistId, checklistId), eq(onboardingTasks.tenant_id, tenantId)),
```

---

⚠️ **Line 5555** (medium confidence)

**Before:**
```
.orderBy(onboardingTasks.createdAt);
```

**After:**
```
.orderBy(onboardingTasks.created_at);
```

---

✅ **Line 5571** (high confidence)

**Before:**
```
.where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenant_id, tenantId)))
```

---

✅ **Line 5579** (high confidence)

**Before:**
```
.where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenant_id, tenantId)));
```

---

✅ **Line 5589** (high confidence)

**Before:**
```
.where(eq(leases.tenantId, tenantId))
```

**After:**
```
.where(eq(leases.tenant_id, tenantId))
```

---

⚠️ **Line 5590** (medium confidence)

**Before:**
```
.orderBy(desc(leases.createdAt));
```

**After:**
```
.orderBy(desc(leases.created_at));
```

---

✅ **Line 5597** (high confidence)

**Before:**
```
.where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leases.id, id), eq(leases.tenant_id, tenantId)));
```

---

✅ **Line 5605** (high confidence)

**Before:**
```
.where(and(eq(leases.customerId, customerId), eq(leases.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leases.customerId, customerId), eq(leases.tenant_id, tenantId)))
```

---

✅ **Line 5613** (high confidence)

**Before:**
```
.where(and(eq(leases.status, status), eq(leases.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leases.status, status), eq(leases.tenant_id, tenantId)))
```

---

⚠️ **Line 5614** (medium confidence)

**Before:**
```
.orderBy(desc(leases.createdAt));
```

**After:**
```
.orderBy(desc(leases.created_at));
```

---

✅ **Line 5630** (high confidence)

**Before:**
```
.where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leases.id, id), eq(leases.tenant_id, tenantId)))
```

---

✅ **Line 5636** (high confidence)

**Before:**
```
await db.delete(leases).where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)));
```

**After:**
```
await db.delete(leases).where(and(eq(leases.id, id), eq(leases.tenant_id, tenantId)));
```

---

✅ **Line 5644** (high confidence)

**Before:**
```
.where(and(eq(leasePayments.leaseId, leaseId), eq(leasePayments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leasePayments.leaseId, leaseId), eq(leasePayments.tenant_id, tenantId)))
```

---

✅ **Line 5652** (high confidence)

**Before:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenant_id, tenantId)));
```

---

✅ **Line 5665** (high confidence)

**Before:**
```
eq(leasePayments.tenantId, tenantId),
```

**After:**
```
eq(leasePayments.tenant_id, tenantId),
```

---

✅ **Line 5681** (high confidence)

**Before:**
```
eq(leasePayments.tenantId, tenantId),
```

**After:**
```
eq(leasePayments.tenant_id, tenantId),
```

---

✅ **Line 5702** (high confidence)

**Before:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenant_id, tenantId)))
```

---

✅ **Line 5710** (high confidence)

**Before:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leasePayments.id, id), eq(leasePayments.tenant_id, tenantId)));
```

---

✅ **Line 5718** (high confidence)

**Before:**
```
.where(eq(leaseRenewals.tenantId, tenantId))
```

**After:**
```
.where(eq(leaseRenewals.tenant_id, tenantId))
```

---

⚠️ **Line 5719** (medium confidence)

**Before:**
```
.orderBy(desc(leaseRenewals.createdAt));
```

**After:**
```
.orderBy(desc(leaseRenewals.created_at));
```

---

✅ **Line 5726** (high confidence)

**Before:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenant_id, tenantId)));
```

---

✅ **Line 5737** (high confidence)

**Before:**
```
.where(and(eq(leaseRenewals.leaseId, leaseId), eq(leaseRenewals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseRenewals.leaseId, leaseId), eq(leaseRenewals.tenant_id, tenantId)));
```

---

✅ **Line 5753** (high confidence)

**Before:**
```
eq(leaseRenewals.tenantId, tenantId),
```

**After:**
```
eq(leaseRenewals.tenant_id, tenantId),
```

---

✅ **Line 5774** (high confidence)

**Before:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenant_id, tenantId)))
```

---

✅ **Line 5782** (high confidence)

**Before:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenant_id, tenantId)));
```

---

✅ **Line 5790** (high confidence)

**Before:**
```
.where(eq(leaseDispositions.tenantId, tenantId))
```

**After:**
```
.where(eq(leaseDispositions.tenant_id, tenantId))
```

---

✅ **Line 5798** (high confidence)

**Before:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenant_id, tenantId)));
```

---

✅ **Line 5809** (high confidence)

**Before:**
```
.where(and(eq(leaseDispositions.leaseId, leaseId), eq(leaseDispositions.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseDispositions.leaseId, leaseId), eq(leaseDispositions.tenant_id, tenantId)));
```

---

✅ **Line 5826** (high confidence)

**Before:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenant_id, tenantId)))
```

---

✅ **Line 5834** (high confidence)

**Before:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenant_id, tenantId)));
```

---

✅ **Line 5850** (high confidence)

**Before:**
```
eq(integrationCredentials.tenantId, tenantId),
```

**After:**
```
eq(integrationCredentials.tenant_id, tenantId),
```

---

⚠️ **Line 5854** (medium confidence)

**Before:**
```
.orderBy(desc(integrationCredentials.createdAt));
```

**After:**
```
.orderBy(desc(integrationCredentials.created_at));
```

---

✅ **Line 5859** (high confidence)

**Before:**
```
.where(eq(integrationCredentials.tenantId, tenantId))
```

**After:**
```
.where(eq(integrationCredentials.tenant_id, tenantId))
```

---

⚠️ **Line 5860** (medium confidence)

**Before:**
```
.orderBy(desc(integrationCredentials.createdAt));
```

**After:**
```
.orderBy(desc(integrationCredentials.created_at));
```

---

✅ **Line 5870** (high confidence)

**Before:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenant_id, tenantId)));
```

---

✅ **Line 5883** (high confidence)

**Before:**
```
eq(integrationCredentials.tenantId, tenantId),
```

**After:**
```
eq(integrationCredentials.tenant_id, tenantId),
```

---

✅ **Line 5905** (high confidence)

**Before:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenant_id, tenantId)))
```

---

✅ **Line 5913** (high confidence)

**Before:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenant_id, tenantId)));
```

---

✅ **Line 5934** (high confidence)

**Before:**
```
.where(and(eq(signatureRequests.tenantId, tenantId), eq(signatureRequests.status, status)))
```

**After:**
```
.where(and(eq(signatureRequests.tenant_id, tenantId), eq(signatureRequests.status, status)))
```

---

⚠️ **Line 5935** (medium confidence)

**Before:**
```
.orderBy(desc(signatureRequests.createdAt));
```

**After:**
```
.orderBy(desc(signatureRequests.created_at));
```

---

✅ **Line 5940** (high confidence)

**Before:**
```
.where(eq(signatureRequests.tenantId, tenantId))
```

**After:**
```
.where(eq(signatureRequests.tenant_id, tenantId))
```

---

⚠️ **Line 5941** (medium confidence)

**Before:**
```
.orderBy(desc(signatureRequests.createdAt));
```

**After:**
```
.orderBy(desc(signatureRequests.created_at));
```

---

✅ **Line 5948** (high confidence)

**Before:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenant_id, tenantId)));
```

---

✅ **Line 5960** (high confidence)

**Before:**
```
and(eq(signatureRequests.customerId, customerId), eq(signatureRequests.tenantId, tenantId)),
```

**After:**
```
and(eq(signatureRequests.customerId, customerId), eq(signatureRequests.tenant_id, tenantId)),
```

---

⚠️ **Line 5962** (medium confidence)

**Before:**
```
.orderBy(desc(signatureRequests.createdAt));
```

**After:**
```
.orderBy(desc(signatureRequests.created_at));
```

---

✅ **Line 5977** (high confidence)

**Before:**
```
eq(signatureRequests.tenantId, tenantId),
```

**After:**
```
eq(signatureRequests.tenant_id, tenantId),
```

---

✅ **Line 5999** (high confidence)

**Before:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenant_id, tenantId)))
```

---

✅ **Line 6007** (high confidence)

**Before:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenant_id, tenantId)));
```

---

✅ **Line 6016** (high confidence)

**Before:**
```
and(eq(signatureSigners.requestId, requestId), eq(signatureSigners.tenantId, tenantId)),
```

**After:**
```
and(eq(signatureSigners.requestId, requestId), eq(signatureSigners.tenant_id, tenantId)),
```

---

✅ **Line 6025** (high confidence)

**Before:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenant_id, tenantId)));
```

---

✅ **Line 6042** (high confidence)

**Before:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenant_id, tenantId)))
```

---

✅ **Line 6050** (high confidence)

**Before:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenant_id, tenantId)));
```

---

✅ **Line 6059** (high confidence)

**Before:**
```
and(eq(signatureDocuments.requestId, requestId), eq(signatureDocuments.tenantId, tenantId)),
```

**After:**
```
and(eq(signatureDocuments.requestId, requestId), eq(signatureDocuments.tenant_id, tenantId)),
```

---

✅ **Line 6068** (high confidence)

**Before:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenant_id, tenantId)));
```

---

✅ **Line 6085** (high confidence)

**Before:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenant_id, tenantId)))
```

---

✅ **Line 6093** (high confidence)

**Before:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenant_id, tenantId)));
```

---

✅ **Line 6102** (high confidence)

**Before:**
```
and(eq(signatureAuditLogs.requestId, requestId), eq(signatureAuditLogs.tenantId, tenantId)),
```

**After:**
```
and(eq(signatureAuditLogs.requestId, requestId), eq(signatureAuditLogs.tenant_id, tenantId)),
```

---

✅ **Line 6115** (high confidence)

**Before:**
```
and(eq(signatureAuditLogs.signerId, signerId), eq(signatureAuditLogs.tenantId, tenantId)),
```

**After:**
```
and(eq(signatureAuditLogs.signerId, signerId), eq(signatureAuditLogs.tenant_id, tenantId)),
```

---

✅ **Line 6132** (high confidence)

**Before:**
```
const conditions = [eq(installations.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(installations.tenant_id, tenantId)];
```

---

✅ **Line 6155** (high confidence)

**Before:**
```
.where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(installations.id, id), eq(installations.tenant_id, tenantId)));
```

---

✅ **Line 6169** (high confidence)

**Before:**
```
eq(installations.tenantId, tenantId),
```

**After:**
```
eq(installations.tenant_id, tenantId),
```

---

✅ **Line 6188** (high confidence)

**Before:**
```
.where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(installations.id, id), eq(installations.tenant_id, tenantId)))
```

---

✅ **Line 6196** (high confidence)

**Before:**
```
.where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(installations.id, id), eq(installations.tenant_id, tenantId)));
```

---

✅ **Line 6208** (high confidence)

**Before:**
```
and(eq(installations.tenantId, tenantId), isNotNull(installations.installationNumber)),
```

**After:**
```
and(eq(installations.tenant_id, tenantId), isNotNull(installations.installationNumber)),
```

---

✅ **Line 6226** (high confidence)

**Before:**
```
const conditions = [eq(serviceSignatures.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(serviceSignatures.tenant_id, tenantId)];
```

---

✅ **Line 6246** (high confidence)

**Before:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenant_id, tenantId)));
```

---

✅ **Line 6263** (high confidence)

**Before:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenant_id, tenantId)))
```

---

✅ **Line 6271** (high confidence)

**Before:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenant_id, tenantId)));
```

---

✅ **Line 6285** (high confidence)

**Before:**
```
eq(installationChecklists.tenantId, tenantId),
```

**After:**
```
eq(installationChecklists.tenant_id, tenantId),
```

---

✅ **Line 6298** (high confidence)

**Before:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenant_id, tenantId)));
```

---

✅ **Line 6317** (high confidence)

**Before:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenant_id, tenantId)))
```

---

✅ **Line 6325** (high confidence)

**Before:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenant_id, tenantId)));
```

---

✅ **Line 6339** (high confidence)

**Before:**
```
let query = db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(emailTemplates).where(eq(emailTemplates.tenant_id, tenantId));
```

---

✅ **Line 6341** (high confidence)

**Before:**
```
const conditions = [eq(emailTemplates.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(emailTemplates.tenant_id, tenantId)];
```

---

⚠️ **Line 6357** (medium confidence)

**Before:**
```
.orderBy(desc(emailTemplates.createdAt));
```

**After:**
```
.orderBy(desc(emailTemplates.created_at));
```

---

✅ **Line 6364** (high confidence)

**Before:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenant_id, tenantId)));
```

---

✅ **Line 6376** (high confidence)

**Before:**
```
and(eq(emailTemplates.templateName, templateName), eq(emailTemplates.tenantId, tenantId)),
```

**After:**
```
and(eq(emailTemplates.templateName, templateName), eq(emailTemplates.tenant_id, tenantId)),
```

---

✅ **Line 6394** (high confidence)

**Before:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenant_id, tenantId)))
```

---

✅ **Line 6402** (high confidence)

**Before:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenant_id, tenantId)));
```

---

✅ **Line 6409** (high confidence)

**Before:**
```
const conditions = [eq(emailCampaigns.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(emailCampaigns.tenant_id, tenantId)];
```

---

⚠️ **Line 6425** (medium confidence)

**Before:**
```
.orderBy(desc(emailCampaigns.createdAt));
```

**After:**
```
.orderBy(desc(emailCampaigns.created_at));
```

---

✅ **Line 6432** (high confidence)

**Before:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenant_id, tenantId)));
```

---

✅ **Line 6444** (high confidence)

**Before:**
```
and(eq(emailCampaigns.campaignName, campaignName), eq(emailCampaigns.tenantId, tenantId)),
```

**After:**
```
and(eq(emailCampaigns.campaignName, campaignName), eq(emailCampaigns.tenant_id, tenantId)),
```

---

✅ **Line 6462** (high confidence)

**Before:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenant_id, tenantId)))
```

---

✅ **Line 6470** (high confidence)

**Before:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenant_id, tenantId)));
```

---

✅ **Line 6480** (high confidence)

**Before:**
```
.where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenant_id, tenantId)));
```

---

✅ **Line 6485** (high confidence)

**Before:**
```
.where(and(eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenant_id, tenantId)));
```

---

✅ **Line 6539** (high confidence)

**Before:**
```
.where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenant_id, tenantId)))
```

---

⚠️ **Line 6540** (medium confidence)

**Before:**
```
.orderBy(desc(emailSends.createdAt));
```

**After:**
```
.orderBy(desc(emailSends.created_at));
```

---

✅ **Line 6547** (high confidence)

**Before:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenant_id, tenantId)));
```

---

✅ **Line 6555** (high confidence)

**Before:**
```
.where(and(eq(emailSends.recipientEmail, recipientEmail), eq(emailSends.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailSends.recipientEmail, recipientEmail), eq(emailSends.tenant_id, tenantId)))
```

---

⚠️ **Line 6556** (medium confidence)

**Before:**
```
.orderBy(desc(emailSends.createdAt));
```

**After:**
```
.orderBy(desc(emailSends.created_at));
```

---

✅ **Line 6572** (high confidence)

**Before:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenant_id, tenantId)))
```

---

✅ **Line 6580** (high confidence)

**Before:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailSends.id, id), eq(emailSends.tenant_id, tenantId)));
```

---

✅ **Line 6592** (high confidence)

**Before:**
```
.where(and(eq(emailEvents.emailSendId, emailSendId), eq(emailEvents.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailEvents.emailSendId, emailSendId), eq(emailEvents.tenant_id, tenantId)))
```

---

✅ **Line 6601** (high confidence)

**Before:**
```
const conditions = [eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenant_id, tenantId)];
```

---

✅ **Line 6623** (high confidence)

**Before:**
```
const conditions = [eq(emailLists.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(emailLists.tenant_id, tenantId)];
```

---

⚠️ **Line 6639** (medium confidence)

**Before:**
```
.orderBy(desc(emailLists.createdAt));
```

**After:**
```
.orderBy(desc(emailLists.created_at));
```

---

✅ **Line 6646** (high confidence)

**Before:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenant_id, tenantId)));
```

---

✅ **Line 6654** (high confidence)

**Before:**
```
.where(and(eq(emailLists.listName, listName), eq(emailLists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailLists.listName, listName), eq(emailLists.tenant_id, tenantId)));
```

---

✅ **Line 6671** (high confidence)

**Before:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenant_id, tenantId)))
```

---

✅ **Line 6679** (high confidence)

**Before:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailLists.id, id), eq(emailLists.tenant_id, tenantId)));
```

---

✅ **Line 6686** (high confidence)

**Before:**
```
.where(and(eq(emailListMembers.listId, listId), eq(emailListMembers.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailListMembers.listId, listId), eq(emailListMembers.tenant_id, tenantId)));
```

---

✅ **Line 6706** (high confidence)

**Before:**
```
eq(emailListMembers.tenantId, tenantId),
```

**After:**
```
eq(emailListMembers.tenant_id, tenantId),
```

---

⚠️ **Line 6717** (medium confidence)

**Before:**
```
.orderBy(desc(emailListMembers.createdAt));
```

**After:**
```
.orderBy(desc(emailListMembers.created_at));
```

---

✅ **Line 6724** (high confidence)

**Before:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenant_id, tenantId)));
```

---

✅ **Line 6740** (high confidence)

**Before:**
```
eq(emailListMembers.tenantId, tenantId),
```

**After:**
```
eq(emailListMembers.tenant_id, tenantId),
```

---

✅ **Line 6759** (high confidence)

**Before:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenant_id, tenantId)))
```

---

✅ **Line 6767** (high confidence)

**Before:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenant_id, tenantId)));
```

---

✅ **Line 6779** (high confidence)

**Before:**
```
const conditions = [eq(emailUnsubscribes.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(emailUnsubscribes.tenant_id, tenantId)];
```

---

✅ **Line 6802** (high confidence)

**Before:**
```
eq(emailUnsubscribes.tenantId, tenantId),
```

**After:**
```
eq(emailUnsubscribes.tenant_id, tenantId),
```

---

⚠️ **Line 6886** (medium confidence)

**Before:**
```
.where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)))
```

**After:**
```
.where(and(eq(mfaBackupCodes.user_id, userId), eq(mfaBackupCodes.isUsed, false)))
```

---

⚠️ **Line 6934** (medium confidence)

**Before:**
```
.where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)));
```

**After:**
```
.where(and(eq(mfaBackupCodes.user_id, userId), eq(mfaBackupCodes.isUsed, false)));
```

---

⚠️ **Line 6960** (medium confidence)

**Before:**
```
.where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)))
```

**After:**
```
.where(and(eq(mfaBackupCodes.user_id, userId), eq(mfaBackupCodes.isUsed, false)))
```

---

⚠️ **Line 6961** (medium confidence)

**Before:**
```
.orderBy(asc(mfaBackupCodes.createdAt));
```

**After:**
```
.orderBy(asc(mfaBackupCodes.created_at));
```

---

⚠️ **Line 6965** (medium confidence)

**Before:**
```
await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
```

**After:**
```
await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.user_id, userId));
```

---

⚠️ **Line 6979** (medium confidence)

**Before:**
```
const conditions = [eq(mfaAuditLogs.userId, userId)];
```

**After:**
```
const conditions = [eq(mfaAuditLogs.user_id, userId)];
```

---

⚠️ **Line 6993** (medium confidence)

**Before:**
```
.orderBy(desc(mfaAuditLogs.createdAt));
```

**After:**
```
.orderBy(desc(mfaAuditLogs.created_at));
```

---

✅ **Line 7000** (high confidence)

**Before:**
```
const conditions = [eq(mfaAuditLogs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(mfaAuditLogs.tenant_id, tenantId)];
```

---

⚠️ **Line 7014** (medium confidence)

**Before:**
```
.orderBy(desc(mfaAuditLogs.createdAt));
```

**After:**
```
.orderBy(desc(mfaAuditLogs.created_at));
```

---

✅ **Line 7030** (high confidence)

**Before:**
```
.where(eq(users.tenantId, tenantId));
```

**After:**
```
.where(eq(users.tenant_id, tenantId));
```

---

✅ **Line 7038** (high confidence)

**Before:**
```
.where(and(eq(users.tenantId, tenantId), eq(users.twoFactorEnabled, true)));
```

**After:**
```
.where(and(eq(users.tenant_id, tenantId), eq(users.twoFactorEnabled, true)));
```

---

✅ **Line 7054** (high confidence)

**Before:**
```
eq(mfaAuditLogs.tenantId, tenantId),
```

**After:**
```
eq(mfaAuditLogs.tenant_id, tenantId),
```

---

⚠️ **Line 7057** (medium confidence)

**Before:**
```
gte(mfaAuditLogs.createdAt, thirtyDaysAgo),
```

**After:**
```
gte(mfaAuditLogs.created_at, thirtyDaysAgo),
```

---

✅ **Line 7069** (high confidence)

**Before:**
```
eq(mfaAuditLogs.tenantId, tenantId),
```

**After:**
```
eq(mfaAuditLogs.tenant_id, tenantId),
```

---

⚠️ **Line 7071** (medium confidence)

**Before:**
```
gte(mfaAuditLogs.createdAt, thirtyDaysAgo),
```

**After:**
```
gte(mfaAuditLogs.created_at, thirtyDaysAgo),
```

---

✅ **Line 7093** (high confidence)

**Before:**
```
eq(users.tenantId, tenantId),
```

**After:**
```
eq(users.tenant_id, tenantId),
```

---

✅ **Line 7114** (high confidence)

**Before:**
```
const conditions = [eq(workflows.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(workflows.tenant_id, tenantId)];
```

---

⚠️ **Line 7122** (medium confidence)

**Before:**
```
.orderBy(desc(workflows.createdAt));
```

**After:**
```
.orderBy(desc(workflows.created_at));
```

---

⚠️ **Line 7302** (medium confidence)

**Before:**
```
.orderBy(desc(workflowExecutions.createdAt))
```

**After:**
```
.orderBy(desc(workflowExecutions.created_at))
```

---

✅ **Line 7313** (high confidence)

**Before:**
```
.where(eq(workflowExecutions.tenantId, tenantId))
```

**After:**
```
.where(eq(workflowExecutions.tenant_id, tenantId))
```

---

⚠️ **Line 7314** (medium confidence)

**Before:**
```
.orderBy(desc(workflowExecutions.createdAt))
```

**After:**
```
.orderBy(desc(workflowExecutions.created_at))
```

---

⚠️ **Line 7335** (medium confidence)

**Before:**
```
.orderBy(asc(workflowExecutions.createdAt))
```

**After:**
```
.orderBy(asc(workflowExecutions.created_at))
```

---

⚠️ **Line 7375** (medium confidence)

**Before:**
```
.orderBy(asc(workflowExecutionEvents.createdAt));
```

**After:**
```
.orderBy(asc(workflowExecutionEvents.created_at));
```

---

✅ **Line 7533** (high confidence)

**Before:**
```
const conditions = [eq(leadScoringRules.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(leadScoringRules.tenant_id, tenantId)];
```

---

✅ **Line 7548** (high confidence)

**Before:**
```
.where(and(eq(leadScoringRules.tenantId, tenantId), eq(leadScoringRules.isActive, true)))
```

**After:**
```
.where(and(eq(leadScoringRules.tenant_id, tenantId), eq(leadScoringRules.isActive, true)))
```

---

✅ **Line 7621** (high confidence)

**Before:**
```
eq(bantQualificationCriteria.tenantId, tenantId),
```

**After:**
```
eq(bantQualificationCriteria.tenant_id, tenantId),
```

---

✅ **Line 7664** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 7678** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 7693** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 7709** (high confidence)

**Before:**
```
eq(leadScoreCalculations.tenantId, tenantId),
```

**After:**
```
eq(leadScoreCalculations.tenant_id, tenantId),
```

---

✅ **Line 7740** (high confidence)

**Before:**
```
.where(eq(leadQualificationHistory.tenantId, tenantId))
```

**After:**
```
.where(eq(leadQualificationHistory.tenant_id, tenantId))
```

---

✅ **Line 7817** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 7831** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 7863** (high confidence)

**Before:**
```
.where(eq(leadScoringFactors.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoringFactors.tenant_id, tenantId))
```

---

✅ **Line 7899** (high confidence)

**Before:**
```
.where(eq(bantQualificationCriteria.tenantId, tenantId));
```

**After:**
```
.where(eq(bantQualificationCriteria.tenant_id, tenantId));
```

---

✅ **Line 7952** (high confidence)

**Before:**
```
.where(eq(manufacturerConnections.tenantId, tenantId));
```

**After:**
```
.where(eq(manufacturerConnections.tenant_id, tenantId));
```

---

✅ **Line 7954** (high confidence)

**Before:**
```
const conditions = [eq(manufacturerConnections.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(manufacturerConnections.tenant_id, tenantId)];
```

---

⚠️ **Line 7972** (medium confidence)

**Before:**
```
.orderBy(desc(manufacturerConnections.updatedAt));
```

**After:**
```
.orderBy(desc(manufacturerConnections.updated_at));
```

---

✅ **Line 7996** (high confidence)

**Before:**
```
eq(manufacturerConnections.tenantId, tenantId),
```

**After:**
```
eq(manufacturerConnections.tenant_id, tenantId),
```

---

✅ **Line 8025** (high confidence)

**Before:**
```
and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenantId, tenantId)),
```

**After:**
```
and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenant_id, tenantId)),
```

---

✅ **Line 8036** (high confidence)

**Before:**
```
and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenantId, tenantId)),
```

**After:**
```
and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenant_id, tenantId)),
```

---

✅ **Line 8063** (high confidence)

**Before:**
```
eq(manufacturerConnections.tenantId, tenantId),
```

**After:**
```
eq(manufacturerConnections.tenant_id, tenantId),
```

---

✅ **Line 8081** (high confidence)

**Before:**
```
const conditions = [eq(manufacturerOrders.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(manufacturerOrders.tenant_id, tenantId)];
```

---

✅ **Line 8128** (high confidence)

**Before:**
```
eq(manufacturerOrders.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrders.tenant_id, tenantId),
```

---

✅ **Line 8153** (high confidence)

**Before:**
```
.where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenant_id, tenantId)))
```

---

✅ **Line 8162** (high confidence)

**Before:**
```
.where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenant_id, tenantId)));
```

---

✅ **Line 8173** (high confidence)

**Before:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenant_id, tenantId)))
```

---

✅ **Line 8192** (high confidence)

**Before:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenant_id, tenantId)))
```

---

✅ **Line 8210** (high confidence)

**Before:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenant_id, tenantId)))
```

---

✅ **Line 8259** (high confidence)

**Before:**
```
eq(manufacturerOrderLineItems.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderLineItems.tenant_id, tenantId),
```

---

✅ **Line 8273** (high confidence)

**Before:**
```
eq(manufacturerOrderLineItems.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderLineItems.tenant_id, tenantId),
```

---

✅ **Line 8304** (high confidence)

**Before:**
```
eq(manufacturerOrderLineItems.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderLineItems.tenant_id, tenantId),
```

---

✅ **Line 8355** (high confidence)

**Before:**
```
eq(manufacturerOrderConfirmations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderConfirmations.tenant_id, tenantId),
```

---

✅ **Line 8377** (high confidence)

**Before:**
```
eq(manufacturerOrderConfirmations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderConfirmations.tenant_id, tenantId),
```

---

✅ **Line 8416** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8446** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8460** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8480** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8507** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8531** (high confidence)

**Before:**
```
eq(manufacturerOrderExceptions.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderExceptions.tenant_id, tenantId),
```

---

✅ **Line 8584** (high confidence)

**Before:**
```
eq(manufacturerOrderExceptions.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderExceptions.tenant_id, tenantId),
```

---

✅ **Line 8610** (high confidence)

**Before:**
```
eq(manufacturerOrderExceptions.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderExceptions.tenant_id, tenantId),
```

---

✅ **Line 8643** (high confidence)

**Before:**
```
const conditions = [eq(manufacturerOrders.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(manufacturerOrders.tenant_id, tenantId)];
```

---

✅ **Line 8693** (high confidence)

**Before:**
```
eq(manufacturerOrderShipments.tenantId, tenantId),
```

**After:**
```
eq(manufacturerOrderShipments.tenant_id, tenantId),
```

---

✅ **Line 8714** (high confidence)

**Before:**
```
.where(eq(manufacturerOrderExceptions.tenantId, tenantId));
```

**After:**
```
.where(eq(manufacturerOrderExceptions.tenant_id, tenantId));
```

---

✅ **Line 8724** (high confidence)

**Before:**
```
.where(eq(manufacturerConnections.tenantId, tenantId));
```

**After:**
```
.where(eq(manufacturerConnections.tenant_id, tenantId));
```

---

✅ **Line 8770** (high confidence)

**Before:**
```
eq(technicianLocations.tenantId, tenantId),
```

**After:**
```
eq(technicianLocations.tenant_id, tenantId),
```

---

✅ **Line 8793** (high confidence)

**Before:**
```
eq(technicianLocations.tenantId, tenantId),
```

**After:**
```
eq(technicianLocations.tenant_id, tenantId),
```

---

✅ **Line 8814** (high confidence)

**Before:**
```
and(eq(technicianLocations.tenantId, tenantId), eq(technicianLocations.status, status)),
```

**After:**
```
and(eq(technicianLocations.tenant_id, tenantId), eq(technicianLocations.status, status)),
```

---

✅ **Line 8830** (high confidence)

**Before:**
```
.where(eq(technicianLocations.tenantId, tenantId));
```

**After:**
```
.where(eq(technicianLocations.tenant_id, tenantId));
```

---

✅ **Line 8854** (high confidence)

**Before:**
```
eq(gpsLocationHistory.tenantId, tenantId),
```

**After:**
```
eq(gpsLocationHistory.tenant_id, tenantId),
```

---

✅ **Line 8876** (high confidence)

**Before:**
```
eq(technicianLocations.tenantId, tenantId),
```

**After:**
```
eq(technicianLocations.tenant_id, tenantId),
```

---

✅ **Line 8886** (high confidence)

**Before:**
```
.where(eq(technicianLocations.tenantId, tenantId))
```

**After:**
```
.where(eq(technicianLocations.tenant_id, tenantId))
```

---

✅ **Line 8905** (high confidence)

**Before:**
```
eq(gpsLocationHistory.tenantId, tenantId),
```

**After:**
```
eq(gpsLocationHistory.tenant_id, tenantId),
```

---

✅ **Line 8939** (high confidence)

**Before:**
```
eq(gpsLocationHistory.tenantId, tenantId),
```

**After:**
```
eq(gpsLocationHistory.tenant_id, tenantId),
```

---

✅ **Line 8984** (high confidence)

**Before:**
```
const conditions = [eq(routeAssignments.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(routeAssignments.tenant_id, tenantId)];
```

---

✅ **Line 9007** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)))
```

---

✅ **Line 9028** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)))
```

---

✅ **Line 9036** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)));
```

---

✅ **Line 9047** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)))
```

---

✅ **Line 9068** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)))
```

---

✅ **Line 9104** (high confidence)

**Before:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenant_id, tenantId)))
```

---

✅ **Line 9120** (high confidence)

**Before:**
```
const conditions = [eq(routeDeviations.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(routeDeviations.tenant_id, tenantId)];
```

---

✅ **Line 9149** (high confidence)

**Before:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenant_id, tenantId)))
```

---

✅ **Line 9174** (high confidence)

**Before:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenant_id, tenantId)))
```

---

✅ **Line 9195** (high confidence)

**Before:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenant_id, tenantId)))
```

---

✅ **Line 9205** (high confidence)

**Before:**
```
eq(routeDeviations.tenantId, tenantId),
```

**After:**
```
eq(routeDeviations.tenant_id, tenantId),
```

---

✅ **Line 9231** (high confidence)

**Before:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenant_id, tenantId)))
```

---

✅ **Line 9241** (high confidence)

**Before:**
```
const conditions = [eq(etaCalculations.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(etaCalculations.tenant_id, tenantId)];
```

---

✅ **Line 9264** (high confidence)

**Before:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenant_id, tenantId)))
```

---

✅ **Line 9285** (high confidence)

**Before:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenant_id, tenantId)))
```

---

✅ **Line 9300** (high confidence)

**Before:**
```
eq(etaCalculations.tenantId, tenantId),
```

**After:**
```
eq(etaCalculations.tenant_id, tenantId),
```

---

✅ **Line 9328** (high confidence)

**Before:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenant_id, tenantId)))
```

---

✅ **Line 9344** (high confidence)

**Before:**
```
eq(etaCalculations.tenantId, tenantId),
```

**After:**
```
eq(etaCalculations.tenant_id, tenantId),
```

---

✅ **Line 9395** (high confidence)

**Before:**
```
const conditions = [eq(geofences.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(geofences.tenant_id, tenantId)];
```

---

⚠️ **Line 9411** (medium confidence)

**Before:**
```
.orderBy(desc(geofences.createdAt));
```

**After:**
```
.orderBy(desc(geofences.created_at));
```

---

✅ **Line 9418** (high confidence)

**Before:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenant_id, tenantId)))
```

---

✅ **Line 9439** (high confidence)

**Before:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenant_id, tenantId)))
```

---

✅ **Line 9447** (high confidence)

**Before:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenant_id, tenantId)));
```

---

✅ **Line 9454** (high confidence)

**Before:**
```
.where(and(eq(geofences.tenantId, tenantId), eq(geofences.isActive, true)));
```

**After:**
```
.where(and(eq(geofences.tenant_id, tenantId), eq(geofences.isActive, true)));
```

---

✅ **Line 9485** (high confidence)

**Before:**
```
const conditions = [eq(geofenceEvents.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(geofenceEvents.tenant_id, tenantId)];
```

---

⚠️ **Line 9504** (medium confidence)

**Before:**
```
.orderBy(desc(geofenceEvents.createdAt));
```

**After:**
```
.orderBy(desc(geofenceEvents.created_at));
```

---

✅ **Line 9521** (high confidence)

**Before:**
```
eq(geofenceEvents.tenantId, tenantId),
```

**After:**
```
eq(geofenceEvents.tenant_id, tenantId),
```

---

⚠️ **Line 9526** (medium confidence)

**Before:**
```
conditions.push(gte(geofenceEvents.createdAt, filters.startDate));
```

**After:**
```
conditions.push(gte(geofenceEvents.created_at, filters.startDate));
```

---

⚠️ **Line 9529** (medium confidence)

**Before:**
```
conditions.push(lte(geofenceEvents.createdAt, filters.endDate));
```

**After:**
```
conditions.push(lte(geofenceEvents.created_at, filters.endDate));
```

---

⚠️ **Line 9539** (medium confidence)

**Before:**
```
.orderBy(desc(geofenceEvents.createdAt));
```

**After:**
```
.orderBy(desc(geofenceEvents.created_at));
```

---

✅ **Line 9546** (high confidence)

**Before:**
```
.where(and(eq(geofenceEvents.tenantId, tenantId), eq(geofenceEvents.ticketId, ticketId)))
```

**After:**
```
.where(and(eq(geofenceEvents.tenant_id, tenantId), eq(geofenceEvents.ticketId, ticketId)))
```

---

⚠️ **Line 9547** (medium confidence)

**Before:**
```
.orderBy(asc(geofenceEvents.createdAt));
```

**After:**
```
.orderBy(asc(geofenceEvents.created_at));
```

---

✅ **Line 9554** (high confidence)

**Before:**
```
.where(and(eq(geofenceEvents.id, eventId), eq(geofenceEvents.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofenceEvents.id, eventId), eq(geofenceEvents.tenant_id, tenantId)))
```

---

✅ **Line 9613** (high confidence)

**Before:**
```
const conditions = [eq(billingRules.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(billingRules.tenant_id, tenantId)];
```

---

⚠️ **Line 9635** (medium confidence)

**Before:**
```
.orderBy(desc(billingRules.priority), desc(billingRules.createdAt));
```

**After:**
```
.orderBy(desc(billingRules.priority), desc(billingRules.created_at));
```

---

✅ **Line 9656** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 9664** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)));
```

---

✅ **Line 9673** (high confidence)

**Before:**
```
eq(billingRules.tenantId, tenantId),
```

**After:**
```
eq(billingRules.tenant_id, tenantId),
```

---

✅ **Line 9756** (high confidence)

**Before:**
```
eq(billingRules.tenantId, tenantId),
```

**After:**
```
eq(billingRules.tenant_id, tenantId),
```

---

✅ **Line 9770** (high confidence)

**Before:**
```
.where(and(eq(billingRules.contractId, contractId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.contractId, contractId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 9785** (high confidence)

**Before:**
```
const conditions = [eq(meterAnomalies.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(meterAnomalies.tenant_id, tenantId)];
```

---

✅ **Line 9832** (high confidence)

**Before:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenant_id, tenantId)))
```

---

✅ **Line 9852** (high confidence)

**Before:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenant_id, tenantId)))
```

---

✅ **Line 9872** (high confidence)

**Before:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenant_id, tenantId)))
```

---

✅ **Line 9881** (high confidence)

**Before:**
```
const conditions = [eq(meterAnomalies.tenantId, tenantId), eq(meterAnomalies.resolved, false)];
```

**After:**
```
const conditions = [eq(meterAnomalies.tenant_id, tenantId), eq(meterAnomalies.resolved, false)];
```

---

✅ **Line 9906** (high confidence)

**Before:**
```
and(eq(meterAnomalies.equipmentId, equipmentId), eq(meterAnomalies.tenantId, tenantId)),
```

**After:**
```
and(eq(meterAnomalies.equipmentId, equipmentId), eq(meterAnomalies.tenant_id, tenantId)),
```

---

✅ **Line 9922** (high confidence)

**Before:**
```
const conditions = [eq(billingDisputes.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(billingDisputes.tenant_id, tenantId)];
```

---

✅ **Line 9969** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 9986** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 10002** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 10028** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 10049** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 10059** (high confidence)

**Before:**
```
eq(billingDisputes.tenantId, tenantId),
```

**After:**
```
eq(billingDisputes.tenant_id, tenantId),
```

---

✅ **Line 10082** (high confidence)

**Before:**
```
and(eq(billingDisputes.customerId, customerId), eq(billingDisputes.tenantId, tenantId)),
```

**After:**
```
and(eq(billingDisputes.customerId, customerId), eq(billingDisputes.tenant_id, tenantId)),
```

---

✅ **Line 10091** (high confidence)

**Before:**
```
.where(and(eq(billingDisputes.invoiceId, invoiceId), eq(billingDisputes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingDisputes.invoiceId, invoiceId), eq(billingDisputes.tenant_id, tenantId)))
```

---

✅ **Line 10105** (high confidence)

**Before:**
```
const conditions = [eq(invoiceGenerationLogs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(invoiceGenerationLogs.tenant_id, tenantId)];
```

---

⚠️ **Line 10124** (medium confidence)

**Before:**
```
.orderBy(desc(invoiceGenerationLogs.createdAt));
```

**After:**
```
.orderBy(desc(invoiceGenerationLogs.created_at));
```

---

✅ **Line 10151** (high confidence)

**Before:**
```
.where(and(eq(invoiceGenerationLogs.id, logId), eq(invoiceGenerationLogs.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoiceGenerationLogs.id, logId), eq(invoiceGenerationLogs.tenant_id, tenantId)))
```

---

⚠️ **Line 10161** (medium confidence)

**Before:**
```
.orderBy(desc(invoiceGenerationLogs.createdAt));
```

**After:**
```
.orderBy(desc(invoiceGenerationLogs.created_at));
```

---

✅ **Line 10169** (high confidence)

**Before:**
```
eq(invoiceGenerationLogs.tenantId, tenantId),
```

**After:**
```
eq(invoiceGenerationLogs.tenant_id, tenantId),
```

---

⚠️ **Line 10181** (medium confidence)

**Before:**
```
.orderBy(desc(invoiceGenerationLogs.createdAt));
```

**After:**
```
.orderBy(desc(invoiceGenerationLogs.created_at));
```

---

✅ **Line 10199** (high confidence)

**Before:**
```
eq(invoiceGenerationLogs.tenantId, tenantId),
```

**After:**
```
eq(invoiceGenerationLogs.tenant_id, tenantId),
```

---

⚠️ **Line 10200** (medium confidence)

**Before:**
```
gte(invoiceGenerationLogs.createdAt, startDate),
```

**After:**
```
gte(invoiceGenerationLogs.created_at, startDate),
```

---

⚠️ **Line 10201** (medium confidence)

**Before:**
```
lte(invoiceGenerationLogs.createdAt, endDate),
```

**After:**
```
lte(invoiceGenerationLogs.created_at, endDate),
```

---

✅ **Line 10229** (high confidence)

**Before:**
```
const conditions = [eq(billingSchedules.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(billingSchedules.tenant_id, tenantId)];
```

---

✅ **Line 10273** (high confidence)

**Before:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenant_id, tenantId)))
```

---

✅ **Line 10281** (high confidence)

**Before:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenant_id, tenantId)));
```

---

✅ **Line 10288** (high confidence)

**Before:**
```
.where(and(eq(billingSchedules.tenantId, tenantId), eq(billingSchedules.isActive, true)))
```

**After:**
```
.where(and(eq(billingSchedules.tenant_id, tenantId), eq(billingSchedules.isActive, true)))
```

---

✅ **Line 10298** (high confidence)

**Before:**
```
eq(billingSchedules.tenantId, tenantId),
```

**After:**
```
eq(billingSchedules.tenant_id, tenantId),
```

---

✅ **Line 10318** (high confidence)

**Before:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenant_id, tenantId)))
```

---

✅ **Line 10333** (high confidence)

**Before:**
```
const conditions = [eq(creditMemos.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(creditMemos.tenant_id, tenantId)];
```

---

✅ **Line 10377** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenant_id, tenantId)))
```

---

✅ **Line 10395** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenant_id, tenantId)))
```

---

✅ **Line 10410** (high confidence)

**Before:**
```
eq(creditMemos.tenantId, tenantId),
```

**After:**
```
eq(creditMemos.tenant_id, tenantId),
```

---

✅ **Line 10432** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenant_id, tenantId)))
```

---

✅ **Line 10452** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenant_id, tenantId)))
```

---

✅ **Line 10461** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.customerId, customerId), eq(creditMemos.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(creditMemos.customerId, customerId), eq(creditMemos.tenant_id, tenantId)))
```

---

✅ **Line 10469** (high confidence)

**Before:**
```
.where(and(eq(creditMemos.tenantId, tenantId), eq(creditMemos.creditStatus, 'pending')))
```

**After:**
```
.where(and(eq(creditMemos.tenant_id, tenantId), eq(creditMemos.creditStatus, 'pending')))
```

---

✅ **Line 10483** (high confidence)

**Before:**
```
const conditions = [eq(customerHealthScores.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(customerHealthScores.tenant_id, tenantId)];
```

---

✅ **Line 10524** (high confidence)

**Before:**
```
eq(customerHealthScores.tenantId, tenantId),
```

**After:**
```
eq(customerHealthScores.tenant_id, tenantId),
```

---

✅ **Line 10545** (high confidence)

**Before:**
```
.where(and(eq(customerHealthScores.id, scoreId), eq(customerHealthScores.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customerHealthScores.id, scoreId), eq(customerHealthScores.tenant_id, tenantId)))
```

---

✅ **Line 10556** (high confidence)

**Before:**
```
eq(customerHealthScores.tenantId, tenantId),
```

**After:**
```
eq(customerHealthScores.tenant_id, tenantId),
```

---

✅ **Line 10569** (high confidence)

**Before:**
```
eq(customerHealthScores.tenantId, tenantId),
```

**After:**
```
eq(customerHealthScores.tenant_id, tenantId),
```

---

✅ **Line 10587** (high confidence)

**Before:**
```
eq(customerHealthScores.tenantId, tenantId),
```

**After:**
```
eq(customerHealthScores.tenant_id, tenantId),
```

---

✅ **Line 10607** (high confidence)

**Before:**
```
const conditions = [eq(churnPredictions.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(churnPredictions.tenant_id, tenantId)];
```

---

✅ **Line 10640** (high confidence)

**Before:**
```
and(eq(churnPredictions.customerId, customerId), eq(churnPredictions.tenantId, tenantId)),
```

**After:**
```
and(eq(churnPredictions.customerId, customerId), eq(churnPredictions.tenant_id, tenantId)),
```

---

✅ **Line 10660** (high confidence)

**Before:**
```
.where(and(eq(churnPredictions.id, predictionId), eq(churnPredictions.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(churnPredictions.id, predictionId), eq(churnPredictions.tenant_id, tenantId)))
```

---

✅ **Line 10671** (high confidence)

**Before:**
```
eq(churnPredictions.tenantId, tenantId),
```

**After:**
```
eq(churnPredictions.tenant_id, tenantId),
```

---

✅ **Line 10683** (high confidence)

**Before:**
```
and(eq(churnPredictions.tenantId, tenantId), lte(churnPredictions.expiresAt, new Date())),
```

**After:**
```
and(eq(churnPredictions.tenant_id, tenantId), lte(churnPredictions.expiresAt, new Date())),
```

---

✅ **Line 10694** (high confidence)

**Before:**
```
eq(churnPredictions.tenantId, tenantId),
```

**After:**
```
eq(churnPredictions.tenant_id, tenantId),
```

---

✅ **Line 10712** (high confidence)

**Before:**
```
const conditions = [eq(successInterventions.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(successInterventions.tenant_id, tenantId)];
```

---

⚠️ **Line 10731** (medium confidence)

**Before:**
```
.orderBy(desc(successInterventions.createdAt));
```

**After:**
```
.orderBy(desc(successInterventions.created_at));
```

---

✅ **Line 10753** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

⚠️ **Line 10756** (medium confidence)

**Before:**
```
.orderBy(desc(successInterventions.createdAt));
```

**After:**
```
.orderBy(desc(successInterventions.created_at));
```

---

✅ **Line 10775** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10797** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10822** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10835** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10850** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10871** (high confidence)

**Before:**
```
eq(successInterventions.tenantId, tenantId),
```

**After:**
```
eq(successInterventions.tenant_id, tenantId),
```

---

✅ **Line 10887** (high confidence)

**Before:**
```
const conditions = [eq(customerJourneys.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(customerJourneys.tenant_id, tenantId)];
```

---

⚠️ **Line 10903** (medium confidence)

**Before:**
```
.orderBy(desc(customerJourneys.updatedAt));
```

**After:**
```
.orderBy(desc(customerJourneys.updated_at));
```

---

✅ **Line 10923** (high confidence)

**Before:**
```
and(eq(customerJourneys.customerId, customerId), eq(customerJourneys.tenantId, tenantId)),
```

**After:**
```
and(eq(customerJourneys.customerId, customerId), eq(customerJourneys.tenant_id, tenantId)),
```

---

✅ **Line 10942** (high confidence)

**Before:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenant_id, tenantId)))
```

---

✅ **Line 10964** (high confidence)

**Before:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenant_id, tenantId)))
```

---

✅ **Line 10975** (high confidence)

**Before:**
```
eq(customerJourneys.tenantId, tenantId),
```

**After:**
```
eq(customerJourneys.tenant_id, tenantId),
```

---

⚠️ **Line 10979** (medium confidence)

**Before:**
```
.orderBy(desc(customerJourneys.updatedAt));
```

**After:**
```
.orderBy(desc(customerJourneys.updated_at));
```

---

✅ **Line 10998** (high confidence)

**Before:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenant_id, tenantId)))
```

---

✅ **Line 11012** (high confidence)

**Before:**
```
const conditions = [eq(renewalOpportunities.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(renewalOpportunities.tenant_id, tenantId)];
```

---

✅ **Line 11047** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11063** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11086** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11107** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11131** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11144** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11157** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 11168** (high confidence)

**Before:**
```
where: eq(assignmentGroups.tenantId, tenantId),
```

**After:**
```
where: eq(assignmentGroups.tenant_id, tenantId),
```

---

✅ **Line 11216** (high confidence)

**Before:**
```
where: and(eq(assignmentGroups.tenantId, tenantId), eq(assignmentGroups.isActive, true)),
```

**After:**
```
where: and(eq(assignmentGroups.tenant_id, tenantId), eq(assignmentGroups.isActive, true)),
```

---

✅ **Line 11226** (high confidence)

**Before:**
```
const conditions = [eq(workflowApprovals.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(workflowApprovals.tenant_id, tenantId)];
```

---

✅ **Line 11255** (high confidence)

**Before:**
```
eq(workflowApprovals.tenantId, tenantId),
```

**After:**
```
eq(workflowApprovals.tenant_id, tenantId),
```

---

### `server\seed-toner-workflow.ts`

✅ **Line 193** (high confidence)

**Before:**
```
sql`${supplies.productCode} = ${product.productCode} AND ${supplies.tenantId} = ${DEFAULT_TENANT_ID}`,
```

**After:**
```
sql`${supplies.productCode} = ${product.productCode} AND ${supplies.tenant_id} = ${DEFAULT_TENANT_ID}`,
```

---

✅ **Line 227** (high confidence)

**Before:**
```
sql`${inventoryItems.partNumber} = ${product.productCode} AND ${inventoryItems.tenantId} = ${DEFAULT_TENANT_ID}`,
```

**After:**
```
sql`${inventoryItems.partNumber} = ${product.productCode} AND ${inventoryItems.tenant_id} = ${DEFAULT_TENANT_ID}`,
```

---

✅ **Line 275** (high confidence)

**Before:**
```
.where(sql`${customerPortalAccess.tenantId} = ${DEFAULT_TENANT_ID}`)
```

**After:**
```
.where(sql`${customerPortalAccess.tenant_id} = ${DEFAULT_TENANT_ID}`)
```

---

### `server\seed-signature-data.ts`

✅ **Line 25** (high confidence)

**Before:**
```
where: (records, { eq }) => eq(records.tenantId, tenantId),
```

**After:**
```
where: (records, { eq }) => eq(records.tenant_id, tenantId),
```

---

### `server\seed-sales-metrics.ts`

✅ **Line 24** (high confidence)

**Before:**
```
const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenant.id)).limit(5);
```

**After:**
```
const tenantUsers = await db.select().from(users).where(eq(users.tenant_id, tenant.id)).limit(5);
```

---

✅ **Line 35** (high confidence)

**Before:**
```
.where(eq(salesTeams.tenantId, tenant.id))
```

**After:**
```
.where(eq(salesTeams.tenant_id, tenant.id))
```

---

⚠️ **Line 139** (medium confidence)

**Before:**
```
].filter((metric) => metric.userId && metric.teamId);
```

**After:**
```
].filter((metric) => metric.user_id && metric.teamId);
```

---

⚠️ **Line 195** (medium confidence)

**Before:**
```
].filter((funnel) => funnel.userId && funnel.teamId);
```

**After:**
```
].filter((funnel) => funnel.user_id && funnel.teamId);
```

---

⚠️ **Line 282** (medium confidence)

**Before:**
```
].filter((insight) => insight.managerId && insight.userId && insight.teamId);
```

**After:**
```
].filter((insight) => insight.managerId && insight.user_id && insight.teamId);
```

---

### `server\seed-pricing-data.ts`

✅ **Line 10** (high confidence)

**Before:**
```
const tenantId = req.tenantId!; // From tenant middleware
```

**After:**
```
const tenantId = req.tenant_id!; // From tenant middleware
```

---

### `server\seed-mfa-data.ts`

⚠️ **Line 61** (medium confidence)

**Before:**
```
await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, testUser.id));
```

**After:**
```
await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.user_id, testUser.id));
```

---

⚠️ **Line 64** (medium confidence)

**Before:**
```
await db.delete(mfaAuditLogs).where(eq(mfaAuditLogs.userId, testUser.id));
```

**After:**
```
await db.delete(mfaAuditLogs).where(eq(mfaAuditLogs.user_id, testUser.id));
```

---

✅ **Line 95** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

⚠️ **Line 110** (medium confidence)

**Before:**
```
.where(and(eq(mfaBackupCodes.userId, testUser.id), eq(mfaBackupCodes.isUsed, false)))
```

**After:**
```
.where(and(eq(mfaBackupCodes.user_id, testUser.id), eq(mfaBackupCodes.isUsed, false)))
```

---

✅ **Line 136** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

✅ **Line 153** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

✅ **Line 170** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

✅ **Line 187** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

✅ **Line 205** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

### `server\seed-lease-data.ts`

✅ **Line 28** (high confidence)

**Before:**
```
const tenantId = existingCustomers[0].tenantId;
```

**After:**
```
const tenantId = existingCustomers[0].tenant_id;
```

---

### `server\seed-field-service-data.ts`

✅ **Line 25** (high confidence)

**Before:**
```
await db.delete(servicePhotos).where(eq(servicePhotos.tenantId, tenantId));
```

**After:**
```
await db.delete(servicePhotos).where(eq(servicePhotos.tenant_id, tenantId));
```

---

✅ **Line 26** (high confidence)

**Before:**
```
await db.delete(installationChecklists).where(eq(installationChecklists.tenantId, tenantId));
```

**After:**
```
await db.delete(installationChecklists).where(eq(installationChecklists.tenant_id, tenantId));
```

---

✅ **Line 27** (high confidence)

**Before:**
```
await db.delete(serviceSignatures).where(eq(serviceSignatures.tenantId, tenantId));
```

**After:**
```
await db.delete(serviceSignatures).where(eq(serviceSignatures.tenant_id, tenantId));
```

---

✅ **Line 28** (high confidence)

**Before:**
```
await db.delete(installations).where(eq(installations.tenantId, tenantId));
```

**After:**
```
await db.delete(installations).where(eq(installations.tenant_id, tenantId));
```

---

✅ **Line 33** (high confidence)

**Before:**
```
where: (records, { eq }) => eq(records.tenantId, tenantId),
```

**After:**
```
where: (records, { eq }) => eq(records.tenant_id, tenantId),
```

---

✅ **Line 47** (high confidence)

**Before:**
```
where: (tech, { eq }) => eq(tech.tenantId, tenantId),
```

**After:**
```
where: (tech, { eq }) => eq(tech.tenant_id, tenantId),
```

---

✅ **Line 53** (high confidence)

**Before:**
```
where: (tickets, { eq }) => eq(tickets.tenantId, tenantId),
```

**After:**
```
where: (tickets, { eq }) => eq(tickets.tenant_id, tenantId),
```

---

✅ **Line 59** (high confidence)

**Before:**
```
where: (u, { eq }) => eq(u.tenantId, tenantId),
```

**After:**
```
where: (u, { eq }) => eq(u.tenant_id, tenantId),
```

---

### `server\seed-customer-success.ts`

✅ **Line 20** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.status, 'active')))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.status, 'active')))
```

---

✅ **Line 32** (high confidence)

**Before:**
```
.where(eq(contracts.tenantId, tenantId))
```

**After:**
```
.where(eq(contracts.tenant_id, tenantId))
```

---

### `server\seed-crm-goals.ts`

✅ **Line 28** (high confidence)

**Before:**
```
.where(eq(users.tenantId, tenant.id))
```

**After:**
```
.where(eq(users.tenant_id, tenant.id))
```

---

⚠️ **Line 111** (medium confidence)

**Before:**
```
].filter((member) => member.userId); // Filter out undefined userIds
```

**After:**
```
].filter((member) => member.user_id); // Filter out undefined userIds
```

---

⚠️ **Line 253** (medium confidence)

**Before:**
```
].filter((report) => report.userId && report.teamId); // Filter out reports without valid IDs
```

**After:**
```
].filter((report) => report.user_id && report.teamId); // Filter out reports without valid IDs
```

---

### `server\security-compliance.ts`

✅ **Line 110** (high confidence)

**Before:**
```
tenantId: entry.tenantId,
```

**After:**
```
tenantId: entry.tenant_id,
```

---

⚠️ **Line 111** (medium confidence)

**Before:**
```
userId: entry.userId,
```

**After:**
```
userId: entry.user_id,
```

---

✅ **Line 153** (high confidence)

**Before:**
```
if (req.tenantId && req.user?.id) {
```

**After:**
```
if (req.tenant_id && req.user?.id) {
```

---

✅ **Line 155** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 196** (high confidence)

**Before:**
```
tenantId: entry.tenantId,
```

**After:**
```
tenantId: entry.tenant_id,
```

---

⚠️ **Line 197** (medium confidence)

**Before:**
```
userId: entry.userId,
```

**After:**
```
userId: entry.user_id,
```

---

✅ **Line 219** (high confidence)

**Before:**
```
if (req.tenantId && req.user?.id) {
```

**After:**
```
if (req.tenant_id && req.user?.id) {
```

---

✅ **Line 224** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 273** (high confidence)

**Before:**
```
tenantId: request.tenantId,
```

**After:**
```
tenantId: request.tenant_id,
```

---

✅ **Line 292** (high confidence)

**Before:**
```
tenantId: request.tenantId,
```

**After:**
```
tenantId: request.tenant_id,
```

---

✅ **Line 312** (high confidence)

**Before:**
```
where: (users, { eq, and }) => and(eq(users.tenantId, tenantId), eq(users.id, subjectId)),
```

**After:**
```
where: (users, { eq, and }) => and(eq(users.tenant_id, tenantId), eq(users.id, subjectId)),
```

---

✅ **Line 316** (high confidence)

**Before:**
```
and(eq(records.tenantId, tenantId), eq(records.primaryContactEmail, subjectId)),
```

**After:**
```
and(eq(records.tenant_id, tenantId), eq(records.primaryContactEmail, subjectId)),
```

---

✅ **Line 320** (high confidence)

**Before:**
```
and(eq(tickets.tenantId, tenantId), eq(tickets.customerId, subjectId)),
```

**After:**
```
and(eq(tickets.tenant_id, tenantId), eq(tickets.customerId, subjectId)),
```

---

⚠️ **Line 323** (medium confidence)

**Before:**
```
where: (logs, { eq, and }) => and(eq(logs.tenantId, tenantId), eq(logs.userId, subjectId)),
```

**After:**
```
where: (logs, { eq, and }) => and(eq(logs.tenantId, tenantId), eq(logs.user_id, subjectId)),
```

---

✅ **Line 323** (high confidence)

**Before:**
```
where: (logs, { eq, and }) => and(eq(logs.tenantId, tenantId), eq(logs.userId, subjectId)),
```

**After:**
```
where: (logs, { eq, and }) => and(eq(logs.tenant_id, tenantId), eq(logs.userId, subjectId)),
```

---

### `server\routes.ts`

⚠️ **Line 203** (medium confidence)

**Before:**
```
const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
```

**After:**
```
const isAuthenticated = req.session?.user_id || req.user?.id || req.user?.claims?.sub;
```

---

⚠️ **Line 210** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 212** (high confidence)

**Before:**
```
if (userId && (!req.user || !req.user.tenantId)) {
```

**After:**
```
if (userId && (!req.user || !req.user.tenant_id)) {
```

---

✅ **Line 220** (high confidence)

**Before:**
```
tenantId: fullUser.tenantId,
```

**After:**
```
tenantId: fullUser.tenant_id,
```

---

✅ **Line 241** (high confidence)

**Before:**
```
} else if (!req.user.tenantId && !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id && !req.user.id) {
```

---

✅ **Line 703** (high confidence)

**Before:**
```
tenantId: req.supabaseUser.tenantId,
```

**After:**
```
tenantId: req.supabaseUser.tenant_id,
```

---

⚠️ **Line 799** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 814** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 877** (high confidence)

**Before:**
```
if (!isRoot && user?.tenantId !== tenantId) {
```

**After:**
```
if (!isRoot && user?.tenant_id !== tenantId) {
```

---

✅ **Line 896** (high confidence)

**Before:**
```
.where(eq(locations.tenantId, tenantId))
```

**After:**
```
.where(eq(locations.tenant_id, tenantId))
```

---

✅ **Line 919** (high confidence)

**Before:**
```
if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
```

**After:**
```
if (!user?.role?.canAccessAllTenants && user?.tenant_id !== tenantId) {
```

---

✅ **Line 932** (high confidence)

**Before:**
```
.where(eq(regions.tenantId, tenantId))
```

**After:**
```
.where(eq(regions.tenant_id, tenantId))
```

---

✅ **Line 957** (high confidence)

**Before:**
```
if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
```

**After:**
```
if (!user?.role?.canAccessAllTenants && user?.tenant_id !== tenantId) {
```

---

✅ **Line 977** (high confidence)

**Before:**
```
.where(eq(locations.tenantId, tenantId));
```

**After:**
```
.where(eq(locations.tenant_id, tenantId));
```

---

✅ **Line 995** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 1004** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 1011** (high confidence)

**Before:**
```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

**After:**
```
.where(and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active'))),
```

---

✅ **Line 1021** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

⚠️ **Line 1022** (medium confidence)

**Before:**
```
sql`date_trunc('month', ${invoices.createdAt}) = date_trunc('month', current_date)`,
```

**After:**
```
sql`date_trunc('month', ${invoices.created_at}) = date_trunc('month', current_date)`,
```

---

✅ **Line 1030** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'open'))),
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), eq(serviceTickets.status, 'open'))),
```

---

✅ **Line 1050** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 1060** (medium confidence)

**Before:**
```
createdAt: serviceTickets.createdAt,
```

**After:**
```
createdAt: serviceTickets.created_at,
```

---

✅ **Line 1065** (high confidence)

**Before:**
```
.where(eq(serviceTickets.tenantId, tenantId))
```

**After:**
```
.where(eq(serviceTickets.tenant_id, tenantId))
```

---

⚠️ **Line 1066** (medium confidence)

**Before:**
```
.orderBy(desc(serviceTickets.createdAt))
```

**After:**
```
.orderBy(desc(serviceTickets.created_at))
```

---

✅ **Line 1078** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 1091** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 1111** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1127** (high confidence)

**Before:**
```
.where(and(eq(inventoryItems.tenantId, tenantId), sql`quantity_on_hand <= reorder_point`))
```

**After:**
```
.where(and(eq(inventoryItems.tenant_id, tenantId), sql`quantity_on_hand <= reorder_point`))
```

---

✅ **Line 1151** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1188** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1208** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 1223** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1263** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1310** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1355** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1406** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1476** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1547** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1592** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1652** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1729** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1805** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1873** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1954** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2014** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2109** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2182** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2277** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2329** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2438** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2605** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2774** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 2972** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3133** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3301** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3464** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3698** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3726** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3758** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3791** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3809** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3848** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3974** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 3994** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4013** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4029** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4044** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4066** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4081** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4113** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4130** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4146** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4163** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4182** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4243** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4301** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4347** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4374** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4389** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4408** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4429** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4461** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4480** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4495** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4518** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4534** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4548** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4570** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4586** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4600** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4619** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4637** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4655** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4669** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4688** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4702** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4721** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4741** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4763** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4781** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4795** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4814** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4832** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4850** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4865** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4888** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4919** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4947** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4966** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 4984** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5191** (high confidence)

**Before:**
```
tenantId ? eq(inventoryItems.tenantId, tenantId) : sql`TRUE`,
```

**After:**
```
tenantId ? eq(inventoryItems.tenant_id, tenantId) : sql`TRUE`,
```

---

✅ **Line 5203** (high confidence)

**Before:**
```
.where(tenantId ? eq(vendors.tenantId, tenantId) : sql`TRUE`);
```

**After:**
```
.where(tenantId ? eq(vendors.tenant_id, tenantId) : sql`TRUE`);
```

---

✅ **Line 5321** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 5335** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 5358** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5403** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5448** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5462** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5482** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5513** (high confidence)

**Before:**
```
.where(and(eq(contracts.tenantId, tenantId), inArray(contracts.id, contractIds)));
```

**After:**
```
.where(and(eq(contracts.tenant_id, tenantId), inArray(contracts.id, contractIds)));
```

---

✅ **Line 5630** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5653** (high confidence)

**Before:**
```
.where(eq(contracts.tenantId, tenantId))
```

**After:**
```
.where(eq(contracts.tenant_id, tenantId))
```

---

✅ **Line 5663** (high confidence)

**Before:**
```
.where(eq(contracts.tenantId, tenantId));
```

**After:**
```
.where(eq(contracts.tenant_id, tenantId));
```

---

✅ **Line 5720** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5823** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5881** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 5949** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 6008** (high confidence)

**Before:**
```
eq(productAccessories.tenantId, tenantId),
```

**After:**
```
eq(productAccessories.tenant_id, tenantId),
```

---

✅ **Line 6091** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 6162** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 6181** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 6452** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 6456** (high confidence)

**Before:**
```
const result = await storage.getUsers(user.tenantId);
```

**After:**
```
const result = await storage.getUsers(user.tenant_id);
```

---

✅ **Line 6475** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 6479** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 6504** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6525** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6538** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6559** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6650** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6668** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 6768** (high confidence)

**Before:**
```
const tenantId = req.session?.tenantId;
```

**After:**
```
const tenantId = req.session?.tenant_id;
```

---

✅ **Line 6780** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 6801** (high confidence)

**Before:**
```
.where(and(eq(inventoryItems.tenantId, tenantId), sql`quantity_on_hand <= reorder_point`))
```

**After:**
```
.where(and(eq(inventoryItems.tenant_id, tenantId), sql`quantity_on_hand <= reorder_point`))
```

---

✅ **Line 6833** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 6862** (medium confidence)

**Before:**
```
createdAt: invoices.createdAt,
```

**After:**
```
createdAt: invoices.created_at,
```

---

✅ **Line 6870** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

⚠️ **Line 6874** (medium confidence)

**Before:**
```
.orderBy(desc(invoices.createdAt))
```

**After:**
```
.orderBy(desc(invoices.created_at))
```

---

✅ **Line 6915** (high confidence)

**Before:**
```
eq(serviceContracts.tenantId, tenantId),
```

**After:**
```
eq(serviceContracts.tenant_id, tenantId),
```

---

⚠️ **Line 7352** (medium confidence)

**Before:**
```
const rows = await db.select().from(seoPages).orderBy(desc(seoPages.updatedAt));
```

**After:**
```
const rows = await db.select().from(seoPages).orderBy(desc(seoPages.updated_at));
```

---

⚠️ **Line 8088** (medium confidence)

**Before:**
```
updateData.updatedAt = new Date();
```

**After:**
```
updateData.updated_at = new Date();
```

---

✅ **Line 8226** (high confidence)

**Before:**
```
req.tenantId as string,
```

**After:**
```
req.tenant_id as string,
```

---

✅ **Line 8244** (high confidence)

**Before:**
```
req.tenantId as string,
```

**After:**
```
req.tenant_id as string,
```

---

✅ **Line 8262** (high confidence)

**Before:**
```
req.tenantId as string,
```

**After:**
```
req.tenant_id as string,
```

---

✅ **Line 8280** (high confidence)

**Before:**
```
req.tenantId as string,
```

**After:**
```
req.tenant_id as string,
```

---

✅ **Line 8298** (high confidence)

**Before:**
```
req.tenantId as string,
```

**After:**
```
req.tenant_id as string,
```

---

✅ **Line 8311** (high confidence)

**Before:**
```
const contracts = await storage.getContracts(req.tenantId!);
```

**After:**
```
const contracts = await storage.getContracts(req.tenant_id!);
```

---

⚠️ **Line 8322** (medium confidence)

**Before:**
```
const userId = session?.userId;
```

**After:**
```
const userId = session?.user_id;
```

---

✅ **Line 8339** (high confidence)

**Before:**
```
tenantId: req.tenantId!,
```

**After:**
```
tenantId: req.tenant_id!,
```

---

✅ **Line 8533** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8585** (high confidence)

**Before:**
```
const tenantId = String((req as any).user?.tenantId || '');
```

**After:**
```
const tenantId = String((req as any).user?.tenant_id || '');
```

---

✅ **Line 8625** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8688** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8726** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8753** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8782** (high confidence)

**Before:**
```
const businessRecordId = req.user.tenantId; // Placeholder
```

**After:**
```
const businessRecordId = req.user.tenant_id; // Placeholder
```

---

✅ **Line 8816** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8840** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8864** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8908** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 8951** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9004** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9036** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9104** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9127** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9231** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9260** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9307** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9342** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9374** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9430** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9454** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9524** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9556** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9571** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 9633** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9658** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9696** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9738** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9766** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9857** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9881** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9939** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 9969** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10024** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10053** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10089** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10113** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10169** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10226** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10309** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10336** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10384** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10411** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10438** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10491** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10529** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10569** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10628** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10656** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10693** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10717** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10776** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10814** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10861** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10922** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10946** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 10974** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11036** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11067** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11091** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11139** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11176** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11208** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11291** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11341** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11377** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11434** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11470** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11494** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11554** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11604** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11668** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11693** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11748** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11784** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11808** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11861** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11885** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11932** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 11995** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 12069** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 12122** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 12158** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 12355** (high confidence)

**Before:**
```
eq(meterReadings.tenantId, tenantId),
```

**After:**
```
eq(meterReadings.tenant_id, tenantId),
```

---

✅ **Line 12736** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 12789** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

### `server\routes-workflow-automation.ts`

✅ **Line 20** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 631** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 695** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-warehouse.ts`

✅ **Line 101** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || (req as any).user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || (req as any).user?.claims?.tenant_id;
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 130** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 157** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 174** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 203** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 221** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 249** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 260** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 282** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 300** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 311** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 339** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 350** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 380** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 398** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

### `server\routes-warehouse-fpy.ts`

✅ **Line 50** (high confidence)

**Before:**
```
.where(eq(warehouseKittingOperations.tenantId, tenantId));
```

**After:**
```
.where(eq(warehouseKittingOperations.tenant_id, tenantId));
```

---

⚠️ **Line 61** (medium confidence)

**Before:**
```
query = query.where(gte(warehouseKittingOperations.createdAt, new Date(fromDate as string)));
```

**After:**
```
query = query.where(gte(warehouseKittingOperations.created_at, new Date(fromDate as string)));
```

---

⚠️ **Line 65** (medium confidence)

**Before:**
```
query = query.where(lte(warehouseKittingOperations.createdAt, new Date(toDate as string)));
```

**After:**
```
query = query.where(lte(warehouseKittingOperations.created_at, new Date(toDate as string)));
```

---

⚠️ **Line 68** (medium confidence)

**Before:**
```
const operations = await query.orderBy(desc(warehouseKittingOperations.createdAt));
```

**After:**
```
const operations = await query.orderBy(desc(warehouseKittingOperations.created_at));
```

---

✅ **Line 98** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, tenantId),
```

---

✅ **Line 127** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, tenantId),
```

---

⚠️ **Line 143** (medium confidence)

**Before:**
```
const startTime = operation.startedAt || operation.createdAt;
```

**After:**
```
const startTime = operation.startedAt || operation.created_at;
```

---

✅ **Line 200** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, tenantId),
```

---

⚠️ **Line 201** (medium confidence)

**Before:**
```
gte(warehouseKittingOperations.createdAt, startDate),
```

**After:**
```
gte(warehouseKittingOperations.created_at, startDate),
```

---

✅ **Line 318** (high confidence)

**Before:**
```
eq(autoInvoiceGeneration.tenantId, tenantId),
```

**After:**
```
eq(autoInvoiceGeneration.tenant_id, tenantId),
```

---

✅ **Line 345** (high confidence)

**Before:**
```
.where(eq(autoInvoiceGeneration.tenantId, tenantId));
```

**After:**
```
.where(eq(autoInvoiceGeneration.tenant_id, tenantId));
```

---

### `server\routes-validate.ts`

✅ **Line 42** (high confidence)

**Before:**
```
.where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(quotes.id, quoteId), eq(quotes.tenant_id, tenantId)))
```

---

✅ **Line 104** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 152** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenant_id, tenantId)))
```

---

✅ **Line 241** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenant_id, tenantId)))
```

---

✅ **Line 309** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenant_id, tenantId)))
```

---

### `server\routes-user-profile.ts`

✅ **Line 134** (high confidence)

**Before:**
```
tenant_id: userRecord.tenantId,
```

**After:**
```
tenant_id: userRecord.tenant_id,
```

---

⚠️ **Line 140** (medium confidence)

**Before:**
```
createdAt: userRecord.createdAt,
```

**After:**
```
createdAt: userRecord.created_at,
```

---

✅ **Line 179** (high confidence)

**Before:**
```
const tenantId = req.supabaseUser?.tenantId || (req as any).tenantId;
```

**After:**
```
const tenantId = req.supabaseUser?.tenant_id || (req as any).tenant_id;
```

---

### `server\routes-user-lifecycle.ts`

✅ **Line 49** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 53** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

⚠️ **Line 68** (medium confidence)

**Before:**
```
targetUserId: req.params.userId || req.body.userId,
```

**After:**
```
targetUserId: req.params.user_id || req.body.user_id,
```

---

⚠️ **Line 268** (medium confidence)

**Before:**
```
where: eq(onboardingChecklists.userId, req.params.userId),
```

**After:**
```
where: eq(onboardingChecklists.user_id, req.params.user_id),
```

---

⚠️ **Line 269** (medium confidence)

**Before:**
```
orderBy: desc(onboardingChecklists.createdAt),
```

**After:**
```
orderBy: desc(onboardingChecklists.created_at),
```

---

⚠️ **Line 358** (medium confidence)

**Before:**
```
userId: req.params.userId,
```

**After:**
```
userId: req.params.user_id,
```

---

⚠️ **Line 386** (medium confidence)

**Before:**
```
where: eq(offboardingWorkflows.userId, req.params.userId),
```

**After:**
```
where: eq(offboardingWorkflows.user_id, req.params.user_id),
```

---

⚠️ **Line 387** (medium confidence)

**Before:**
```
orderBy: desc(offboardingWorkflows.createdAt),
```

**After:**
```
orderBy: desc(offboardingWorkflows.created_at),
```

---

⚠️ **Line 524** (medium confidence)

**Before:**
```
impersonatedUserId: req.params.userId,
```

**After:**
```
impersonatedUserId: req.params.user_id,
```

---

✅ **Line 578** (high confidence)

**Before:**
```
tenantId ? eq(userImpersonationSessions.tenantId, tenantId as string) : undefined,
```

**After:**
```
tenantId ? eq(userImpersonationSessions.tenant_id, tenantId as string) : undefined,
```

---

⚠️ **Line 603** (medium confidence)

**Before:**
```
where: eq(userLifecycleEvents.userId, req.params.userId),
```

**After:**
```
where: eq(userLifecycleEvents.user_id, req.params.user_id),
```

---

⚠️ **Line 604** (medium confidence)

**Before:**
```
orderBy: desc(userLifecycleEvents.createdAt),
```

**After:**
```
orderBy: desc(userLifecycleEvents.created_at),
```

---

### `server\routes-universal-search.ts`

✅ **Line 65** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 121** (high confidence)

**Before:**
```
eq(deals.tenantId, tenantId),
```

**After:**
```
eq(deals.tenant_id, tenantId),
```

---

✅ **Line 176** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

✅ **Line 226** (high confidence)

**Before:**
```
eq(quotes.tenantId, tenantId),
```

**After:**
```
eq(quotes.tenant_id, tenantId),
```

---

### `server\routes-trial.ts`

⚠️ **Line 13** (medium confidence)

**Before:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
```

**After:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.user_id;
```

---

### `server\routes-today-dashboard.ts`

✅ **Line 58** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

✅ **Line 73** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

✅ **Line 86** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

✅ **Line 101** (high confidence)

**Before:**
```
eq(leadScoreCalculations.tenantId, tenantId),
```

**After:**
```
eq(leadScoreCalculations.tenant_id, tenantId),
```

---

✅ **Line 138** (high confidence)

**Before:**
```
eq(deals.tenantId, tenantId),
```

**After:**
```
eq(deals.tenant_id, tenantId),
```

---

⚠️ **Line 151** (medium confidence)

**Before:**
```
const updatedAt = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt!);
```

**After:**
```
const updatedAt = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.created_at!);
```

---

⚠️ **Line 151** (medium confidence)

**Before:**
```
const updatedAt = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt!);
```

**After:**
```
const updatedAt = deal.updated_at ? new Date(deal.updated_at) : new Date(deal.createdAt!);
```

---

✅ **Line 179** (high confidence)

**Before:**
```
eq(deals.tenantId, tenantId),
```

**After:**
```
eq(deals.tenant_id, tenantId),
```

---

✅ **Line 201** (high confidence)

**Before:**
```
where: eq(deals.tenantId, tenantId),
```

**After:**
```
where: eq(deals.tenant_id, tenantId),
```

---

✅ **Line 227** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 241** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

### `server\routes-territory-management.ts`

✅ **Line 45** (high confidence)

**Before:**
```
const territory = await territoryManagementService.createTerritory(req.tenantId!, req.body);
```

**After:**
```
const territory = await territoryManagementService.createTerritory(req.tenant_id!, req.body);
```

---

✅ **Line 67** (high confidence)

**Before:**
```
const result = await territoryManagementService.listTerritories(req.tenantId!, {
```

**After:**
```
const result = await territoryManagementService.listTerritories(req.tenant_id!, {
```

---

✅ **Line 92** (high confidence)

**Before:**
```
const territory = await territoryManagementService.getTerritory(req.tenantId!, req.params.id);
```

**After:**
```
const territory = await territoryManagementService.getTerritory(req.tenant_id!, req.params.id);
```

---

✅ **Line 116** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 142** (high confidence)

**Before:**
```
await territoryManagementService.deleteTerritory(req.tenantId!, req.params.id, req.user!.id);
```

**After:**
```
await territoryManagementService.deleteTerritory(req.tenant_id!, req.params.id, req.user!.id);
```

---

✅ **Line 161** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 185** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 220** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 245** (high confidence)

**Before:**
```
const result = await territoryManagementService.listAssignmentRules(req.tenantId!, {
```

**After:**
```
const result = await territoryManagementService.listAssignmentRules(req.tenant_id!, {
```

---

✅ **Line 267** (high confidence)

**Before:**
```
const rule = await territoryManagementService.getAssignmentRule(req.tenantId!, req.params.id);
```

**After:**
```
const rule = await territoryManagementService.getAssignmentRule(req.tenant_id!, req.params.id);
```

---

✅ **Line 296** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 326** (high confidence)

**Before:**
```
await territoryManagementService.deleteAssignmentRule(req.tenantId!, req.params.id);
```

**After:**
```
await territoryManagementService.deleteAssignmentRule(req.tenant_id!, req.params.id);
```

---

✅ **Line 349** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

⚠️ **Line 350** (medium confidence)

**Before:**
```
req.params.userId,
```

**After:**
```
req.params.user_id,
```

---

✅ **Line 371** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

⚠️ **Line 372** (medium confidence)

**Before:**
```
req.params.userId,
```

**After:**
```
req.params.user_id,
```

---

✅ **Line 396** (high confidence)

**Before:**
```
const result = await territoryManagementService.listRepCapacities(req.tenantId!, {
```

**After:**
```
const result = await territoryManagementService.listRepCapacities(req.tenant_id!, {
```

---

✅ **Line 420** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 446** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 468** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

⚠️ **Line 469** (medium confidence)

**Before:**
```
req.params.userId,
```

**After:**
```
req.params.user_id,
```

---

✅ **Line 496** (high confidence)

**Before:**
```
const stats = await territoryManagementService.getStats(req.tenantId!);
```

**After:**
```
const stats = await territoryManagementService.getStats(req.tenant_id!);
```

---

### `server\routes-tenant-onboarding.ts`

✅ **Line 46** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 50** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 278** (high confidence)

**Before:**
```
tenantId: req.params.tenantId,
```

**After:**
```
tenantId: req.params.tenant_id,
```

---

✅ **Line 303** (high confidence)

**Before:**
```
where: eq(integrationSetupLogs.tenantId, req.params.tenantId),
```

**After:**
```
where: eq(integrationSetupLogs.tenant_id, req.params.tenant_id),
```

---

⚠️ **Line 304** (medium confidence)

**Before:**
```
orderBy: desc(integrationSetupLogs.createdAt),
```

**After:**
```
orderBy: desc(integrationSetupLogs.created_at),
```

---

✅ **Line 368** (high confidence)

**Before:**
```
tenantId: req.params.tenantId,
```

**After:**
```
tenantId: req.params.tenant_id,
```

---

✅ **Line 448** (high confidence)

**Before:**
```
const healthScore = await TenantOnboardingService.validateTenantHealth(req.params.tenantId);
```

**After:**
```
const healthScore = await TenantOnboardingService.validateTenantHealth(req.params.tenant_id);
```

---

✅ **Line 470** (high confidence)

**Before:**
```
where: eq(tenantHealthScores.tenantId, req.params.tenantId),
```

**After:**
```
where: eq(tenantHealthScores.tenant_id, req.params.tenant_id),
```

---

✅ **Line 504** (high confidence)

**Before:**
```
sourceTenantId: req.params.tenantId,
```

**After:**
```
sourceTenantId: req.params.tenant_id,
```

---

⚠️ **Line 559** (medium confidence)

**Before:**
```
orderBy: desc(onboardingAnalytics.createdAt),
```

**After:**
```
orderBy: desc(onboardingAnalytics.created_at),
```

---

⚠️ **Line 565** (medium confidence)

**Before:**
```
orderBy: desc(tenantOnboardingSessions.createdAt),
```

**After:**
```
orderBy: desc(tenantOnboardingSessions.created_at),
```

---

⚠️ **Line 598** (medium confidence)

**Before:**
```
orderBy: desc(tenantOnboardingSessions.createdAt),
```

**After:**
```
orderBy: desc(tenantOnboardingSessions.created_at),
```

---

### `server\routes-templates.ts`

✅ **Line 18** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 23** (high confidence)

**Before:**
```
.where(eq(projectTemplates.tenantId, tenantId))
```

**After:**
```
.where(eq(projectTemplates.tenant_id, tenantId))
```

---

⚠️ **Line 24** (medium confidence)

**Before:**
```
.orderBy(projectTemplates.createdAt);
```

**After:**
```
.orderBy(projectTemplates.created_at);
```

---

✅ **Line 36** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 42** (high confidence)

**Before:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenant_id, tenantId)));
```

---

✅ **Line 58** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 79** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 85** (high confidence)

**Before:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenant_id, tenantId)))
```

---

✅ **Line 102** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 107** (high confidence)

**Before:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenant_id, tenantId)));
```

---

✅ **Line 119** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 127** (high confidence)

**Before:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(projectTemplates.id, templateId), eq(projectTemplates.tenant_id, tenantId)));
```

---

✅ **Line 184** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 192** (high confidence)

**Before:**
```
.where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(projects.id, projectId), eq(projects.tenant_id, tenantId)));
```

---

✅ **Line 202** (high confidence)

**Before:**
```
.where(and(eq(tasks.projectId, projectId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.projectId, projectId), eq(tasks.tenant_id, tenantId)));
```

---

### `server\routes-technician-management.ts`

✅ **Line 34** (high confidence)

**Before:**
```
const tenantId = req.user!.tenantId;
```

**After:**
```
const tenantId = req.user!.tenant_id;
```

---

⚠️ **Line 54** (medium confidence)

**Before:**
```
createdAt: technicians.createdAt,
```

**After:**
```
createdAt: technicians.created_at,
```

---

⚠️ **Line 55** (medium confidence)

**Before:**
```
updatedAt: technicians.updatedAt,
```

**After:**
```
updatedAt: technicians.updated_at,
```

---

✅ **Line 58** (high confidence)

**Before:**
```
.where(eq(technicians.tenantId, tenantId))
```

**After:**
```
.where(eq(technicians.tenant_id, tenantId))
```

---

✅ **Line 70** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 81** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 84** (medium confidence)

**Before:**
```
serviceTickets.updatedAt,
```

**After:**
```
serviceTickets.updated_at,
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 119** (high confidence)

**Before:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenant_id, tenantId)));
```

---

⚠️ **Line 136** (medium confidence)

**Before:**
```
createdAt: serviceTickets.createdAt,
```

**After:**
```
createdAt: serviceTickets.created_at,
```

---

✅ **Line 142** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 145** (medium confidence)

**Before:**
```
.orderBy(desc(serviceTickets.createdAt))
```

**After:**
```
.orderBy(desc(serviceTickets.created_at))
```

---

✅ **Line 166** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 193** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 202** (high confidence)

**Before:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenant_id, tenantId)))
```

---

✅ **Line 224** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 234** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 248** (high confidence)

**Before:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(technicians.id, technicianId), eq(technicians.tenant_id, tenantId)))
```

---

✅ **Line 270** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 283** (high confidence)

**Before:**
```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'active')));
```

**After:**
```
.where(and(eq(technicians.tenant_id, tenantId), eq(technicians.status, 'active')));
```

---

✅ **Line 296** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 326** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 338** (medium confidence)

**Before:**
```
avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${serviceTickets.completedDate} - ${serviceTickets.createdAt})) / 3600)`,
```

**After:**
```
avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${serviceTickets.completedDate} - ${serviceTickets.created_at})) / 3600)`,
```

---

✅ **Line 342** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), gte(serviceTickets.createdAt, daysAgo)))
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), gte(serviceTickets.createdAt, daysAgo)))
```

---

⚠️ **Line 342** (medium confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), gte(serviceTickets.createdAt, daysAgo)))
```

**After:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), gte(serviceTickets.created_at, daysAgo)))
```

---

✅ **Line 367** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 372** (high confidence)

**Before:**
```
.where(eq(technicians.tenantId, tenantId));
```

**After:**
```
.where(eq(technicians.tenant_id, tenantId));
```

---

✅ **Line 377** (high confidence)

**Before:**
```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'active')));
```

**After:**
```
.where(and(eq(technicians.tenant_id, tenantId), eq(technicians.status, 'active')));
```

---

✅ **Line 384** (high confidence)

**Before:**
```
eq(technicians.tenantId, tenantId),
```

**After:**
```
eq(technicians.tenant_id, tenantId),
```

---

✅ **Line 395** (high confidence)

**Before:**
```
eq(technicians.tenantId, tenantId),
```

**After:**
```
eq(technicians.tenant_id, tenantId),
```

---

### `server\routes-tasks.ts`

✅ **Line 19** (high confidence)

**Before:**
```
if (userId && (!req.user || !req.user.tenantId)) {
```

**After:**
```
if (userId && (!req.user || !req.user.tenant_id)) {
```

---

✅ **Line 27** (high confidence)

**Before:**
```
tenantId: fullUser.tenantId,
```

**After:**
```
tenantId: fullUser.tenant_id,
```

---

✅ **Line 45** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 50** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 59** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 80** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 99** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 139** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 158** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 177** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 199** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-subscriptions.ts`

✅ **Line 106** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 145** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 167** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

✅ **Line 207** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 240** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 265** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 297** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 318** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 349** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 370** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 415** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 443** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 455** (high confidence)

**Before:**
```
eq(subscriptionNotifications.tenantId, tenantId),
```

**After:**
```
eq(subscriptionNotifications.tenant_id, tenantId),
```

---

⚠️ **Line 456** (medium confidence)

**Before:**
```
userId ? eq(subscriptionNotifications.userId, userId) : sql`true`,
```

**After:**
```
userId ? eq(subscriptionNotifications.user_id, userId) : sql`true`,
```

---

⚠️ **Line 460** (medium confidence)

**Before:**
```
.orderBy(desc(subscriptionNotifications.createdAt))
```

**After:**
```
.orderBy(desc(subscriptionNotifications.created_at))
```

---

✅ **Line 476** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 493** (high confidence)

**Before:**
```
eq(subscriptionNotifications.tenantId, tenantId),
```

**After:**
```
eq(subscriptionNotifications.tenant_id, tenantId),
```

---

✅ **Line 510** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 527** (high confidence)

**Before:**
```
eq(subscriptionNotifications.tenantId, tenantId),
```

**After:**
```
eq(subscriptionNotifications.tenant_id, tenantId),
```

---

✅ **Line 548** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 553** (high confidence)

**Before:**
```
.where(eq(subscriptionEvents.tenantId, tenantId))
```

**After:**
```
.where(eq(subscriptionEvents.tenant_id, tenantId))
```

---

⚠️ **Line 554** (medium confidence)

**Before:**
```
.orderBy(desc(subscriptionEvents.createdAt))
```

**After:**
```
.orderBy(desc(subscriptionEvents.created_at))
```

---

✅ **Line 675** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 765** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 843** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 855** (high confidence)

**Before:**
```
if (session.metadata?.tenantId !== tenantId) {
```

**After:**
```
if (session.metadata?.tenant_id !== tenantId) {
```

---

✅ **Line 879** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 924** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 956** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 969** (high confidence)

**Before:**
```
where: eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
where: eq(tenantSubscriptions.tenant_id, tenantId),
```

---

✅ **Line 1001** (high confidence)

**Before:**
```
where: eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
where: eq(tenantSubscriptions.tenant_id, tenantId),
```

---

### `server\routes-software-products.ts`

✅ **Line 15** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 33** (medium confidence)

**Before:**
```
createdAt: softwareProducts.createdAt,
```

**After:**
```
createdAt: softwareProducts.created_at,
```

---

⚠️ **Line 34** (medium confidence)

**Before:**
```
updatedAt: softwareProducts.updatedAt,
```

**After:**
```
updatedAt: softwareProducts.updated_at,
```

---

✅ **Line 37** (high confidence)

**Before:**
```
.where(eq(softwareProducts.tenantId, tenantId));
```

**After:**
```
.where(eq(softwareProducts.tenant_id, tenantId));
```

---

✅ **Line 69** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 75** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenant_id, tenantId)));
```

---

✅ **Line 91** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 111** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 120** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenant_id, tenantId)))
```

---

✅ **Line 137** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 142** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(softwareProducts.id, productId), eq(softwareProducts.tenant_id, tenantId)))
```

---

✅ **Line 159** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 166** (high confidence)

**Before:**
```
eq(softwareProducts.tenantId, tenantId),
```

**After:**
```
eq(softwareProducts.tenant_id, tenantId),
```

---

✅ **Line 181** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 187** (high confidence)

**Before:**
```
and(eq(softwareProducts.tenantId, tenantId), sql`${softwareProducts.vendor} IS NOT NULL`),
```

**After:**
```
and(eq(softwareProducts.tenant_id, tenantId), sql`${softwareProducts.vendor} IS NOT NULL`),
```

---

✅ **Line 200** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 207** (high confidence)

**Before:**
```
eq(softwareProducts.tenantId, tenantId),
```

**After:**
```
eq(softwareProducts.tenant_id, tenantId),
```

---

✅ **Line 222** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 227** (high confidence)

**Before:**
```
.where(eq(softwareProducts.tenantId, tenantId));
```

**After:**
```
.where(eq(softwareProducts.tenant_id, tenantId));
```

---

✅ **Line 232** (high confidence)

**Before:**
```
.where(and(eq(softwareProducts.tenantId, tenantId), eq(softwareProducts.status, 'active')));
```

**After:**
```
.where(and(eq(softwareProducts.tenant_id, tenantId), eq(softwareProducts.status, 'active')));
```

---

✅ **Line 239** (high confidence)

**Before:**
```
eq(softwareProducts.tenantId, tenantId),
```

**After:**
```
eq(softwareProducts.tenant_id, tenantId),
```

---

✅ **Line 249** (high confidence)

**Before:**
```
.where(eq(softwareProducts.tenantId, tenantId));
```

**After:**
```
.where(eq(softwareProducts.tenant_id, tenantId));
```

---

✅ **Line 272** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 281** (high confidence)

**Before:**
```
.where(eq(softwareProducts.tenantId, tenantId))
```

**After:**
```
.where(eq(softwareProducts.tenant_id, tenantId))
```

---

### `server\routes-social-media.ts`

✅ **Line 31** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 36** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 151** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, post.id), eq(socialMediaPosts.tenantId, post.tenantId)));
```

**After:**
```
.where(and(eq(socialMediaPosts.id, post.id), eq(socialMediaPosts.tenant_id, post.tenant_id)));
```

---

✅ **Line 164** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, post.id), eq(socialMediaPosts.tenantId, post.tenantId)));
```

**After:**
```
.where(and(eq(socialMediaPosts.id, post.id), eq(socialMediaPosts.tenant_id, post.tenant_id)));
```

---

✅ **Line 173** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 181** (high confidence)

**Before:**
```
.where(eq(socialMediaPosts.tenantId, tenantId))
```

**After:**
```
.where(eq(socialMediaPosts.tenant_id, tenantId))
```

---

⚠️ **Line 182** (medium confidence)

**Before:**
```
.orderBy(desc(socialMediaPosts.createdAt));
```

**After:**
```
.orderBy(desc(socialMediaPosts.created_at));
```

---

✅ **Line 194** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 248** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 260** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenant_id, tenantId)))
```

---

✅ **Line 277** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 286** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenant_id, tenantId)))
```

---

✅ **Line 303** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 319** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenant_id, tenantId)));
```

---

✅ **Line 329** (high confidence)

**Before:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(socialMediaPosts.id, id), eq(socialMediaPosts.tenant_id, tenantId)));
```

---

✅ **Line 348** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 356** (high confidence)

**Before:**
```
.where(eq(socialMediaCronJobs.tenantId, tenantId))
```

**After:**
```
.where(eq(socialMediaCronJobs.tenant_id, tenantId))
```

---

⚠️ **Line 357** (medium confidence)

**Before:**
```
.orderBy(desc(socialMediaCronJobs.createdAt));
```

**After:**
```
.orderBy(desc(socialMediaCronJobs.created_at));
```

---

✅ **Line 369** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 394** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 406** (high confidence)

**Before:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenant_id, tenantId)))
```

---

✅ **Line 423** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 432** (high confidence)

**Before:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenant_id, tenantId)))
```

---

✅ **Line 449** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 460** (high confidence)

**Before:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenant_id, tenantId)));
```

---

✅ **Line 508** (high confidence)

**Before:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenant_id, tenantId)));
```

---

✅ **Line 525** (high confidence)

**Before:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(socialMediaCronJobs.id, id), eq(socialMediaCronJobs.tenant_id, tenantId)));
```

---

### `server\routes-signup-crm.ts`

⚠️ **Line 96** (medium confidence)

**Before:**
```
.orderBy(desc(trialActivityLog.createdAt))
```

**After:**
```
.orderBy(desc(trialActivityLog.created_at))
```

---

⚠️ **Line 111** (medium confidence)

**Before:**
```
.orderBy(desc(conversionFunnelEvents.createdAt));
```

**After:**
```
.orderBy(desc(conversionFunnelEvents.created_at));
```

---

⚠️ **Line 140** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

⚠️ **Line 171** (medium confidence)

**Before:**
```
.where(and(gte(platformSignups.createdAt, start), lte(platformSignups.createdAt, end)));
```

**After:**
```
.where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)));
```

---

⚠️ **Line 180** (medium confidence)

**Before:**
```
.where(and(gte(platformSignups.createdAt, start), lte(platformSignups.createdAt, end)))
```

**After:**
```
.where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)))
```

---

⚠️ **Line 190** (medium confidence)

**Before:**
```
.where(and(gte(platformSignups.createdAt, start), lte(platformSignups.createdAt, end)))
```

**After:**
```
.where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)))
```

---

⚠️ **Line 197** (medium confidence)

**Before:**
```
.where(and(gte(platformSignups.createdAt, start), lte(platformSignups.createdAt, end)));
```

**After:**
```
.where(and(gte(platformSignups.created_at, start), lte(platformSignups.created_at, end)));
```

---

⚠️ **Line 206** (medium confidence)

**Before:**
```
gte(platformSignups.createdAt, start),
```

**After:**
```
gte(platformSignups.created_at, start),
```

---

⚠️ **Line 207** (medium confidence)

**Before:**
```
lte(platformSignups.createdAt, end),
```

**After:**
```
lte(platformSignups.created_at, end),
```

---

### `server\routes-settings.ts`

✅ **Line 50** (high confidence)

**Before:**
```
tenantId: user.tenantId || (req as any).tenantId || 'demo-tenant',
```

**After:**
```
tenantId: user.tenant_id || (req as any).tenant_id || 'demo-tenant',
```

---

⚠️ **Line 251** (medium confidence)

**Before:**
```
createdAt: userData?.createdAt,
```

**After:**
```
createdAt: userData?.created_at,
```

---

### `server\routes-service-dispatch.ts`

✅ **Line 59** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 75** (medium confidence)

**Before:**
```
createdAt: serviceTickets.createdAt,
```

**After:**
```
createdAt: serviceTickets.created_at,
```

---

✅ **Line 79** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'pending')))
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), eq(serviceTickets.status, 'pending')))
```

---

⚠️ **Line 80** (medium confidence)

**Before:**
```
.orderBy(desc(serviceTickets.createdAt))
```

**After:**
```
.orderBy(desc(serviceTickets.created_at))
```

---

✅ **Line 87** (high confidence)

**Before:**
```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'available')));
```

**After:**
```
.where(and(eq(technicians.tenant_id, tenantId), eq(technicians.status, 'available')));
```

---

✅ **Line 98** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 133** (medium confidence)

**Before:**
```
createdAt: ticket.createdAt,
```

**After:**
```
createdAt: ticket.created_at,
```

---

⚠️ **Line 160** (medium confidence)

**Before:**
```
createdAt: ticket.createdAt,
```

**After:**
```
createdAt: ticket.created_at,
```

---

✅ **Line 263** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 282** (high confidence)

**Before:**
```
.where(eq(technicians.tenantId, tenantId));
```

**After:**
```
.where(eq(technicians.tenant_id, tenantId));
```

---

✅ **Line 293** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 350** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 364** (high confidence)

**Before:**
```
.where(eq(serviceTickets.tenantId, tenantId))
```

**After:**
```
.where(eq(serviceTickets.tenant_id, tenantId))
```

---

✅ **Line 376** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'completed')))
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), eq(serviceTickets.status, 'completed')))
```

---

✅ **Line 455** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 468** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 478** (high confidence)

**Before:**
```
.where(and(eq(technicians.tenantId, tenantId), eq(technicians.status, 'available')));
```

**After:**
```
.where(and(eq(technicians.tenant_id, tenantId), eq(technicians.status, 'available')));
```

---

✅ **Line 535** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 545** (high confidence)

**Before:**
```
.where(eq(technicians.tenantId, tenantId));
```

**After:**
```
.where(eq(technicians.tenant_id, tenantId));
```

---

✅ **Line 587** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 617** (high confidence)

**Before:**
```
and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.partNumber, partNumber)),
```

**After:**
```
and(eq(inventoryItems.tenant_id, tenantId), eq(inventoryItems.partNumber, partNumber)),
```

---

✅ **Line 672** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 692** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), inArray(serviceTickets.id, ticketIds)));
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), inArray(serviceTickets.id, ticketIds)));
```

---

✅ **Line 718** (high confidence)

**Before:**
```
eq(inventoryItems.tenantId, tenantId),
```

**After:**
```
eq(inventoryItems.tenant_id, tenantId),
```

---

### `server\routes-service-analysis.ts`

✅ **Line 25** (high confidence)

**Before:**
```
req.tenantId = tenantId;
```

**After:**
```
req.tenant_id = tenantId;
```

---

✅ **Line 41** (high confidence)

**Before:**
```
eq(serviceCallAnalysis.tenantId, tenantId),
```

**After:**
```
eq(serviceCallAnalysis.tenant_id, tenantId),
```

---

⚠️ **Line 45** (medium confidence)

**Before:**
```
.orderBy(desc(serviceCallAnalysis.createdAt));
```

**After:**
```
.orderBy(desc(serviceCallAnalysis.created_at));
```

---

✅ **Line 72** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenant_id, tenantId)));
```

---

✅ **Line 77** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenant_id, tenantId)));
```

---

✅ **Line 97** (high confidence)

**Before:**
```
.where(and(eq(serviceCallAnalysis.id, id), eq(serviceCallAnalysis.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceCallAnalysis.id, id), eq(serviceCallAnalysis.tenant_id, tenantId)))
```

---

✅ **Line 121** (high confidence)

**Before:**
```
and(eq(servicePartsUsed.tenantId, tenantId), eq(servicePartsUsed.analysisId, analysisId)),
```

**After:**
```
and(eq(servicePartsUsed.tenant_id, tenantId), eq(servicePartsUsed.analysisId, analysisId)),
```

---

✅ **Line 162** (high confidence)

**Before:**
```
and(eq(serviceCallAnalysis.id, analysisId), eq(serviceCallAnalysis.tenantId, tenantId)),
```

**After:**
```
and(eq(serviceCallAnalysis.id, analysisId), eq(serviceCallAnalysis.tenant_id, tenantId)),
```

---

✅ **Line 196** (high confidence)

**Before:**
```
.where(and(eq(partsOrders.tenantId, tenantId), eq(partsOrders.analysisId, analysisId)))
```

**After:**
```
.where(and(eq(partsOrders.tenant_id, tenantId), eq(partsOrders.analysisId, analysisId)))
```

---

⚠️ **Line 197** (medium confidence)

**Before:**
```
.orderBy(desc(partsOrders.createdAt));
```

**After:**
```
.orderBy(desc(partsOrders.created_at));
```

---

✅ **Line 221** (high confidence)

**Before:**
```
.where(and(eq(partsOrders.id, orderId), eq(partsOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(partsOrders.id, orderId), eq(partsOrders.tenant_id, tenantId)))
```

---

✅ **Line 268** (high confidence)

**Before:**
```
.where(and(eq(partsOrderItems.tenantId, tenantId), eq(partsOrderItems.orderId, orderId)));
```

**After:**
```
.where(and(eq(partsOrderItems.tenant_id, tenantId), eq(partsOrderItems.orderId, orderId)));
```

---

✅ **Line 291** (high confidence)

**Before:**
```
.where(eq(serviceCallAnalysis.tenantId, tenantId));
```

**After:**
```
.where(eq(serviceCallAnalysis.tenant_id, tenantId));
```

---

✅ **Line 301** (high confidence)

**Before:**
```
.where(eq(partsOrders.tenantId, tenantId));
```

**After:**
```
.where(eq(partsOrders.tenant_id, tenantId));
```

---

⚠️ **Line 327** (medium confidence)

**Before:**
```
createdAt: serviceCallAnalysis.createdAt,
```

**After:**
```
createdAt: serviceCallAnalysis.created_at,
```

---

✅ **Line 333** (high confidence)

**Before:**
```
.where(eq(serviceCallAnalysis.tenantId, tenantId))
```

**After:**
```
.where(eq(serviceCallAnalysis.tenant_id, tenantId))
```

---

⚠️ **Line 334** (medium confidence)

**Before:**
```
.orderBy(desc(serviceCallAnalysis.createdAt))
```

**After:**
```
.orderBy(desc(serviceCallAnalysis.created_at))
```

---

### `server\routes-seo.ts`

✅ **Line 53** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 61** (high confidence)

**Before:**
```
.where(eq(seoSettings.tenantId, tenantId))
```

**After:**
```
.where(eq(seoSettings.tenant_id, tenantId))
```

---

✅ **Line 74** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 82** (high confidence)

**Before:**
```
.where(eq(seoSettings.tenantId, tenantId))
```

**After:**
```
.where(eq(seoSettings.tenant_id, tenantId))
```

---

✅ **Line 132** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 180** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 191** (high confidence)

**Before:**
```
.where(eq(seoAuditHistory.tenantId, tenantId))
```

**After:**
```
.where(eq(seoAuditHistory.tenant_id, tenantId))
```

---

⚠️ **Line 192** (medium confidence)

**Before:**
```
.orderBy(desc(seoAuditHistory.createdAt))
```

**After:**
```
.orderBy(desc(seoAuditHistory.created_at))
```

---

✅ **Line 206** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 214** (high confidence)

**Before:**
```
.where(and(eq(seoAuditHistory.id, req.params.id), eq(seoAuditHistory.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(seoAuditHistory.id, req.params.id), eq(seoAuditHistory.tenant_id, tenantId)))
```

---

✅ **Line 231** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 271** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 279** (high confidence)

**Before:**
```
.where(eq(seoKeywords.tenantId, tenantId))
```

**After:**
```
.where(eq(seoKeywords.tenant_id, tenantId))
```

---

✅ **Line 292** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 312** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 320** (high confidence)

**Before:**
```
.where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenant_id, tenantId)))
```

---

✅ **Line 333** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 340** (high confidence)

**Before:**
```
.where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenant_id, tenantId)));
```

---

✅ **Line 369** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 380** (high confidence)

**Before:**
```
.where(and(eq(seoKeywords.tenantId, tenantId), inArray(seoKeywords.id, keywordIds)));
```

**After:**
```
.where(and(eq(seoKeywords.tenant_id, tenantId), inArray(seoKeywords.id, keywordIds)));
```

---

✅ **Line 419** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 461** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 471** (high confidence)

**Before:**
```
eq(seoCrawlResults.tenantId, tenantId),
```

**After:**
```
eq(seoCrawlResults.tenant_id, tenantId),
```

---

✅ **Line 489** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 525** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 533** (high confidence)

**Before:**
```
const conditions = [eq(seoCoreWebVitals.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(seoCoreWebVitals.tenant_id, tenantId)];
```

---

✅ **Line 557** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 590** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 598** (high confidence)

**Before:**
```
.where(eq(seoPageScores.tenantId, tenantId))
```

**After:**
```
.where(eq(seoPageScores.tenant_id, tenantId))
```

---

✅ **Line 614** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 652** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 659** (high confidence)

**Before:**
```
const conditions = [eq(seoImageAnalysis.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(seoImageAnalysis.tenant_id, tenantId)];
```

---

✅ **Line 683** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 721** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 729** (high confidence)

**Before:**
```
.where(and(eq(seoLinkAnalysis.tenantId, tenantId), eq(seoLinkAnalysis.isBroken, true)))
```

**After:**
```
.where(and(eq(seoLinkAnalysis.tenant_id, tenantId), eq(seoLinkAnalysis.isBroken, true)))
```

---

✅ **Line 745** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 780** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 815** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 855** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 890** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 926** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 957** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 965** (high confidence)

**Before:**
```
.where(eq(seoContentOptimization.tenantId, tenantId))
```

**After:**
```
.where(eq(seoContentOptimization.tenant_id, tenantId))
```

---

⚠️ **Line 966** (medium confidence)

**Before:**
```
.orderBy(desc(seoContentOptimization.createdAt))
```

**After:**
```
.orderBy(desc(seoContentOptimization.created_at))
```

---

✅ **Line 981** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1016** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1023** (high confidence)

**Before:**
```
const conditions = [eq(seoAlerts.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(seoAlerts.tenant_id, tenantId)];
```

---

⚠️ **Line 1032** (medium confidence)

**Before:**
```
.orderBy(desc(seoAlerts.createdAt))
```

**After:**
```
.orderBy(desc(seoAlerts.created_at))
```

---

✅ **Line 1045** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1058** (high confidence)

**Before:**
```
.where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenant_id, tenantId)))
```

---

✅ **Line 1071** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1087** (high confidence)

**Before:**
```
.where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenant_id, tenantId)))
```

---

✅ **Line 1102** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1110** (high confidence)

**Before:**
```
const conditions = [eq(seoMonitoringLog.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(seoMonitoringLog.tenant_id, tenantId)];
```

---

✅ **Line 1140** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1174** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1182** (high confidence)

**Before:**
```
.where(eq(seoCompetitorAnalysis.tenantId, tenantId))
```

**After:**
```
.where(eq(seoCompetitorAnalysis.tenant_id, tenantId))
```

---

✅ **Line 1215** (high confidence)

**Before:**
```
conditions.push(eq(seoKeywords.tenantId, tenantId));
```

**After:**
```
conditions.push(eq(seoKeywords.tenant_id, tenantId));
```

---

⚠️ **Line 1370** (medium confidence)

**Before:**
```
// blogPosts = posts.map(p => ({ slug: p.slug, updatedAt: p.updatedAt }));
```

**After:**
```
// blogPosts = posts.map(p => ({ slug: p.slug, updatedAt: p.updated_at }));
```

---

⚠️ **Line 1395** (medium confidence)

**Before:**
```
xml += `    <lastmod>${post.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
```

**After:**
```
xml += `    <lastmod>${post.updated_at.toISOString().split('T')[0]}</lastmod>\n`;
```

---

### `server\routes-security-compliance.ts`

✅ **Line 64** (high confidence)

**Before:**
```
const conditions = [eq(auditLogs.tenantId, req.tenantId!)];
```

**After:**
```
const conditions = [eq(auditLogs.tenant_id, req.tenant_id!)];
```

---

⚠️ **Line 73** (medium confidence)

**Before:**
```
conditions.push(eq(auditLogs.userId, userId as string));
```

**After:**
```
conditions.push(eq(auditLogs.user_id, userId as string));
```

---

✅ **Line 144** (high confidence)

**Before:**
```
.where(and(eq(auditLogs.tenantId, req.tenantId!), gte(auditLogs.timestamp, startDate)))
```

**After:**
```
.where(and(eq(auditLogs.tenant_id, req.tenant_id!), gte(auditLogs.timestamp, startDate)))
```

---

✅ **Line 176** (high confidence)

**Before:**
```
const conditions = [eq(dataAccessLogs.tenantId, req.tenantId!)];
```

**After:**
```
const conditions = [eq(dataAccessLogs.tenant_id, req.tenant_id!)];
```

---

⚠️ **Line 185** (medium confidence)

**Before:**
```
conditions.push(eq(dataAccessLogs.userId, userId as string));
```

**After:**
```
conditions.push(eq(dataAccessLogs.user_id, userId as string));
```

---

✅ **Line 240** (high confidence)

**Before:**
```
const conditions = [eq(gdprRequests.tenantId, req.tenantId!)];
```

**After:**
```
const conditions = [eq(gdprRequests.tenant_id, req.tenant_id!)];
```

---

⚠️ **Line 256** (medium confidence)

**Before:**
```
.orderBy(desc(gdprRequests.createdAt))
```

**After:**
```
.orderBy(desc(gdprRequests.created_at))
```

---

✅ **Line 290** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 319** (high confidence)

**Before:**
```
where: and(eq(gdprRequests.id, requestId), eq(gdprRequests.tenantId, req.tenantId!)),
```

**After:**
```
where: and(eq(gdprRequests.id, requestId), eq(gdprRequests.tenant_id, req.tenant_id!)),
```

---

✅ **Line 331** (high confidence)

**Before:**
```
const personalData = await processDataSubjectAccess(req.tenantId!, request.subjectId);
```

**After:**
```
const personalData = await processDataSubjectAccess(req.tenant_id!, request.subjectId);
```

---

✅ **Line 368** (high confidence)

**Before:**
```
eq(securitySessions.tenantId, req.tenantId!),
```

**After:**
```
eq(securitySessions.tenant_id, req.tenant_id!),
```

---

⚠️ **Line 373** (medium confidence)

**Before:**
```
conditions.push(eq(securitySessions.userId, userId as string));
```

**After:**
```
conditions.push(eq(securitySessions.user_id, userId as string));
```

---

✅ **Line 429** (high confidence)

**Before:**
```
eq(securitySessions.tenantId, req.tenantId!),
```

**After:**
```
eq(securitySessions.tenant_id, req.tenant_id!),
```

---

✅ **Line 450** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, req.tenantId!),
```

**After:**
```
where: eq(complianceSettings.tenant_id, req.tenant_id!),
```

---

✅ **Line 483** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 488** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, req.tenantId!),
```

**After:**
```
where: eq(complianceSettings.tenant_id, req.tenant_id!),
```

---

✅ **Line 495** (high confidence)

**Before:**
```
.where(eq(complianceSettings.tenantId, req.tenantId!));
```

**After:**
```
.where(eq(complianceSettings.tenant_id, req.tenant_id!));
```

---

✅ **Line 528** (high confidence)

**Before:**
```
.where(and(eq(auditLogs.tenantId, req.tenantId!), gte(auditLogs.timestamp, startDate)))
```

**After:**
```
.where(and(eq(auditLogs.tenant_id, req.tenant_id!), gte(auditLogs.timestamp, startDate)))
```

---

✅ **Line 540** (high confidence)

**Before:**
```
eq(dataAccessLogs.tenantId, req.tenantId!),
```

**After:**
```
eq(dataAccessLogs.tenant_id, req.tenant_id!),
```

---

✅ **Line 551** (high confidence)

**Before:**
```
and(eq(securitySessions.tenantId, req.tenantId!), eq(securitySessions.isActive, true)),
```

**After:**
```
and(eq(securitySessions.tenant_id, req.tenant_id!), eq(securitySessions.isActive, true)),
```

---

✅ **Line 561** (high confidence)

**Before:**
```
.where(eq(gdprRequests.tenantId, req.tenantId!))
```

**After:**
```
.where(eq(gdprRequests.tenant_id, req.tenant_id!))
```

---

✅ **Line 570** (high confidence)

**Before:**
```
eq(dataAccessLogs.tenantId, req.tenantId!),
```

**After:**
```
eq(dataAccessLogs.tenant_id, req.tenant_id!),
```

---

### `server\routes-salesforce-integration.ts`

✅ **Line 94** (high confidence)

**Before:**
```
(req as AuthenticatedRequest).user?.tenantId ||
```

**After:**
```
(req as AuthenticatedRequest).user?.tenant_id ||
```

---

✅ **Line 95** (high confidence)

**Before:**
```
(req as any).session?.user?.tenantId;
```

**After:**
```
(req as any).session?.user?.tenant_id;
```

---

✅ **Line 347** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, transformedRecord.tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, transformedRecord.tenant_id),
```

---

✅ **Line 360** (high confidence)

**Before:**
```
eq(enhancedContacts.tenantId, transformedRecord.tenantId),
```

**After:**
```
eq(enhancedContacts.tenant_id, transformedRecord.tenant_id),
```

---

✅ **Line 373** (high confidence)

**Before:**
```
eq(opportunities.tenantId, transformedRecord.tenantId),
```

**After:**
```
eq(opportunities.tenant_id, transformedRecord.tenant_id),
```

---

✅ **Line 386** (high confidence)

**Before:**
```
eq(enhancedProducts.tenantId, transformedRecord.tenantId),
```

**After:**
```
eq(enhancedProducts.tenant_id, transformedRecord.tenant_id),
```

---

### `server\routes-sales-pipeline.ts`

✅ **Line 49** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 140** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 220** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 271** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 384** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 482** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-sales-handoff.ts`

✅ **Line 28** (high confidence)

**Before:**
```
let conditions = [eq(salesHandoffChecklists.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(salesHandoffChecklists.tenant_id, tenantId)];
```

---

✅ **Line 61** (high confidence)

**Before:**
```
eq(salesHandoffChecklists.tenantId, tenantId),
```

**After:**
```
eq(salesHandoffChecklists.tenant_id, tenantId),
```

---

✅ **Line 148** (high confidence)

**Before:**
```
and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenantId, tenantId)),
```

**After:**
```
and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenant_id, tenantId)),
```

---

✅ **Line 171** (high confidence)

**Before:**
```
where: and(eq(handoffTasks.handoffId, id), eq(handoffTasks.tenantId, tenantId)),
```

**After:**
```
where: and(eq(handoffTasks.handoffId, id), eq(handoffTasks.tenant_id, tenantId)),
```

---

✅ **Line 195** (high confidence)

**Before:**
```
and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenantId, tenantId)),
```

**After:**
```
and(eq(salesHandoffChecklists.id, id), eq(salesHandoffChecklists.tenant_id, tenantId)),
```

---

✅ **Line 218** (high confidence)

**Before:**
```
let conditions = [eq(handoffTaskTemplates.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(handoffTaskTemplates.tenant_id, tenantId)];
```

---

✅ **Line 267** (high confidence)

**Before:**
```
.where(and(eq(handoffTaskTemplates.id, id), eq(handoffTaskTemplates.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(handoffTaskTemplates.id, id), eq(handoffTaskTemplates.tenant_id, tenantId)))
```

---

✅ **Line 289** (high confidence)

**Before:**
```
let conditions = [eq(handoffTasks.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(handoffTasks.tenant_id, tenantId)];
```

---

✅ **Line 347** (high confidence)

**Before:**
```
.where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenant_id, tenantId)))
```

---

✅ **Line 395** (high confidence)

**Before:**
```
.where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(handoffTasks.id, id), eq(handoffTasks.tenant_id, tenantId)))
```

---

✅ **Line 439** (high confidence)

**Before:**
```
let conditions = [eq(implementationProjects.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(implementationProjects.tenant_id, tenantId)];
```

---

✅ **Line 472** (high confidence)

**Before:**
```
eq(implementationProjects.tenantId, tenantId),
```

**After:**
```
eq(implementationProjects.tenant_id, tenantId),
```

---

✅ **Line 519** (high confidence)

**Before:**
```
and(eq(implementationProjects.id, id), eq(implementationProjects.tenantId, tenantId)),
```

**After:**
```
and(eq(implementationProjects.id, id), eq(implementationProjects.tenant_id, tenantId)),
```

---

✅ **Line 545** (high confidence)

**Before:**
```
eq(implementationProjects.tenantId, tenantId),
```

**After:**
```
eq(implementationProjects.tenant_id, tenantId),
```

---

### `server\routes-sales-forecasting.ts`

✅ **Line 34** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 38** (high confidence)

**Before:**
```
.where(eq(salesForecasts.tenantId, tenantId))
```

**After:**
```
.where(eq(salesForecasts.tenant_id, tenantId))
```

---

⚠️ **Line 39** (medium confidence)

**Before:**
```
.orderBy(desc(salesForecasts.createdAt));
```

**After:**
```
.orderBy(desc(salesForecasts.created_at));
```

---

✅ **Line 52** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 59** (high confidence)

**Before:**
```
and(eq(forecastPipelineItems.tenantId, tenantId), eq(forecastPipelineItems.forecastId, id)),
```

**After:**
```
and(eq(forecastPipelineItems.tenant_id, tenantId), eq(forecastPipelineItems.forecastId, id)),
```

---

✅ **Line 77** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 87** (high confidence)

**Before:**
```
.where(and(eq(salesForecasts.tenantId, tenantId), eq(salesForecasts.id, forecastId)))
```

**After:**
```
.where(and(eq(salesForecasts.tenant_id, tenantId), eq(salesForecasts.id, forecastId)))
```

---

✅ **Line 286** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 292** (high confidence)

**Before:**
```
.where(eq(forecastMetrics.tenantId, tenantId))
```

**After:**
```
.where(eq(forecastMetrics.tenant_id, tenantId))
```

---

✅ **Line 305** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 377** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 383** (high confidence)

**Before:**
```
.where(eq(forecastRules.tenantId, tenantId))
```

**After:**
```
.where(eq(forecastRules.tenant_id, tenantId))
```

---

✅ **Line 396** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 409** (medium confidence)

**Before:**
```
month: sql<string>`DATE_TRUNC('month', ${businessRecords.updatedAt})::text`,
```

**After:**
```
month: sql<string>`DATE_TRUNC('month', ${businessRecords.updated_at})::text`,
```

---

✅ **Line 416** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 418** (medium confidence)

**Before:**
```
gte(businessRecords.updatedAt, startDate),
```

**After:**
```
gte(businessRecords.updated_at, startDate),
```

---

⚠️ **Line 421** (medium confidence)

**Before:**
```
.groupBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt})`)
```

**After:**
```
.groupBy(sql`DATE_TRUNC('month', ${businessRecords.updated_at})`)
```

---

⚠️ **Line 422** (medium confidence)

**Before:**
```
.orderBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt}) DESC`),
```

**After:**
```
.orderBy(sql`DATE_TRUNC('month', ${businessRecords.updated_at}) DESC`),
```

---

✅ **Line 429** (high confidence)

**Before:**
```
and(eq(forecastMetrics.tenantId, tenantId), gte(forecastMetrics.snapshotDate, startDate)),
```

**After:**
```
and(eq(forecastMetrics.tenant_id, tenantId), gte(forecastMetrics.snapshotDate, startDate)),
```

---

### `server\routes-root-admin.ts`

✅ **Line 23** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 27** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

⚠️ **Line 39** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 151** (high confidence)

**Before:**
```
.leftJoin(users, eq(users.tenantId, tenants.id))
```

**After:**
```
.leftJoin(users, eq(users.tenant_id, tenants.id))
```

---

✅ **Line 174** (high confidence)

**Before:**
```
tenantId: activityReports.tenantId,
```

**After:**
```
tenantId: activityReports.tenant_id,
```

---

⚠️ **Line 175** (medium confidence)

**Before:**
```
userId: activityReports.userId,
```

**After:**
```
userId: activityReports.user_id,
```

---

⚠️ **Line 178** (medium confidence)

**Before:**
```
timestamp: activityReports.createdAt,
```

**After:**
```
timestamp: activityReports.created_at,
```

---

⚠️ **Line 183** (medium confidence)

**Before:**
```
.orderBy(desc(activityReports.createdAt))
```

**After:**
```
.orderBy(desc(activityReports.created_at))
```

---

✅ **Line 189** (high confidence)

**Before:**
```
const tenant = alert.tenantId
```

**After:**
```
const tenant = alert.tenant_id
```

---

✅ **Line 193** (high confidence)

**Before:**
```
.where(eq(tenants.id, alert.tenantId))
```

**After:**
```
.where(eq(tenants.id, alert.tenant_id))
```

---

⚠️ **Line 197** (medium confidence)

**Before:**
```
const user = alert.userId
```

**After:**
```
const user = alert.user_id
```

---

⚠️ **Line 201** (medium confidence)

**Before:**
```
.where(eq(users.id, alert.userId))
```

**After:**
```
.where(eq(users.id, alert.user_id))
```

---

✅ **Line 308** (high confidence)

**Before:**
```
tenantId: users.tenantId,
```

**After:**
```
tenantId: users.tenant_id,
```

---

⚠️ **Line 311** (medium confidence)

**Before:**
```
createdAt: users.createdAt,
```

**After:**
```
createdAt: users.created_at,
```

---

✅ **Line 315** (high confidence)

**Before:**
```
.leftJoin(tenants, eq(users.tenantId, tenants.id));
```

**After:**
```
.leftJoin(tenants, eq(users.tenant_id, tenants.id));
```

---

✅ **Line 348** (high confidence)

**Before:**
```
const tenant = user.tenantId
```

**After:**
```
const tenant = user.tenant_id
```

---

✅ **Line 352** (high confidence)

**Before:**
```
.where(eq(tenants.id, user.tenantId))
```

**After:**
```
.where(eq(tenants.id, user.tenant_id))
```

---

⚠️ **Line 385** (medium confidence)

**Before:**
```
createdAt: roles.createdAt,
```

**After:**
```
createdAt: roles.created_at,
```

---

⚠️ **Line 406** (medium confidence)

**Before:**
```
userId: auditLogs.userId,
```

**After:**
```
userId: auditLogs.user_id,
```

---

⚠️ **Line 421** (medium confidence)

**Before:**
```
const user = log.userId
```

**After:**
```
const user = log.user_id
```

---

⚠️ **Line 425** (medium confidence)

**Before:**
```
.where(eq(users.id, log.userId))
```

**After:**
```
.where(eq(users.id, log.user_id))
```

---

⚠️ **Line 545** (medium confidence)

**Before:**
```
conditions.push(eq(rbacAuditLog.userId, userId as string));
```

**After:**
```
conditions.push(eq(rbacAuditLog.user_id, userId as string));
```

---

⚠️ **Line 550** (medium confidence)

**Before:**
```
conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
```

**After:**
```
conditions.push(gte(rbacAuditLog.created_at, new Date(startDate as string)));
```

---

⚠️ **Line 553** (medium confidence)

**Before:**
```
conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
```

**After:**
```
conditions.push(lte(rbacAuditLog.created_at, new Date(endDate as string)));
```

---

⚠️ **Line 569** (medium confidence)

**Before:**
```
.orderBy(desc(rbacAuditLog.createdAt))
```

**After:**
```
.orderBy(desc(rbacAuditLog.created_at))
```

---

⚠️ **Line 582** (medium confidence)

**Before:**
```
const user = log.userId
```

**After:**
```
const user = log.user_id
```

---

⚠️ **Line 586** (medium confidence)

**Before:**
```
.where(eq(users.id, log.userId))
```

**After:**
```
.where(eq(users.id, log.user_id))
```

---

⚠️ **Line 621** (medium confidence)

**Before:**
```
conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
```

**After:**
```
conditions.push(gte(rbacAuditLog.created_at, new Date(startDate as string)));
```

---

⚠️ **Line 624** (medium confidence)

**Before:**
```
conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
```

**After:**
```
conditions.push(lte(rbacAuditLog.created_at, new Date(endDate as string)));
```

---

⚠️ **Line 662** (medium confidence)

**Before:**
```
and(eq(rbacAuditLog.eventType, 'ADMIN_BYPASS'), gte(rbacAuditLog.createdAt, yesterday)),
```

**After:**
```
and(eq(rbacAuditLog.eventType, 'ADMIN_BYPASS'), gte(rbacAuditLog.created_at, yesterday)),
```

---

⚠️ **Line 694** (medium confidence)

**Before:**
```
conditions.push(eq(rbacAuditLog.userId, userId as string));
```

**After:**
```
conditions.push(eq(rbacAuditLog.user_id, userId as string));
```

---

⚠️ **Line 697** (medium confidence)

**Before:**
```
conditions.push(gte(rbacAuditLog.createdAt, new Date(startDate as string)));
```

**After:**
```
conditions.push(gte(rbacAuditLog.created_at, new Date(startDate as string)));
```

---

⚠️ **Line 700** (medium confidence)

**Before:**
```
conditions.push(lte(rbacAuditLog.createdAt, new Date(endDate as string)));
```

**After:**
```
conditions.push(lte(rbacAuditLog.created_at, new Date(endDate as string)));
```

---

⚠️ **Line 709** (medium confidence)

**Before:**
```
.orderBy(desc(rbacAuditLog.createdAt))
```

**After:**
```
.orderBy(desc(rbacAuditLog.created_at))
```

---

⚠️ **Line 715** (medium confidence)

**Before:**
```
const user = log.userId
```

**After:**
```
const user = log.user_id
```

---

⚠️ **Line 719** (medium confidence)

**Before:**
```
.where(eq(users.id, log.userId))
```

**After:**
```
.where(eq(users.id, log.user_id))
```

---

### `server\routes-reports.ts`

✅ **Line 33** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 34** (medium confidence)

**Before:**
```
gte(serviceTickets.createdAt, fromDate),
```

**After:**
```
gte(serviceTickets.created_at, fromDate),
```

---

⚠️ **Line 35** (medium confidence)

**Before:**
```
lte(serviceTickets.createdAt, toDate),
```

**After:**
```
lte(serviceTickets.created_at, toDate),
```

---

⚠️ **Line 44** (medium confidence)

**Before:**
```
return (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60) <= slaMin;
```

**After:**
```
return (t.completedAt.getTime() - t.created_at.getTime()) / (1000 * 60) <= slaMin;
```

---

⚠️ **Line 60** (medium confidence)

**Before:**
```
return (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60) <= slaMin;
```

**After:**
```
return (t.completedAt.getTime() - t.created_at.getTime()) / (1000 * 60) <= slaMin;
```

---

✅ **Line 89** (high confidence)

**Before:**
```
where: eq(deals.tenantId, tenantId),
```

**After:**
```
where: eq(deals.tenant_id, tenantId),
```

---

✅ **Line 143** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 181** (high confidence)

**Before:**
```
where: and(eq(customers.tenantId, tenantId), eq(customers.recordType, 'customer')),
```

**After:**
```
where: and(eq(customers.tenant_id, tenantId), eq(customers.recordType, 'customer')),
```

---

✅ **Line 191** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 192** (medium confidence)

**Before:**
```
gte(serviceTickets.createdAt, ninetyDaysAgo),
```

**After:**
```
gte(serviceTickets.created_at, ninetyDaysAgo),
```

---

✅ **Line 198** (high confidence)

**Before:**
```
where: and(eq(invoices.tenantId, tenantId), gte(invoices.invoiceDate, ninetyDaysAgo)),
```

**After:**
```
where: and(eq(invoices.tenant_id, tenantId), gte(invoices.invoiceDate, ninetyDaysAgo)),
```

---

✅ **Line 203** (high confidence)

**Before:**
```
where: and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')),
```

**After:**
```
where: and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active')),
```

---

⚠️ **Line 270** (medium confidence)

**Before:**
```
const lastActivity = c.lastActivityDate || c.updatedAt || c.createdAt;
```

**After:**
```
const lastActivity = c.lastActivityDate || c.updatedAt || c.created_at;
```

---

⚠️ **Line 270** (medium confidence)

**Before:**
```
const lastActivity = c.lastActivityDate || c.updatedAt || c.createdAt;
```

**After:**
```
const lastActivity = c.lastActivityDate || c.updated_at || c.createdAt;
```

---

⚠️ **Line 280** (medium confidence)

**Before:**
```
const customerSince = c.customerSince || c.createdAt;
```

**After:**
```
const customerSince = c.customerSince || c.created_at;
```

---

✅ **Line 400** (high confidence)

**Before:**
```
where: eq(technicians.tenantId, tenantId),
```

**After:**
```
where: eq(technicians.tenant_id, tenantId),
```

---

✅ **Line 406** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 407** (medium confidence)

**Before:**
```
gte(serviceTickets.createdAt, thirtyDaysAgo),
```

**After:**
```
gte(serviceTickets.created_at, thirtyDaysAgo),
```

---

⚠️ **Line 481** (medium confidence)

**Before:**
```
(new Date(tk.completedAt).getTime() - new Date(tk.createdAt).getTime()) / (1000 * 60);
```

**After:**
```
(new Date(tk.completedAt).getTime() - new Date(tk.created_at).getTime()) / (1000 * 60);
```

---

⚠️ **Line 495** (medium confidence)

**Before:**
```
other.createdAt > tk.createdAt &&
```

**After:**
```
other.created_at > tk.created_at &&
```

---

⚠️ **Line 496** (medium confidence)

**Before:**
```
new Date(other.createdAt).getTime() -
```

**After:**
```
new Date(other.created_at).getTime() -
```

---

⚠️ **Line 497** (medium confidence)

**Before:**
```
new Date(tk.completedAt || tk.createdAt).getTime() <
```

**After:**
```
new Date(tk.completedAt || tk.created_at).getTime() <
```

---

### `server\routes-reporting.ts`

✅ **Line 53** (high confidence)

**Before:**
```
and(eq(reportDefinitions.tenantId, user.tenantId), eq(reportDefinitions.isActive, true)),
```

**After:**
```
and(eq(reportDefinitions.tenant_id, user.tenant_id), eq(reportDefinitions.isActive, true)),
```

---

✅ **Line 130** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, user.tenant_id),
```

---

✅ **Line 167** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 185** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 210** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 260** (high confidence)

**Before:**
```
.where(and(eq(kpiDefinitions.tenantId, user.tenantId), eq(kpiDefinitions.isActive, true)));
```

**After:**
```
.where(and(eq(kpiDefinitions.tenant_id, user.tenant_id), eq(kpiDefinitions.isActive, true)));
```

---

✅ **Line 479** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, user.tenant_id),
```

---

✅ **Line 509** (high confidence)

**Before:**
```
const exportResult = await exportService.exportReport(user.tenantId, user.id, {
```

**After:**
```
const exportResult = await exportService.exportReport(user.tenant_id, user.id, {
```

---

✅ **Line 519** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 608** (high confidence)

**Before:**
```
and(eq(reportDefinitions.tenantId, user.tenantId), eq(reportDefinitions.isActive, true)),
```

**After:**
```
and(eq(reportDefinitions.tenant_id, user.tenant_id), eq(reportDefinitions.isActive, true)),
```

---

✅ **Line 623** (high confidence)

**Before:**
```
.where(and(eq(kpiDefinitions.tenantId, user.tenantId), eq(kpiDefinitions.isActive, true)));
```

**After:**
```
.where(and(eq(kpiDefinitions.tenant_id, user.tenant_id), eq(kpiDefinitions.isActive, true)));
```

---

✅ **Line 651** (high confidence)

**Before:**
```
eq(userReportActivity.tenantId, user.tenantId),
```

**After:**
```
eq(userReportActivity.tenant_id, user.tenant_id),
```

---

⚠️ **Line 652** (medium confidence)

**Before:**
```
eq(userReportActivity.userId, user.id),
```

**After:**
```
eq(userReportActivity.user_id, user.id),
```

---

⚠️ **Line 655** (medium confidence)

**Before:**
```
.orderBy(desc(userReportActivity.createdAt))
```

**After:**
```
.orderBy(desc(userReportActivity.created_at))
```

---

### `server\routes-reporting-architecture.ts`

✅ **Line 47** (high confidence)

**Before:**
```
.where(and(eq(reportDefinitions.tenantId, tenantId), eq(reportDefinitions.isActive, true)));
```

**After:**
```
.where(and(eq(reportDefinitions.tenant_id, tenantId), eq(reportDefinitions.isActive, true)));
```

---

✅ **Line 52** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 92** (high confidence)

**Before:**
```
.where(and(eq(reportDefinitions.id, id), eq(reportDefinitions.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(reportDefinitions.id, id), eq(reportDefinitions.tenant_id, tenantId)))
```

---

✅ **Line 130** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 202** (high confidence)

**Before:**
```
eq(kpiDefinitions.tenantId, tenantId),
```

**After:**
```
eq(kpiDefinitions.tenant_id, tenantId),
```

---

✅ **Line 253** (high confidence)

**Before:**
```
.where(and(eq(kpiDefinitions.id, id), eq(kpiDefinitions.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(kpiDefinitions.id, id), eq(kpiDefinitions.tenant_id, tenantId)))
```

---

✅ **Line 264** (high confidence)

**Before:**
```
.where(and(eq(kpiValues.kpiId, id), eq(kpiValues.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(kpiValues.kpiId, id), eq(kpiValues.tenant_id, tenantId)))
```

---

✅ **Line 305** (high confidence)

**Before:**
```
.where(and(eq(reportDefinitions.tenantId, tenantId), eq(reportDefinitions.isActive, true)))
```

**After:**
```
.where(and(eq(reportDefinitions.tenant_id, tenantId), eq(reportDefinitions.isActive, true)))
```

---

✅ **Line 346** (high confidence)

**Before:**
```
.where(and(eq(kpiDefinitions.tenantId, tenantId), eq(kpiDefinitions.isActive, true)))
```

**After:**
```
.where(and(eq(kpiDefinitions.tenant_id, tenantId), eq(kpiDefinitions.isActive, true)))
```

---

### `server\routes-renewal-management.ts`

✅ **Line 28** (high confidence)

**Before:**
```
let conditions = [eq(contractRenewals.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(contractRenewals.tenant_id, tenantId)];
```

---

✅ **Line 66** (high confidence)

**Before:**
```
where: and(eq(contractRenewals.id, id), eq(contractRenewals.tenantId, tenantId)),
```

**After:**
```
where: and(eq(contractRenewals.id, id), eq(contractRenewals.tenant_id, tenantId)),
```

---

✅ **Line 123** (high confidence)

**Before:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenant_id, tenantId)))
```

---

✅ **Line 155** (high confidence)

**Before:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenant_id, tenantId)))
```

---

✅ **Line 185** (high confidence)

**Before:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contractRenewals.id, id), eq(contractRenewals.tenant_id, tenantId)))
```

---

✅ **Line 213** (high confidence)

**Before:**
```
eq(contractRenewals.tenantId, tenantId),
```

**After:**
```
eq(contractRenewals.tenant_id, tenantId),
```

---

✅ **Line 238** (high confidence)

**Before:**
```
where: and(eq(contractRenewals.id, id), eq(contractRenewals.tenantId, tenantId)),
```

**After:**
```
where: and(eq(contractRenewals.id, id), eq(contractRenewals.tenant_id, tenantId)),
```

---

✅ **Line 280** (high confidence)

**Before:**
```
eq(renewalActivities.tenantId, tenantId),
```

**After:**
```
eq(renewalActivities.tenant_id, tenantId),
```

---

✅ **Line 334** (high confidence)

**Before:**
```
where: eq(renewalPlaybooks.tenantId, tenantId),
```

**After:**
```
where: eq(renewalPlaybooks.tenant_id, tenantId),
```

---

✅ **Line 376** (high confidence)

**Before:**
```
.where(and(eq(renewalPlaybooks.id, id), eq(renewalPlaybooks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(renewalPlaybooks.id, id), eq(renewalPlaybooks.tenant_id, tenantId)))
```

---

✅ **Line 397** (high confidence)

**Before:**
```
where: and(eq(contractRenewals.id, renewalId), eq(contractRenewals.tenantId, tenantId)),
```

**After:**
```
where: and(eq(contractRenewals.id, renewalId), eq(contractRenewals.tenant_id, tenantId)),
```

---

✅ **Line 406** (high confidence)

**Before:**
```
where: and(eq(renewalPlaybooks.tenantId, tenantId), eq(renewalPlaybooks.isActive, true)),
```

**After:**
```
where: and(eq(renewalPlaybooks.tenant_id, tenantId), eq(renewalPlaybooks.isActive, true)),
```

---

✅ **Line 461** (high confidence)

**Before:**
```
let conditions = [eq(expansionOpportunities.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(expansionOpportunities.tenant_id, tenantId)];
```

---

✅ **Line 520** (high confidence)

**Before:**
```
and(eq(expansionOpportunities.id, id), eq(expansionOpportunities.tenantId, tenantId)),
```

**After:**
```
and(eq(expansionOpportunities.id, id), eq(expansionOpportunities.tenant_id, tenantId)),
```

---

✅ **Line 552** (high confidence)

**Before:**
```
and(eq(expansionOpportunities.id, id), eq(expansionOpportunities.tenantId, tenantId)),
```

**After:**
```
and(eq(expansionOpportunities.id, id), eq(expansionOpportunities.tenant_id, tenantId)),
```

---

### `server\routes-remote-monitoring.ts`

✅ **Line 14** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 23** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId));
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId));
```

---

✅ **Line 220** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 335** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

✅ **Line 426** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 435** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId));
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId));
```

---

✅ **Line 552** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

✅ **Line 605** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

✅ **Line 687** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 720** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-quickbooks-integration.ts`

✅ **Line 29** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 183** (high confidence)

**Before:**
```
transformed.tenantId = (req.user as any)?.tenantId;
```

**After:**
```
transformed.tenant_id = (req.user as any)?.tenant_id;
```

---

✅ **Line 243** (high confidence)

**Before:**
```
transformed.tenantId = (req.user as any)?.tenantId;
```

**After:**
```
transformed.tenant_id = (req.user as any)?.tenant_id;
```

---

### `server\routes-purchase-orders.ts`

✅ **Line 30** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || (req as any).user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || (req as any).user?.claims?.tenant_id;
```

---

✅ **Line 46** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 71** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 117** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 139** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 162** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 198** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 216** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 244** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 266** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 289** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 305** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 327** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 353** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 375** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 398** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

✅ **Line 431** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.user?.claims?.tenant_id;
```

---

### `server\routes-proposals.ts`

✅ **Line 62** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 67** (high confidence)

**Before:**
```
req.user.tenantId ||
```

**After:**
```
req.user.tenant_id ||
```

---

✅ **Line 103** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 129** (high confidence)

**Before:**
```
.where(and(eq(proposalTemplates.id, id), eq(proposalTemplates.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposalTemplates.id, id), eq(proposalTemplates.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 151** (high confidence)

**Before:**
```
.where(eq(equipmentPackages.tenantId, req.user.tenantId))
```

**After:**
```
.where(eq(equipmentPackages.tenant_id, req.user.tenant_id))
```

---

✅ **Line 166** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 205** (medium confidence)

**Before:**
```
createdAt: proposals.createdAt,
```

**After:**
```
createdAt: proposals.created_at,
```

---

✅ **Line 213** (high confidence)

**Before:**
```
const conditions: any[] = [eq(proposals.tenantId, req.user.tenantId)];
```

**After:**
```
const conditions: any[] = [eq(proposals.tenant_id, req.user.tenant_id)];
```

---

⚠️ **Line 227** (medium confidence)

**Before:**
```
conditions.push(sql`${proposals.createdAt} < NOW() - INTERVAL '${n} days'`);
```

**After:**
```
conditions.push(sql`${proposals.created_at} < NOW() - INTERVAL '${n} days'`);
```

---

⚠️ **Line 233** (medium confidence)

**Before:**
```
const result = await query.orderBy(desc(proposals.createdAt));
```

**After:**
```
const result = await query.orderBy(desc(proposals.created_at));
```

---

✅ **Line 249** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 289** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 305** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 333** (high confidence)

**Before:**
```
const proposalNumber = await generateProposalNumber(req.user.tenantId);
```

**After:**
```
const proposalNumber = await generateProposalNumber(req.user.tenant_id);
```

---

✅ **Line 338** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 358** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 418** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 433** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 440** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 463** (medium confidence)

**Before:**
```
delete restData.updatedAt;
```

**After:**
```
delete restData.updated_at;
```

---

✅ **Line 484** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 501** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 508** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 528** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 537** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 581** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenantId, req.user.tenantId)))
```

**After:**
```
.where(and(eq(proposals.id, id), eq(proposals.tenant_id, req.user.tenant_id)))
```

---

✅ **Line 591** (high confidence)

**Before:**
```
await upsertDealForProposal(proposal, req.user.id, req.user.tenantId);
```

**After:**
```
await upsertDealForProposal(proposal, req.user.id, req.user.tenant_id);
```

---

✅ **Line 594** (high confidence)

**Before:**
```
const dealId = await upsertDealForProposal(proposal, req.user.id, req.user.tenantId, {
```

**After:**
```
const dealId = await upsertDealForProposal(proposal, req.user.id, req.user.tenant_id, {
```

---

✅ **Line 597** (high confidence)

**Before:**
```
await createContractFromProposal(proposal, req.user.tenantId, req.user.id);
```

**After:**
```
await createContractFromProposal(proposal, req.user.tenant_id, req.user.id);
```

---

✅ **Line 639** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 645** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 653** (high confidence)

**Before:**
```
await recalculateProposalTotals(proposalId, req.user.tenantId);
```

**After:**
```
await recalculateProposalTotals(proposalId, req.user.tenant_id);
```

---

✅ **Line 675** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 685** (high confidence)

**Before:**
```
await recalculateProposalTotals(proposalId, req.user.tenantId);
```

**After:**
```
await recalculateProposalTotals(proposalId, req.user.tenant_id);
```

---

✅ **Line 705** (high confidence)

**Before:**
```
eq(proposalLineItems.tenantId, req.user.tenantId),
```

**After:**
```
eq(proposalLineItems.tenant_id, req.user.tenant_id),
```

---

✅ **Line 714** (high confidence)

**Before:**
```
await recalculateProposalTotals(proposalId, req.user.tenantId);
```

**After:**
```
await recalculateProposalTotals(proposalId, req.user.tenant_id);
```

---

✅ **Line 732** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 794** (high confidence)

**Before:**
```
and(eq(proposals.tenantId, tenantId), sql`${proposals.proposalNumber} LIKE ${prefix + '%'}`),
```

**After:**
```
and(eq(proposals.tenant_id, tenantId), sql`${proposals.proposalNumber} LIKE ${prefix + '%'}`),
```

---

✅ **Line 813** (high confidence)

**Before:**
```
and(eq(proposalLineItems.proposalId, proposalId), eq(proposalLineItems.tenantId, tenantId)),
```

**After:**
```
and(eq(proposalLineItems.proposalId, proposalId), eq(proposalLineItems.tenant_id, tenantId)),
```

---

✅ **Line 822** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenant_id, tenantId)));
```

---

✅ **Line 846** (high confidence)

**Before:**
```
.where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.name, stageName)))
```

**After:**
```
.where(and(eq(dealStages.tenant_id, tenantId), eq(dealStages.name, stageName)))
```

---

✅ **Line 855** (high confidence)

**Before:**
```
.where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.isWonStage, true)))
```

**After:**
```
.where(and(eq(dealStages.tenant_id, tenantId), eq(dealStages.isWonStage, true)))
```

---

✅ **Line 865** (high confidence)

**Before:**
```
.where(eq(dealStages.tenantId, tenantId))
```

**After:**
```
.where(eq(dealStages.tenant_id, tenantId))
```

---

✅ **Line 881** (high confidence)

**Before:**
```
.where(eq(dealStages.tenantId, tenantId))
```

**After:**
```
.where(eq(dealStages.tenant_id, tenantId))
```

---

✅ **Line 908** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, tenantId), eq(deals.title, title)))
```

**After:**
```
.where(and(eq(deals.tenant_id, tenantId), eq(deals.title, title)))
```

---

✅ **Line 934** (high confidence)

**Before:**
```
.where(and(eq(deals.id, existing[0].id), eq(deals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(deals.id, existing[0].id), eq(deals.tenant_id, tenantId)));
```

---

✅ **Line 969** (high confidence)

**Before:**
```
and(eq(contracts.tenantId, tenantId), sql`${contracts.contractNumber} LIKE ${prefix + '%'}`),
```

**After:**
```
and(eq(contracts.tenant_id, tenantId), sql`${contracts.contractNumber} LIKE ${prefix + '%'}`),
```

---

✅ **Line 1026** (high confidence)

**Before:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(proposals.id, proposalId), eq(proposals.tenant_id, tenantId)));
```

---

✅ **Line 1038** (high confidence)

**Before:**
```
and(eq(proposalLineItems.proposalId, proposalId), eq(proposalLineItems.tenantId, tenantId)),
```

**After:**
```
and(eq(proposalLineItems.proposalId, proposalId), eq(proposalLineItems.tenant_id, tenantId)),
```

---

✅ **Line 1056** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 1071** (high confidence)

**Before:**
```
and(eq(companyContacts.id, quote.contactId), eq(companyContacts.tenantId, tenantId)),
```

**After:**
```
and(eq(companyContacts.id, quote.contactId), eq(companyContacts.tenant_id, tenantId)),
```

---

⚠️ **Line 1282** (medium confidence)

**Before:**
```
<p><strong>Created:</strong> ${new Date(quote.createdAt).toLocaleDateString()}</p>
```

**After:**
```
<p><strong>Created:</strong> ${new Date(quote.created_at).toLocaleDateString()}</p>
```

---

✅ **Line 1352** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 1488** (medium confidence)

**Before:**
```
<p><strong>Created:</strong> ${new Date(quote.createdAt).toLocaleDateString()}</p>
```

**After:**
```
<p><strong>Created:</strong> ${new Date(quote.created_at).toLocaleDateString()}</p>
```

---

✅ **Line 1560** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 1728** (medium confidence)

**Before:**
```
<p><strong>Created:</strong> ${new Date(quote.createdAt).toLocaleDateString()}</p>
```

**After:**
```
<p><strong>Created:</strong> ${new Date(quote.created_at).toLocaleDateString()}</p>
```

---

### `server\routes-product-pricing.ts`

✅ **Line 59** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 78** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 122** (high confidence)

**Before:**
```
.where(eq(companyPricingSettings.tenantId, tenantId))
```

**After:**
```
.where(eq(companyPricingSettings.tenant_id, tenantId))
```

---

✅ **Line 138** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 162** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 202** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 226** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
```

---

⚠️ **Line 282** (medium confidence)

**Before:**
```
updateData.updatedAt = new Date();
```

**After:**
```
updateData.updated_at = new Date();
```

---

✅ **Line 288** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 312** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 339** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 361** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, productId), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 388** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 414** (high confidence)

**Before:**
```
.where(eq(enhancedQuotePricing.tenantId, tenantId))
```

**After:**
```
.where(eq(enhancedQuotePricing.tenant_id, tenantId))
```

---

⚠️ **Line 423** (medium confidence)

**Before:**
```
query = query.where(sql`${enhancedQuotePricing.createdAt} >= ${startDate}`);
```

**After:**
```
query = query.where(sql`${enhancedQuotePricing.created_at} >= ${startDate}`);
```

---

⚠️ **Line 427** (medium confidence)

**Before:**
```
query = query.where(sql`${enhancedQuotePricing.createdAt} <= ${endDate}`);
```

**After:**
```
query = query.where(sql`${enhancedQuotePricing.created_at} <= ${endDate}`);
```

---

⚠️ **Line 434** (medium confidence)

**Before:**
```
const quotes = await query.orderBy(desc(enhancedQuotePricing.createdAt)).limit(100);
```

**After:**
```
const quotes = await query.orderBy(desc(enhancedQuotePricing.created_at)).limit(100);
```

---

⚠️ **Line 458** (medium confidence)

**Before:**
```
quoteDate: quote.createdAt,
```

**After:**
```
quoteDate: quote.created_at,
```

---

✅ **Line 510** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 532** (high confidence)

**Before:**
```
.where(eq(enhancedQuotePricing.tenantId, tenantId))
```

**After:**
```
.where(eq(enhancedQuotePricing.tenant_id, tenantId))
```

---

⚠️ **Line 533** (medium confidence)

**Before:**
```
.orderBy(desc(enhancedQuotePricing.createdAt))
```

**After:**
```
.orderBy(desc(enhancedQuotePricing.created_at))
```

---

⚠️ **Line 553** (medium confidence)

**Before:**
```
quote.createdAt?.toISOString().split('T')[0] || '',
```

**After:**
```
quote.created_at?.toISOString().split('T')[0] || '',
```

---

✅ **Line 586** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 641** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 674** (high confidence)

**Before:**
```
eq(priceChangeApprovals.tenantId, tenantId),
```

**After:**
```
eq(priceChangeApprovals.tenant_id, tenantId),
```

---

✅ **Line 696** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 720** (high confidence)

**Before:**
```
eq(priceChangeApprovals.tenantId, tenantId),
```

**After:**
```
eq(priceChangeApprovals.tenant_id, tenantId),
```

---

### `server\routes-product-models.ts`

✅ **Line 31** (high confidence)

**Before:**
```
const tenantId = req.user!.tenantId;
```

**After:**
```
const tenantId = req.user!.tenant_id;
```

---

⚠️ **Line 51** (medium confidence)

**Before:**
```
createdAt: productModels.createdAt,
```

**After:**
```
createdAt: productModels.created_at,
```

---

⚠️ **Line 52** (medium confidence)

**Before:**
```
updatedAt: productModels.updatedAt,
```

**After:**
```
updatedAt: productModels.updated_at,
```

---

✅ **Line 55** (high confidence)

**Before:**
```
.where(eq(productModels.tenantId, tenantId));
```

**After:**
```
.where(eq(productModels.tenant_id, tenantId));
```

---

✅ **Line 92** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 98** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenant_id, tenantId)));
```

---

✅ **Line 119** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 144** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 153** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 175** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 180** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, modelId), eq(productModels.tenant_id, tenantId)))
```

---

✅ **Line 202** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 208** (high confidence)

**Before:**
```
and(eq(productModels.tenantId, tenantId), sql`${productModels.category} IS NOT NULL`),
```

**After:**
```
and(eq(productModels.tenant_id, tenantId), sql`${productModels.category} IS NOT NULL`),
```

---

✅ **Line 226** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 233** (high confidence)

**Before:**
```
eq(productModels.tenantId, tenantId),
```

**After:**
```
eq(productModels.tenant_id, tenantId),
```

---

✅ **Line 253** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 260** (high confidence)

**Before:**
```
eq(productModels.tenantId, tenantId),
```

**After:**
```
eq(productModels.tenant_id, tenantId),
```

---

✅ **Line 281** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 286** (high confidence)

**Before:**
```
.where(eq(productModels.tenantId, tenantId));
```

**After:**
```
.where(eq(productModels.tenant_id, tenantId));
```

---

✅ **Line 291** (high confidence)

**Before:**
```
.where(and(eq(productModels.tenantId, tenantId), eq(productModels.status, 'active')));
```

**After:**
```
.where(and(eq(productModels.tenant_id, tenantId), eq(productModels.status, 'active')));
```

---

✅ **Line 298** (high confidence)

**Before:**
```
eq(productModels.tenantId, tenantId),
```

**After:**
```
eq(productModels.tenant_id, tenantId),
```

---

✅ **Line 308** (high confidence)

**Before:**
```
.where(eq(productModels.tenantId, tenantId));
```

**After:**
```
.where(eq(productModels.tenant_id, tenantId));
```

---

✅ **Line 336** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 351** (high confidence)

**Before:**
```
.where(and(eq(productModels.id, update.id), eq(productModels.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(productModels.id, update.id), eq(productModels.tenant_id, tenantId)))
```

---

### `server\routes-proactive-maintenance.ts`

✅ **Line 22** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 46** (high confidence)

**Before:**
```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')))
```

**After:**
```
.where(and(eq(equipment.tenant_id, tenantId), eq(equipment.status, 'active')))
```

---

✅ **Line 178** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 197** (high confidence)

**Before:**
```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenant_id, tenantId)))
```

---

### `server\routes-print-cost-calculator.ts`

⚠️ **Line 458** (medium confidence)

**Before:**
```
.orderBy(desc(calculatorLeads.createdAt))
```

**After:**
```
.orderBy(desc(calculatorLeads.created_at))
```

---

⚠️ **Line 489** (medium confidence)

**Before:**
```
.orderBy(desc(calculatorSessions.createdAt));
```

**After:**
```
.orderBy(desc(calculatorSessions.created_at));
```

---

### `server\routes-pricing.ts`

✅ **Line 15** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 19** (high confidence)

**Before:**
```
const settings = await storage.getCompanyPricingSettings(user.tenantId);
```

**After:**
```
const settings = await storage.getCompanyPricingSettings(user.tenant_id);
```

---

✅ **Line 30** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 36** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 39** (high confidence)

**Before:**
```
const settings = await storage.updateCompanyPricingSettings(user.tenantId, validated);
```

**After:**
```
const settings = await storage.updateCompanyPricingSettings(user.tenant_id, validated);
```

---

✅ **Line 54** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 58** (high confidence)

**Before:**
```
const productPricing = await storage.getProductPricing(user.tenantId);
```

**After:**
```
const productPricing = await storage.getProductPricing(user.tenant_id);
```

---

✅ **Line 69** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 75** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 93** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 100** (high confidence)

**Before:**
```
const productPricing = await storage.updateProductPricing(id, user.tenantId, validated);
```

**After:**
```
const productPricing = await storage.updateProductPricing(id, user.tenant_id, validated);
```

---

✅ **Line 118** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 123** (high confidence)

**Before:**
```
const success = await storage.deleteProductPricing(id, user.tenantId);
```

**After:**
```
const success = await storage.deleteProductPricing(id, user.tenant_id);
```

---

✅ **Line 140** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 145** (high confidence)

**Before:**
```
const quotePricing = await storage.getQuotePricing(quoteId, user.tenantId);
```

**After:**
```
const quotePricing = await storage.getQuotePricing(quoteId, user.tenant_id);
```

---

✅ **Line 156** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 162** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 180** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 187** (high confidence)

**Before:**
```
const quotePricing = await storage.updateQuotePricing(id, user.tenantId, validated);
```

**After:**
```
const quotePricing = await storage.updateQuotePricing(id, user.tenant_id, validated);
```

---

✅ **Line 206** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 211** (high confidence)

**Before:**
```
const lineItems = await storage.getQuotePricingLineItems(quotePricingId, user.tenantId);
```

**After:**
```
const lineItems = await storage.getQuotePricingLineItems(quotePricingId, user.tenant_id);
```

---

✅ **Line 222** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 228** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 245** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 252** (high confidence)

**Before:**
```
const lineItem = await storage.updateQuotePricingLineItem(id, user.tenantId, validated);
```

**After:**
```
const lineItem = await storage.updateQuotePricingLineItem(id, user.tenant_id, validated);
```

---

✅ **Line 270** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 275** (high confidence)

**Before:**
```
const success = await storage.deleteQuotePricingLineItem(id, user.tenantId);
```

**After:**
```
const success = await storage.deleteQuotePricingLineItem(id, user.tenant_id);
```

---

✅ **Line 292** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 299** (high confidence)

**Before:**
```
const companySettings = await storage.getCompanyPricingSettings(user.tenantId);
```

**After:**
```
const companySettings = await storage.getCompanyPricingSettings(user.tenant_id);
```

---

✅ **Line 305** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

### `server\routes-preventive-maintenance.ts`

✅ **Line 13** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 231** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 359** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 477** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 574** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-predictive-service-dispatch.ts`

✅ **Line 116** (high confidence)

**Before:**
```
eq(serviceCallsEnhanced.tenantId, tenantId),
```

**After:**
```
eq(serviceCallsEnhanced.tenant_id, tenantId),
```

---

✅ **Line 133** (high confidence)

**Before:**
```
.where(eq(equipmentMetrics.tenantId, tenantId));
```

**After:**
```
.where(eq(equipmentMetrics.tenant_id, tenantId));
```

---

✅ **Line 146** (high confidence)

**Before:**
```
eq(equipmentMetrics.tenantId, tenantId),
```

**After:**
```
eq(equipmentMetrics.tenant_id, tenantId),
```

---

✅ **Line 160** (high confidence)

**Before:**
```
eq(serviceCallsEnhanced.tenantId, tenantId),
```

**After:**
```
eq(serviceCallsEnhanced.tenant_id, tenantId),
```

---

✅ **Line 185** (high confidence)

**Before:**
```
eq(serviceCallsEnhanced.tenantId, tenantId),
```

**After:**
```
eq(serviceCallsEnhanced.tenant_id, tenantId),
```

---

✅ **Line 265** (high confidence)

**Before:**
```
eq(serviceCallsEnhanced.tenantId, tenantId),
```

**After:**
```
eq(serviceCallsEnhanced.tenant_id, tenantId),
```

---

✅ **Line 278** (high confidence)

**Before:**
```
where: and(eq(equipment.id, service.equipmentId), eq(equipment.tenantId, tenantId)),
```

**After:**
```
where: and(eq(equipment.id, service.equipmentId), eq(equipment.tenant_id, tenantId)),
```

---

✅ **Line 287** (high confidence)

**Before:**
```
eq(equipmentMetrics.tenantId, tenantId),
```

**After:**
```
eq(equipmentMetrics.tenant_id, tenantId),
```

---

✅ **Line 334** (high confidence)

**Before:**
```
where: and(eq(equipment.serialNumber, serialNumber), eq(equipment.tenantId, tenantId)),
```

**After:**
```
where: and(eq(equipment.serialNumber, serialNumber), eq(equipment.tenant_id, tenantId)),
```

---

✅ **Line 348** (high confidence)

**Before:**
```
eq(equipmentMetrics.tenantId, tenantId),
```

**After:**
```
eq(equipmentMetrics.tenant_id, tenantId),
```

---

✅ **Line 366** (high confidence)

**Before:**
```
eq(serviceCallsEnhanced.tenantId, tenantId),
```

**After:**
```
eq(serviceCallsEnhanced.tenant_id, tenantId),
```

---

✅ **Line 412** (high confidence)

**Before:**
```
eq(technicianResourcesEnhanced.tenantId, tenantId),
```

**After:**
```
eq(technicianResourcesEnhanced.tenant_id, tenantId),
```

---

✅ **Line 467** (high confidence)

**Before:**
```
eq(equipmentMetrics.tenantId, tenantId),
```

**After:**
```
eq(equipmentMetrics.tenant_id, tenantId),
```

---

### `server\routes-predictive-maintenance-hub.ts`

✅ **Line 33** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 60** (high confidence)

**Before:**
```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')))
```

**After:**
```
.where(and(eq(equipment.tenant_id, tenantId), eq(equipment.status, 'active')))
```

---

✅ **Line 123** (high confidence)

**Before:**
```
eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
```

**After:**
```
eq(clientCollectedMetrics.tenant_id, parseInt(tenantId)),
```

---

✅ **Line 247** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 266** (high confidence)

**Before:**
```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(equipment.id, equipmentId), eq(equipment.tenant_id, tenantId)))
```

---

✅ **Line 325** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 365** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 415** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 427** (high confidence)

**Before:**
```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));
```

**After:**
```
.where(and(eq(equipment.tenant_id, tenantId), eq(equipment.status, 'active')));
```

---

✅ **Line 486** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 504** (high confidence)

**Before:**
```
.where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));
```

**After:**
```
.where(and(eq(equipment.tenant_id, tenantId), eq(equipment.status, 'active')));
```

---

✅ **Line 526** (high confidence)

**Before:**
```
eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
```

**After:**
```
eq(clientCollectedMetrics.tenant_id, parseInt(tenantId)),
```

---

### `server\routes-predictive-analytics.ts`

✅ **Line 18** (high confidence)

**Before:**
```
} else if (!req.user.id || !req.user.tenantId) {
```

**After:**
```
} else if (!req.user.id || !req.user.tenant_id) {
```

---

✅ **Line 22** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 38** (high confidence)

**Before:**
```
const tenantId = (req as any).user?.tenantId;
```

**After:**
```
const tenantId = (req as any).user?.tenant_id;
```

---

✅ **Line 366** (high confidence)

**Before:**
```
const tenantId = (req as any).user?.tenantId;
```

**After:**
```
const tenantId = (req as any).user?.tenant_id;
```

---

✅ **Line 465** (high confidence)

**Before:**
```
const tenantId = (req as any).user?.tenantId;
```

**After:**
```
const tenantId = (req as any).user?.tenant_id;
```

---

### `server\routes-platform-deals.ts`

⚠️ **Line 111** (medium confidence)

**Before:**
```
platformDeals[sortBy as keyof typeof platformDeals] || platformDeals.createdAt;
```

**After:**
```
platformDeals[sortBy as keyof typeof platformDeals] || platformDeals.created_at;
```

---

⚠️ **Line 256** (medium confidence)

**Before:**
```
const conditions: SQL[] = [gte(platformDeals.createdAt, startDate)];
```

**After:**
```
const conditions: SQL[] = [gte(platformDeals.created_at, startDate)];
```

---

⚠️ **Line 285** (medium confidence)

**Before:**
```
.filter((d) => d.actualCloseDate && d.createdAt)
```

**After:**
```
.filter((d) => d.actualCloseDate && d.created_at)
```

---

⚠️ **Line 288** (medium confidence)

**Before:**
```
(d.actualCloseDate!.getTime() - d.createdAt!.getTime()) / (1000 * 60 * 60 * 24),
```

**After:**
```
(d.actualCloseDate!.getTime() - d.created_at!.getTime()) / (1000 * 60 * 60 * 24),
```

---

### `server\routes-platform-customer-success.ts`

✅ **Line 274** (high confidence)

**Before:**
```
tenantId: businessRecord.tenantId || undefined,
```

**After:**
```
tenantId: businessRecord.tenant_id || undefined,
```

---

✅ **Line 492** (high confidence)

**Before:**
```
tenantId: businessRecord.tenantId || undefined,
```

**After:**
```
tenantId: businessRecord.tenant_id || undefined,
```

---

⚠️ **Line 573** (medium confidence)

**Before:**
```
orderBy: [desc(platformSuccessInterventions.createdAt)],
```

**After:**
```
orderBy: [desc(platformSuccessInterventions.created_at)],
```

---

### `server\routes-platform-business-records.ts`

⚠️ **Line 132** (medium confidence)

**Before:**
```
conditions.push(gte(platformBusinessRecords.createdAt, new Date(filters.createdAfter)));
```

**After:**
```
conditions.push(gte(platformBusinessRecords.created_at, new Date(filters.createdAfter)));
```

---

⚠️ **Line 135** (medium confidence)

**Before:**
```
conditions.push(lte(platformBusinessRecords.createdAt, new Date(filters.createdBefore)));
```

**After:**
```
conditions.push(lte(platformBusinessRecords.created_at, new Date(filters.createdBefore)));
```

---

⚠️ **Line 176** (medium confidence)

**Before:**
```
orderBy: [desc(platformBusinessRecords.createdAt)],
```

**After:**
```
orderBy: [desc(platformBusinessRecords.created_at)],
```

---

⚠️ **Line 218** (medium confidence)

**Before:**
```
platformBusinessRecords.createdAt;
```

**After:**
```
platformBusinessRecords.created_at;
```

---

⚠️ **Line 373** (medium confidence)

**Before:**
```
orderBy: [desc(platformDeals.createdAt)],
```

**After:**
```
orderBy: [desc(platformDeals.created_at)],
```

---

⚠️ **Line 725** (medium confidence)

**Before:**
```
orderBy: [desc(platformBusinessRecords.createdAt)],
```

**After:**
```
orderBy: [desc(platformBusinessRecords.created_at)],
```

---

⚠️ **Line 762** (medium confidence)

**Before:**
```
r.createdAt?.toISOString(),
```

**After:**
```
r.created_at?.toISOString(),
```

---

### `server\routes-platform-analytics.ts`

⚠️ **Line 128** (medium confidence)

**Before:**
```
gte(platformBusinessRecords.createdAt, startDate),
```

**After:**
```
gte(platformBusinessRecords.created_at, startDate),
```

---

⚠️ **Line 129** (medium confidence)

**Before:**
```
lte(platformBusinessRecords.createdAt, endDate),
```

**After:**
```
lte(platformBusinessRecords.created_at, endDate),
```

---

⚠️ **Line 207** (medium confidence)

**Before:**
```
whereConditions.push(gte(platformBusinessRecords.createdAt, new Date(startDate as string)));
```

**After:**
```
whereConditions.push(gte(platformBusinessRecords.created_at, new Date(startDate as string)));
```

---

⚠️ **Line 210** (medium confidence)

**Before:**
```
whereConditions.push(lte(platformBusinessRecords.createdAt, new Date(endDate as string)));
```

**After:**
```
whereConditions.push(lte(platformBusinessRecords.created_at, new Date(endDate as string)));
```

---

⚠️ **Line 321** (medium confidence)

**Before:**
```
whereConditions.push(gte(platformBusinessRecords.createdAt, new Date(startDate as string)));
```

**After:**
```
whereConditions.push(gte(platformBusinessRecords.created_at, new Date(startDate as string)));
```

---

⚠️ **Line 324** (medium confidence)

**Before:**
```
whereConditions.push(lte(platformBusinessRecords.createdAt, new Date(endDate as string)));
```

**After:**
```
whereConditions.push(lte(platformBusinessRecords.created_at, new Date(endDate as string)));
```

---

⚠️ **Line 365** (medium confidence)

**Before:**
```
if ('column' in c && c.column === platformBusinessRecords.createdAt) {
```

**After:**
```
if ('column' in c && c.column === platformBusinessRecords.created_at) {
```

---

⚠️ **Line 366** (medium confidence)

**Before:**
```
return gte(platformDeals.createdAt, (c as any).value);
```

**After:**
```
return gte(platformDeals.created_at, (c as any).value);
```

---

### `server\routes-pipeline-configuration.ts`

✅ **Line 60** (high confidence)

**Before:**
```
.where(eq(pipelineTemplates.tenantId, user.tenantId))
```

**After:**
```
.where(eq(pipelineTemplates.tenant_id, user.tenant_id))
```

---

✅ **Line 87** (high confidence)

**Before:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenant_id, user.tenant_id)))
```

---

✅ **Line 150** (high confidence)

**Before:**
```
eq(pipelineTemplates.tenantId, user.tenantId),
```

**After:**
```
eq(pipelineTemplates.tenant_id, user.tenant_id),
```

---

✅ **Line 160** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 171** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 222** (high confidence)

**Before:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenant_id, user.tenant_id)))
```

---

✅ **Line 236** (high confidence)

**Before:**
```
eq(pipelineTemplates.tenantId, user.tenantId),
```

**After:**
```
eq(pipelineTemplates.tenant_id, user.tenant_id),
```

---

✅ **Line 279** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.pipelineTemplateId, id)));
```

**After:**
```
.where(and(eq(deals.tenant_id, user.tenant_id), eq(deals.pipelineTemplateId, id)));
```

---

✅ **Line 290** (high confidence)

**Before:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)));
```

**After:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenant_id, user.tenant_id)));
```

---

✅ **Line 323** (high confidence)

**Before:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenant_id, user.tenant_id)))
```

---

✅ **Line 334** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 352** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 407** (high confidence)

**Before:**
```
eq(pipelineStages.tenantId, user.tenantId),
```

**After:**
```
eq(pipelineStages.tenant_id, user.tenant_id),
```

---

✅ **Line 430** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 462** (high confidence)

**Before:**
```
.where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenant_id, user.tenant_id)))
```

---

✅ **Line 500** (high confidence)

**Before:**
```
and(eq(pipelineStages.id, stage.id), eq(pipelineStages.tenantId, user.tenantId)),
```

**After:**
```
and(eq(pipelineStages.id, stage.id), eq(pipelineStages.tenant_id, user.tenant_id)),
```

---

✅ **Line 530** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, user.tenantId), eq(deals.currentStageId, id)));
```

**After:**
```
.where(and(eq(deals.tenant_id, user.tenant_id), eq(deals.currentStageId, id)));
```

---

✅ **Line 540** (high confidence)

**Before:**
```
.where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)));
```

**After:**
```
.where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenant_id, user.tenant_id)));
```

---

✅ **Line 573** (high confidence)

**Before:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenant_id, user.tenant_id)))
```

---

✅ **Line 603** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

⚠️ **Line 614** (medium confidence)

**Before:**
```
(new Date().getTime() - new Date(deal.updatedAt || deal.createdAt).getTime()) /
```

**After:**
```
(new Date().getTime() - new Date(deal.updatedAt || deal.created_at).getTime()) /
```

---

⚠️ **Line 614** (medium confidence)

**Before:**
```
(new Date().getTime() - new Date(deal.updatedAt || deal.createdAt).getTime()) /
```

**After:**
```
(new Date().getTime() - new Date(deal.updated_at || deal.createdAt).getTime()) /
```

---

✅ **Line 637** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 687** (high confidence)

**Before:**
```
and(eq(dealStageHistory.dealId, dealId), eq(dealStageHistory.tenantId, user.tenantId)),
```

**After:**
```
and(eq(dealStageHistory.dealId, dealId), eq(dealStageHistory.tenant_id, user.tenant_id)),
```

---

✅ **Line 727** (high confidence)

**Before:**
```
.where(eq(dealStageHistory.tenantId, user.tenantId))
```

**After:**
```
.where(eq(dealStageHistory.tenant_id, user.tenant_id))
```

---

✅ **Line 766** (high confidence)

**Before:**
```
.where(eq(dealStageHistory.tenantId, user.tenantId))
```

**After:**
```
.where(eq(dealStageHistory.tenant_id, user.tenant_id))
```

---

### `server\routes-pagination.ts`

✅ **Line 55** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 59** (high confidence)

**Before:**
```
const conditions = [eq(businessRecords.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(businessRecords.tenant_id, tenantId)];
```

---

⚠️ **Line 97** (medium confidence)

**Before:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.createdAt,
```

**After:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.created_at,
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 116** (high confidence)

**Before:**
```
const conditions = [eq(serviceTickets.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(serviceTickets.tenant_id, tenantId)];
```

---

⚠️ **Line 147** (medium confidence)

**Before:**
```
serviceTickets[sortBy as keyof typeof serviceTickets] || serviceTickets.createdAt,
```

**After:**
```
serviceTickets[sortBy as keyof typeof serviceTickets] || serviceTickets.created_at,
```

---

✅ **Line 163** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 166** (high confidence)

**Before:**
```
const conditions = [eq(inventoryItems.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(inventoryItems.tenant_id, tenantId)];
```

---

⚠️ **Line 198** (medium confidence)

**Before:**
```
inventoryItems[sortBy as keyof typeof inventoryItems] || inventoryItems.createdAt,
```

**After:**
```
inventoryItems[sortBy as keyof typeof inventoryItems] || inventoryItems.created_at,
```

---

✅ **Line 214** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 217** (high confidence)

**Before:**
```
const conditions = [eq(invoices.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(invoices.tenant_id, tenantId)];
```

---

⚠️ **Line 246** (medium confidence)

**Before:**
```
.orderBy(sortDirection(invoices[sortBy as keyof typeof invoices] || invoices.createdAt))
```

**After:**
```
.orderBy(sortDirection(invoices[sortBy as keyof typeof invoices] || invoices.created_at))
```

---

### `server\routes-opportunities.ts`

✅ **Line 32** (high confidence)

**Before:**
```
const tenantId = req.user!.tenantId;
```

**After:**
```
const tenantId = req.user!.tenant_id;
```

---

⚠️ **Line 51** (medium confidence)

**Before:**
```
createdAt: businessRecords.createdAt,
```

**After:**
```
createdAt: businessRecords.created_at,
```

---

⚠️ **Line 52** (medium confidence)

**Before:**
```
updatedAt: businessRecords.updatedAt,
```

**After:**
```
updatedAt: businessRecords.updated_at,
```

---

✅ **Line 59** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 63** (medium confidence)

**Before:**
```
.orderBy(desc(businessRecords.estimatedValue), desc(businessRecords.createdAt));
```

**After:**
```
.orderBy(desc(businessRecords.estimatedValue), desc(businessRecords.created_at));
```

---

✅ **Line 76** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 95** (medium confidence)

**Before:**
```
createdAt: businessRecords.createdAt,
```

**After:**
```
createdAt: businessRecords.created_at,
```

---

⚠️ **Line 96** (medium confidence)

**Before:**
```
updatedAt: businessRecords.updatedAt,
```

**After:**
```
updatedAt: businessRecords.updated_at,
```

---

✅ **Line 104** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 114** (high confidence)

**Before:**
```
.where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenant_id, tenantId)))
```

---

⚠️ **Line 115** (medium confidence)

**Before:**
```
.orderBy(desc(quotes.createdAt));
```

**After:**
```
.orderBy(desc(quotes.created_at));
```

---

✅ **Line 121** (high confidence)

**Before:**
```
.where(and(eq(deals.customerId, opportunityId), eq(deals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(deals.customerId, opportunityId), eq(deals.tenant_id, tenantId)))
```

---

⚠️ **Line 122** (medium confidence)

**Before:**
```
.orderBy(desc(deals.createdAt));
```

**After:**
```
.orderBy(desc(deals.created_at));
```

---

✅ **Line 138** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 147** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 164** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 172** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 204** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 216** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 224** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 234** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 242** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.priority, 'urgent')));
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.priority, 'urgent')));
```

---

✅ **Line 250** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), sql`${businessRecords.estimatedValue} > 0`),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), sql`${businessRecords.estimatedValue} > 0`),
```

---

✅ **Line 274** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 285** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

### `server\routes-onboarding.ts`

✅ **Line 46** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 56** (high confidence)

**Before:**
```
if (!req.user?.tenantId && tenantId) {
```

**After:**
```
if (!req.user?.tenant_id && tenantId) {
```

---

✅ **Line 60** (high confidence)

**Before:**
```
if (!req.user?.tenantId) {
```

**After:**
```
if (!req.user?.tenant_id) {
```

---

⚠️ **Line 285** (medium confidence)

**Before:**
```
<div class="field-value">${new Date(checklist.createdAt).toLocaleDateString()}</div>
```

**After:**
```
<div class="field-value">${new Date(checklist.created_at).toLocaleDateString()}</div>
```

---

✅ **Line 429** (high confidence)

**Before:**
```
.where(eq(businessRecords.tenantId, tenantId))
```

**After:**
```
.where(eq(businessRecords.tenant_id, tenantId))
```

---

✅ **Line 455** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 459** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 461** (high confidence)

**Before:**
```
let query = db.select().from(quotes).where(eq(quotes.tenantId, tenantId)).limit(Number(limit));
```

**After:**
```
let query = db.select().from(quotes).where(eq(quotes.tenant_id, tenantId)).limit(Number(limit));
```

---

✅ **Line 466** (high confidence)

**Before:**
```
eq(quotes.tenantId, tenantId),
```

**After:**
```
eq(quotes.tenant_id, tenantId),
```

---

✅ **Line 475** (high confidence)

**Before:**
```
eq(quotes.tenantId, tenantId),
```

**After:**
```
eq(quotes.tenant_id, tenantId),
```

---

✅ **Line 498** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 502** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 507** (high confidence)

**Before:**
```
.where(and(eq(quoteLineItems.tenantId, tenantId), eq(quoteLineItems.quoteId, quoteId)))
```

**After:**
```
.where(and(eq(quoteLineItems.tenant_id, tenantId), eq(quoteLineItems.quoteId, quoteId)))
```

---

✅ **Line 522** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 526** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 532** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, businessRecordId)))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.id, businessRecordId)))
```

---

✅ **Line 571** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 575** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 597** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 601** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 641** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 645** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 679** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 683** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 713** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 717** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 738** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 742** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 763** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 767** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

✅ **Line 797** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 801** (high confidence)

**Before:**
```
const tenantId = user.tenantId;
```

**After:**
```
const tenantId = user.tenant_id;
```

---

### `server\routes-modular-dashboard.ts`

✅ **Line 107** (high confidence)

**Before:**
```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

**After:**
```
and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

---

✅ **Line 126** (high confidence)

**Before:**
```
.where(eq(deals.tenantId, tenantId));
```

**After:**
```
.where(eq(deals.tenant_id, tenantId));
```

---

✅ **Line 145** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'lead')),
```

---

✅ **Line 164** (high confidence)

**Before:**
```
.where(eq(serviceTickets.tenantId, tenantId));
```

**After:**
```
.where(eq(serviceTickets.tenant_id, tenantId));
```

---

✅ **Line 183** (high confidence)

**Before:**
```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

**After:**
```
and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

---

✅ **Line 205** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 227** (high confidence)

**Before:**
```
.where(and(eq(inventoryItems.tenantId, tenantId), sql`current_stock <= reorder_point`));
```

**After:**
```
.where(and(eq(inventoryItems.tenant_id, tenantId), sql`current_stock <= reorder_point`));
```

---

✅ **Line 247** (high confidence)

**Before:**
```
.where(eq(serviceTickets.tenantId, tenantId)),
```

**After:**
```
.where(eq(serviceTickets.tenant_id, tenantId)),
```

---

✅ **Line 253** (high confidence)

**Before:**
```
and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
```

**After:**
```
and(eq(serviceTickets.tenant_id, tenantId), sql`status IN ('open', 'in_progress')`),
```

---

✅ **Line 275** (high confidence)

**Before:**
```
and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

**After:**
```
and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${currentMonth}`),
```

---

✅ **Line 298** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 306** (high confidence)

**Before:**
```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

**After:**
```
.where(and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active'))),
```

---

✅ **Line 312** (high confidence)

**Before:**
```
and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

**After:**
```
and(eq(invoices.tenant_id, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

---

✅ **Line 319** (high confidence)

**Before:**
```
and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
```

**After:**
```
and(eq(serviceTickets.tenant_id, tenantId), sql`status IN ('open', 'in_progress')`),
```

---

### `server\routes-modular-dashboard-broken.ts`

✅ **Line 28** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`)),
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${currentMonth}`)),
```

---

✅ **Line 33** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${previousMonth}`)),
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${previousMonth}`)),
```

---

✅ **Line 41** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, tenantId), ...(userId ? [eq(deals.ownerId, userId)] : []))),
```

**After:**
```
.where(and(eq(deals.tenant_id, tenantId), ...(userId ? [eq(deals.ownerId, userId)] : []))),
```

---

✅ **Line 65** (high confidence)

**Before:**
```
eq(deals.tenantId, tenantId),
```

**After:**
```
eq(deals.tenant_id, tenantId),
```

---

✅ **Line 76** (high confidence)

**Before:**
```
eq(deals.tenantId, tenantId),
```

**After:**
```
eq(deals.tenant_id, tenantId),
```

---

✅ **Line 98** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), sql`created_at::text LIKE ${currentMonth}`));
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), sql`created_at::text LIKE ${currentMonth}`));
```

---

✅ **Line 119** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 130** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 158** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 169** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 180** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 215** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 226** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

✅ **Line 256** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 262** (high confidence)

**Before:**
```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active'))),
```

**After:**
```
.where(and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active'))),
```

---

✅ **Line 268** (high confidence)

**Before:**
```
and(eq(invoices.tenantId, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

**After:**
```
and(eq(invoices.tenant_id, tenantId), sql`created_at >= NOW() - INTERVAL '30 days'`),
```

---

✅ **Line 275** (high confidence)

**Before:**
```
and(eq(serviceTickets.tenantId, tenantId), sql`status IN ('open', 'in_progress')`),
```

**After:**
```
and(eq(serviceTickets.tenant_id, tenantId), sql`status IN ('open', 'in_progress')`),
```

---

✅ **Line 297** (high confidence)

**Before:**
```
.where(and(eq(inventoryItems.tenantId, tenantId), sql`current_stock <= reorder_point`))
```

**After:**
```
.where(and(eq(inventoryItems.tenant_id, tenantId), sql`current_stock <= reorder_point`))
```

---

✅ **Line 318** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId || '1d4522ad-b3d8-4018-8890-f9294b2efbe6';
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id || '1d4522ad-b3d8-4018-8890-f9294b2efbe6';
```

---

### `server\routes-mobile.ts`

✅ **Line 25** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 270** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 416** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 496** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 593** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 690** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-mobile-technician.ts`

✅ **Line 49** (high confidence)

**Before:**
```
eq(phoneInTickets.tenantId, tenantId),
```

**After:**
```
eq(phoneInTickets.tenant_id, tenantId),
```

---

⚠️ **Line 54** (medium confidence)

**Before:**
```
since ? gte(phoneInTickets.updatedAt, new Date(since)) : undefined,
```

**After:**
```
since ? gte(phoneInTickets.updated_at, new Date(since)) : undefined,
```

---

✅ **Line 65** (high confidence)

**Before:**
```
where: eq(equipment.tenantId, tenantId),
```

**After:**
```
where: eq(equipment.tenant_id, tenantId),
```

---

✅ **Line 71** (high confidence)

**Before:**
```
where: eq(businessRecords.tenantId, tenantId),
```

**After:**
```
where: eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 77** (high confidence)

**Before:**
```
where: and(eq(users.id, technicianId), eq(users.tenantId, tenantId)),
```

**After:**
```
where: and(eq(users.id, technicianId), eq(users.tenant_id, tenantId)),
```

---

⚠️ **Line 105** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 109** (high confidence)

**Before:**
```
eq(phoneInTickets.tenantId, tenantId),
```

**After:**
```
eq(phoneInTickets.tenant_id, tenantId),
```

---

⚠️ **Line 123** (medium confidence)

**Before:**
```
orderBy: [desc(phoneInTickets.createdAt)],
```

**After:**
```
orderBy: [desc(phoneInTickets.created_at)],
```

---

✅ **Line 145** (high confidence)

**Before:**
```
where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)),
```

**After:**
```
where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)),
```

---

✅ **Line 193** (high confidence)

**Before:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)))
```

---

⚠️ **Line 215** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 227** (high confidence)

**Before:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)))
```

---

⚠️ **Line 259** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 286** (high confidence)

**Before:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)))
```

---

⚠️ **Line 324** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

⚠️ **Line 380** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 390** (high confidence)

**Before:**
```
where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)),
```

**After:**
```
where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)),
```

---

✅ **Line 433** (high confidence)

**Before:**
```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

**After:**
```
where: and(eq(equipment.id, id), eq(equipment.tenant_id, tenantId)),
```

---

✅ **Line 445** (high confidence)

**Before:**
```
where: and(eq(phoneInTickets.equipmentId, id), eq(phoneInTickets.tenantId, tenantId)),
```

**After:**
```
where: and(eq(phoneInTickets.equipmentId, id), eq(phoneInTickets.tenant_id, tenantId)),
```

---

⚠️ **Line 446** (medium confidence)

**Before:**
```
orderBy: [desc(phoneInTickets.createdAt)],
```

**After:**
```
orderBy: [desc(phoneInTickets.created_at)],
```

---

✅ **Line 477** (high confidence)

**Before:**
```
eq(equipment.tenantId, tenantId),
```

**After:**
```
eq(equipment.tenant_id, tenantId),
```

---

⚠️ **Line 507** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

⚠️ **Line 540** (medium confidence)

**Before:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 550** (high confidence)

**Before:**
```
and(eq(phoneInTickets.tenantId, tenantId), eq(phoneInTickets.assignedTo, technicianId)),
```

**After:**
```
and(eq(phoneInTickets.tenant_id, tenantId), eq(phoneInTickets.assignedTo, technicianId)),
```

---

### `server\routes-manufacturer-integration.ts`

✅ **Line 20** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 28** (high confidence)

**Before:**
```
.where(eq(manufacturerIntegrations.tenantId, tenantId))
```

**After:**
```
.where(eq(manufacturerIntegrations.tenant_id, tenantId))
```

---

⚠️ **Line 29** (medium confidence)

**Before:**
```
.orderBy(desc(manufacturerIntegrations.createdAt));
```

**After:**
```
.orderBy(desc(manufacturerIntegrations.created_at));
```

---

✅ **Line 41** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 63** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 74** (high confidence)

**Before:**
```
and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
```

**After:**
```
and(eq(manufacturerIntegrations.tenant_id, tenantId), eq(manufacturerIntegrations.id, id)),
```

---

✅ **Line 92** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 106** (high confidence)

**Before:**
```
and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
```

**After:**
```
and(eq(manufacturerIntegrations.tenant_id, tenantId), eq(manufacturerIntegrations.id, id)),
```

---

✅ **Line 124** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 134** (high confidence)

**Before:**
```
and(eq(manufacturerIntegrations.tenantId, tenantId), eq(manufacturerIntegrations.id, id)),
```

**After:**
```
and(eq(manufacturerIntegrations.tenant_id, tenantId), eq(manufacturerIntegrations.id, id)),
```

---

✅ **Line 147** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 172** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 194** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 206** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 222** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 237** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId))
```

---

✅ **Line 250** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 269** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 285** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

✅ **Line 302** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 313** (high confidence)

**Before:**
```
eq(integrationAuditLogs.tenantId, tenantId),
```

**After:**
```
eq(integrationAuditLogs.tenant_id, tenantId),
```

---

✅ **Line 356** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 366** (high confidence)

**Before:**
```
.where(eq(manufacturerIntegrations.tenantId, tenantId)),
```

**After:**
```
.where(eq(manufacturerIntegrations.tenant_id, tenantId)),
```

---

✅ **Line 373** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 381** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId)),
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId)),
```

---

✅ **Line 388** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 398** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

### `server\routes-lead-assignment.ts`

✅ **Line 29** (high confidence)

**Before:**
```
where: eq(salesTerritories.tenantId, tenantId),
```

**After:**
```
where: eq(salesTerritories.tenant_id, tenantId),
```

---

✅ **Line 47** (high confidence)

**Before:**
```
where: and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)),
```

**After:**
```
where: and(eq(salesTerritories.id, id), eq(salesTerritories.tenant_id, tenantId)),
```

---

✅ **Line 92** (high confidence)

**Before:**
```
.where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenant_id, tenantId)))
```

---

✅ **Line 114** (high confidence)

**Before:**
```
.where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenant_id, tenantId)))
```

---

✅ **Line 139** (high confidence)

**Before:**
```
where: eq(leadAssignmentRules.tenantId, tenantId),
```

**After:**
```
where: eq(leadAssignmentRules.tenant_id, tenantId),
```

---

✅ **Line 157** (high confidence)

**Before:**
```
where: and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)),
```

**After:**
```
where: and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenant_id, tenantId)),
```

---

✅ **Line 202** (high confidence)

**Before:**
```
.where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenant_id, tenantId)))
```

---

✅ **Line 224** (high confidence)

**Before:**
```
.where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenant_id, tenantId)))
```

---

⚠️ **Line 247** (medium confidence)

**Before:**
```
where: and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.user_id, userId), eq(repCapacity.tenantId, tenantId)),
```

---

✅ **Line 247** (high confidence)

**Before:**
```
where: and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.userId, userId), eq(repCapacity.tenant_id, tenantId)),
```

---

✅ **Line 270** (high confidence)

**Before:**
```
where: eq(repCapacity.tenantId, tenantId),
```

**After:**
```
where: eq(repCapacity.tenant_id, tenantId),
```

---

⚠️ **Line 271** (medium confidence)

**Before:**
```
orderBy: [desc(repCapacity.isAvailable), asc(repCapacity.userId)],
```

**After:**
```
orderBy: [desc(repCapacity.isAvailable), asc(repCapacity.user_id)],
```

---

⚠️ **Line 296** (medium confidence)

**Before:**
```
where: and(eq(repCapacity.userId, capacityData.userId), eq(repCapacity.tenantId, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.user_id, capacityData.user_id), eq(repCapacity.tenantId, tenantId)),
```

---

✅ **Line 296** (high confidence)

**Before:**
```
where: and(eq(repCapacity.userId, capacityData.userId), eq(repCapacity.tenantId, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.userId, capacityData.userId), eq(repCapacity.tenant_id, tenantId)),
```

---

⚠️ **Line 333** (medium confidence)

**Before:**
```
.where(and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(repCapacity.user_id, userId), eq(repCapacity.tenantId, tenantId)))
```

---

✅ **Line 333** (high confidence)

**Before:**
```
.where(and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(repCapacity.userId, userId), eq(repCapacity.tenant_id, tenantId)))
```

---

✅ **Line 358** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 379** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 426** (high confidence)

**Before:**
```
where: eq(leadAssignmentQueue.tenantId, tenantId),
```

**After:**
```
where: eq(leadAssignmentQueue.tenant_id, tenantId),
```

---

✅ **Line 433** (high confidence)

**Before:**
```
eq(leadAssignmentQueue.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentQueue.tenant_id, tenantId),
```

---

✅ **Line 482** (high confidence)

**Before:**
```
.where(and(eq(leadAssignmentQueue.id, id), eq(leadAssignmentQueue.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leadAssignmentQueue.id, id), eq(leadAssignmentQueue.tenant_id, tenantId)))
```

---

✅ **Line 514** (high confidence)

**Before:**
```
eq(leadAssignmentRules.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentRules.tenant_id, tenantId),
```

---

### `server\routes-knowledge-base.ts`

⚠️ **Line 25** (medium confidence)

**Before:**
```
return (req as any).user?.id || (req as any).user?.claims?.sub || (req as any).session?.userId;
```

**After:**
```
return (req as any).user?.id || (req as any).user?.claims?.sub || (req as any).session?.user_id;
```

---

✅ **Line 55** (high confidence)

**Before:**
```
(req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
```

**After:**
```
(req as any).tenant_id || (req.session as any).tenant_id || '00000000-0000-0000-0000-000000000000'
```

---

✅ **Line 70** (high confidence)

**Before:**
```
eq(knowledgeCategories.tenantId, tenantId),
```

**After:**
```
eq(knowledgeCategories.tenant_id, tenantId),
```

---

✅ **Line 105** (high confidence)

**Before:**
```
eq(knowledgeCategories.tenantId, tenantId),
```

**After:**
```
eq(knowledgeCategories.tenant_id, tenantId),
```

---

✅ **Line 161** (high confidence)

**Before:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenant_id, tenantId)))
```

---

✅ **Line 187** (high confidence)

**Before:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenant_id, tenantId)))
```

---

✅ **Line 220** (high confidence)

**Before:**
```
const whereConditions = [eq(knowledgeArticles.tenantId, tenantId)];
```

**After:**
```
const whereConditions = [eq(knowledgeArticles.tenant_id, tenantId)];
```

---

⚠️ **Line 280** (medium confidence)

**Before:**
```
updatedAt: knowledgeArticles.updatedAt,
```

**After:**
```
updatedAt: knowledgeArticles.updated_at,
```

---

✅ **Line 318** (high confidence)

**Before:**
```
const whereConditions = [eq(knowledgeArticles.tenantId, tenantId)];
```

**After:**
```
const whereConditions = [eq(knowledgeArticles.tenant_id, tenantId)];
```

---

✅ **Line 459** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 492** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 534** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 566** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 590** (high confidence)

**Before:**
```
.where(and(eq(articleVersions.articleId, id), eq(articleVersions.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(articleVersions.articleId, id), eq(articleVersions.tenant_id, tenantId)));
```

---

✅ **Line 595** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 647** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

✅ **Line 752** (high confidence)

**Before:**
```
.where(and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.articleId, id)))
```

**After:**
```
.where(and(eq(articleFeedback.tenant_id, tenantId), eq(articleFeedback.articleId, id)))
```

---

⚠️ **Line 753** (medium confidence)

**Before:**
```
.orderBy(desc(articleFeedback.createdAt));
```

**After:**
```
.orderBy(desc(articleFeedback.created_at));
```

---

✅ **Line 782** (high confidence)

**Before:**
```
.where(eq(knowledgeArticles.tenantId, tenantId));
```

**After:**
```
.where(eq(knowledgeArticles.tenant_id, tenantId));
```

---

✅ **Line 791** (high confidence)

**Before:**
```
.where(eq(knowledgeCategories.tenantId, tenantId));
```

**After:**
```
.where(eq(knowledgeCategories.tenant_id, tenantId));
```

---

✅ **Line 803** (high confidence)

**Before:**
```
and(eq(knowledgeArticles.tenantId, tenantId), eq(knowledgeArticles.status, 'published')),
```

**After:**
```
and(eq(knowledgeArticles.tenant_id, tenantId), eq(knowledgeArticles.status, 'published')),
```

---

⚠️ **Line 813** (medium confidence)

**Before:**
```
createdAt: knowledgeSearchQueries.createdAt,
```

**After:**
```
createdAt: knowledgeSearchQueries.created_at,
```

---

✅ **Line 816** (high confidence)

**Before:**
```
.where(eq(knowledgeSearchQueries.tenantId, tenantId))
```

**After:**
```
.where(eq(knowledgeSearchQueries.tenant_id, tenantId))
```

---

⚠️ **Line 817** (medium confidence)

**Before:**
```
.orderBy(desc(knowledgeSearchQueries.createdAt))
```

**After:**
```
.orderBy(desc(knowledgeSearchQueries.created_at))
```

---

### `server\routes-intelligent-alerts.ts`

⚠️ **Line 81** (medium confidence)

**Before:**
```
orderBy: desc(alertTriageResults.createdAt),
```

**After:**
```
orderBy: desc(alertTriageResults.created_at),
```

---

⚠️ **Line 182** (medium confidence)

**Before:**
```
orderBy: desc(automatedContainmentLogs.createdAt),
```

**After:**
```
orderBy: desc(automatedContainmentLogs.created_at),
```

---

✅ **Line 188** (high confidence)

**Before:**
```
conditions.push(eq(automatedContainmentLogs.tenantId, tenantId as string));
```

**After:**
```
conditions.push(eq(automatedContainmentLogs.tenant_id, tenantId as string));
```

---

⚠️ **Line 196** (medium confidence)

**Before:**
```
orderBy: desc(automatedContainmentLogs.createdAt),
```

**After:**
```
orderBy: desc(automatedContainmentLogs.created_at),
```

---

✅ **Line 257** (high confidence)

**Before:**
```
where: tenantId ? eq(incidentCorrelations.tenantId, tenantId as string) : undefined,
```

**After:**
```
where: tenantId ? eq(incidentCorrelations.tenant_id, tenantId as string) : undefined,
```

---

⚠️ **Line 258** (medium confidence)

**Before:**
```
orderBy: desc(incidentCorrelations.createdAt),
```

**After:**
```
orderBy: desc(incidentCorrelations.created_at),
```

---

⚠️ **Line 277** (medium confidence)

**Before:**
```
orderBy: desc(incidentCorrelations.createdAt),
```

**After:**
```
orderBy: desc(incidentCorrelations.created_at),
```

---

✅ **Line 500** (high confidence)

**Before:**
```
conditions.push(eq(proactiveThreatDetection.tenantId, tenantId as string));
```

**After:**
```
conditions.push(eq(proactiveThreatDetection.tenant_id, tenantId as string));
```

---

✅ **Line 565** (high confidence)

**Before:**
```
conditions.push(eq(alertRoutingRules.tenantId, tenantId as string));
```

**After:**
```
conditions.push(eq(alertRoutingRules.tenant_id, tenantId as string));
```

---

### `server\routes-integrations.ts`

✅ **Line 25** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 46** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 65** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-integrations-real.ts`

✅ **Line 25** (high confidence)

**Before:**
```
where: eq(platformIntegrations.tenantId, tenantId),
```

**After:**
```
where: eq(platformIntegrations.tenant_id, tenantId),
```

---

⚠️ **Line 26** (medium confidence)

**Before:**
```
orderBy: desc(platformIntegrations.createdAt),
```

**After:**
```
orderBy: desc(platformIntegrations.created_at),
```

---

✅ **Line 90** (high confidence)

**Before:**
```
.where(and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenant_id, tenantId)))
```

---

✅ **Line 108** (high confidence)

**Before:**
```
where: and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenantId, tenantId)),
```

**After:**
```
where: and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenant_id, tenantId)),
```

---

✅ **Line 158** (high confidence)

**Before:**
```
where: and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenantId, tenantId)),
```

**After:**
```
where: and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenant_id, tenantId)),
```

---

✅ **Line 294** (high confidence)

**Before:**
```
.where(and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(platformIntegrations.id, id), eq(platformIntegrations.tenant_id, tenantId)));
```

---

### `server\routes-integration-hub.ts`

✅ **Line 21** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 40** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 796** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 819** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-incident-response.ts`

✅ **Line 20** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 465** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 629** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-import.ts`

⚠️ **Line 436** (medium confidence)

**Before:**
```
job.updatedAt = new Date();
```

**After:**
```
job.updated_at = new Date();
```

---

⚠️ **Line 533** (medium confidence)

**Before:**
```
job.updatedAt = new Date();
```

**After:**
```
job.updated_at = new Date();
```

---

⚠️ **Line 556** (medium confidence)

**Before:**
```
job.updatedAt = new Date();
```

**After:**
```
job.updated_at = new Date();
```

---

✅ **Line 558** (high confidence)

**Before:**
```
const tenantId = job.tenantId;
```

**After:**
```
const tenantId = job.tenant_id;
```

---

⚠️ **Line 559** (medium confidence)

**Before:**
```
const userId = job.userId;
```

**After:**
```
const userId = job.user_id;
```

---

⚠️ **Line 610** (medium confidence)

**Before:**
```
job.updatedAt = new Date();
```

**After:**
```
job.updated_at = new Date();
```

---

✅ **Line 850** (high confidence)

**Before:**
```
.where(eq(businessRecords.tenantId, job.tenantId))
```

**After:**
```
.where(eq(businessRecords.tenant_id, job.tenant_id))
```

---

### `server\routes-gdpr-core.ts`

✅ **Line 59** (high confidence)

**Before:**
```
const exportRequest = await gdprDataExportService.createExportRequest(req.tenantId!, {
```

**After:**
```
const exportRequest = await gdprDataExportService.createExportRequest(req.tenant_id!, {
```

---

✅ **Line 86** (high confidence)

**Before:**
```
const result = await gdprDataExportService.listExportRequests(req.tenantId!, {
```

**After:**
```
const result = await gdprDataExportService.listExportRequests(req.tenant_id!, {
```

---

✅ **Line 110** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 136** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 166** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 183** (high confidence)

**Before:**
```
await gdprDataExportService.recordDownload(req.tenantId!, req.params.id);
```

**After:**
```
await gdprDataExportService.recordDownload(req.tenant_id!, req.params.id);
```

---

✅ **Line 188** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 214** (high confidence)

**Before:**
```
const templates = await gdprDataExportService.listTemplates(req.tenantId!);
```

**After:**
```
const templates = await gdprDataExportService.listTemplates(req.tenant_id!);
```

---

✅ **Line 231** (high confidence)

**Before:**
```
const template = await gdprDataExportService.createTemplate(req.tenantId!, req.body);
```

**After:**
```
const template = await gdprDataExportService.createTemplate(req.tenant_id!, req.body);
```

---

✅ **Line 260** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 291** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 324** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 351** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 368** (high confidence)

**Before:**
```
const summary = await consentManagementService.getConsentSummary(req.tenantId!, req.params.id);
```

**After:**
```
const summary = await consentManagementService.getConsentSummary(req.tenant_id!, req.params.id);
```

---

✅ **Line 383** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 404** (high confidence)

**Before:**
```
const result = await consentManagementService.listConsents(req.tenantId!, {
```

**After:**
```
const result = await consentManagementService.listConsents(req.tenant_id!, {
```

---

✅ **Line 429** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 449** (high confidence)

**Before:**
```
const stats = await consentManagementService.getConsentStats(req.tenantId!);
```

**After:**
```
const stats = await consentManagementService.getConsentStats(req.tenant_id!);
```

---

✅ **Line 466** (high confidence)

**Before:**
```
const templates = await consentManagementService.listTemplates(req.tenantId!);
```

**After:**
```
const templates = await consentManagementService.listTemplates(req.tenant_id!);
```

---

✅ **Line 483** (high confidence)

**Before:**
```
const template = await consentManagementService.createTemplate(req.tenantId!, req.body);
```

**After:**
```
const template = await consentManagementService.createTemplate(req.tenant_id!, req.body);
```

---

✅ **Line 516** (high confidence)

**Before:**
```
const dpa = await dpaManagementService.createDpa(req.tenantId!, req.body, req.user!.id);
```

**After:**
```
const dpa = await dpaManagementService.createDpa(req.tenant_id!, req.body, req.user!.id);
```

---

✅ **Line 538** (high confidence)

**Before:**
```
const result = await dpaManagementService.listDpas(req.tenantId!, {
```

**After:**
```
const result = await dpaManagementService.listDpas(req.tenant_id!, {
```

---

✅ **Line 563** (high confidence)

**Before:**
```
const dpa = await dpaManagementService.getDpa(req.tenantId!, req.params.id);
```

**After:**
```
const dpa = await dpaManagementService.getDpa(req.tenant_id!, req.params.id);
```

---

✅ **Line 587** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 621** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 647** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 673** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 700** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 729** (high confidence)

**Before:**
```
const dpas = await dpaManagementService.getExpiringDpas(req.tenantId!, withinDays);
```

**After:**
```
const dpas = await dpaManagementService.getExpiringDpas(req.tenant_id!, withinDays);
```

---

✅ **Line 747** (high confidence)

**Before:**
```
const dpas = await dpaManagementService.getDpasPendingCompliance(req.tenantId!);
```

**After:**
```
const dpas = await dpaManagementService.getDpasPendingCompliance(req.tenant_id!);
```

---

✅ **Line 771** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 803** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 834** (high confidence)

**Before:**
```
const check = await dpaManagementService.createComplianceCheck(req.tenantId!, {
```

**After:**
```
const check = await dpaManagementService.createComplianceCheck(req.tenant_id!, {
```

---

✅ **Line 860** (high confidence)

**Before:**
```
const result = await dpaManagementService.listComplianceChecks(req.tenantId!, req.params.id, {
```

**After:**
```
const result = await dpaManagementService.listComplianceChecks(req.tenant_id!, req.params.id, {
```

---

✅ **Line 881** (high confidence)

**Before:**
```
const stats = await dpaManagementService.getStats(req.tenantId!);
```

**After:**
```
const stats = await dpaManagementService.getStats(req.tenant_id!);
```

---

✅ **Line 909** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 935** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 955** (high confidence)

**Before:**
```
const rule = await contactDeduplicationService.getRule(req.tenantId!, req.params.id);
```

**After:**
```
const rule = await contactDeduplicationService.getRule(req.tenant_id!, req.params.id);
```

---

✅ **Line 984** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1011** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1034** (high confidence)

**Before:**
```
const result = await contactDeduplicationService.listMatches(req.tenantId!, {
```

**After:**
```
const result = await contactDeduplicationService.listMatches(req.tenant_id!, {
```

---

✅ **Line 1062** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1099** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1132** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1157** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1179** (high confidence)

**Before:**
```
req.tenantId!,
```

**After:**
```
req.tenant_id!,
```

---

✅ **Line 1208** (high confidence)

**Before:**
```
.runScanJob(req.tenantId!, req.params.id)
```

**After:**
```
.runScanJob(req.tenant_id!, req.params.id)
```

---

✅ **Line 1228** (high confidence)

**Before:**
```
const result = await contactDeduplicationService.listScanJobs(req.tenantId!, {
```

**After:**
```
const result = await contactDeduplicationService.listScanJobs(req.tenant_id!, {
```

---

✅ **Line 1250** (high confidence)

**Before:**
```
const stats = await contactDeduplicationService.getStats(req.tenantId!);
```

**After:**
```
const stats = await contactDeduplicationService.getStats(req.tenant_id!);
```

---

### `server\routes-export.ts`

✅ **Line 11** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 21** (high confidence)

**Before:**
```
if (!checklist || checklist.tenantId !== user.tenantId) {
```

**After:**
```
if (!checklist || checklist.tenant_id !== user.tenant_id) {
```

---

✅ **Line 47** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 57** (high confidence)

**Before:**
```
if (!checklist || checklist.tenantId !== user.tenantId) {
```

**After:**
```
if (!checklist || checklist.tenant_id !== user.tenant_id) {
```

---

✅ **Line 86** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 96** (high confidence)

**Before:**
```
if (!checklist || checklist.tenantId !== user.tenantId) {
```

**After:**
```
if (!checklist || checklist.tenant_id !== user.tenant_id) {
```

---

⚠️ **Line 140** (medium confidence)

**Before:**
```
<p>Created: ${new Date(checklist.createdAt).toLocaleDateString()}</p>
```

**After:**
```
<p>Created: ${new Date(checklist.created_at).toLocaleDateString()}</p>
```

---

⚠️ **Line 202** (medium confidence)

**Before:**
```
<p><strong>Last Updated:</strong> ${new Date(checklist.updatedAt).toLocaleDateString()}</p>
```

**After:**
```
<p><strong>Last Updated:</strong> ${new Date(checklist.updated_at).toLocaleDateString()}</p>
```

---

⚠️ **Line 218** (medium confidence)

**Before:**
```
createdAt: checklist.createdAt,
```

**After:**
```
createdAt: checklist.created_at,
```

---

⚠️ **Line 265** (medium confidence)

**Before:**
```
new Date(checklist.createdAt).toLocaleDateString(),
```

**After:**
```
new Date(checklist.created_at).toLocaleDateString(),
```

---

### `server\routes-esignature.ts`

✅ **Line 15** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 121** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 188** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 216** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, businessRecordId)))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.id, businessRecordId)))
```

---

✅ **Line 310** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 360** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-erp-integration.ts`

✅ **Line 20** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 688** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 721** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-equipment-qr.ts`

✅ **Line 23** (high confidence)

**Before:**
```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

**After:**
```
where: and(eq(equipment.id, id), eq(equipment.tenant_id, tenantId)),
```

---

✅ **Line 57** (high confidence)

**Before:**
```
where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
```

**After:**
```
where: and(eq(equipment.id, id), eq(equipment.tenant_id, tenantId)),
```

---

✅ **Line 189** (high confidence)

**Before:**
```
eq(equipment.tenantId, tenantId),
```

**After:**
```
eq(equipment.tenant_id, tenantId),
```

---

### `server\routes-equipment-lifecycle-state-machine.ts`

⚠️ **Line 23** (medium confidence)

**Before:**
```
reqAny.session?.userId ||
```

**After:**
```
reqAny.session?.user_id ||
```

---

✅ **Line 55** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 121** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 160** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 180** (high confidence)

**Before:**
```
eq(equipmentLifecycle.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycle.tenant_id, tenantId),
```

---

✅ **Line 244** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 264** (high confidence)

**Before:**
```
eq(equipmentLifecycle.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycle.tenant_id, tenantId),
```

---

✅ **Line 325** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 399** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

### `server\routes-equipment-disposal.ts`

⚠️ **Line 25** (medium confidence)

**Before:**
```
reqAny.session?.userId ||
```

**After:**
```
reqAny.session?.user_id ||
```

---

✅ **Line 68** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 103** (high confidence)

**Before:**
```
eq(equipmentLifecycle.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycle.tenant_id, tenantId),
```

---

✅ **Line 172** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 183** (high confidence)

**Before:**
```
let query = db.select().from(equipmentDisposal).where(eq(equipmentDisposal.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(equipmentDisposal).where(eq(equipmentDisposal.tenant_id, tenantId));
```

---

✅ **Line 217** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 229** (high confidence)

**Before:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));
```

---

✅ **Line 262** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 299** (high confidence)

**Before:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)))
```

---

✅ **Line 332** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 345** (high confidence)

**Before:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));
```

---

✅ **Line 363** (high confidence)

**Before:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));
```

---

### `server\routes-enhanced-tasks.ts`

✅ **Line 14** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 47** (medium confidence)

**Before:**
```
createdAt: tasks.createdAt,
```

**After:**
```
createdAt: tasks.created_at,
```

---

⚠️ **Line 48** (medium confidence)

**Before:**
```
updatedAt: tasks.updatedAt,
```

**After:**
```
updatedAt: tasks.updated_at,
```

---

✅ **Line 65** (high confidence)

**Before:**
```
.where(eq(tasks.tenantId, tenantId));
```

**After:**
```
.where(eq(tasks.tenant_id, tenantId));
```

---

⚠️ **Line 81** (medium confidence)

**Before:**
```
const allTasks = await query.orderBy(desc(tasks.updatedAt));
```

**After:**
```
const allTasks = await query.orderBy(desc(tasks.updated_at));
```

---

✅ **Line 114** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 133** (medium confidence)

**Before:**
```
createdAt: projects.createdAt,
```

**After:**
```
createdAt: projects.created_at,
```

---

✅ **Line 145** (high confidence)

**Before:**
```
.where(eq(projects.tenantId, tenantId))
```

**After:**
```
.where(eq(projects.tenant_id, tenantId))
```

---

⚠️ **Line 162** (medium confidence)

**Before:**
```
projects.createdAt,
```

**After:**
```
projects.created_at,
```

---

⚠️ **Line 166** (medium confidence)

**Before:**
```
.orderBy(desc(projects.updatedAt));
```

**After:**
```
.orderBy(desc(projects.updated_at));
```

---

✅ **Line 178** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 189** (high confidence)

**Before:**
```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

**After:**
```
.where(and(eq(users.tenant_id, tenantId), eq(users.isActive, true)))
```

---

✅ **Line 202** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 235** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 252** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)))
```

---

✅ **Line 274** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 295** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 307** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 330** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 342** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 357** (high confidence)

**Before:**
```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenantId, tenantId)))
```

**After:**
```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenant_id, tenantId)))
```

---

✅ **Line 370** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 377** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 386** (high confidence)

**Before:**
```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 389** (high confidence)

**Before:**
```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

### `server\routes-enhanced-service.ts`

✅ **Line 40** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 119** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 177** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 282** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.type, 'customer')));
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.type, 'customer')));
```

---

✅ **Line 313** (high confidence)

**Before:**
```
let where = and(eq(phoneInTickets.tenantId, tenantId));
```

**After:**
```
let where = and(eq(phoneInTickets.tenant_id, tenantId));
```

---

✅ **Line 323** (high confidence)

**Before:**
```
tenantId: phoneInTickets.tenantId,
```

**After:**
```
tenantId: phoneInTickets.tenant_id,
```

---

⚠️ **Line 344** (medium confidence)

**Before:**
```
createdAt: phoneInTickets.createdAt,
```

**After:**
```
createdAt: phoneInTickets.created_at,
```

---

⚠️ **Line 345** (medium confidence)

**Before:**
```
updatedAt: phoneInTickets.updatedAt,
```

**After:**
```
updatedAt: phoneInTickets.updated_at,
```

---

⚠️ **Line 349** (medium confidence)

**Before:**
```
.orderBy(desc(phoneInTickets.createdAt))
```

**After:**
```
.orderBy(desc(phoneInTickets.created_at))
```

---

✅ **Line 565** (high confidence)

**Before:**
```
eq(ticketPartsRequests.tenantId, tenantId),
```

**After:**
```
eq(ticketPartsRequests.tenant_id, tenantId),
```

---

⚠️ **Line 569** (medium confidence)

**Before:**
```
.orderBy(desc(ticketPartsRequests.createdAt));
```

**After:**
```
.orderBy(desc(ticketPartsRequests.created_at));
```

---

✅ **Line 629** (high confidence)

**Before:**
```
tenantId: serviceTickets.tenantId,
```

**After:**
```
tenantId: serviceTickets.tenant_id,
```

---

✅ **Line 637** (high confidence)

**Before:**
```
await billingEngine.autoGenerateFromServiceTicket(ticketId, ticket.tenantId);
```

**After:**
```
await billingEngine.autoGenerateFromServiceTicket(ticketId, ticket.tenant_id);
```

---

✅ **Line 661** (high confidence)

**Before:**
```
.where(and(eq(workflowSteps.tenantId, tenantId), eq(workflowSteps.sessionId, sessionId)))
```

**After:**
```
.where(and(eq(workflowSteps.tenant_id, tenantId), eq(workflowSteps.sessionId, sessionId)))
```

---

✅ **Line 692** (high confidence)

**Before:**
```
eq(customers.tenantId, tenantId),
```

**After:**
```
eq(customers.tenant_id, tenantId),
```

---

✅ **Line 769** (high confidence)

**Before:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenant_id, tenantId)))
```

---

⚠️ **Line 826** (medium confidence)

**Before:**
```
sql`CONCAT('SN', LPAD(CAST(EXTRACT(epoch FROM ${serviceTickets.createdAt}) AS TEXT), 8, '0'))`.as(
```

**After:**
```
sql`CONCAT('SN', LPAD(CAST(EXTRACT(epoch FROM ${serviceTickets.created_at}) AS TEXT), 8, '0'))`.as(
```

---

✅ **Line 831** (high confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.customerId, companyId)))
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), eq(serviceTickets.customerId, companyId)))
```

---

✅ **Line 857** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, companyId)))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.id, companyId)))
```

---

### `server\routes-enhanced-rbac.ts`

✅ **Line 43** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 48** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 61** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 92** (high confidence)

**Before:**
```
.where(eq(enhancedRoles.tenantId, tenantId));
```

**After:**
```
.where(eq(enhancedRoles.tenant_id, tenantId));
```

---

✅ **Line 99** (high confidence)

**Before:**
```
.where(eq(organizationalUnits.tenantId, tenantId));
```

**After:**
```
.where(eq(organizationalUnits.tenant_id, tenantId));
```

---

✅ **Line 190** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 225** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 313** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 379** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 468** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 571** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 572** (medium confidence)

**Before:**
```
const targetUserId = req.params.userId;
```

**After:**
```
const targetUserId = req.params.user_id;
```

---

⚠️ **Line 592** (medium confidence)

**Before:**
```
eq(userRoleAssignments.userId, targetUserId),
```

**After:**
```
eq(userRoleAssignments.user_id, targetUserId),
```

---

✅ **Line 593** (high confidence)

**Before:**
```
eq(userRoleAssignments.tenantId, tenantId),
```

**After:**
```
eq(userRoleAssignments.tenant_id, tenantId),
```

---

✅ **Line 613** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 614** (medium confidence)

**Before:**
```
const targetUserId = req.params.userId;
```

**After:**
```
const targetUserId = req.params.user_id;
```

---

✅ **Line 658** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 697** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 736** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-email-parser.ts`

⚠️ **Line 57** (medium confidence)

**Before:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
```

**After:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.user_id;
```

---

✅ **Line 69** (high confidence)

**Before:**
```
where: eq(emailMonitorConfig.tenantId, tenantId),
```

**After:**
```
where: eq(emailMonitorConfig.tenant_id, tenantId),
```

---

✅ **Line 132** (high confidence)

**Before:**
```
where: eq(emailMonitorConfig.tenantId, tenantId),
```

**After:**
```
where: eq(emailMonitorConfig.tenant_id, tenantId),
```

---

✅ **Line 155** (high confidence)

**Before:**
```
.where(eq(emailMonitorConfig.tenantId, tenantId))
```

**After:**
```
.where(eq(emailMonitorConfig.tenant_id, tenantId))
```

---

✅ **Line 256** (high confidence)

**Before:**
```
let whereConditions: any = eq(processedEmails.tenantId, tenantId);
```

**After:**
```
let whereConditions: any = eq(processedEmails.tenant_id, tenantId);
```

---

✅ **Line 301** (high confidence)

**Before:**
```
where: eq(emailMonitorConfig.tenantId, tenantId),
```

**After:**
```
where: eq(emailMonitorConfig.tenant_id, tenantId),
```

---

✅ **Line 325** (high confidence)

**Before:**
```
eq(processedEmails.tenantId, tenantId),
```

**After:**
```
eq(processedEmails.tenant_id, tenantId),
```

---

✅ **Line 414** (high confidence)

**Before:**
```
.where(eq(emailMonitorConfig.tenantId, tenantId));
```

**After:**
```
.where(eq(emailMonitorConfig.tenant_id, tenantId));
```

---

✅ **Line 436** (high confidence)

**Before:**
```
.where(eq(emailMonitorConfig.tenantId, tenantId));
```

**After:**
```
.where(eq(emailMonitorConfig.tenant_id, tenantId));
```

---

### `server\routes-dod-enforcement.ts`

✅ **Line 31** (high confidence)

**Before:**
```
.where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)))
```

**After:**
```
.where(and(eq(quotes.tenant_id, tenantId), eq(quotes.id, quoteId)))
```

---

✅ **Line 63** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, quote.customerId)),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.id, quote.customerId)),
```

---

✅ **Line 108** (high confidence)

**Before:**
```
.where(and(eq(proposals.tenantId, tenantId), eq(proposals.id, proposalId)))
```

**After:**
```
.where(and(eq(proposals.tenant_id, tenantId), eq(proposals.id, proposalId)))
```

---

✅ **Line 172** (high confidence)

**Before:**
```
.where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, poId)))
```

**After:**
```
.where(and(eq(purchaseOrders.tenant_id, tenantId), eq(purchaseOrders.id, poId)))
```

---

✅ **Line 238** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, tenantId),
```

---

### `server\routes-documents.ts`

✅ **Line 24** (high confidence)

**Before:**
```
req.tenantId = tenantId;
```

**After:**
```
req.tenant_id = tenantId;
```

---

✅ **Line 34** (high confidence)

**Before:**
```
.where(eq(documents.tenantId, req.tenantId))
```

**After:**
```
.where(eq(documents.tenant_id, req.tenant_id))
```

---

⚠️ **Line 35** (medium confidence)

**Before:**
```
.orderBy(documents.createdAt);
```

**After:**
```
.orderBy(documents.created_at);
```

---

✅ **Line 51** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 73** (high confidence)

**Before:**
```
.where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.tenantId)));
```

**After:**
```
.where(and(eq(documents.id, req.params.id), eq(documents.tenant_id, req.tenant_id)));
```

---

✅ **Line 92** (high confidence)

**Before:**
```
.where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.tenantId)));
```

**After:**
```
.where(and(eq(documents.id, req.params.id), eq(documents.tenant_id, req.tenant_id)));
```

---

### `server\routes-document-management.ts`

✅ **Line 23** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 257** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 553** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 723** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 760** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-document-automation.ts`

⚠️ **Line 29** (medium confidence)

**Before:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
```

**After:**
```
return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.user_id;
```

---

✅ **Line 68** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 72** (high confidence)

**Before:**
```
and(or(eq(t.tenantId, tenantId), eq(t.isPublic, true)), eq(t.isActive, true)),
```

**After:**
```
and(or(eq(t.tenant_id, tenantId), eq(t.isPublic, true)), eq(t.isActive, true)),
```

---

⚠️ **Line 73** (medium confidence)

**Before:**
```
orderBy: (t, { desc }) => [desc(t.createdAt)],
```

**After:**
```
orderBy: (t, { desc }) => [desc(t.created_at)],
```

---

✅ **Line 86** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 91** (high confidence)

**Before:**
```
and(eq(t.id, parseInt(id)), or(eq(t.tenantId, tenantId), eq(t.isPublic, true))),
```

**After:**
```
and(eq(t.id, parseInt(id)), or(eq(t.tenant_id, tenantId), eq(t.isPublic, true))),
```

---

✅ **Line 108** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 129** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 133** (high confidence)

**Before:**
```
where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenantId, tenantId)),
```

**After:**
```
where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenant_id, tenantId)),
```

---

✅ **Line 159** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 163** (high confidence)

**Before:**
```
where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenantId, tenantId)),
```

**After:**
```
where: (t, { eq, and }) => and(eq(t.id, parseInt(id)), eq(t.tenant_id, tenantId)),
```

---

✅ **Line 185** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 209** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 263** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 293** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

⚠️ **Line 310** (medium confidence)

**Before:**
```
orderBy: (d, { desc }) => [desc(d.createdAt)],
```

**After:**
```
orderBy: (d, { desc }) => [desc(d.created_at)],
```

---

✅ **Line 323** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 327** (high confidence)

**Before:**
```
where: (d, { eq, and }) => and(eq(d.id, parseInt(id)), eq(d.tenantId, tenantId)),
```

**After:**
```
where: (d, { eq, and }) => and(eq(d.id, parseInt(id)), eq(d.tenant_id, tenantId)),
```

---

✅ **Line 362** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 401** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 405** (high confidence)

**Before:**
```
where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenantId, tenantId)),
```

**After:**
```
where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenant_id, tenantId)),
```

---

✅ **Line 422** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 425** (high confidence)

**Before:**
```
where: (u, { eq }) => eq(u.tenantId, tenantId),
```

**After:**
```
where: (u, { eq }) => eq(u.tenant_id, tenantId),
```

---

⚠️ **Line 426** (medium confidence)

**Before:**
```
orderBy: (u, { desc }) => [desc(u.createdAt)],
```

**After:**
```
orderBy: (u, { desc }) => [desc(u.created_at)],
```

---

✅ **Line 439** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 445** (high confidence)

**Before:**
```
where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenantId, tenantId)),
```

**After:**
```
where: (u, { eq, and }) => and(eq(u.id, parseInt(id)), eq(u.tenant_id, tenantId)),
```

---

✅ **Line 476** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 479** (high confidence)

**Before:**
```
where: (m, { eq, and }) => and(eq(m.tenantId, tenantId), eq(m.isActive, true)),
```

**After:**
```
where: (m, { eq, and }) => and(eq(m.tenant_id, tenantId), eq(m.isActive, true)),
```

---

⚠️ **Line 480** (medium confidence)

**Before:**
```
orderBy: (m, { desc }) => [desc(m.createdAt)],
```

**After:**
```
orderBy: (m, { desc }) => [desc(m.created_at)],
```

---

✅ **Line 493** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

### `server\routes-device-monitoring.ts`

✅ **Line 29** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 33** (high confidence)

**Before:**
```
where: eq(clientCollectedMetrics.tenantId, tenantId),
```

**After:**
```
where: eq(clientCollectedMetrics.tenant_id, tenantId),
```

---

✅ **Line 55** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 60** (high confidence)

**Before:**
```
eq(clientCollectedMetrics.tenantId, tenantId),
```

**After:**
```
eq(clientCollectedMetrics.tenant_id, tenantId),
```

---

✅ **Line 80** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 83** (high confidence)

**Before:**
```
where: and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.status, 'active')),
```

**After:**
```
where: and(eq(tonerAlerts.tenant_id, tenantId), eq(tonerAlerts.status, 'active')),
```

---

⚠️ **Line 84** (medium confidence)

**Before:**
```
orderBy: [desc(tonerAlerts.createdAt)],
```

**After:**
```
orderBy: [desc(tonerAlerts.created_at)],
```

---

✅ **Line 104** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 108** (high confidence)

**Before:**
```
? and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.serialNumber, serialNumber))
```

**After:**
```
? and(eq(tonerAlerts.tenant_id, tenantId), eq(tonerAlerts.serialNumber, serialNumber))
```

---

✅ **Line 110** (high confidence)

**Before:**
```
eq(tonerAlerts.tenantId, tenantId),
```

**After:**
```
eq(tonerAlerts.tenant_id, tenantId),
```

---

⚠️ **Line 117** (medium confidence)

**Before:**
```
orderBy: [desc(tonerAlerts.createdAt)],
```

**After:**
```
orderBy: [desc(tonerAlerts.created_at)],
```

---

✅ **Line 138** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 143** (high confidence)

**Before:**
```
where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenantId, tenantId)),
```

**After:**
```
where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenant_id, tenantId)),
```

---

✅ **Line 179** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 183** (high confidence)

**Before:**
```
where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenantId, tenantId)),
```

**After:**
```
where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenant_id, tenantId)),
```

---

✅ **Line 213** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 223** (high confidence)

**Before:**
```
.where(eq(clientCollectedMetrics.tenantId, tenantId));
```

**After:**
```
.where(eq(clientCollectedMetrics.tenant_id, tenantId));
```

---

✅ **Line 231** (high confidence)

**Before:**
```
.where(and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.status, 'active')));
```

**After:**
```
.where(and(eq(tonerAlerts.tenant_id, tenantId), eq(tonerAlerts.status, 'active')));
```

---

### `server\routes-demo-scheduling.ts`

✅ **Line 17** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 23** (high confidence)

**Before:**
```
.where(eq(demoSchedules.tenantId, tenantId))
```

**After:**
```
.where(eq(demoSchedules.tenant_id, tenantId))
```

---

✅ **Line 79** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 99** (high confidence)

**Before:**
```
and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
```

**After:**
```
and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'customer')),
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 298** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-deals-management.ts`

✅ **Line 49** (high confidence)

**Before:**
```
const tenantId = req.user!.tenantId;
```

**After:**
```
const tenantId = req.user!.tenant_id;
```

---

✅ **Line 60** (high confidence)

**Before:**
```
? and(eq(deals.tenantId, tenantId), scopeFilter)
```

**After:**
```
? and(eq(deals.tenant_id, tenantId), scopeFilter)
```

---

✅ **Line 61** (high confidence)

**Before:**
```
: eq(deals.tenantId, tenantId);
```

**After:**
```
: eq(deals.tenant_id, tenantId);
```

---

⚠️ **Line 78** (medium confidence)

**Before:**
```
createdAt: deals.createdAt,
```

**After:**
```
createdAt: deals.created_at,
```

---

⚠️ **Line 79** (medium confidence)

**Before:**
```
updatedAt: deals.updatedAt,
```

**After:**
```
updatedAt: deals.updated_at,
```

---

⚠️ **Line 85** (medium confidence)

**Before:**
```
.orderBy(desc(deals.createdAt));
```

**After:**
```
.orderBy(desc(deals.created_at));
```

---

✅ **Line 98** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 116** (medium confidence)

**Before:**
```
createdAt: deals.createdAt,
```

**After:**
```
createdAt: deals.created_at,
```

---

⚠️ **Line 117** (medium confidence)

**Before:**
```
updatedAt: deals.updatedAt,
```

**After:**
```
updatedAt: deals.updated_at,
```

---

✅ **Line 122** (high confidence)

**Before:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenant_id, tenantId)));
```

---

✅ **Line 132** (high confidence)

**Before:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenant_id, tenantId)))
```

---

⚠️ **Line 133** (medium confidence)

**Before:**
```
.orderBy(desc(dealActivities.createdAt));
```

**After:**
```
.orderBy(desc(dealActivities.created_at));
```

---

✅ **Line 145** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 183** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 195** (high confidence)

**Before:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenant_id, tenantId)))
```

---

✅ **Line 215** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 221** (high confidence)

**Before:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenant_id, tenantId)));
```

---

✅ **Line 226** (high confidence)

**Before:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(deals.id, dealId), eq(deals.tenant_id, tenantId)))
```

---

✅ **Line 243** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 248** (high confidence)

**Before:**
```
.where(eq(dealStages.tenantId, tenantId))
```

**After:**
```
.where(eq(dealStages.tenant_id, tenantId))
```

---

✅ **Line 261** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 280** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 293** (medium confidence)

**Before:**
```
createdAt: dealActivities.createdAt,
```

**After:**
```
createdAt: dealActivities.created_at,
```

---

✅ **Line 297** (high confidence)

**Before:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenant_id, tenantId)))
```

---

⚠️ **Line 298** (medium confidence)

**Before:**
```
.orderBy(desc(dealActivities.createdAt));
```

**After:**
```
.orderBy(desc(dealActivities.created_at));
```

---

✅ **Line 310** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 333** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 339** (high confidence)

**Before:**
```
.where(eq(deals.tenantId, tenantId));
```

**After:**
```
.where(eq(deals.tenant_id, tenantId));
```

---

✅ **Line 344** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'active')));
```

**After:**
```
.where(and(eq(deals.tenant_id, tenantId), eq(deals.status, 'active')));
```

---

✅ **Line 352** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'won')));
```

**After:**
```
.where(and(eq(deals.tenant_id, tenantId), eq(deals.status, 'won')));
```

---

✅ **Line 357** (high confidence)

**Before:**
```
.where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'lost')));
```

**After:**
```
.where(and(eq(deals.tenant_id, tenantId), eq(deals.status, 'lost')));
```

---

### `server\routes-deal-desk.ts`

✅ **Line 50** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 55** (high confidence)

**Before:**
```
.where(eq(approvalRules.tenantId, tenantId))
```

**After:**
```
.where(eq(approvalRules.tenant_id, tenantId))
```

---

✅ **Line 73** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 98** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 107** (high confidence)

**Before:**
```
.where(and(eq(approvalRules.id, id), eq(approvalRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(approvalRules.id, id), eq(approvalRules.tenant_id, tenantId)))
```

---

✅ **Line 124** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 129** (high confidence)

**Before:**
```
.where(and(eq(approvalRules.id, id), eq(approvalRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(approvalRules.id, id), eq(approvalRules.tenant_id, tenantId)))
```

---

✅ **Line 148** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 163** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 203** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 206** (high confidence)

**Before:**
```
let conditions = [eq(approvalRequests.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(approvalRequests.tenant_id, tenantId)];
```

---

✅ **Line 237** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 255** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 261** (high confidence)

**Before:**
```
.where(and(eq(approvalRequests.id, id), eq(approvalRequests.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(approvalRequests.id, id), eq(approvalRequests.tenant_id, tenantId)));
```

---

⚠️ **Line 286** (medium confidence)

**Before:**
```
.orderBy(approvalComments.createdAt);
```

**After:**
```
.orderBy(approvalComments.created_at);
```

---

✅ **Line 328** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 364** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 379** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

✅ **Line 390** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

✅ **Line 405** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

✅ **Line 416** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

✅ **Line 435** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

✅ **Line 471** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 474** (high confidence)

**Before:**
```
let conditions = [eq(discountAnalytics.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(discountAnalytics.tenant_id, tenantId)];
```

---

✅ **Line 506** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 514** (high confidence)

**Before:**
```
eq(approvalDelegations.tenantId, tenantId),
```

**After:**
```
eq(approvalDelegations.tenant_id, tenantId),
```

---

⚠️ **Line 521** (medium confidence)

**Before:**
```
.orderBy(desc(approvalDelegations.createdAt));
```

**After:**
```
.orderBy(desc(approvalDelegations.created_at));
```

---

✅ **Line 533** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 558** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 571** (high confidence)

**Before:**
```
eq(approvalDelegations.tenantId, tenantId),
```

**After:**
```
eq(approvalDelegations.tenant_id, tenantId),
```

---

### `server\routes-data-enrichment.ts`

✅ **Line 117** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 120** (high confidence)

**Before:**
```
let query = db.select().from(enrichedContacts).where(eq(enrichedContacts.tenantId, tenantId));
```

**After:**
```
let query = db.select().from(enrichedContacts).where(eq(enrichedContacts.tenant_id, tenantId));
```

---

✅ **Line 123** (high confidence)

**Before:**
```
const conditions = [eq(enrichedContacts.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(enrichedContacts.tenant_id, tenantId)];
```

---

✅ **Line 234** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 240** (high confidence)

**Before:**
```
.where(and(eq(enrichedContacts.id, id), eq(enrichedContacts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(enrichedContacts.id, id), eq(enrichedContacts.tenant_id, tenantId)))
```

---

✅ **Line 257** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 275** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 282** (high confidence)

**Before:**
```
.where(and(eq(enrichedContacts.id, id), eq(enrichedContacts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(enrichedContacts.id, id), eq(enrichedContacts.tenant_id, tenantId)))
```

---

✅ **Line 303** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 306** (high confidence)

**Before:**
```
const conditions = [eq(enrichedCompanies.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(enrichedCompanies.tenant_id, tenantId)];
```

---

✅ **Line 390** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 396** (high confidence)

**Before:**
```
.where(and(eq(enrichedCompanies.id, id), eq(enrichedCompanies.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(enrichedCompanies.id, id), eq(enrichedCompanies.tenant_id, tenantId)))
```

---

✅ **Line 413** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 435** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 438** (high confidence)

**Before:**
```
let whereConditions = [eq(enrichedIntentData.tenantId, tenantId)];
```

**After:**
```
let whereConditions = [eq(enrichedIntentData.tenant_id, tenantId)];
```

---

✅ **Line 473** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 476** (high confidence)

**Before:**
```
let whereConditions = [eq(prospectingCampaigns.tenantId, tenantId)];
```

**After:**
```
let whereConditions = [eq(prospectingCampaigns.tenant_id, tenantId)];
```

---

⚠️ **Line 486** (medium confidence)

**Before:**
```
.orderBy(desc(prospectingCampaigns.createdAt));
```

**After:**
```
.orderBy(desc(prospectingCampaigns.created_at));
```

---

✅ **Line 498** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 526** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 585** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 645** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 654** (high confidence)

**Before:**
```
.where(eq(enrichedContacts.tenantId, tenantId))
```

**After:**
```
.where(eq(enrichedContacts.tenant_id, tenantId))
```

---

✅ **Line 664** (high confidence)

**Before:**
```
.where(eq(enrichedContacts.tenantId, tenantId))
```

**After:**
```
.where(eq(enrichedContacts.tenant_id, tenantId))
```

---

✅ **Line 674** (high confidence)

**Before:**
```
.where(eq(enrichedContacts.tenantId, tenantId))
```

**After:**
```
.where(eq(enrichedContacts.tenant_id, tenantId))
```

---

✅ **Line 684** (high confidence)

**Before:**
```
.where(eq(enrichedCompanies.tenantId, tenantId))
```

**After:**
```
.where(eq(enrichedCompanies.tenant_id, tenantId))
```

---

### `server\routes-dashboard-layouts.ts`

✅ **Line 49** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 62** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 63** (medium confidence)

**Before:**
```
eq(dashboardLayouts.userId, userId),
```

**After:**
```
eq(dashboardLayouts.user_id, userId),
```

---

⚠️ **Line 85** (medium confidence)

**Before:**
```
createdAt: layout.createdAt,
```

**After:**
```
createdAt: layout.created_at,
```

---

⚠️ **Line 86** (medium confidence)

**Before:**
```
updatedAt: layout.updatedAt,
```

**After:**
```
updatedAt: layout.updated_at,
```

---

✅ **Line 103** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 118** (medium confidence)

**Before:**
```
createdAt: dashboardLayouts.createdAt,
```

**After:**
```
createdAt: dashboardLayouts.created_at,
```

---

⚠️ **Line 119** (medium confidence)

**Before:**
```
updatedAt: dashboardLayouts.updatedAt,
```

**After:**
```
updatedAt: dashboardLayouts.updated_at,
```

---

✅ **Line 124** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 126** (medium confidence)

**Before:**
```
or(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.isPublic, true)),
```

**After:**
```
or(eq(dashboardLayouts.user_id, userId), eq(dashboardLayouts.isPublic, true)),
```

---

⚠️ **Line 129** (medium confidence)

**Before:**
```
.orderBy(desc(dashboardLayouts.isDefault), desc(dashboardLayouts.updatedAt));
```

**After:**
```
.orderBy(desc(dashboardLayouts.isDefault), desc(dashboardLayouts.updated_at));
```

---

✅ **Line 147** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 167** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 168** (medium confidence)

**Before:**
```
eq(dashboardLayouts.userId, userId),
```

**After:**
```
eq(dashboardLayouts.user_id, userId),
```

---

✅ **Line 180** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 181** (medium confidence)

**Before:**
```
eq(dashboardLayouts.userId, userId),
```

**After:**
```
eq(dashboardLayouts.user_id, userId),
```

---

✅ **Line 239** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 254** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 255** (medium confidence)

**Before:**
```
eq(dashboardLayouts.userId, userId),
```

**After:**
```
eq(dashboardLayouts.user_id, userId),
```

---

✅ **Line 282** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 300** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 318** (high confidence)

**Before:**
```
eq(opportunities.tenantId, tenantId),
```

**After:**
```
eq(opportunities.tenant_id, tenantId),
```

---

✅ **Line 368** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 382** (high confidence)

**Before:**
```
.where(eq(opportunities.tenantId, tenantId))
```

**After:**
```
.where(eq(opportunities.tenant_id, tenantId))
```

---

✅ **Line 415** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

### `server\routes-dashboard-customization.ts`

✅ **Line 85** (high confidence)

**Before:**
```
eq(dashboardLayouts.tenantId, tenantId),
```

**After:**
```
eq(dashboardLayouts.tenant_id, tenantId),
```

---

⚠️ **Line 86** (medium confidence)

**Before:**
```
or(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.roleId, roleId || '')),
```

**After:**
```
or(eq(dashboardLayouts.user_id, userId), eq(dashboardLayouts.roleId, roleId || '')),
```

---

✅ **Line 113** (high confidence)

**Before:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenant_id, tenantId)))
```

---

⚠️ **Line 187** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

✅ **Line 193** (high confidence)

**Before:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenant_id, tenantId)))
```

---

✅ **Line 224** (high confidence)

**Before:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(dashboardLayouts.id, layoutId), eq(dashboardLayouts.tenant_id, tenantId)));
```

---

⚠️ **Line 251** (medium confidence)

**Before:**
```
eq(userDashboardPreferences.userId, userId),
```

**After:**
```
eq(userDashboardPreferences.user_id, userId),
```

---

✅ **Line 252** (high confidence)

**Before:**
```
eq(userDashboardPreferences.tenantId, tenantId),
```

**After:**
```
eq(userDashboardPreferences.tenant_id, tenantId),
```

---

⚠️ **Line 306** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

⚠️ **Line 313** (medium confidence)

**Before:**
```
eq(userDashboardPreferences.userId, userId),
```

**After:**
```
eq(userDashboardPreferences.user_id, userId),
```

---

✅ **Line 314** (high confidence)

**Before:**
```
eq(userDashboardPreferences.tenantId, tenantId),
```

**After:**
```
eq(userDashboardPreferences.tenant_id, tenantId),
```

---

⚠️ **Line 388** (medium confidence)

**Before:**
```
.where(and(eq(dashboardSnapshots.layoutId, layoutId), eq(dashboardSnapshots.userId, userId)));
```

**After:**
```
.where(and(eq(dashboardSnapshots.layoutId, layoutId), eq(dashboardSnapshots.user_id, userId)));
```

---

### `server\routes-customer-success.ts`

✅ **Line 28** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 282** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 516** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 680** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-customer-portal.ts`

✅ **Line 71** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 76** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 141** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 155** (high confidence)

**Before:**
```
db.select().from(customerPortalAccess).where(eq(customerPortalAccess.tenantId, tenantId)),
```

**After:**
```
db.select().from(customerPortalAccess).where(eq(customerPortalAccess.tenant_id, tenantId)),
```

---

✅ **Line 159** (high confidence)

**Before:**
```
.where(eq(customerServiceRequests.tenantId, tenantId)),
```

**After:**
```
.where(eq(customerServiceRequests.tenant_id, tenantId)),
```

---

✅ **Line 163** (high confidence)

**Before:**
```
.where(eq(customerMeterSubmissions.tenantId, tenantId)),
```

**After:**
```
.where(eq(customerMeterSubmissions.tenant_id, tenantId)),
```

---

✅ **Line 164** (high confidence)

**Before:**
```
db.select().from(customerSupplyOrders).where(eq(customerSupplyOrders.tenantId, tenantId)),
```

**After:**
```
db.select().from(customerSupplyOrders).where(eq(customerSupplyOrders.tenant_id, tenantId)),
```

---

✅ **Line 165** (high confidence)

**Before:**
```
db.select().from(customerPayments).where(eq(customerPayments.tenantId, tenantId)),
```

**After:**
```
db.select().from(customerPayments).where(eq(customerPayments.tenant_id, tenantId)),
```

---

✅ **Line 166** (high confidence)

**Before:**
```
db.select().from(customerNotifications).where(eq(customerNotifications.tenantId, tenantId)),
```

**After:**
```
db.select().from(customerNotifications).where(eq(customerNotifications.tenant_id, tenantId)),
```

---

✅ **Line 198** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 206** (high confidence)

**Before:**
```
.where(eq(customerPortalAccess.tenantId, tenantId))
```

**After:**
```
.where(eq(customerPortalAccess.tenant_id, tenantId))
```

---

⚠️ **Line 207** (medium confidence)

**Before:**
```
.orderBy(desc(customerPortalAccess.createdAt));
```

**After:**
```
.orderBy(desc(customerPortalAccess.created_at));
```

---

✅ **Line 223** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 233** (high confidence)

**Before:**
```
.where(eq(customerServiceRequests.tenantId, tenantId))
```

**After:**
```
.where(eq(customerServiceRequests.tenant_id, tenantId))
```

---

✅ **Line 251** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 261** (high confidence)

**Before:**
```
.where(eq(customerMeterSubmissions.tenantId, tenantId))
```

**After:**
```
.where(eq(customerMeterSubmissions.tenant_id, tenantId))
```

---

✅ **Line 279** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 342** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 415** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 474** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 534** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 605** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 659** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 702** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 748** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 791** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 836** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 905** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 964** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1017** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1067** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1108** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1155** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1192** (high confidence)

**Before:**
```
eq(customerSatisfactionSurveys.tenantId, tenantId),
```

**After:**
```
eq(customerSatisfactionSurveys.tenant_id, tenantId),
```

---

⚠️ **Line 1196** (medium confidence)

**Before:**
```
.orderBy(desc(customerSatisfactionSurveys.createdAt));
```

**After:**
```
.orderBy(desc(customerSatisfactionSurveys.created_at));
```

---

✅ **Line 1216** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1234** (high confidence)

**Before:**
```
eq(customerSatisfactionSurveys.tenantId, tenantId),
```

**After:**
```
eq(customerSatisfactionSurveys.tenant_id, tenantId),
```

---

✅ **Line 1305** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1323** (high confidence)

**Before:**
```
eq(customerSatisfactionSurveys.tenantId, tenantId),
```

**After:**
```
eq(customerSatisfactionSurveys.tenant_id, tenantId),
```

---

✅ **Line 1389** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1415** (high confidence)

**Before:**
```
eq(customerSatisfactionSurveys.tenantId, tenantId),
```

**After:**
```
eq(customerSatisfactionSurveys.tenant_id, tenantId),
```

---

✅ **Line 1563** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 1626** (high confidence)

**Before:**
```
eq(customerSatisfactionSurveys.tenantId, tenantId),
```

**After:**
```
eq(customerSatisfactionSurveys.tenant_id, tenantId),
```

---

### `server\routes-customer-numbers.ts`

✅ **Line 21** (high confidence)

**Before:**
```
} else if (!req.user.id || !req.user.tenantId) {
```

**After:**
```
} else if (!req.user.id || !req.user.tenant_id) {
```

---

✅ **Line 25** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 53** (high confidence)

**Before:**
```
and(eq(customerNumberConfig.tenantId, tenantId), eq(customerNumberConfig.isActive, true)),
```

**After:**
```
and(eq(customerNumberConfig.tenant_id, tenantId), eq(customerNumberConfig.isActive, true)),
```

---

✅ **Line 117** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 140** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 147** (high confidence)

**Before:**
```
and(eq(customerNumberConfig.tenantId, tenantId), eq(customerNumberConfig.isActive, true)),
```

**After:**
```
and(eq(customerNumberConfig.tenant_id, tenantId), eq(customerNumberConfig.isActive, true)),
```

---

✅ **Line 174** (high confidence)

**Before:**
```
.where(eq(customerNumberConfig.tenantId, tenantId))
```

**After:**
```
.where(eq(customerNumberConfig.tenant_id, tenantId))
```

---

⚠️ **Line 175** (medium confidence)

**Before:**
```
.orderBy(desc(customerNumberConfig.createdAt));
```

**After:**
```
.orderBy(desc(customerNumberConfig.created_at));
```

---

✅ **Line 199** (high confidence)

**Before:**
```
.where(eq(customerNumberConfig.tenantId, tenantId));
```

**After:**
```
.where(eq(customerNumberConfig.tenant_id, tenantId));
```

---

✅ **Line 221** (high confidence)

**Before:**
```
.where(and(eq(customerNumberConfig.id, id), eq(customerNumberConfig.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(customerNumberConfig.id, id), eq(customerNumberConfig.tenant_id, tenantId)))
```

---

✅ **Line 233** (high confidence)

**Before:**
```
.where(and(eq(customerNumberConfig.tenantId, tenantId), ne(customerNumberConfig.id, id)));
```

**After:**
```
.where(and(eq(customerNumberConfig.tenant_id, tenantId), ne(customerNumberConfig.id, id)));
```

---

✅ **Line 285** (high confidence)

**Before:**
```
and(eq(customerNumberConfig.tenantId, tenantId), eq(customerNumberConfig.isActive, true)),
```

**After:**
```
and(eq(customerNumberConfig.tenant_id, tenantId), eq(customerNumberConfig.isActive, true)),
```

---

✅ **Line 345** (high confidence)

**Before:**
```
.where(eq(customerNumberHistory.tenantId, tenantId))
```

**After:**
```
.where(eq(customerNumberHistory.tenant_id, tenantId))
```

---

### `server\routes-custom-reports.ts`

✅ **Line 158** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 159** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

⚠️ **Line 176** (medium confidence)

**Before:**
```
createdAt: reportDefinitions.createdAt,
```

**After:**
```
createdAt: reportDefinitions.created_at,
```

---

⚠️ **Line 177** (medium confidence)

**Before:**
```
updatedAt: reportDefinitions.updatedAt,
```

**After:**
```
updatedAt: reportDefinitions.updated_at,
```

---

✅ **Line 182** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

⚠️ **Line 189** (medium confidence)

**Before:**
```
.orderBy(desc(reportDefinitions.updatedAt));
```

**After:**
```
.orderBy(desc(reportDefinitions.updated_at));
```

---

✅ **Line 207** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 258** (high confidence)

**Before:**
```
const conditions: any[] = [eq(table.tenantId, tenantId)];
```

**After:**
```
const conditions: any[] = [eq(table.tenant_id, tenantId)];
```

---

✅ **Line 322** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 323** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 408** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 409** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 423** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 486** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 487** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 500** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 526** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 527** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 539** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 568** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 569** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 583** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, tenantId),
```

---

✅ **Line 646** (high confidence)

**Before:**
```
const conditions: any[] = [eq(table.tenantId, tenantId)];
```

**After:**
```
const conditions: any[] = [eq(table.tenant_id, tenantId)];
```

---

### `server\routes-csv-import.ts`

✅ **Line 158** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

⚠️ **Line 159** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 255** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 283** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 334** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 378** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 421** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 455** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

⚠️ **Line 459** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 500** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

⚠️ **Line 504** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 546** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 586** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 693** (high confidence)

**Before:**
```
if (job.tenantId !== req.tenantId) {
```

**After:**
```
if (job.tenant_id !== req.tenant_id) {
```

---

✅ **Line 708** (high confidence)

**Before:**
```
req.tenantId!, // Pass tenantId for defense-in-depth isolation
```

**After:**
```
req.tenant_id!, // Pass tenantId for defense-in-depth isolation
```

---

### `server\routes-crm-goals.ts`

✅ **Line 80** (high confidence)

**Before:**
```
.where(eq(salesGoals.tenantId, req.user!.tenantId))
```

**After:**
```
.where(eq(salesGoals.tenant_id, req.user!.tenant_id))
```

---

⚠️ **Line 81** (medium confidence)

**Before:**
```
.orderBy(desc(salesGoals.createdAt));
```

**After:**
```
.orderBy(desc(salesGoals.created_at));
```

---

✅ **Line 95** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 130** (high confidence)

**Before:**
```
.where(eq(salesTeams.tenantId, req.user.tenantId))
```

**After:**
```
.where(eq(salesTeams.tenant_id, req.user.tenant_id))
```

---

✅ **Line 145** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 163** (medium confidence)

**Before:**
```
userId: salesTeamMembers.userId,
```

**After:**
```
userId: salesTeamMembers.user_id,
```

---

⚠️ **Line 172** (medium confidence)

**Before:**
```
.innerJoin(users, eq(salesTeamMembers.userId, users.id))
```

**After:**
```
.innerJoin(users, eq(salesTeamMembers.user_id, users.id))
```

---

✅ **Line 176** (high confidence)

**Before:**
```
eq(salesTeamMembers.tenantId, req.user.tenantId),
```

**After:**
```
eq(salesTeamMembers.tenant_id, req.user.tenant_id),
```

---

✅ **Line 193** (high confidence)

**Before:**
```
let whereConditions = [eq(activityReports.tenantId, req.user.tenantId)];
```

**After:**
```
let whereConditions = [eq(activityReports.tenant_id, req.user.tenant_id)];
```

---

⚠️ **Line 200** (medium confidence)

**Before:**
```
whereConditions.push(eq(activityReports.userId, userId as string));
```

**After:**
```
whereConditions.push(eq(activityReports.user_id, userId as string));
```

---

⚠️ **Line 218** (medium confidence)

**Before:**
```
userId: activityReports.userId,
```

**After:**
```
userId: activityReports.user_id,
```

---

⚠️ **Line 238** (medium confidence)

**Before:**
```
.leftJoin(users, eq(activityReports.userId, users.id))
```

**After:**
```
.leftJoin(users, eq(activityReports.user_id, users.id))
```

---

✅ **Line 255** (high confidence)

**Before:**
```
let whereConditions = [eq(goalProgress.tenantId, req.user.tenantId)];
```

**After:**
```
let whereConditions = [eq(goalProgress.tenant_id, req.user.tenant_id)];
```

---

✅ **Line 334** (high confidence)

**Before:**
```
eq(leadActivities.tenantId, req.user.tenantId),
```

**After:**
```
eq(leadActivities.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 335** (medium confidence)

**Before:**
```
gte(leadActivities.createdAt, startDate),
```

**After:**
```
gte(leadActivities.created_at, startDate),
```

---

⚠️ **Line 336** (medium confidence)

**Before:**
```
lte(leadActivities.createdAt, endDate),
```

**After:**
```
lte(leadActivities.created_at, endDate),
```

---

✅ **Line 361** (high confidence)

**Before:**
```
eq(customerActivities.tenantId, req.user.tenantId),
```

**After:**
```
eq(customerActivities.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 362** (medium confidence)

**Before:**
```
gte(customerActivities.createdAt, startDate),
```

**After:**
```
gte(customerActivities.created_at, startDate),
```

---

⚠️ **Line 363** (medium confidence)

**Before:**
```
lte(customerActivities.createdAt, endDate),
```

**After:**
```
lte(customerActivities.created_at, endDate),
```

---

✅ **Line 384** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 418** (high confidence)

**Before:**
```
.where(and(eq(salesGoals.tenantId, req.user.tenantId), eq(salesGoals.isActive, true)));
```

**After:**
```
.where(and(eq(salesGoals.tenant_id, req.user.tenant_id), eq(salesGoals.isActive, true)));
```

---

✅ **Line 424** (high confidence)

**Before:**
```
.where(and(eq(salesTeams.tenantId, req.user.tenantId), eq(salesTeams.isActive, true)));
```

**After:**
```
.where(and(eq(salesTeams.tenant_id, req.user.tenant_id), eq(salesTeams.isActive, true)));
```

---

✅ **Line 432** (high confidence)

**Before:**
```
eq(salesTeamMembers.tenantId, req.user.tenantId),
```

**After:**
```
eq(salesTeamMembers.tenant_id, req.user.tenant_id),
```

---

✅ **Line 443** (high confidence)

**Before:**
```
eq(activityReports.tenantId, req.user.tenantId),
```

**After:**
```
eq(activityReports.tenant_id, req.user.tenant_id),
```

---

✅ **Line 470** (high confidence)

**Before:**
```
eq(salesMetrics.tenantId, req.user.tenantId),
```

**After:**
```
eq(salesMetrics.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 472** (medium confidence)

**Before:**
```
userId ? eq(salesMetrics.userId, userId) : undefined,
```

**After:**
```
userId ? eq(salesMetrics.user_id, userId) : undefined,
```

---

✅ **Line 489** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 511** (high confidence)

**Before:**
```
eq(conversionFunnel.tenantId, req.user.tenantId),
```

**After:**
```
eq(conversionFunnel.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 513** (medium confidence)

**Before:**
```
userId ? eq(conversionFunnel.userId, userId) : undefined,
```

**After:**
```
userId ? eq(conversionFunnel.user_id, userId) : undefined,
```

---

✅ **Line 536** (high confidence)

**Before:**
```
eq(managerInsights.tenantId, req.user.tenantId),
```

**After:**
```
eq(managerInsights.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 539** (medium confidence)

**Before:**
```
userId ? eq(managerInsights.userId, userId) : undefined,
```

**After:**
```
userId ? eq(managerInsights.user_id, userId) : undefined,
```

---

⚠️ **Line 545** (medium confidence)

**Before:**
```
.orderBy(desc(managerInsights.createdAt));
```

**After:**
```
.orderBy(desc(managerInsights.created_at));
```

---

✅ **Line 566** (high confidence)

**Before:**
```
eq(salesMetrics.tenantId, req.user.tenantId),
```

**After:**
```
eq(salesMetrics.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 567** (medium confidence)

**Before:**
```
userId ? eq(salesMetrics.userId, userId) : undefined,
```

**After:**
```
userId ? eq(salesMetrics.user_id, userId) : undefined,
```

---

✅ **Line 585** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 587** (medium confidence)

**Before:**
```
userId: metrics.userId,
```

**After:**
```
userId: metrics.user_id,
```

---

✅ **Line 615** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 617** (medium confidence)

**Before:**
```
userId: metrics.userId,
```

**After:**
```
userId: metrics.user_id,
```

---

✅ **Line 659** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 661** (medium confidence)

**Before:**
```
userId: metrics.userId,
```

**After:**
```
userId: metrics.user_id,
```

---

⚠️ **Line 797** (medium confidence)

**Before:**
```
userId: salesMetrics.userId,
```

**After:**
```
userId: salesMetrics.user_id,
```

---

⚠️ **Line 829** (medium confidence)

**Before:**
```
.leftJoin(users, eq(salesMetrics.userId, users.id))
```

**After:**
```
.leftJoin(users, eq(salesMetrics.user_id, users.id))
```

---

✅ **Line 833** (high confidence)

**Before:**
```
eq(salesMetrics.tenantId, req.user.tenantId),
```

**After:**
```
eq(salesMetrics.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 835** (medium confidence)

**Before:**
```
userId ? eq(salesMetrics.userId, userId) : undefined,
```

**After:**
```
userId ? eq(salesMetrics.user_id, userId) : undefined,
```

---

### `server\routes-contract-renewal.ts`

✅ **Line 24** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || (req.session as any)?.tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id || (req.session as any)?.tenant_id;
```

---

✅ **Line 28** (high confidence)

**Before:**
```
(req as any).tenantId = tenantId;
```

**After:**
```
(req as any).tenant_id = tenantId;
```

---

✅ **Line 45** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 64** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 68** (high confidence)

**Before:**
```
where: eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
where: eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 89** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 108** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 126** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 150** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 168** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 209** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 213** (high confidence)

**Before:**
```
where: eq(renewalProposals.tenantId, tenantId),
```

**After:**
```
where: eq(renewalProposals.tenant_id, tenantId),
```

---

✅ **Line 234** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 242** (high confidence)

**Before:**
```
where: and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)),
```

**After:**
```
where: and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenant_id, tenantId)),
```

---

✅ **Line 265** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 293** (high confidence)

**Before:**
```
.where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenant_id, tenantId)))
```

---

✅ **Line 316** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 326** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 359** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 376** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 401** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 419** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 438** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 454** (high confidence)

**Before:**
```
.where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenant_id, tenantId)))
```

---

✅ **Line 472** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

### `server\routes-contract-alerts.ts`

✅ **Line 36** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 69** (high confidence)

**Before:**
```
eq(serviceContracts.tenantId, tenantId),
```

**After:**
```
eq(serviceContracts.tenant_id, tenantId),
```

---

✅ **Line 101** (high confidence)

**Before:**
```
eq(contracts.tenantId, tenantId),
```

**After:**
```
eq(contracts.tenant_id, tenantId),
```

---

✅ **Line 182** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 219** (high confidence)

**Before:**
```
.where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenant_id, tenantId)))
```

---

✅ **Line 242** (high confidence)

**Before:**
```
.where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contracts.id, contractId), eq(contracts.tenant_id, tenantId)))
```

---

✅ **Line 279** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 300** (high confidence)

**Before:**
```
.where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenant_id, tenantId)))
```

---

✅ **Line 317** (high confidence)

**Before:**
```
eq(renewalOpportunities.tenantId, tenantId),
```

**After:**
```
eq(renewalOpportunities.tenant_id, tenantId),
```

---

✅ **Line 384** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 423** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-content-marketing.ts`

✅ **Line 181** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || null;
```

**After:**
```
const tenantId = req.user?.tenant_id || null;
```

---

✅ **Line 342** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || null;
```

**After:**
```
const tenantId = req.user?.tenant_id || null;
```

---

✅ **Line 434** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || null;
```

**After:**
```
const tenantId = req.user?.tenant_id || null;
```

---

✅ **Line 484** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || null;
```

**After:**
```
const tenantId = req.user?.tenant_id || null;
```

---

⚠️ **Line 675** (medium confidence)

**Before:**
```
updatedAt: blogPosts.updatedAt,
```

**After:**
```
updatedAt: blogPosts.updated_at,
```

---

⚠️ **Line 684** (medium confidence)

**Before:**
```
updatedAt: guides.updatedAt,
```

**After:**
```
updatedAt: guides.updated_at,
```

---

⚠️ **Line 693** (medium confidence)

**Before:**
```
updatedAt: caseStudies.updatedAt,
```

**After:**
```
updatedAt: caseStudies.updated_at,
```

---

⚠️ **Line 702** (medium confidence)

**Before:**
```
updatedAt: landingPages.updatedAt,
```

**After:**
```
updatedAt: landingPages.updated_at,
```

---

⚠️ **Line 723** (medium confidence)

**Before:**
```
const lastmod = (post.updatedAt || post.publishedAt)?.toISOString().split('T')[0];
```

**After:**
```
const lastmod = (post.updated_at || post.publishedAt)?.toISOString().split('T')[0];
```

---

⚠️ **Line 735** (medium confidence)

**Before:**
```
const lastmod = (guide.updatedAt || guide.publishedAt)?.toISOString().split('T')[0];
```

**After:**
```
const lastmod = (guide.updated_at || guide.publishedAt)?.toISOString().split('T')[0];
```

---

⚠️ **Line 747** (medium confidence)

**Before:**
```
const lastmod = (study.updatedAt || study.publishedAt)?.toISOString().split('T')[0];
```

**After:**
```
const lastmod = (study.updated_at || study.publishedAt)?.toISOString().split('T')[0];
```

---

⚠️ **Line 759** (medium confidence)

**Before:**
```
const lastmod = page.updatedAt?.toISOString().split('T')[0];
```

**After:**
```
const lastmod = page.updated_at?.toISOString().split('T')[0];
```

---

### `server\routes-contacts.ts`

✅ **Line 31** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 58** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 77** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 107** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 129** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 155** (high confidence)

**Before:**
```
const tenantId = req.tenantId || user.tenantId;
```

**After:**
```
const tenantId = req.tenant_id || user.tenant_id;
```

---

⚠️ **Line 211** (medium confidence)

**Before:**
```
filters.createdAt = {
```

**After:**
```
filters.created_at = {
```

---

⚠️ **Line 218** (medium confidence)

**Before:**
```
filters.createdAt = {
```

**After:**
```
filters.created_at = {
```

---

⚠️ **Line 226** (medium confidence)

**Before:**
```
filters.createdAt = { gte: last7Days };
```

**After:**
```
filters.created_at = { gte: last7Days };
```

---

⚠️ **Line 231** (medium confidence)

**Before:**
```
filters.createdAt = { gte: last30Days };
```

**After:**
```
filters.created_at = { gte: last30Days };
```

---

✅ **Line 298** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 323** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 337** (high confidence)

**Before:**
```
if (contact.tenantId !== tenantId) {
```

**After:**
```
if (contact.tenant_id !== tenantId) {
```

---

✅ **Line 359** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 373** (high confidence)

**Before:**
```
if (contact.tenantId !== tenantId) {
```

**After:**
```
if (contact.tenant_id !== tenantId) {
```

---

✅ **Line 396** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 410** (high confidence)

**Before:**
```
if (contact.tenantId !== tenantId) {
```

**After:**
```
if (contact.tenant_id !== tenantId) {
```

---

✅ **Line 444** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 448** (high confidence)

**Before:**
```
const contacts = await storage.getContactsByCompany(companyId, user.tenantId);
```

**After:**
```
const contacts = await storage.getContactsByCompany(companyId, user.tenant_id);
```

---

✅ **Line 468** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 474** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 496** (high confidence)

**Before:**
```
if (!user?.tenantId) {
```

**After:**
```
if (!user?.tenant_id) {
```

---

✅ **Line 500** (high confidence)

**Before:**
```
await storage.deleteContact(contactId, user.tenantId);
```

**After:**
```
await storage.deleteContact(contactId, user.tenant_id);
```

---

### `server\routes-company-ids.ts`

✅ **Line 29** (high confidence)

**Before:**
```
} else if (!req.user.id || !req.user.tenantId) {
```

**After:**
```
} else if (!req.user.id || !req.user.tenant_id) {
```

---

✅ **Line 33** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 54** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, recordId), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, recordId), eq(businessRecords.tenant_id, tenantId)))
```

---

⚠️ **Line 122** (medium confidence)

**Before:**
```
createdAt: businessRecords.createdAt,
```

**After:**
```
createdAt: businessRecords.created_at,
```

---

✅ **Line 125** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), isNull(businessRecords.companyDisplayId)))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), isNull(businessRecords.companyDisplayId)))
```

---

### `server\routes-companies.ts`

✅ **Line 28** (high confidence)

**Before:**
```
const tenantId = user.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = user.tenant_id || getTenantId(req);
```

---

✅ **Line 53** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 73** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 100** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 125** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 149** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 169** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 195** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 244** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

### `server\routes-client-monitoring.ts`

✅ **Line 58** (high confidence)

**Before:**
```
eq(monitoringClients.tenantId, tenantId),
```

**After:**
```
eq(monitoringClients.tenant_id, tenantId),
```

---

✅ **Line 74** (high confidence)

**Before:**
```
req.tenantId = tenantId;
```

**After:**
```
req.tenant_id = tenantId;
```

---

✅ **Line 146** (high confidence)

**Before:**
```
.where(and(eq(supplies.tenantId, tenantId), eq(supplies.isActive, true), or(...conditions)))
```

**After:**
```
.where(and(eq(supplies.tenant_id, tenantId), eq(supplies.isActive, true), or(...conditions)))
```

---

✅ **Line 179** (high confidence)

**Before:**
```
eq(inventoryItems.tenantId, tenantId),
```

**After:**
```
eq(inventoryItems.tenant_id, tenantId),
```

---

✅ **Line 271** (high confidence)

**Before:**
```
eq(serviceContracts.tenantId, tenantId),
```

**After:**
```
eq(serviceContracts.tenant_id, tenantId),
```

---

✅ **Line 467** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 475** (high confidence)

**Before:**
```
.where(eq(monitoringClients.tenantId, tenantId))
```

**After:**
```
.where(eq(monitoringClients.tenant_id, tenantId))
```

---

⚠️ **Line 476** (medium confidence)

**Before:**
```
.orderBy(desc(monitoringClients.createdAt));
```

**After:**
```
.orderBy(desc(monitoringClients.created_at));
```

---

✅ **Line 488** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 523** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 533** (high confidence)

**Before:**
```
.where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
```

**After:**
```
.where(and(eq(monitoringClients.tenant_id, tenantId), eq(monitoringClients.id, id)))
```

---

✅ **Line 550** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 563** (high confidence)

**Before:**
```
.where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
```

**After:**
```
.where(and(eq(monitoringClients.tenant_id, tenantId), eq(monitoringClients.id, id)))
```

---

✅ **Line 580** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 598** (high confidence)

**Before:**
```
.where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)))
```

**After:**
```
.where(and(eq(monitoringClients.tenant_id, tenantId), eq(monitoringClients.id, id)))
```

---

✅ **Line 618** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 627** (high confidence)

**Before:**
```
.where(and(eq(monitoringClients.tenantId, tenantId), eq(monitoringClients.id, id)));
```

**After:**
```
.where(and(eq(monitoringClients.tenant_id, tenantId), eq(monitoringClients.id, id)));
```

---

✅ **Line 639** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 649** (high confidence)

**Before:**
```
.where(and(eq(clientActivityLogs.tenantId, tenantId), eq(clientActivityLogs.clientId, id)))
```

**After:**
```
.where(and(eq(clientActivityLogs.tenant_id, tenantId), eq(clientActivityLogs.clientId, id)))
```

---

✅ **Line 663** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 675** (high confidence)

**Before:**
```
eq(clientDiscoveredDevices.tenantId, tenantId),
```

**After:**
```
eq(clientDiscoveredDevices.tenant_id, tenantId),
```

---

✅ **Line 696** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 717** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 753** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 916** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 948** (high confidence)

**Before:**
```
tenantId: req.tenantId,
```

**After:**
```
tenantId: req.tenant_id,
```

---

✅ **Line 989** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 998** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId));
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId));
```

---

✅ **Line 1005** (high confidence)

**Before:**
```
.where(eq(deviceMetrics.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceMetrics.tenant_id, tenantId))
```

---

✅ **Line 1141** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 1152** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId));
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId));
```

---

✅ **Line 1160** (high confidence)

**Before:**
```
.where(eq(deviceMetrics.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceMetrics.tenant_id, tenantId))
```

---

✅ **Line 1217** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 1229** (high confidence)

**Before:**
```
.where(and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, id)))
```

**After:**
```
.where(and(eq(deviceRegistrations.tenant_id, tenantId), eq(deviceRegistrations.id, id)))
```

---

✅ **Line 1240** (high confidence)

**Before:**
```
.where(and(eq(deviceMetrics.tenantId, tenantId), eq(deviceMetrics.deviceId, id)))
```

**After:**
```
.where(and(eq(deviceMetrics.tenant_id, tenantId), eq(deviceMetrics.deviceId, id)))
```

---

✅ **Line 1259** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 1270** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId))
```

---

✅ **Line 1277** (high confidence)

**Before:**
```
.where(eq(deviceMetrics.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceMetrics.tenant_id, tenantId))
```

---

✅ **Line 1321** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 1333** (high confidence)

**Before:**
```
.where(eq(deviceRegistrations.tenantId, tenantId));
```

**After:**
```
.where(eq(deviceRegistrations.tenant_id, tenantId));
```

---

✅ **Line 1341** (high confidence)

**Before:**
```
.where(eq(deviceMetrics.tenantId, tenantId))
```

**After:**
```
.where(eq(deviceMetrics.tenant_id, tenantId))
```

---

✅ **Line 1378** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || req.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id || req.tenant_id;
```

---

✅ **Line 1402** (high confidence)

**Before:**
```
.where(and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, id)))
```

**After:**
```
.where(and(eq(deviceRegistrations.tenant_id, tenantId), eq(deviceRegistrations.id, id)))
```

---

✅ **Line 1413** (high confidence)

**Before:**
```
.where(and(eq(deviceMetrics.tenantId, tenantId), eq(deviceMetrics.deviceId, id)))
```

**After:**
```
.where(and(eq(deviceMetrics.tenant_id, tenantId), eq(deviceMetrics.deviceId, id)))
```

---

⚠️ **Line 1671** (medium confidence)

**Before:**
```
} else if (req.user || req.session?.userId) {
```

**After:**
```
} else if (req.user || req.session?.user_id) {
```

---

⚠️ **Line 1693** (medium confidence)

**Before:**
```
const mappings = await query.orderBy(desc(oidMappings.createdAt));
```

**After:**
```
const mappings = await query.orderBy(desc(oidMappings.created_at));
```

---

⚠️ **Line 1727** (medium confidence)

**Before:**
```
} else if (req.user || req.session?.userId) {
```

**After:**
```
} else if (req.user || req.session?.user_id) {
```

---

✅ **Line 1807** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1822** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 1851** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 1905** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1919** (high confidence)

**Before:**
```
and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, deviceId)),
```

**After:**
```
and(eq(deviceRegistrations.tenant_id, tenantId), eq(deviceRegistrations.id, deviceId)),
```

---

### `server\routes-client-metrics.ts`

✅ **Line 115** (high confidence)

**Before:**
```
eq(tonerAlerts.tenantId, tenantId),
```

**After:**
```
eq(tonerAlerts.tenant_id, tenantId),
```

---

✅ **Line 157** (high confidence)

**Before:**
```
eq(tonerAlerts.tenantId, tenantId),
```

**After:**
```
eq(tonerAlerts.tenant_id, tenantId),
```

---

✅ **Line 190** (high confidence)

**Before:**
```
eq(clientRegistrations.tenantId, tenantId),
```

**After:**
```
eq(clientRegistrations.tenant_id, tenantId),
```

---

✅ **Line 239** (high confidence)

**Before:**
```
tenantId: client.tenantId,
```

**After:**
```
tenantId: client.tenant_id,
```

---

✅ **Line 291** (high confidence)

**Before:**
```
processTonerAlerts(client.tenantId, client.clientId, devices).catch((err) => {
```

**After:**
```
processTonerAlerts(client.tenant_id, client.clientId, devices).catch((err) => {
```

---

✅ **Line 297** (high confidence)

**Before:**
```
tenantId: client.tenantId,
```

**After:**
```
tenantId: client.tenant_id,
```

---

✅ **Line 361** (high confidence)

**Before:**
```
tenantId: client.tenantId,
```

**After:**
```
tenantId: client.tenant_id,
```

---

✅ **Line 406** (high confidence)

**Before:**
```
eq(monitoredDevices.tenantId, client.tenantId),
```

**After:**
```
eq(monitoredDevices.tenant_id, client.tenant_id),
```

---

✅ **Line 449** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 493** (high confidence)

**Before:**
```
tenantId: newClient.tenantId,
```

**After:**
```
tenantId: newClient.tenant_id,
```

---

⚠️ **Line 495** (medium confidence)

**Before:**
```
createdAt: newClient.createdAt,
```

**After:**
```
createdAt: newClient.created_at,
```

---

✅ **Line 510** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 513** (high confidence)

**Before:**
```
where: eq(clientRegistrations.tenantId, tenantId),
```

**After:**
```
where: eq(clientRegistrations.tenant_id, tenantId),
```

---

⚠️ **Line 514** (medium confidence)

**Before:**
```
orderBy: [desc(clientRegistrations.createdAt)],
```

**After:**
```
orderBy: [desc(clientRegistrations.created_at)],
```

---

✅ **Line 534** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 539** (high confidence)

**Before:**
```
eq(clientRegistrations.tenantId, tenantId),
```

**After:**
```
eq(clientRegistrations.tenant_id, tenantId),
```

---

✅ **Line 551** (high confidence)

**Before:**
```
eq(clientActivityLogs.tenantId, tenantId),
```

**After:**
```
eq(clientActivityLogs.tenant_id, tenantId),
```

---

✅ **Line 561** (high confidence)

**Before:**
```
eq(monitoredDevices.tenantId, tenantId),
```

**After:**
```
eq(monitoredDevices.tenant_id, tenantId),
```

---

✅ **Line 570** (high confidence)

**Before:**
```
eq(tonerAlerts.tenantId, tenantId),
```

**After:**
```
eq(tonerAlerts.tenant_id, tenantId),
```

---

⚠️ **Line 573** (medium confidence)

**Before:**
```
orderBy: [desc(tonerAlerts.createdAt)],
```

**After:**
```
orderBy: [desc(tonerAlerts.created_at)],
```

---

✅ **Line 605** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 610** (high confidence)

**Before:**
```
eq(clientRegistrations.tenantId, tenantId),
```

**After:**
```
eq(clientRegistrations.tenant_id, tenantId),
```

---

### `server\routes-clickup-tasks.ts`

✅ **Line 14** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 41** (medium confidence)

**Before:**
```
createdAt: tasks.createdAt,
```

**After:**
```
createdAt: tasks.created_at,
```

---

⚠️ **Line 42** (medium confidence)

**Before:**
```
updatedAt: tasks.updatedAt,
```

**After:**
```
updatedAt: tasks.updated_at,
```

---

✅ **Line 59** (high confidence)

**Before:**
```
.where(eq(tasks.tenantId, tenantId));
```

**After:**
```
.where(eq(tasks.tenant_id, tenantId));
```

---

⚠️ **Line 75** (medium confidence)

**Before:**
```
const allTasks = await query.orderBy(desc(tasks.updatedAt));
```

**After:**
```
const allTasks = await query.orderBy(desc(tasks.updated_at));
```

---

✅ **Line 108** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

⚠️ **Line 127** (medium confidence)

**Before:**
```
createdAt: projects.createdAt,
```

**After:**
```
createdAt: projects.created_at,
```

---

✅ **Line 139** (high confidence)

**Before:**
```
.where(eq(projects.tenantId, tenantId))
```

**After:**
```
.where(eq(projects.tenant_id, tenantId))
```

---

⚠️ **Line 156** (medium confidence)

**Before:**
```
projects.createdAt,
```

**After:**
```
projects.created_at,
```

---

⚠️ **Line 160** (medium confidence)

**Before:**
```
.orderBy(desc(projects.updatedAt));
```

**After:**
```
.orderBy(desc(projects.updated_at));
```

---

✅ **Line 172** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 183** (high confidence)

**Before:**
```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
```

**After:**
```
.where(and(eq(users.tenant_id, tenantId), eq(users.isActive, true)))
```

---

✅ **Line 196** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 229** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 246** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)))
```

---

✅ **Line 268** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 289** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 301** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 324** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 336** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 351** (high confidence)

**Before:**
```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenantId, tenantId)))
```

**After:**
```
.where(and(inArray(tasks.id, taskIds), eq(tasks.tenant_id, tenantId)))
```

---

✅ **Line 364** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 371** (high confidence)

**Before:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 380** (high confidence)

**Before:**
```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(tasks.parentTaskId, taskId), eq(tasks.tenant_id, tenantId)));
```

---

✅ **Line 383** (high confidence)

**Before:**
```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
```

**After:**
```
await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenant_id, tenantId)));
```

---

### `server\routes-catalog.ts`

⚠️ **Line 149** (medium confidence)

**Before:**
```
updateData.updatedAt = new Date();
```

**After:**
```
updateData.updated_at = new Date();
```

---

### `server\routes-business-records.ts`

✅ **Line 108** (high confidence)

**Before:**
```
const conditions: any[] = [eq(businessRecords.tenantId, tenantId)];
```

**After:**
```
const conditions: any[] = [eq(businessRecords.tenant_id, tenantId)];
```

---

⚠️ **Line 155** (medium confidence)

**Before:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.createdAt;
```

**After:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.created_at;
```

---

✅ **Line 208** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 227** (medium confidence)

**Before:**
```
.orderBy(desc(businessRecordActivities.createdAt))
```

**After:**
```
.orderBy(desc(businessRecordActivities.created_at))
```

---

✅ **Line 327** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 401** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 506** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, ids)))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), inArray(businessRecords.id, ids)))
```

---

✅ **Line 551** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, id), eq(businessRecords.tenant_id, tenantId)))
```

---

✅ **Line 609** (high confidence)

**Before:**
```
.where(eq(businessRecords.tenantId, tenantId))
```

**After:**
```
.where(eq(businessRecords.tenant_id, tenantId))
```

---

✅ **Line 620** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 659** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 700** (medium confidence)

**Before:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.createdAt;
```

**After:**
```
businessRecords[sortBy as keyof typeof businessRecords] || businessRecords.created_at;
```

---

✅ **Line 748** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 768** (medium confidence)

**Before:**
```
.orderBy(desc(businessRecordActivities.createdAt))
```

**After:**
```
.orderBy(desc(businessRecordActivities.created_at))
```

---

### `server\routes-business-process-optimization.ts`

✅ **Line 30** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 452** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 584** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 613** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 639** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 671** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-breach-detection.ts`

✅ **Line 48** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

⚠️ **Line 51** (medium confidence)

**Before:**
```
lt(businessRecords.createdAt, twentyFourHoursAgo),
```

**After:**
```
lt(businessRecords.created_at, twentyFourHoursAgo),
```

---

✅ **Line 77** (high confidence)

**Before:**
```
eq(proposals.tenantId, tenantId),
```

**After:**
```
eq(proposals.tenant_id, tenantId),
```

---

⚠️ **Line 79** (medium confidence)

**Before:**
```
lt(proposals.createdAt, fourteenDaysAgo),
```

**After:**
```
lt(proposals.created_at, fourteenDaysAgo),
```

---

✅ **Line 102** (high confidence)

**Before:**
```
eq(purchaseOrders.tenantId, tenantId),
```

**After:**
```
eq(purchaseOrders.tenant_id, tenantId),
```

---

✅ **Line 127** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, tenantId),
```

---

⚠️ **Line 129** (medium confidence)

**Before:**
```
lt(serviceTickets.createdAt, fiveDaysAgo),
```

**After:**
```
lt(serviceTickets.created_at, fiveDaysAgo),
```

---

✅ **Line 152** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

⚠️ **Line 154** (medium confidence)

**Before:**
```
lt(invoices.createdAt, twentyFourHoursAgo),
```

**After:**
```
lt(invoices.created_at, twentyFourHoursAgo),
```

---

✅ **Line 180** (high confidence)

**Before:**
```
eq(meterReadings.tenantId, tenantId),
```

**After:**
```
eq(meterReadings.tenant_id, tenantId),
```

---

### `server\routes-automation.ts`

✅ **Line 27** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 51** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 110** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 183** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 216** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 248** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 300** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

✅ **Line 361** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId || getTenantId(req);
```

**After:**
```
const tenantId = req.user?.tenant_id || getTenantId(req);
```

---

### `server\routes-auto-supply-replenishment.ts`

✅ **Line 24** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || (req.session as any)?.tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id || (req.session as any)?.tenant_id;
```

---

✅ **Line 28** (high confidence)

**Before:**
```
(req as any).tenantId = tenantId;
```

**After:**
```
(req as any).tenant_id = tenantId;
```

---

✅ **Line 42** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 60** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 64** (high confidence)

**Before:**
```
where: eq(supplyMonitoring.tenantId, tenantId),
```

**After:**
```
where: eq(supplyMonitoring.tenant_id, tenantId),
```

---

✅ **Line 86** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 104** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 128** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 146** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 174** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 193** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 201** (high confidence)

**Before:**
```
where: and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenantId, tenantId)),
```

**After:**
```
where: and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenant_id, tenantId)),
```

---

✅ **Line 224** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 244** (high confidence)

**Before:**
```
.where(and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenant_id, tenantId)))
```

---

✅ **Line 267** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 285** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 304** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 314** (high confidence)

**Before:**
```
eq(supplyMonitoring.tenantId, tenantId),
```

**After:**
```
eq(supplyMonitoring.tenant_id, tenantId),
```

---

✅ **Line 348** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 368** (high confidence)

**Before:**
```
and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenantId, tenantId)),
```

**After:**
```
and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenant_id, tenantId)),
```

---

### `server\routes-auto-lead-routing.ts`

✅ **Line 123** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 140** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 159** (high confidence)

**Before:**
```
eq(leadScoreCalculations.tenantId, tenantId),
```

**After:**
```
eq(leadScoreCalculations.tenant_id, tenantId),
```

---

⚠️ **Line 168** (medium confidence)

**Before:**
```
userId: repCapacity.userId,
```

**After:**
```
userId: repCapacity.user_id,
```

---

✅ **Line 176** (high confidence)

**Before:**
```
.where(and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.isAvailable, true)));
```

**After:**
```
.where(and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.isAvailable, true)));
```

---

✅ **Line 191** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

⚠️ **Line 218** (medium confidence)

**Before:**
```
userId: rep.userId,
```

**After:**
```
userId: rep.user_id,
```

---

✅ **Line 313** (high confidence)

**Before:**
```
where: and(eq(businessRecords.id, leadId), eq(businessRecords.tenantId, tenantId)),
```

**After:**
```
where: and(eq(businessRecords.id, leadId), eq(businessRecords.tenant_id, tenantId)),
```

---

### `server\routes-ai-gpt5.ts`

✅ **Line 22** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 27** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

✅ **Line 96** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 136** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 180** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 220** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 260** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 300** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 340** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 380** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 422** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-ai-analytics.ts`

✅ **Line 30** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 523** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 579** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\routes-admin-workflows.ts`

✅ **Line 34** (high confidence)

**Before:**
```
} else if (!req.user.tenantId || !req.user.id) {
```

**After:**
```
} else if (!req.user.tenant_id || !req.user.id) {
```

---

✅ **Line 38** (high confidence)

**Before:**
```
tenantId: req.user.tenantId || getTenantId(req),
```

**After:**
```
tenantId: req.user.tenant_id || getTenantId(req),
```

---

### `server\routes-admin-subscriptions.ts`

⚠️ **Line 66** (medium confidence)

**Before:**
```
.orderBy(desc(tenantSubscriptions.createdAt))
```

**After:**
```
.orderBy(desc(tenantSubscriptions.created_at))
```

---

✅ **Line 110** (high confidence)

**Before:**
```
const status = await SubscriptionService.getSubscriptionStatus(subscription.tenantId);
```

**After:**
```
const status = await SubscriptionService.getSubscriptionStatus(subscription.tenant_id);
```

---

⚠️ **Line 264** (medium confidence)

**Before:**
```
.orderBy(desc(discounts.createdAt))
```

**After:**
```
.orderBy(desc(discounts.created_at))
```

---

⚠️ **Line 315** (medium confidence)

**Before:**
```
.orderBy(desc(discountRedemptions.createdAt))
```

**After:**
```
.orderBy(desc(discountRedemptions.created_at))
```

---

### `server\routes-accessibility.ts`

⚠️ **Line 49** (medium confidence)

**Before:**
```
where: eq(userAccessibilityPreferences.userId, userId),
```

**After:**
```
where: eq(userAccessibilityPreferences.user_id, userId),
```

---

⚠️ **Line 101** (medium confidence)

**Before:**
```
where: eq(userAccessibilityPreferences.userId, userId),
```

**After:**
```
where: eq(userAccessibilityPreferences.user_id, userId),
```

---

⚠️ **Line 113** (medium confidence)

**Before:**
```
.where(eq(userAccessibilityPreferences.userId, userId))
```

**After:**
```
.where(eq(userAccessibilityPreferences.user_id, userId))
```

---

⚠️ **Line 150** (medium confidence)

**Before:**
```
.where(eq(userAccessibilityPreferences.userId, userId));
```

**After:**
```
.where(eq(userAccessibilityPreferences.user_id, userId));
```

---

✅ **Line 224** (high confidence)

**Before:**
```
const conditions = [eq(accessibilityFeedback.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(accessibilityFeedback.tenant_id, tenantId)];
```

---

✅ **Line 353** (high confidence)

**Before:**
```
let conditions = [eq(accessibilityAuditLog.tenantId, tenantId)];
```

**After:**
```
let conditions = [eq(accessibilityAuditLog.tenant_id, tenantId)];
```

---

### `server\role-seeder.ts`

✅ **Line 529** (high confidence)

**Before:**
```
tenantId: userData.tenantId,
```

**After:**
```
tenantId: userData.tenant_id,
```

---

### `server\reporting-rbac-middleware.ts`

⚠️ **Line 234** (medium confidence)

**Before:**
```
const userId = req.user?.id || req.session?.userId;
```

**After:**
```
const userId = req.user?.id || req.session?.user_id;
```

---

✅ **Line 274** (high confidence)

**Before:**
```
tenantId: user.tenantId!,
```

**After:**
```
tenantId: user.tenant_id!,
```

---

✅ **Line 370** (high confidence)

**Before:**
```
if (!user.tenantId) return [];
```

**After:**
```
if (!user.tenant_id) return [];
```

---

✅ **Line 383** (high confidence)

**Before:**
```
.where(eq(locations.tenantId, user.tenantId));
```

**After:**
```
.where(eq(locations.tenant_id, user.tenant_id));
```

---

✅ **Line 392** (high confidence)

**Before:**
```
.where(and(eq(locations.tenantId, user.tenantId), eq(locations.regionId, user.regionId)));
```

**After:**
```
.where(and(eq(locations.tenant_id, user.tenant_id), eq(locations.regionId, user.regionId)));
```

---

✅ **Line 406** (high confidence)

**Before:**
```
if (!user.tenantId) return [];
```

**After:**
```
if (!user.tenant_id) return [];
```

---

✅ **Line 419** (high confidence)

**Before:**
```
.where(eq(regions.tenantId, user.tenantId));
```

**After:**
```
.where(eq(regions.tenant_id, user.tenant_id));
```

---

✅ **Line 544** (high confidence)

**Before:**
```
return baseQuery.where(eq(`${prefix}tenant_id`, this.userContext.tenantId));
```

**After:**
```
return baseQuery.where(eq(`${prefix}tenant_id`, this.userContext.tenant_id));
```

---

✅ **Line 550** (high confidence)

**Before:**
```
eq(`${prefix}tenant_id`, this.userContext.tenantId),
```

**After:**
```
eq(`${prefix}tenant_id`, this.userContext.tenant_id),
```

---

✅ **Line 561** (high confidence)

**Before:**
```
eq(`${prefix}tenant_id`, this.userContext.tenantId),
```

**After:**
```
eq(`${prefix}tenant_id`, this.userContext.tenant_id),
```

---

✅ **Line 572** (high confidence)

**Before:**
```
eq(`${prefix}tenant_id`, this.userContext.tenantId),
```

**After:**
```
eq(`${prefix}tenant_id`, this.userContext.tenant_id),
```

---

✅ **Line 586** (high confidence)

**Before:**
```
eq(`${prefix}tenant_id`, this.userContext.tenantId),
```

**After:**
```
eq(`${prefix}tenant_id`, this.userContext.tenant_id),
```

---

### `server\replitAuth.ts`

✅ **Line 77** (high confidence)

**Before:**
```
let tenantId = supabaseUser.tenantId;
```

**After:**
```
let tenantId = supabaseUser.tenant_id;
```

---

✅ **Line 84** (high confidence)

**Before:**
```
tenantId = tenantId || dbUser.tenantId;
```

**After:**
```
tenantId = tenantId || dbUser.tenant_id;
```

---

✅ **Line 118** (high confidence)

**Before:**
```
(req as any).tenantId = tenantId;
```

**After:**
```
(req as any).tenant_id = tenantId;
```

---

⚠️ **Line 189** (medium confidence)

**Before:**
```
const sessionUserId = (req.session as any)?.userId;
```

**After:**
```
const sessionUserId = (req.session as any)?.user_id;
```

---

✅ **Line 190** (high confidence)

**Before:**
```
const sessionTenantId = (req.session as any)?.tenantId;
```

**After:**
```
const sessionTenantId = (req.session as any)?.tenant_id;
```

---

✅ **Line 200** (high confidence)

**Before:**
```
} else if (!user.tenantId) {
```

**After:**
```
} else if (!user.tenant_id) {
```

---

✅ **Line 201** (high confidence)

**Before:**
```
user.tenantId = sessionTenantId;
```

**After:**
```
user.tenant_id = sessionTenantId;
```

---

### `server\rbac-middleware.ts`

✅ **Line 65** (high confidence)

**Before:**
```
req.user.tenantId = tenantId || undefined;
```

**After:**
```
req.user.tenant_id = tenantId || undefined;
```

---

### `server\rbac-initializer.ts`

✅ **Line 28** (high confidence)

**Before:**
```
.where(eq(enhancedRoles.tenantId, tenantId))
```

**After:**
```
.where(eq(enhancedRoles.tenant_id, tenantId))
```

---

✅ **Line 103** (high confidence)

**Before:**
```
.where(eq(enhancedRoles.tenantId, tenantId))
```

**After:**
```
.where(eq(enhancedRoles.tenant_id, tenantId))
```

---

✅ **Line 135** (high confidence)

**Before:**
```
count: db.$count(enhancedRoles, eq(enhancedRoles.tenantId, tenantId)),
```

**After:**
```
count: db.$count(enhancedRoles, eq(enhancedRoles.tenant_id, tenantId)),
```

---

✅ **Line 138** (high confidence)

**Before:**
```
count: db.$count(organizationalUnits, eq(organizationalUnits.tenantId, tenantId)),
```

**After:**
```
count: db.$count(organizationalUnits, eq(organizationalUnits.tenant_id, tenantId)),
```

---

✅ **Line 190** (high confidence)

**Before:**
```
await tx.delete(enhancedRoles).where(eq(enhancedRoles.tenantId, tenantId));
```

**After:**
```
await tx.delete(enhancedRoles).where(eq(enhancedRoles.tenant_id, tenantId));
```

---

✅ **Line 191** (high confidence)

**Before:**
```
await tx.delete(organizationalUnits).where(eq(organizationalUnits.tenantId, tenantId));
```

**After:**
```
await tx.delete(organizationalUnits).where(eq(organizationalUnits.tenant_id, tenantId));
```

---

✅ **Line 217** (high confidence)

**Before:**
```
.where(eq(enhancedRoles.tenantId, tenantId));
```

**After:**
```
.where(eq(enhancedRoles.tenant_id, tenantId));
```

---

✅ **Line 231** (high confidence)

**Before:**
```
.where(eq(organizationalUnits.tenantId, tenantId))
```

**After:**
```
.where(eq(organizationalUnits.tenant_id, tenantId))
```

---

### `server\manufacturer-integration-service.ts`

✅ **Line 612** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 684** (high confidence)

**Before:**
```
and(eq(deviceRegistrations.tenantId, tenantId), eq(deviceRegistrations.id, deviceId)),
```

**After:**
```
and(eq(deviceRegistrations.tenant_id, tenantId), eq(deviceRegistrations.id, deviceId)),
```

---

✅ **Line 759** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

### `server\index.ts`

⚠️ **Line 226** (medium confidence)

**Before:**
```
const userId = req.session?.userId || req.user?.id;
```

**After:**
```
const userId = req.session?.user_id || req.user?.id;
```

---

### `server\fix-data-consistency.ts`

✅ **Line 106** (high confidence)

**Before:**
```
const tenantId = req.tenantId!;
```

**After:**
```
const tenantId = req.tenant_id!;
```

---

✅ **Line 110** (high confidence)

**Before:**
```
.where(eq(${entityName}.tenantId, tenantId))
```

**After:**
```
.where(eq(${entityName}.tenant_id, tenantId))
```

---

⚠️ **Line 111** (medium confidence)

**Before:**
```
.orderBy(desc(${entityName}.createdAt));
```

**After:**
```
.orderBy(desc(${entityName}.created_at));
```

---

### `server\enhanced-rbac-service.ts`

⚠️ **Line 53** (medium confidence)

**Before:**
```
query.userId,
```

**After:**
```
query.user_id,
```

---

✅ **Line 114** (high confidence)

**Before:**
```
await this.cachePermissions(cacheKey, permissions, computeTime, orgContext.tenantId, userId);
```

**After:**
```
await this.cachePermissions(cacheKey, permissions, computeTime, orgContext.tenant_id, userId);
```

---

⚠️ **Line 183** (medium confidence)

**Before:**
```
eq(userRoleAssignments.userId, userId),
```

**After:**
```
eq(userRoleAssignments.user_id, userId),
```

---

✅ **Line 184** (high confidence)

**Before:**
```
eq(userRoleAssignments.tenantId, orgContext.tenantId),
```

**After:**
```
eq(userRoleAssignments.tenant_id, orgContext.tenant_id),
```

---

✅ **Line 218** (high confidence)

**Before:**
```
eq((enhancedRoles as any).tenantId, orgContext.tenantId),
```

**After:**
```
eq((enhancedRoles as any).tenant_id, orgContext.tenant_id),
```

---

⚠️ **Line 252** (medium confidence)

**Before:**
```
eq(permissionOverrides.userId, userId),
```

**After:**
```
eq(permissionOverrides.user_id, userId),
```

---

✅ **Line 253** (high confidence)

**Before:**
```
eq(permissionOverrides.tenantId, orgContext.tenantId),
```

**After:**
```
eq(permissionOverrides.tenant_id, orgContext.tenant_id),
```

---

✅ **Line 302** (high confidence)

**Before:**
```
await this.invalidateCache(roleData.tenantId);
```

**After:**
```
await this.invalidateCache(roleData.tenant_id);
```

---

✅ **Line 350** (high confidence)

**Before:**
```
await this.invalidateCache(role[0].tenantId);
```

**After:**
```
await this.invalidateCache(role[0].tenant_id);
```

---

✅ **Line 389** (high confidence)

**Before:**
```
await this.invalidateCache(overrideData.tenantId);
```

**After:**
```
await this.invalidateCache(overrideData.tenant_id);
```

---

✅ **Line 440** (high confidence)

**Before:**
```
const contextStr = `${orgContext.tenantId}:${orgContext.unitId || ''}:${orgContext.locationId || ''}:${orgContext.regionId || ''}`;
```

**After:**
```
const contextStr = `${orgContext.tenant_id}:${orgContext.unitId || ''}:${orgContext.locationId || ''}:${orgContext.regionId || ''}`;
```

---

✅ **Line 511** (high confidence)

**Before:**
```
await db.delete(permissionCache).where(eq(permissionCache.tenantId, tenantId));
```

**After:**
```
await db.delete(permissionCache).where(eq(permissionCache.tenant_id, tenantId));
```

---

### `server\enhanced-rbac-seeder.ts`

✅ **Line 81** (high confidence)

**Before:**
```
.where(eq(organizationalUnits.tenantId, tenantId))
```

**After:**
```
.where(eq(organizationalUnits.tenant_id, tenantId))
```

---

### `server\enhanced-rbac-schema.ts`

✅ **Line 79** (high confidence)

**Before:**
```
index('idx_org_units_tenant').on(table.tenantId),
```

**After:**
```
index('idx_org_units_tenant').on(table.tenant_id),
```

---

✅ **Line 129** (high confidence)

**Before:**
```
index('idx_enhanced_roles_tenant').on(table.tenantId),
```

**After:**
```
index('idx_enhanced_roles_tenant').on(table.tenant_id),
```

---

⚠️ **Line 234** (medium confidence)

**Before:**
```
index('idx_user_role_assignments_user').on(table.userId),
```

**After:**
```
index('idx_user_role_assignments_user').on(table.user_id),
```

---

✅ **Line 236** (high confidence)

**Before:**
```
index('idx_user_role_assignments_tenant').on(table.tenantId),
```

**After:**
```
index('idx_user_role_assignments_tenant').on(table.tenant_id),
```

---

⚠️ **Line 279** (medium confidence)

**Before:**
```
index('idx_permission_overrides_user').on(table.userId),
```

**After:**
```
index('idx_permission_overrides_user').on(table.user_id),
```

---

⚠️ **Line 312** (medium confidence)

**Before:**
```
index('idx_permission_cache_user_context').on(table.userId, table.organizationalContext),
```

**After:**
```
index('idx_permission_cache_user_context').on(table.user_id, table.organizationalContext),
```

---

⚠️ **Line 403** (medium confidence)

**Before:**
```
userIdIdx: index('rbac_audit_user_id_idx').on(table.userId),
```

**After:**
```
userIdIdx: index('rbac_audit_user_id_idx').on(table.user_id),
```

---

✅ **Line 404** (high confidence)

**Before:**
```
tenantIdIdx: index('rbac_audit_tenant_id_idx').on(table.tenantId),
```

**After:**
```
tenantIdIdx: index('rbac_audit_tenant_id_idx').on(table.tenant_id),
```

---

⚠️ **Line 405** (medium confidence)

**Before:**
```
createdAtIdx: index('rbac_audit_created_at_idx').on(table.createdAt),
```

**After:**
```
createdAtIdx: index('rbac_audit_created_at_idx').on(table.created_at),
```

---

### `server\cache-service.ts`

✅ **Line 313** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\auth-setup.ts`

✅ **Line 310** (high confidence)

**Before:**
```
.where(and(eq(teams.department, 'sales'), eq(teams.tenantId, demoTenant.id)));
```

**After:**
```
.where(and(eq(teams.department, 'sales'), eq(teams.tenant_id, demoTenant.id)));
```

---

✅ **Line 318** (high confidence)

**Before:**
```
.where(and(eq(teams.department, 'service'), eq(teams.tenantId, demoTenant.id)));
```

**After:**
```
.where(and(eq(teams.department, 'service'), eq(teams.tenant_id, demoTenant.id)));
```

---

### `server\auth-routes.ts`

⚠️ **Line 276** (medium confidence)

**Before:**
```
req.session.userId = user.id;
```

**After:**
```
req.session.user_id = user.id;
```

---

✅ **Line 277** (high confidence)

**Before:**
```
req.session.tenantId = user.tenantId || undefined;
```

**After:**
```
req.session.tenant_id = user.tenant_id || undefined;
```

---

✅ **Line 291** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 366** (high confidence)

**Before:**
```
tenantId: testUser.tenantId,
```

**After:**
```
tenantId: testUser.tenant_id,
```

---

✅ **Line 392** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 393** (high confidence)

**Before:**
```
tenant_id: user.tenantId,
```

**After:**
```
tenant_id: user.tenant_id,
```

---

⚠️ **Line 553** (medium confidence)

**Before:**
```
const [user] = await db.select().from(users).where(eq(users.id, verification.userId)).limit(1);
```

**After:**
```
const [user] = await db.select().from(users).where(eq(users.id, verification.user_id)).limit(1);
```

---

⚠️ **Line 574** (medium confidence)

**Before:**
```
req.session.userId = user.id;
```

**After:**
```
req.session.user_id = user.id;
```

---

✅ **Line 575** (high confidence)

**Before:**
```
req.session.tenantId = user.tenantId || undefined;
```

**After:**
```
req.session.tenant_id = user.tenant_id || undefined;
```

---

✅ **Line 586** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

⚠️ **Line 616** (medium confidence)

**Before:**
```
.where(eq(emailVerifications.userId, user.id))
```

**After:**
```
.where(eq(emailVerifications.user_id, user.id))
```

---

⚠️ **Line 617** (medium confidence)

**Before:**
```
.orderBy(desc(emailVerifications.createdAt))
```

**After:**
```
.orderBy(desc(emailVerifications.created_at))
```

---

⚠️ **Line 788** (medium confidence)

**Before:**
```
const [user] = await db.select().from(users).where(eq(users.id, resetRecord.userId)).limit(1);
```

**After:**
```
const [user] = await db.select().from(users).where(eq(users.id, resetRecord.user_id)).limit(1);
```

---

### `server\apollo-storage.ts`

✅ **Line 75** (high confidence)

**Before:**
```
const conditions = [eq(tenantApolloLeads.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(tenantApolloLeads.tenant_id, tenantId)];
```

---

⚠️ **Line 89** (medium confidence)

**Before:**
```
.orderBy(desc(tenantApolloLeads.createdAt));
```

**After:**
```
.orderBy(desc(tenantApolloLeads.created_at));
```

---

✅ **Line 106** (high confidence)

**Before:**
```
.where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenant_id, tenantId)))
```

---

✅ **Line 119** (high confidence)

**Before:**
```
and(eq(tenantApolloLeads.apolloId, apolloId), eq(tenantApolloLeads.tenantId, tenantId)),
```

**After:**
```
and(eq(tenantApolloLeads.apolloId, apolloId), eq(tenantApolloLeads.tenant_id, tenantId)),
```

---

✅ **Line 138** (high confidence)

**Before:**
```
.where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(tenantApolloLeads.id, id), eq(tenantApolloLeads.tenant_id, tenantId)))
```

---

✅ **Line 269** (high confidence)

**Before:**
```
eq(apolloApiUsage.tenantId, tenantId),
```

**After:**
```
eq(apolloApiUsage.tenant_id, tenantId),
```

---

⚠️ **Line 270** (medium confidence)

**Before:**
```
gte(apolloApiUsage.createdAt, startDate),
```

**After:**
```
gte(apolloApiUsage.created_at, startDate),
```

---

⚠️ **Line 271** (medium confidence)

**Before:**
```
lt(apolloApiUsage.createdAt, endDate),
```

**After:**
```
lt(apolloApiUsage.created_at, endDate),
```

---

### `server\analytics-routes.ts`

✅ **Line 8** (high confidence)

**Before:**
```
const tenantId = req.session?.tenantId;
```

**After:**
```
const tenantId = req.session?.tenant_id;
```

---

### `supabase\functions\territories\index.ts`

✅ **Line 52** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 54** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\users\index.ts`

✅ **Line 38** (high confidence)

**Before:**
```
let tenantId = (user.app_metadata as any)?.tenantId;
```

**After:**
```
let tenantId = (user.app_metadata as any)?.tenant_id;
```

---

### `supabase\functions\teams\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\technicians\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

⚠️ **Line 208** (medium confidence)

**Before:**
```
user_id: body.userId || body.user_id || null,
```

**After:**
```
user_id: body.user_id || body.user_id || null,
```

---

### `supabase\functions\tasks\index.ts`

✅ **Line 42** (high confidence)

**Before:**
```
let tenantId = (user.app_metadata as any)?.tenantId;
```

**After:**
```
let tenantId = (user.app_metadata as any)?.tenant_id;
```

---

### `supabase\functions\software-products\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\settings\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\service-tickets\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\search\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\roles\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\reports\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\quotes\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\proposals\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\projects\index.ts`

✅ **Line 39** (high confidence)

**Before:**
```
let tenantId = (user.app_metadata as any)?.tenantId;
```

**After:**
```
let tenantId = (user.app_metadata as any)?.tenant_id;
```

---

### `supabase\functions\products\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\product-models\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\pricing\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\pipeline\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\opportunities\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\onboarding\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\notifications\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

⚠️ **Line 160** (medium confidence)

**Before:**
```
user_id: body.userId || body.user_id || user.id,
```

**After:**
```
user_id: body.user_id || body.user_id || user.id,
```

---

### `supabase\functions\meter-readings\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\me\index.ts`

✅ **Line 86** (high confidence)

**Before:**
```
tenantId: (user.app_metadata as any)?.tenantId,
```

**After:**
```
tenantId: (user.app_metadata as any)?.tenant_id,
```

---

✅ **Line 152** (high confidence)

**Before:**
```
tenantId: profile.tenant_id ?? profile.tenantId ?? (user.app_metadata as any)?.tenantId,
```

**After:**
```
tenantId: profile.tenant_id ?? profile.tenant_id ?? (user.app_metadata as any)?.tenant_id,
```

---

### `supabase\functions\locations\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\leases\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\invoices\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\inventory\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\import\index.ts`

✅ **Line 51** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 53** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

✅ **Line 334** (high confidence)

**Before:**
```
.eq('tenant_id', job.tenantId)
```

**After:**
```
.eq('tenant_id', job.tenant_id)
```

---

✅ **Line 393** (high confidence)

**Before:**
```
.eq('tenant_id', job.tenantId)
```

**After:**
```
.eq('tenant_id', job.tenant_id)
```

---

✅ **Line 399** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

⚠️ **Line 404** (medium confidence)

**Before:**
```
created_by: job.userId,
```

**After:**
```
created_by: job.user_id,
```

---

✅ **Line 418** (high confidence)

**Before:**
```
.eq('tenant_id', job.tenantId)
```

**After:**
```
.eq('tenant_id', job.tenant_id)
```

---

✅ **Line 500** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

✅ **Line 535** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

⚠️ **Line 538** (medium confidence)

**Before:**
```
created_by: job.userId,
```

**After:**
```
created_by: job.user_id,
```

---

✅ **Line 660** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

⚠️ **Line 682** (medium confidence)

**Before:**
```
created_by: job.userId,
```

**After:**
```
created_by: job.user_id,
```

---

⚠️ **Line 683** (medium confidence)

**Before:**
```
business_owner: job.userId,
```

**After:**
```
business_owner: job.user_id,
```

---

✅ **Line 698** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

⚠️ **Line 703** (medium confidence)

**Before:**
```
created_by: job.userId,
```

**After:**
```
created_by: job.user_id,
```

---

✅ **Line 715** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

✅ **Line 733** (high confidence)

**Before:**
```
tenant_id: job.tenantId,
```

**After:**
```
tenant_id: job.tenant_id,
```

---

⚠️ **Line 736** (medium confidence)

**Before:**
```
created_by: job.userId,
```

**After:**
```
created_by: job.user_id,
```

---

### `supabase\functions\files\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\exports\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\equipment\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\enabled-products\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\deals\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\customers\index.ts`

✅ **Line 30** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 32** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\contracts\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\contacts\index.ts`

✅ **Line 30** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 32** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\company-contacts\index.ts`

✅ **Line 35** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 37** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\companies\index.ts`

✅ **Line 77** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 79** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\catalog\index.ts`

✅ **Line 29** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 31** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\business-records\index.ts`

✅ **Line 40** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 42** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\appointments\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\activities\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `supabase\functions\analytics\index.ts`

✅ **Line 25** (high confidence)

**Before:**
```
(user.app_metadata?.tenantId as string) ||
```

**After:**
```
(user.app_metadata?.tenant_id as string) ||
```

---

✅ **Line 27** (high confidence)

**Before:**
```
(user.user_metadata?.tenantId as string) ||
```

**After:**
```
(user.user_metadata?.tenant_id as string) ||
```

---

### `server\utils\company-id-generator.ts`

✅ **Line 22** (high confidence)

**Before:**
```
sql`${businessRecords.tenantId} = ${tenantId} AND ${businessRecords.companyDisplayId} = ${displayId}`,
```

**After:**
```
sql`${businessRecords.tenant_id} = ${tenantId} AND ${businessRecords.companyDisplayId} = ${displayId}`,
```

---

✅ **Line 77** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 83** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 171** (high confidence)

**Before:**
```
sql`${businessRecords.tenantId} = ${tenantId} AND ${businessRecords.companyDisplayId} IS NULL`,
```

**After:**
```
sql`${businessRecords.tenant_id} = ${tenantId} AND ${businessRecords.companyDisplayId} IS NULL`,
```

---

### `server\utils\auth-helpers.ts`

⚠️ **Line 13** (medium confidence)

**Before:**
```
* 3. Session-based auth (req.session.userId)
```

**After:**
```
* 3. Session-based auth (req.session.user_id)
```

---

⚠️ **Line 37** (medium confidence)

**Before:**
```
if (reqAny.session?.userId) {
```

**After:**
```
if (reqAny.session?.user_id) {
```

---

⚠️ **Line 38** (medium confidence)

**Before:**
```
return reqAny.session.userId;
```

**After:**
```
return reqAny.session.user_id;
```

---

✅ **Line 59** (high confidence)

**Before:**
```
if (reqAny.tenantId) {
```

**After:**
```
if (reqAny.tenant_id) {
```

---

✅ **Line 60** (high confidence)

**Before:**
```
return reqAny.tenantId;
```

**After:**
```
return reqAny.tenant_id;
```

---

✅ **Line 64** (high confidence)

**Before:**
```
if (reqAny.supabaseUser?.tenantId) {
```

**After:**
```
if (reqAny.supabaseUser?.tenant_id) {
```

---

✅ **Line 65** (high confidence)

**Before:**
```
return reqAny.supabaseUser.tenantId;
```

**After:**
```
return reqAny.supabaseUser.tenant_id;
```

---

✅ **Line 69** (high confidence)

**Before:**
```
if (reqAny.user?.tenantId) {
```

**After:**
```
if (reqAny.user?.tenant_id) {
```

---

✅ **Line 70** (high confidence)

**Before:**
```
return reqAny.user.tenantId;
```

**After:**
```
return reqAny.user.tenant_id;
```

---

✅ **Line 74** (high confidence)

**Before:**
```
if (reqAny.session?.tenantId) {
```

**After:**
```
if (reqAny.session?.tenant_id) {
```

---

✅ **Line 75** (high confidence)

**Before:**
```
return reqAny.session.tenantId;
```

**After:**
```
return reqAny.session.tenant_id;
```

---

### `server\storage\security-storage.ts`

✅ **Line 102** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, tenantId),
```

**After:**
```
where: eq(complianceSettings.tenant_id, tenantId),
```

---

✅ **Line 115** (high confidence)

**Before:**
```
tenantId: settings.tenantId,
```

**After:**
```
tenantId: settings.tenant_id,
```

---

✅ **Line 153** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, tenantId),
```

**After:**
```
where: eq(complianceSettings.tenant_id, tenantId),
```

---

✅ **Line 163** (high confidence)

**Before:**
```
.where(eq(complianceSettings.tenantId, tenantId));
```

**After:**
```
.where(eq(complianceSettings.tenant_id, tenantId));
```

---

✅ **Line 190** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, tenantId),
```

**After:**
```
where: eq(complianceSettings.tenant_id, tenantId),
```

---

✅ **Line 217** (high confidence)

**Before:**
```
where: eq(complianceSettings.tenantId, tenantId),
```

**After:**
```
where: eq(complianceSettings.tenant_id, tenantId),
```

---

✅ **Line 228** (high confidence)

**Before:**
```
.where(eq(complianceSettings.tenantId, tenantId));
```

**After:**
```
.where(eq(complianceSettings.tenant_id, tenantId));
```

---

✅ **Line 261** (high confidence)

**Before:**
```
eq(users.tenantId, tenantId),
```

**After:**
```
eq(users.tenant_id, tenantId),
```

---

⚠️ **Line 302** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)))
```

**After:**
```
.where(and(eq(securitySessions.user_id, userId), eq(securitySessions.isActive, true)))
```

---

⚠️ **Line 310** (medium confidence)

**Before:**
```
createdAt: session.createdAt,
```

**After:**
```
createdAt: session.created_at,
```

---

⚠️ **Line 333** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)));
```

**After:**
```
.where(and(eq(securitySessions.user_id, userId), eq(securitySessions.isActive, true)));
```

---

⚠️ **Line 356** (medium confidence)

**Before:**
```
userId: session.userId,
```

**After:**
```
userId: session.user_id,
```

---

✅ **Line 357** (high confidence)

**Before:**
```
tenantId: session.tenantId,
```

**After:**
```
tenantId: session.tenant_id,
```

---

### `server\services\workflow-triggers.ts`

✅ **Line 347** (high confidence)

**Before:**
```
tenantId: event.tenantId,
```

**After:**
```
tenantId: event.tenant_id,
```

---

⚠️ **Line 348** (medium confidence)

**Before:**
```
createdBy: event.userId,
```

**After:**
```
createdBy: event.user_id,
```

---

✅ **Line 378** (high confidence)

**Before:**
```
*   tenantId: req.user.tenantId,
```

**After:**
```
*   tenantId: req.user.tenant_id,
```

---

### `server\services\workflow-execution-service.ts`

✅ **Line 79** (high confidence)

**Before:**
```
tenantId: execution.tenantId,
```

**After:**
```
tenantId: execution.tenant_id,
```

---

✅ **Line 272** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

⚠️ **Line 278** (medium confidence)

**Before:**
```
createdBy: context.userId || 'system',
```

**After:**
```
createdBy: context.user_id || 'system',
```

---

⚠️ **Line 315** (medium confidence)

**Before:**
```
orderBy: (steps, { desc }) => [desc(steps.createdAt)],
```

**After:**
```
orderBy: (steps, { desc }) => [desc(steps.created_at)],
```

---

✅ **Line 326** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

### `server\services\workflow-event-service.ts`

✅ **Line 78** (high confidence)

**Before:**
```
if (!workflow || workflow.status !== 'active' || workflow.tenantId !== tenantId) {
```

**After:**
```
if (!workflow || workflow.status !== 'active' || workflow.tenant_id !== tenantId) {
```

---

✅ **Line 332** (high confidence)

**Before:**
```
where: and(eq(workflowExecutions.tenantId, tenantId), eq(workflowExecutions.status, 'queued')),
```

**After:**
```
where: and(eq(workflowExecutions.tenant_id, tenantId), eq(workflowExecutions.status, 'queued')),
```

---

### `server\services\white-label-service.ts`

✅ **Line 22** (high confidence)

**Before:**
```
where: eq(whiteLabelConfig.tenantId, tenantId),
```

**After:**
```
where: eq(whiteLabelConfig.tenant_id, tenantId),
```

---

✅ **Line 45** (high confidence)

**Before:**
```
.where(eq(whiteLabelConfig.tenantId, tenantId))
```

**After:**
```
.where(eq(whiteLabelConfig.tenant_id, tenantId))
```

---

✅ **Line 82** (high confidence)

**Before:**
```
and(eq(whiteLabelConfig.tenantId, tenantId), eq(whiteLabelConfig.customDomain, domain)),
```

**After:**
```
and(eq(whiteLabelConfig.tenant_id, tenantId), eq(whiteLabelConfig.customDomain, domain)),
```

---

✅ **Line 93** (high confidence)

**Before:**
```
where: eq(whiteLabelEmailTemplates.tenantId, tenantId),
```

**After:**
```
where: eq(whiteLabelEmailTemplates.tenant_id, tenantId),
```

---

✅ **Line 107** (high confidence)

**Before:**
```
eq(whiteLabelEmailTemplates.tenantId, tenantId),
```

**After:**
```
eq(whiteLabelEmailTemplates.tenant_id, tenantId),
```

---

✅ **Line 126** (high confidence)

**Before:**
```
eq(whiteLabelEmailTemplates.tenantId, tenantId),
```

**After:**
```
eq(whiteLabelEmailTemplates.tenant_id, tenantId),
```

---

✅ **Line 141** (high confidence)

**Before:**
```
eq(whiteLabelEmailTemplates.tenantId, tenantId),
```

**After:**
```
eq(whiteLabelEmailTemplates.tenant_id, tenantId),
```

---

✅ **Line 172** (high confidence)

**Before:**
```
eq(whiteLabelEmailTemplates.tenantId, tenantId),
```

**After:**
```
eq(whiteLabelEmailTemplates.tenant_id, tenantId),
```

---

### `server\services\warehouse-reporting-service.ts`

⚠️ **Line 109** (medium confidence)

**Before:**
```
const cacheKey = `warehouse-team-quick-stats:${userContext.userId}:${JSON.stringify(dateRange || {})}`;
```

**After:**
```
const cacheKey = `warehouse-team-quick-stats:${userContext.user_id}:${JSON.stringify(dateRange || {})}`;
```

---

✅ **Line 131** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, userContext.tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, userContext.tenant_id),
```

---

⚠️ **Line 135** (medium confidence)

**Before:**
```
gte(warehouseKittingOperations.createdAt, dateFrom),
```

**After:**
```
gte(warehouseKittingOperations.created_at, dateFrom),
```

---

⚠️ **Line 136** (medium confidence)

**Before:**
```
lte(warehouseKittingOperations.createdAt, dateTo),
```

**After:**
```
lte(warehouseKittingOperations.created_at, dateTo),
```

---

⚠️ **Line 139** (medium confidence)

**Before:**
```
.orderBy(desc(warehouseKittingOperations.createdAt));
```

**After:**
```
.orderBy(desc(warehouseKittingOperations.created_at));
```

---

✅ **Line 208** (high confidence)

**Before:**
```
eq(warehouseKittingOperations.tenantId, userContext.tenantId),
```

**After:**
```
eq(warehouseKittingOperations.tenant_id, userContext.tenant_id),
```

---

⚠️ **Line 212** (medium confidence)

**Before:**
```
gte(warehouseKittingOperations.createdAt, previousDateFrom),
```

**After:**
```
gte(warehouseKittingOperations.created_at, previousDateFrom),
```

---

⚠️ **Line 213** (medium confidence)

**Before:**
```
lte(warehouseKittingOperations.createdAt, dateFrom),
```

**After:**
```
lte(warehouseKittingOperations.created_at, dateFrom),
```

---

### `server\services\user-lifecycle-service.ts`

✅ **Line 113** (high confidence)

**Before:**
```
eq(userProvisioningTemplates.tenantId, tenantId),
```

**After:**
```
eq(userProvisioningTemplates.tenant_id, tenantId),
```

---

✅ **Line 123** (high confidence)

**Before:**
```
sql`${userProvisioningTemplates.tenantId} IS NULL`,
```

**After:**
```
sql`${userProvisioningTemplates.tenant_id} IS NULL`,
```

---

✅ **Line 154** (high confidence)

**Before:**
```
? eq(userProvisioningTemplates.tenantId, tenantId)
```

**After:**
```
? eq(userProvisioningTemplates.tenant_id, tenantId)
```

---

✅ **Line 155** (high confidence)

**Before:**
```
: sql`${userProvisioningTemplates.tenantId} IS NULL`,
```

**After:**
```
: sql`${userProvisioningTemplates.tenant_id} IS NULL`,
```

---

⚠️ **Line 527** (medium confidence)

**Before:**
```
userId: result.userId,
```

**After:**
```
userId: result.user_id,
```

---

✅ **Line 811** (high confidence)

**Before:**
```
eq(accessReviews.tenantId, tenantId),
```

**After:**
```
eq(accessReviews.tenant_id, tenantId),
```

---

✅ **Line 899** (high confidence)

**Before:**
```
tenantId: session.tenantId,
```

**After:**
```
tenantId: session.tenant_id,
```

---

### `server\services\usage-tracking-service.ts`

✅ **Line 41** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 44** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 54** (high confidence)

**Before:**
```
eq(usageMetrics.tenantId, tenantId),
```

**After:**
```
eq(usageMetrics.tenant_id, tenantId),
```

---

✅ **Line 173** (high confidence)

**Before:**
```
eq(users.tenantId, tenantId),
```

**After:**
```
eq(users.tenant_id, tenantId),
```

---

✅ **Line 183** (high confidence)

**Before:**
```
.where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));
```

**After:**
```
.where(and(eq(users.tenant_id, tenantId), eq(users.isActive, true)));
```

---

✅ **Line 189** (high confidence)

**Before:**
```
.where(and(eq(locations.tenantId, tenantId), eq(locations.isActive, true)));
```

**After:**
```
.where(and(eq(locations.tenant_id, tenantId), eq(locations.isActive, true)));
```

---

✅ **Line 195** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.isDeleted, false)));
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.isDeleted, false)));
```

---

✅ **Line 231** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 234** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 320** (high confidence)

**Before:**
```
where: and(eq(dailyUsageSnapshots.tenantId, tenantId), eq(dailyUsageSnapshots.date, today)),
```

**After:**
```
where: and(eq(dailyUsageSnapshots.tenant_id, tenantId), eq(dailyUsageSnapshots.date, today)),
```

---

✅ **Line 358** (high confidence)

**Before:**
```
eq(dailyUsageSnapshots.tenantId, tenantId),
```

**After:**
```
eq(dailyUsageSnapshots.tenant_id, tenantId),
```

---

✅ **Line 476** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 479** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

### `server\services\unified-meter-collection-service.ts`

✅ **Line 73** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 107** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 124** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 146** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 162** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 182** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 195** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 201** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 208** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 230** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

✅ **Line 237** (high confidence)

**Before:**
```
integration.tenantId,
```

**After:**
```
integration.tenant_id,
```

---

### `server\services\trial-management-service.ts`

✅ **Line 29** (high confidence)

**Before:**
```
if (!user || !user.tenantId) {
```

**After:**
```
if (!user || !user.tenant_id) {
```

---

✅ **Line 33** (high confidence)

**Before:**
```
const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
```

**After:**
```
const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
```

---

⚠️ **Line 35** (medium confidence)

**Before:**
```
if (!tenant || !tenant.createdAt) {
```

**After:**
```
if (!tenant || !tenant.created_at) {
```

---

⚠️ **Line 40** (medium confidence)

**Before:**
```
const trialStartDate = new Date(tenant.createdAt);
```

**After:**
```
const trialStartDate = new Date(tenant.created_at);
```

---

✅ **Line 153** (high confidence)

**Before:**
```
tenantId: users.tenantId,
```

**After:**
```
tenantId: users.tenant_id,
```

---

✅ **Line 156** (high confidence)

**Before:**
```
.where(sql`${users.tenantId} IS NOT NULL`);
```

**After:**
```
.where(sql`${users.tenant_id} IS NOT NULL`);
```

---

✅ **Line 215** (high confidence)

**Before:**
```
tenantId: users.tenantId,
```

**After:**
```
tenantId: users.tenant_id,
```

---

✅ **Line 218** (high confidence)

**Before:**
```
.where(sql`${users.tenantId} IS NOT NULL`);
```

**After:**
```
.where(sql`${users.tenant_id} IS NOT NULL`);
```

---

### `server\services\ticket-creation-service.ts`

✅ **Line 36** (high confidence)

**Before:**
```
this.tenantId = tenantId;
```

**After:**
```
this.tenant_id = tenantId;
```

---

✅ **Line 85** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, this.tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, this.tenant_id),
```

---

✅ **Line 101** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 125** (high confidence)

**Before:**
```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customerId)),
```

**After:**
```
where: and(eq(equipment.tenant_id, this.tenant_id), eq(equipment.customerId, customerId)),
```

---

✅ **Line 205** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 270** (high confidence)

**Before:**
```
eq(users.tenantId, this.tenantId),
```

**After:**
```
eq(users.tenant_id, this.tenant_id),
```

---

✅ **Line 401** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, this.tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, this.tenant_id),
```

---

✅ **Line 495** (high confidence)

**Before:**
```
eq(serviceTickets.tenantId, this.tenantId),
```

**After:**
```
eq(serviceTickets.tenant_id, this.tenant_id),
```

---

### `server\services\territory-management-service.ts`

✅ **Line 98** (high confidence)

**Before:**
```
where: and(eq(salesTerritories.id, territoryId), eq(salesTerritories.tenantId, tenantId)),
```

**After:**
```
where: and(eq(salesTerritories.id, territoryId), eq(salesTerritories.tenant_id, tenantId)),
```

---

✅ **Line 120** (high confidence)

**Before:**
```
const conditions = [eq(salesTerritories.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(salesTerritories.tenant_id, tenantId)];
```

---

✅ **Line 166** (high confidence)

**Before:**
```
.where(and(eq(salesTerritories.id, territoryId), eq(salesTerritories.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(salesTerritories.id, territoryId), eq(salesTerritories.tenant_id, tenantId)))
```

---

✅ **Line 212** (high confidence)

**Before:**
```
where: and(eq(salesTerritories.tenantId, tenantId), eq(salesTerritories.isActive, true)),
```

**After:**
```
where: and(eq(salesTerritories.tenant_id, tenantId), eq(salesTerritories.isActive, true)),
```

---

✅ **Line 327** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenant_id, tenantId)));
```

---

✅ **Line 382** (high confidence)

**Before:**
```
const conditions = [eq(leadAssignmentRules.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(leadAssignmentRules.tenant_id, tenantId)];
```

---

✅ **Line 413** (high confidence)

**Before:**
```
where: and(eq(leadAssignmentRules.id, ruleId), eq(leadAssignmentRules.tenantId, tenantId)),
```

**After:**
```
where: and(eq(leadAssignmentRules.id, ruleId), eq(leadAssignmentRules.tenant_id, tenantId)),
```

---

✅ **Line 429** (high confidence)

**Before:**
```
.where(and(eq(leadAssignmentRules.id, ruleId), eq(leadAssignmentRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(leadAssignmentRules.id, ruleId), eq(leadAssignmentRules.tenant_id, tenantId)))
```

---

⚠️ **Line 449** (medium confidence)

**Before:**
```
where: and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.userId, userId)),
```

**After:**
```
where: and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.user_id, userId)),
```

---

✅ **Line 449** (high confidence)

**Before:**
```
where: and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.userId, userId)),
```

**After:**
```
where: and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.userId, userId)),
```

---

⚠️ **Line 477** (medium confidence)

**Before:**
```
.where(and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.userId, userId)))
```

**After:**
```
.where(and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.user_id, userId)))
```

---

✅ **Line 477** (high confidence)

**Before:**
```
.where(and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.userId, userId)))
```

**After:**
```
.where(and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.userId, userId)))
```

---

✅ **Line 493** (high confidence)

**Before:**
```
const conditions = [eq(repCapacity.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(repCapacity.tenant_id, tenantId)];
```

---

✅ **Line 527** (high confidence)

**Before:**
```
eq(repCapacity.tenantId, tenantId),
```

**After:**
```
eq(repCapacity.tenant_id, tenantId),
```

---

⚠️ **Line 536** (medium confidence)

**Before:**
```
conditions.push(inArray(repCapacity.userId, territory.teamMembers));
```

**After:**
```
conditions.push(inArray(repCapacity.user_id, territory.teamMembers));
```

---

✅ **Line 569** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 588** (high confidence)

**Before:**
```
eq(leadAssignmentHistory.tenantId, tenantId),
```

**After:**
```
eq(leadAssignmentHistory.tenant_id, tenantId),
```

---

✅ **Line 633** (high confidence)

**Before:**
```
.where(eq(salesTerritories.tenantId, tenantId)),
```

**After:**
```
.where(eq(salesTerritories.tenant_id, tenantId)),
```

---

✅ **Line 637** (high confidence)

**Before:**
```
.where(and(eq(salesTerritories.tenantId, tenantId), eq(salesTerritories.isActive, true))),
```

**After:**
```
.where(and(eq(salesTerritories.tenant_id, tenantId), eq(salesTerritories.isActive, true))),
```

---

✅ **Line 641** (high confidence)

**Before:**
```
.where(eq(salesTerritories.tenantId, tenantId))
```

**After:**
```
.where(eq(salesTerritories.tenant_id, tenantId))
```

---

✅ **Line 646** (high confidence)

**Before:**
```
.where(eq(salesTerritories.tenantId, tenantId)),
```

**After:**
```
.where(eq(salesTerritories.tenant_id, tenantId)),
```

---

✅ **Line 652** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 662** (high confidence)

**Before:**
```
eq(repCapacity.tenantId, tenantId),
```

**After:**
```
eq(repCapacity.tenant_id, tenantId),
```

---

### `server\services\tenant-onboarding-service.ts`

✅ **Line 1121** (high confidence)

**Before:**
```
target: tenantHealthScores.tenantId,
```

**After:**
```
target: tenantHealthScores.tenant_id,
```

---

✅ **Line 1182** (high confidence)

**Before:**
```
where: eq(integrationSetupLogs.tenantId, tenantId),
```

**After:**
```
where: eq(integrationSetupLogs.tenant_id, tenantId),
```

---

### `server\services\team-reporting-service.ts`

✅ **Line 267** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 273** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 279** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 295** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 409** (high confidence)

**Before:**
```
AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 412** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 505** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 524** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 532** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 539** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 578** (high confidence)

**Before:**
```
AND tenant_id = ${userContext.tenantId}
```

**After:**
```
AND tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 583** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 660** (high confidence)

**Before:**
```
AND br.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND br.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 680** (high confidence)

**Before:**
```
AND br.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND br.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 702** (high confidence)

**Before:**
```
AND br.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND br.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 782** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 796** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 805** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 815** (high confidence)

**Before:**
```
WHERE tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 820** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\team-collaboration-service.ts`

✅ **Line 133** (high confidence)

**Before:**
```
tenantId: teamData.tenantId || 'mock-tenant',
```

**After:**
```
tenantId: teamData.tenant_id || 'mock-tenant',
```

---

⚠️ **Line 170** (medium confidence)

**Before:**
```
userId: memberData.userId || 'new-user',
```

**After:**
```
userId: memberData.user_id || 'new-user',
```

---

✅ **Line 206** (high confidence)

**Before:**
```
tenantId: projectData.tenantId || 'mock-tenant',
```

**After:**
```
tenantId: projectData.tenant_id || 'mock-tenant',
```

---

⚠️ **Line 263** (medium confidence)

**Before:**
```
${teamMembers.map((m) => `- ${m.userId}: Skills: ${m.skills.join(', ')}, Capacity: ${m.workloadCapacity}x, Current: ${currentCapacity.memberAnalytics[m.userId]?.utilizationPercentage || 0}%`).join('\n')}
```

**After:**
```
${teamMembers.map((m) => `- ${m.user_id}: Skills: ${m.skills.join(', ')}, Capacity: ${m.workloadCapacity}x, Current: ${currentCapacity.memberAnalytics[m.user_id]?.utilizationPercentage || 0}%`).join('\n')}
```

---

⚠️ **Line 359** (medium confidence)

**Before:**
```
memberAnalytics[member.userId] = {
```

**After:**
```
memberAnalytics[member.user_id] = {
```

---

⚠️ **Line 361** (medium confidence)

**Before:**
```
userId: member.userId,
```

**After:**
```
userId: member.user_id,
```

---

### `server\services\team-alert-service.ts`

✅ **Line 56** (high confidence)

**Before:**
```
eq(alertConfigurations.tenantId, userContext.tenantId),
```

**After:**
```
eq(alertConfigurations.tenant_id, userContext.tenant_id),
```

---

⚠️ **Line 57** (medium confidence)

**Before:**
```
eq(alertConfigurations.userId, userContext.userId),
```

**After:**
```
eq(alertConfigurations.user_id, userContext.user_id),
```

---

✅ **Line 134** (high confidence)

**Before:**
```
tenantId: userContext.tenantId,
```

**After:**
```
tenantId: userContext.tenant_id,
```

---

✅ **Line 158** (high confidence)

**Before:**
```
eq(alertConfigurations.tenantId, userContext.tenantId),
```

**After:**
```
eq(alertConfigurations.tenant_id, userContext.tenant_id),
```

---

⚠️ **Line 159** (medium confidence)

**Before:**
```
eq(alertConfigurations.userId, userContext.userId),
```

**After:**
```
eq(alertConfigurations.user_id, userContext.user_id),
```

---

✅ **Line 252** (high confidence)

**Before:**
```
tenantId: userContext.tenantId,
```

**After:**
```
tenantId: userContext.tenant_id,
```

---

✅ **Line 279** (high confidence)

**Before:**
```
eq(alertInstances.tenantId, alertData.tenantId!),
```

**After:**
```
eq(alertInstances.tenant_id, alertData.tenant_id!),
```

---

⚠️ **Line 282** (medium confidence)

**Before:**
```
gte(alertInstances.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
```

**After:**
```
gte(alertInstances.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
```

---

⚠️ **Line 347** (medium confidence)

**Before:**
```
where: (users, { eq }) => eq(users.id, config.userId),
```

**After:**
```
where: (users, { eq }) => eq(users.id, config.user_id),
```

---

⚠️ **Line 351** (medium confidence)

**Before:**
```
console.error(`No email found for user ${config.userId}`);
```

**After:**
```
console.error(`No email found for user ${config.user_id}`);
```

---

✅ **Line 372** (high confidence)

**Before:**
```
tenantId: config.tenantId,
```

**After:**
```
tenantId: config.tenant_id,
```

---

⚠️ **Line 547** (medium confidence)

**Before:**
```
Alert ID: ${alert.id} | Created: ${new Date(alert.createdAt).toLocaleString()}
```

**After:**
```
Alert ID: ${alert.id} | Created: ${new Date(alert.created_at).toLocaleString()}
```

---

⚠️ **Line 577** (medium confidence)

**Before:**
```
text += `Created: ${new Date(alert.createdAt).toLocaleString()}\n`;
```

**After:**
```
text += `Created: ${new Date(alert.created_at).toLocaleString()}\n`;
```

---

✅ **Line 589** (high confidence)

**Before:**
```
.where(and(eq(alertInstances.tenantId, tenantId), eq(alertInstances.status, 'active')))
```

**After:**
```
.where(and(eq(alertInstances.tenant_id, tenantId), eq(alertInstances.status, 'active')))
```

---

⚠️ **Line 590** (medium confidence)

**Before:**
```
.orderBy(sql`${alertInstances.createdAt} DESC`)
```

**After:**
```
.orderBy(sql`${alertInstances.created_at} DESC`)
```

---

### `server\services\subscription-service.ts`

✅ **Line 222** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 228** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 247** (high confidence)

**Before:**
```
eq(usageMetrics.tenantId, tenantId),
```

**After:**
```
eq(usageMetrics.tenant_id, tenantId),
```

---

✅ **Line 351** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 354** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 447** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 450** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 528** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 531** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 599** (high confidence)

**Before:**
```
eq(tenantSubscriptions.tenantId, tenantId),
```

**After:**
```
eq(tenantSubscriptions.tenant_id, tenantId),
```

---

⚠️ **Line 602** (medium confidence)

**Before:**
```
orderBy: [desc(tenantSubscriptions.createdAt)],
```

**After:**
```
orderBy: [desc(tenantSubscriptions.created_at)],
```

---

✅ **Line 781** (high confidence)

**Before:**
```
tenantId: subscription.tenantId,
```

**After:**
```
tenantId: subscription.tenant_id,
```

---

✅ **Line 810** (high confidence)

**Before:**
```
const status = await this.getSubscriptionStatus(subscription.tenantId);
```

**After:**
```
const status = await this.getSubscriptionStatus(subscription.tenant_id);
```

---

✅ **Line 832** (high confidence)

**Before:**
```
tenantId: subscription.tenantId,
```

**After:**
```
tenantId: subscription.tenant_id,
```

---

✅ **Line 863** (high confidence)

**Before:**
```
tenantId: subscription.tenantId,
```

**After:**
```
tenantId: subscription.tenant_id,
```

---

### `server\services\stripe-service.ts`

✅ **Line 154** (high confidence)

**Before:**
```
where: eq(users.tenantId, tenantId),
```

**After:**
```
where: eq(users.tenant_id, tenantId),
```

---

✅ **Line 428** (high confidence)

**Before:**
```
const tenantId = subscription.metadata.tenantId;
```

**After:**
```
const tenantId = subscription.metadata.tenant_id;
```

---

✅ **Line 443** (high confidence)

**Before:**
```
const tenantId = subscription.metadata.tenantId;
```

**After:**
```
const tenantId = subscription.metadata.tenant_id;
```

---

✅ **Line 457** (high confidence)

**Before:**
```
.where(eq(tenantSubscriptions.tenantId, tenantId));
```

**After:**
```
.where(eq(tenantSubscriptions.tenant_id, tenantId));
```

---

✅ **Line 466** (high confidence)

**Before:**
```
const tenantId = subscription.metadata.tenantId;
```

**After:**
```
const tenantId = subscription.metadata.tenant_id;
```

---

✅ **Line 480** (high confidence)

**Before:**
```
.where(eq(tenantSubscriptions.tenantId, tenantId));
```

**After:**
```
.where(eq(tenantSubscriptions.tenant_id, tenantId));
```

---

✅ **Line 941** (high confidence)

**Before:**
```
const tenantId = session.metadata?.tenantId;
```

**After:**
```
const tenantId = session.metadata?.tenant_id;
```

---

✅ **Line 963** (high confidence)

**Before:**
```
.where(eq(tenantSubscriptions.tenantId, tenantId));
```

**After:**
```
.where(eq(tenantSubscriptions.tenant_id, tenantId));
```

---

✅ **Line 995** (high confidence)

**Before:**
```
const tenantId = session.metadata?.tenantId;
```

**After:**
```
const tenantId = session.metadata?.tenant_id;
```

---

✅ **Line 1007** (high confidence)

**Before:**
```
const tenantId = subscription.metadata.tenantId;
```

**After:**
```
const tenantId = subscription.metadata.tenant_id;
```

---

✅ **Line 1041** (high confidence)

**Before:**
```
const tenantId = paymentIntent.metadata?.tenantId;
```

**After:**
```
const tenantId = paymentIntent.metadata?.tenant_id;
```

---

✅ **Line 1064** (high confidence)

**Before:**
```
const tenantId = paymentIntent.metadata?.tenantId;
```

**After:**
```
const tenantId = paymentIntent.metadata?.tenant_id;
```

---

### `server\services\sso-service.ts`

✅ **Line 103** (high confidence)

**Before:**
```
const conditions = [eq(ssoProviderConfigs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(ssoProviderConfigs.tenant_id, tenantId)];
```

---

✅ **Line 129** (high confidence)

**Before:**
```
.where(eq(ssoProviderConfigs.tenantId, tenantId))
```

**After:**
```
.where(eq(ssoProviderConfigs.tenant_id, tenantId))
```

---

⚠️ **Line 130** (medium confidence)

**Before:**
```
.orderBy(ssoProviderConfigs.createdAt);
```

**After:**
```
.orderBy(ssoProviderConfigs.created_at);
```

---

✅ **Line 142** (high confidence)

**Before:**
```
.where(eq(ssoProviderConfigs.tenantId, config.tenantId));
```

**After:**
```
.where(eq(ssoProviderConfigs.tenant_id, config.tenant_id));
```

---

✅ **Line 191** (high confidence)

**Before:**
```
const provider = await this.getProviderConfig(request.tenantId, request.providerId);
```

**After:**
```
const provider = await this.getProviderConfig(request.tenant_id, request.providerId);
```

---

✅ **Line 247** (high confidence)

**Before:**
```
tenantId: request.tenantId,
```

**After:**
```
tenantId: request.tenant_id,
```

---

✅ **Line 305** (high confidence)

**Before:**
```
tenantId: request.tenantId,
```

**After:**
```
tenantId: request.tenant_id,
```

---

✅ **Line 331** (high confidence)

**Before:**
```
const tenantId = provider.providerSettings?.tenantId || 'common';
```

**After:**
```
const tenantId = provider.providerSettings?.tenant_id || 'common';
```

---

✅ **Line 516** (high confidence)

**Before:**
```
tenantId: provider.tenantId,
```

**After:**
```
tenantId: provider.tenant_id,
```

---

✅ **Line 688** (high confidence)

**Before:**
```
const tenantId = provider.providerSettings?.tenantId || 'common';
```

**After:**
```
const tenantId = provider.providerSettings?.tenant_id || 'common';
```

---

⚠️ **Line 796** (medium confidence)

**Before:**
```
const [user] = await db.select().from(users).where(eq(users.id, existingMapping.userId));
```

**After:**
```
const [user] = await db.select().from(users).where(eq(users.id, existingMapping.user_id));
```

---

✅ **Line 848** (high confidence)

**Before:**
```
tenantId: provider.tenantId,
```

**After:**
```
tenantId: provider.tenant_id,
```

---

✅ **Line 873** (high confidence)

**Before:**
```
tenantId: provider.tenantId,
```

**After:**
```
tenantId: provider.tenant_id,
```

---

✅ **Line 884** (high confidence)

**Before:**
```
tenantId: provider.tenantId,
```

**After:**
```
tenantId: provider.tenant_id,
```

---

✅ **Line 910** (high confidence)

**Before:**
```
tenantId: provider.tenantId,
```

**After:**
```
tenantId: provider.tenant_id,
```

---

✅ **Line 963** (high confidence)

**Before:**
```
tenantId: data.tenantId,
```

**After:**
```
tenantId: data.tenant_id,
```

---

⚠️ **Line 1142** (medium confidence)

**Before:**
```
userId: session.userId,
```

**After:**
```
userId: session.user_id,
```

---

✅ **Line 1143** (high confidence)

**Before:**
```
tenantId: session.tenantId,
```

**After:**
```
tenantId: session.tenant_id,
```

---

### `server\services\service-supervisor-reporting-service.ts`

✅ **Line 218** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 221** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 336** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 339** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 342** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 435** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 438** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 522** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 525** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

⚠️ **Line 595** (medium confidence)

**Before:**
```
const cacheKey = `team-quick-stats-${userContext.userId}`;
```

**After:**
```
const cacheKey = `team-quick-stats-${userContext.user_id}`;
```

---

### `server\services\service-reporting-service.ts`

✅ **Line 230** (high confidence)

**Before:**
```
AND st.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND st.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 347** (high confidence)

**Before:**
```
AND pu.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND pu.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 447** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 579** (high confidence)

**Before:**
```
WHERE st.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE st.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\service-manager-reporting-service.ts`

✅ **Line 224** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 227** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 345** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 348** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 351** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 447** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 450** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 537** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 540** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\sales-supervisor-reporting-service.ts`

✅ **Line 212** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 216** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 329** (high confidence)

**Before:**
```
LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 330** (high confidence)

**Before:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenantId} ${dateFilter}
```

**After:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenant_id} ${dateFilter}
```

---

✅ **Line 331** (high confidence)

**Before:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenantId} ${dateFilter}
```

**After:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenant_id} ${dateFilter}
```

---

✅ **Line 333** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 344** (high confidence)

**Before:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.stage = 'Closed Won' AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.stage = 'Closed Won' AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 438** (high confidence)

**Before:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 440** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 537** (high confidence)

**Before:**
```
LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 538** (high confidence)

**Before:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenantId} ${dateFilter}
```

**After:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenant_id} ${dateFilter}
```

---

✅ **Line 540** (high confidence)

**Before:**
```
AND l.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND l.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\sales-reporting-service.ts`

✅ **Line 185** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 240** (high confidence)

**Before:**
```
AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 305** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 373** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 406** (high confidence)

**Before:**
```
const cacheKey = `leaderboard:${metric}:${scope}:${userContext.tenantId}`;
```

**After:**
```
const cacheKey = `leaderboard:${metric}:${scope}:${userContext.tenant_id}`;
```

---

✅ **Line 447** (high confidence)

**Before:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 448** (high confidence)

**Before:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 450** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 499** (high confidence)

**Before:**
```
AND tenant_id = ${userContext.tenantId}
```

**After:**
```
AND tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 526** (high confidence)

**Before:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 527** (high confidence)

**Before:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 530** (high confidence)

**Before:**
```
AND u.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 620** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 662** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

⚠️ **Line 711** (medium confidence)

**Before:**
```
userId: individualPipelines[0].userId,
```

**After:**
```
userId: individualPipelines[0].user_id,
```

---

### `server\services\sales-manager-reporting-service.ts`

✅ **Line 218** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 222** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 330** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 333** (high confidence)

**Before:**
```
AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 336** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 347** (high confidence)

**Before:**
```
AND q.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND q.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 349** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 447** (high confidence)

**Before:**
```
AND q.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND q.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 449** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 460** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 463** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 474** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 477** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 581** (high confidence)

**Before:**
```
AND a.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND a.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 584** (high confidence)

**Before:**
```
AND r.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND r.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\route-optimization-service.ts`

✅ **Line 501** (high confidence)

**Before:**
```
tenantId: input.tenantId,
```

**After:**
```
tenantId: input.tenant_id,
```

---

### `server\services\product-pricing-service.ts`

✅ **Line 448** (high confidence)

**Before:**
```
where: eq(companyPricingSettings.tenantId, tenantId),
```

**After:**
```
where: eq(companyPricingSettings.tenant_id, tenantId),
```

---

✅ **Line 479** (high confidence)

**Before:**
```
where: eq(companyPricingSettings.tenantId, tenantId),
```

**After:**
```
where: eq(companyPricingSettings.tenant_id, tenantId),
```

---

### `server\services\pricing-service.ts`

✅ **Line 213** (high confidence)

**Before:**
```
.where(eq(companyPricingSettings.tenantId, tenantId))
```

**After:**
```
.where(eq(companyPricingSettings.tenant_id, tenantId))
```

---

### `server\services\predictive-service-dispatch-service.ts`

✅ **Line 177** (high confidence)

**Before:**
```
eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
```

**After:**
```
eq(clientCollectedMetrics.tenant_id, parseInt(tenantId)),
```

---

✅ **Line 393** (high confidence)

**Before:**
```
where: and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.isAvailable, true)),
```

**After:**
```
where: and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.isAvailable, true)),
```

---

⚠️ **Line 445** (medium confidence)

**Before:**
```
const technicianName = await getUserName(tech.userId);
```

**After:**
```
const technicianName = await getUserName(tech.user_id);
```

---

⚠️ **Line 448** (medium confidence)

**Before:**
```
technicianId: tech.userId,
```

**After:**
```
technicianId: tech.user_id,
```

---

### `server\services\pdf-generation-service.ts`

✅ **Line 638** (high confidence)

**Before:**
```
tenantId: invoices.tenantId,
```

**After:**
```
tenantId: invoices.tenant_id,
```

---

⚠️ **Line 639** (medium confidence)

**Before:**
```
createdAt: invoices.createdAt,
```

**After:**
```
createdAt: invoices.created_at,
```

---

⚠️ **Line 640** (medium confidence)

**Before:**
```
updatedAt: invoices.updatedAt,
```

**After:**
```
updatedAt: invoices.updated_at,
```

---

✅ **Line 644** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

### `server\services\payment-audit-service.ts`

✅ **Line 95** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

⚠️ **Line 96** (medium confidence)

**Before:**
```
userId: context.userId,
```

**After:**
```
userId: context.user_id,
```

---

✅ **Line 317** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

⚠️ **Line 318** (medium confidence)

**Before:**
```
userId: context.userId!,
```

**After:**
```
userId: context.user_id!,
```

---

✅ **Line 360** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

⚠️ **Line 361** (medium confidence)

**Before:**
```
userId: context.userId!,
```

**After:**
```
userId: context.user_id!,
```

---

✅ **Line 399** (high confidence)

**Before:**
```
tenantId: context.tenantId,
```

**After:**
```
tenantId: context.tenant_id,
```

---

⚠️ **Line 400** (medium confidence)

**Before:**
```
userId: context.userId!,
```

**After:**
```
userId: context.user_id!,
```

---

✅ **Line 583** (high confidence)

**Before:**
```
const conditions = [eq(paymentAuditTrail.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(paymentAuditTrail.tenant_id, tenantId)];
```

---

⚠️ **Line 594** (medium confidence)

**Before:**
```
if (options.userId) {
```

**After:**
```
if (options.user_id) {
```

---

⚠️ **Line 595** (medium confidence)

**Before:**
```
conditions.push(eq(paymentAuditTrail.userId, options.userId));
```

**After:**
```
conditions.push(eq(paymentAuditTrail.user_id, options.user_id));
```

---

✅ **Line 638** (high confidence)

**Before:**
```
const conditions = [eq(paymentMethodChanges.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(paymentMethodChanges.tenant_id, tenantId)];
```

---

⚠️ **Line 640** (medium confidence)

**Before:**
```
if (options.userId) {
```

**After:**
```
if (options.user_id) {
```

---

⚠️ **Line 641** (medium confidence)

**Before:**
```
conditions.push(eq(paymentMethodChanges.userId, options.userId));
```

**After:**
```
conditions.push(eq(paymentMethodChanges.user_id, options.user_id));
```

---

✅ **Line 696** (high confidence)

**Before:**
```
eq(paymentAuditTrail.tenantId, tenantId),
```

**After:**
```
eq(paymentAuditTrail.tenant_id, tenantId),
```

---

✅ **Line 779** (high confidence)

**Before:**
```
eq(paymentAuditTrail.tenantId, tenantId),
```

**After:**
```
eq(paymentAuditTrail.tenant_id, tenantId),
```

---

⚠️ **Line 780** (medium confidence)

**Before:**
```
eq(paymentAuditTrail.userId, userId),
```

**After:**
```
eq(paymentAuditTrail.user_id, userId),
```

---

✅ **Line 799** (high confidence)

**Before:**
```
eq(paymentMethodChanges.tenantId, tenantId),
```

**After:**
```
eq(paymentMethodChanges.tenant_id, tenantId),
```

---

⚠️ **Line 800** (medium confidence)

**Before:**
```
eq(paymentMethodChanges.userId, userId),
```

**After:**
```
eq(paymentMethodChanges.user_id, userId),
```

---

### `server\services\mileage-service.ts`

✅ **Line 63** (high confidence)

**Before:**
```
eq(mileageReimbursementRates.tenantId, tenantId),
```

**After:**
```
eq(mileageReimbursementRates.tenant_id, tenantId),
```

---

✅ **Line 183** (high confidence)

**Before:**
```
eq(technicianMileage.tenantId, tenantId),
```

**After:**
```
eq(technicianMileage.tenant_id, tenantId),
```

---

✅ **Line 248** (high confidence)

**Before:**
```
eq(technicianMileage.tenantId, tenantId),
```

**After:**
```
eq(technicianMileage.tenant_id, tenantId),
```

---

✅ **Line 405** (high confidence)

**Before:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenant_id, tenantId)))
```

---

✅ **Line 427** (high confidence)

**Before:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenant_id, tenantId)))
```

---

✅ **Line 443** (high confidence)

**Before:**
```
eq(technicianMileage.tenantId, tenantId),
```

**After:**
```
eq(technicianMileage.tenant_id, tenantId),
```

---

✅ **Line 470** (high confidence)

**Before:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(mileageReports.id, reportId), eq(mileageReports.tenant_id, tenantId)))
```

---

✅ **Line 510** (high confidence)

**Before:**
```
eq(irsMileageLogs.tenantId, tenantId),
```

**After:**
```
eq(irsMileageLogs.tenant_id, tenantId),
```

---

### `server\services\mfa-otp-service.ts`

⚠️ **Line 60** (medium confidence)

**Before:**
```
const key = createOtpKey(record.userId, record.method);
```

**After:**
```
const key = createOtpKey(record.user_id, record.method);
```

---

⚠️ **Line 67** (medium confidence)

**Before:**
```
if (current && current.createdAt.getTime() === record.createdAt.getTime()) {
```

**After:**
```
if (current && current.created_at.getTime() === record.created_at.getTime()) {
```

---

⚠️ **Line 113** (medium confidence)

**Before:**
```
const timeSinceCreated = Date.now() - existingOtp.createdAt.getTime();
```

**After:**
```
const timeSinceCreated = Date.now() - existingOtp.created_at.getTime();
```

---

⚠️ **Line 194** (medium confidence)

**Before:**
```
const timeSinceCreated = Date.now() - existingOtp.createdAt.getTime();
```

**After:**
```
const timeSinceCreated = Date.now() - existingOtp.created_at.getTime();
```

---

### `server\services\meeting-transcription-service.ts`

✅ **Line 441** (high confidence)

**Before:**
```
tenantId: transcription.tenantId,
```

**After:**
```
tenantId: transcription.tenant_id,
```

---

✅ **Line 546** (high confidence)

**Before:**
```
tenantId: transcription.tenantId,
```

**After:**
```
tenantId: transcription.tenant_id,
```

---

✅ **Line 803** (high confidence)

**Before:**
```
tenantId: transcription.tenantId,
```

**After:**
```
tenantId: transcription.tenant_id,
```

---

### `server\services\meeting-scheduling-service.ts`

✅ **Line 147** (high confidence)

**Before:**
```
tenantId: requestData.tenantId || 'mock-tenant',
```

**After:**
```
tenantId: requestData.tenant_id || 'mock-tenant',
```

---

### `server\services\manufacturer-integration-service.ts`

✅ **Line 55** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

⚠️ **Line 59** (medium confidence)

**Before:**
```
.orderBy(desc(manufacturerIntegrations.createdAt));
```

**After:**
```
.orderBy(desc(manufacturerIntegrations.created_at));
```

---

✅ **Line 75** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 107** (high confidence)

**Before:**
```
eq(manufacturerIntegrations.tenantId, tenantId),
```

**After:**
```
eq(manufacturerIntegrations.tenant_id, tenantId),
```

---

✅ **Line 148** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 195** (high confidence)

**Before:**
```
eq(deviceRegistrations.tenantId, tenantId),
```

**After:**
```
eq(deviceRegistrations.tenant_id, tenantId),
```

---

✅ **Line 218** (high confidence)

**Before:**
```
.where(and(eq(deviceRegistrations.id, deviceId), eq(deviceRegistrations.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(deviceRegistrations.id, deviceId), eq(deviceRegistrations.tenant_id, tenantId)));
```

---

✅ **Line 234** (high confidence)

**Before:**
```
eq(deviceMetrics.tenantId, tenantId),
```

**After:**
```
eq(deviceMetrics.tenant_id, tenantId),
```

---

✅ **Line 334** (high confidence)

**Before:**
```
const conditions = [eq(integrationAuditLogs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(integrationAuditLogs.tenant_id, tenantId)];
```

---

### `server\services\lead-intelligence-service.ts`

✅ **Line 85** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== tenantId) {
```

---

✅ **Line 93** (high confidence)

**Before:**
```
.where(and(eq(leadScoringRules.tenantId, tenantId), eq(leadScoringRules.isActive, true)))
```

**After:**
```
.where(and(eq(leadScoringRules.tenant_id, tenantId), eq(leadScoringRules.isActive, true)))
```

---

✅ **Line 333** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== tenantId) {
```

---

⚠️ **Line 400** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

✅ **Line 415** (high confidence)

**Before:**
```
eq(tenantApolloLeads.tenantId, tenantId),
```

**After:**
```
eq(tenantApolloLeads.tenant_id, tenantId),
```

---

⚠️ **Line 486** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

✅ **Line 510** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== tenantId) {
```

---

✅ **Line 563** (high confidence)

**Before:**
```
eq(tenantApolloLeads.tenantId, tenantId),
```

**After:**
```
eq(tenantApolloLeads.tenant_id, tenantId),
```

---

✅ **Line 686** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')));
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.recordType, 'lead')));
```

---

✅ **Line 698** (high confidence)

**Before:**
```
.where(eq(leadScoreCalculations.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoreCalculations.tenant_id, tenantId))
```

---

✅ **Line 724** (high confidence)

**Before:**
```
.where(eq(leadScoringFactors.tenantId, tenantId))
```

**After:**
```
.where(eq(leadScoringFactors.tenant_id, tenantId))
```

---

✅ **Line 740** (high confidence)

**Before:**
```
eq(leadScoreCalculations.tenantId, tenantId),
```

**After:**
```
eq(leadScoreCalculations.tenant_id, tenantId),
```

---

✅ **Line 786** (high confidence)

**Before:**
```
eq(leadScoreCalculations.tenantId, tenantId),
```

**After:**
```
eq(leadScoreCalculations.tenant_id, tenantId),
```

---

### `server\services\knowledge-base-service.ts`

✅ **Line 65** (high confidence)

**Before:**
```
eq(knowledgeCategories.tenantId, tenantId),
```

**After:**
```
eq(knowledgeCategories.tenant_id, tenantId),
```

---

✅ **Line 103** (high confidence)

**Before:**
```
const conditions = [eq(knowledgeCategories.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(knowledgeCategories.tenant_id, tenantId)];
```

---

✅ **Line 141** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

✅ **Line 246** (high confidence)

**Before:**
```
where: and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenantId, tenantId)),
```

**After:**
```
where: and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)),
```

---

✅ **Line 298** (high confidence)

**Before:**
```
.where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)))
```

---

✅ **Line 325** (high confidence)

**Before:**
```
where: and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenantId, tenantId)),
```

**After:**
```
where: and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)),
```

---

⚠️ **Line 330** (medium confidence)

**Before:**
```
await this.trackArticleView(tenantId, articleId, options.userId, options.sessionId);
```

**After:**
```
await this.trackArticleView(tenantId, articleId, options.user_id, options.sessionId);
```

---

✅ **Line 370** (high confidence)

**Before:**
```
const conditions = [eq(knowledgeArticles.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(knowledgeArticles.tenant_id, tenantId)];
```

---

⚠️ **Line 402** (medium confidence)

**Before:**
```
orderBy: [desc(knowledgeArticles.publishedAt), desc(knowledgeArticles.createdAt)],
```

**After:**
```
orderBy: [desc(knowledgeArticles.publishedAt), desc(knowledgeArticles.created_at)],
```

---

⚠️ **Line 601** (medium confidence)

**Before:**
```
userId: feedbackData.userId,
```

**After:**
```
userId: feedbackData.user_id,
```

---

✅ **Line 659** (high confidence)

**Before:**
```
where: eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
where: eq(knowledgeArticles.tenant_id, tenantId),
```

---

✅ **Line 679** (high confidence)

**Before:**
```
where: eq(knowledgeCategories.tenantId, tenantId),
```

**After:**
```
where: eq(knowledgeCategories.tenant_id, tenantId),
```

---

✅ **Line 723** (high confidence)

**Before:**
```
tenantId: article.tenantId,
```

**After:**
```
tenantId: article.tenant_id,
```

---

### `server\services\intelligent-alerts-service.ts`

✅ **Line 223** (high confidence)

**Before:**
```
eq(auditLogs.tenantId, tenantId),
```

**After:**
```
eq(auditLogs.tenant_id, tenantId),
```

---

⚠️ **Line 224** (medium confidence)

**Before:**
```
eq(auditLogs.userId, userId),
```

**After:**
```
eq(auditLogs.user_id, userId),
```

---

✅ **Line 239** (high confidence)

**Before:**
```
eq(alertTriageResults.tenantId, tenantId),
```

**After:**
```
eq(alertTriageResults.tenant_id, tenantId),
```

---

⚠️ **Line 241** (medium confidence)

**Before:**
```
gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '24 hours'`),
```

**After:**
```
gte(alertTriageResults.created_at, sql`NOW() - INTERVAL '24 hours'`),
```

---

✅ **Line 386** (high confidence)

**Before:**
```
eq(alertTriageResults.tenantId, tenantId),
```

**After:**
```
eq(alertTriageResults.tenant_id, tenantId),
```

---

⚠️ **Line 392** (medium confidence)

**Before:**
```
orderBy: [desc(alertTriageResults.createdAt)],
```

**After:**
```
orderBy: [desc(alertTriageResults.created_at)],
```

---

✅ **Line 514** (high confidence)

**Before:**
```
or(eq(alertRoutingRules.tenantId, tenantId), sql`${alertRoutingRules.tenantId} IS NULL`),
```

**After:**
```
or(eq(alertRoutingRules.tenant_id, tenantId), sql`${alertRoutingRules.tenant_id} IS NULL`),
```

---

✅ **Line 736** (high confidence)

**Before:**
```
eq(alertTriageResults.tenantId, tenantId),
```

**After:**
```
eq(alertTriageResults.tenant_id, tenantId),
```

---

⚠️ **Line 737** (medium confidence)

**Before:**
```
gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '7 days'`),
```

**After:**
```
gte(alertTriageResults.created_at, sql`NOW() - INTERVAL '7 days'`),
```

---

⚠️ **Line 812** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.userId, target), eq(securitySessions.isActive, true)));
```

**After:**
```
.where(and(eq(securitySessions.user_id, target), eq(securitySessions.isActive, true)));
```

---

⚠️ **Line 822** (medium confidence)

**Before:**
```
where: and(eq(securitySessions.userId, target), eq(securitySessions.isActive, true)),
```

**After:**
```
where: and(eq(securitySessions.user_id, target), eq(securitySessions.isActive, true)),
```

---

⚠️ **Line 838** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.userId, target), eq(securitySessions.isActive, true)));
```

**After:**
```
.where(and(eq(securitySessions.user_id, target), eq(securitySessions.isActive, true)));
```

---

✅ **Line 1177** (high confidence)

**Before:**
```
eq(alertTriageResults.tenantId, tenantId),
```

**After:**
```
eq(alertTriageResults.tenant_id, tenantId),
```

---

⚠️ **Line 1178** (medium confidence)

**Before:**
```
gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '24 hours'`),
```

**After:**
```
gte(alertTriageResults.created_at, sql`NOW() - INTERVAL '24 hours'`),
```

---

⚠️ **Line 1191** (medium confidence)

**Before:**
```
const incidentUserId = (incident.contextGathered as any)?.userId;
```

**After:**
```
const incidentUserId = (incident.contextGathered as any)?.user_id;
```

---

✅ **Line 1270** (high confidence)

**Before:**
```
eq(proactiveThreatDetection.tenantId, tenantId),
```

**After:**
```
eq(proactiveThreatDetection.tenant_id, tenantId),
```

---

### `server\services\incident-response-service.ts`

⚠️ **Line 64** (medium confidence)

**Before:**
```
.where(sql`DATE(${incidents.createdAt}) = CURRENT_DATE`);
```

**After:**
```
.where(sql`DATE(${incidents.created_at}) = CURRENT_DATE`);
```

---

✅ **Line 111** (high confidence)

**Before:**
```
.where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(incidents.id, incidentId), eq(incidents.tenant_id, tenantId)));
```

---

✅ **Line 132** (high confidence)

**Before:**
```
const conditions = [eq(incidents.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(incidents.tenant_id, tenantId)];
```

---

✅ **Line 191** (high confidence)

**Before:**
```
eq(incidents.tenantId, tenantId),
```

**After:**
```
eq(incidents.tenant_id, tenantId),
```

---

⚠️ **Line 647** (medium confidence)

**Before:**
```
...currentTeam.filter((m: any) => m.userId !== userId),
```

**After:**
```
...currentTeam.filter((m: any) => m.user_id !== userId),
```

---

✅ **Line 741** (high confidence)

**Before:**
```
eq(incidents.tenantId, tenantId),
```

**After:**
```
eq(incidents.tenant_id, tenantId),
```

---

### `server\services\geofence-alerts-service.ts`

✅ **Line 171** (high confidence)

**Before:**
```
eq(geofenceAlertRules.tenantId, tenantId),
```

**After:**
```
eq(geofenceAlertRules.tenant_id, tenantId),
```

---

✅ **Line 414** (high confidence)

**Before:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofences.id, geofenceId), eq(geofences.tenant_id, tenantId)))
```

---

✅ **Line 429** (high confidence)

**Before:**
```
eq(technicianLocations.tenantId, tenantId),
```

**After:**
```
eq(technicianLocations.tenant_id, tenantId),
```

---

✅ **Line 524** (high confidence)

**Before:**
```
eq(technicianDwellSessions.tenantId, tenantId),
```

**After:**
```
eq(technicianDwellSessions.tenant_id, tenantId),
```

---

✅ **Line 574** (high confidence)

**Before:**
```
eq(technicianDwellSessions.tenantId, tenantId),
```

**After:**
```
eq(technicianDwellSessions.tenant_id, tenantId),
```

---

✅ **Line 645** (high confidence)

**Before:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
```

---

✅ **Line 670** (high confidence)

**Before:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
```

---

✅ **Line 693** (high confidence)

**Before:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
```

---

✅ **Line 709** (high confidence)

**Before:**
```
.where(and(eq(geofenceAlerts.tenantId, tenantId), eq(geofenceAlerts.isAcknowledged, false)))
```

**After:**
```
.where(and(eq(geofenceAlerts.tenant_id, tenantId), eq(geofenceAlerts.isAcknowledged, false)))
```

---

✅ **Line 740** (high confidence)

**Before:**
```
eq(geofenceAlerts.tenantId, tenantId),
```

**After:**
```
eq(geofenceAlerts.tenant_id, tenantId),
```

---

### `server\services\gdpr-data-export-service.ts`

✅ **Line 116** (high confidence)

**Before:**
```
where: and(eq(personalDataExports.id, exportId), eq(personalDataExports.tenantId, tenantId)),
```

**After:**
```
where: and(eq(personalDataExports.id, exportId), eq(personalDataExports.tenant_id, tenantId)),
```

---

✅ **Line 250** (high confidence)

**Before:**
```
where: and(eq(users.tenantId, tenantId), eq(users.id, subjectId)),
```

**After:**
```
where: and(eq(users.tenant_id, tenantId), eq(users.id, subjectId)),
```

---

✅ **Line 261** (high confidence)

**Before:**
```
where: and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.id, subjectId)),
```

**After:**
```
where: and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.id, subjectId)),
```

---

✅ **Line 270** (high confidence)

**Before:**
```
eq(enhancedContacts.tenantId, tenantId),
```

**After:**
```
eq(enhancedContacts.tenant_id, tenantId),
```

---

✅ **Line 279** (high confidence)

**Before:**
```
eq(auditLogs.tenantId, tenantId),
```

**After:**
```
eq(auditLogs.tenant_id, tenantId),
```

---

⚠️ **Line 280** (medium confidence)

**Before:**
```
eq(auditLogs.userId, subjectId),
```

**After:**
```
eq(auditLogs.user_id, subjectId),
```

---

⚠️ **Line 304** (medium confidence)

**Before:**
```
where: and(eq(dataAccessLogs.tenantId, tenantId), eq(dataAccessLogs.userId, subjectId)),
```

**After:**
```
where: and(eq(dataAccessLogs.tenantId, tenantId), eq(dataAccessLogs.user_id, subjectId)),
```

---

✅ **Line 304** (high confidence)

**Before:**
```
where: and(eq(dataAccessLogs.tenantId, tenantId), eq(dataAccessLogs.userId, subjectId)),
```

**After:**
```
where: and(eq(dataAccessLogs.tenant_id, tenantId), eq(dataAccessLogs.userId, subjectId)),
```

---

✅ **Line 318** (high confidence)

**Before:**
```
eq(consentRecords.tenantId, tenantId),
```

**After:**
```
eq(consentRecords.tenant_id, tenantId),
```

---

✅ **Line 328** (high confidence)

**Before:**
```
eq(consentAuditTrail.tenantId, tenantId),
```

**After:**
```
eq(consentAuditTrail.tenant_id, tenantId),
```

---

✅ **Line 337** (high confidence)

**Before:**
```
where: and(eq(gdprRequests.tenantId, tenantId), eq(gdprRequests.subjectId, subjectId)),
```

**After:**
```
where: and(eq(gdprRequests.tenant_id, tenantId), eq(gdprRequests.subjectId, subjectId)),
```

---

✅ **Line 438** (high confidence)

**Before:**
```
eq(personalDataExports.tenantId, tenantId),
```

**After:**
```
eq(personalDataExports.tenant_id, tenantId),
```

---

✅ **Line 459** (high confidence)

**Before:**
```
const conditions = [eq(personalDataExports.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(personalDataExports.tenant_id, tenantId)];
```

---

⚠️ **Line 475** (medium confidence)

**Before:**
```
.orderBy(desc(personalDataExports.createdAt))
```

**After:**
```
.orderBy(desc(personalDataExports.created_at))
```

---

✅ **Line 498** (high confidence)

**Before:**
```
.where(and(eq(personalDataExports.id, exportId), eq(personalDataExports.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(personalDataExports.id, exportId), eq(personalDataExports.tenant_id, tenantId)));
```

---

✅ **Line 543** (high confidence)

**Before:**
```
eq(dataExportTemplates.tenantId, tenantId),
```

**After:**
```
eq(dataExportTemplates.tenant_id, tenantId),
```

---

⚠️ **Line 546** (medium confidence)

**Before:**
```
orderBy: [desc(dataExportTemplates.isDefault), desc(dataExportTemplates.createdAt)],
```

**After:**
```
orderBy: [desc(dataExportTemplates.isDefault), desc(dataExportTemplates.created_at)],
```

---

✅ **Line 557** (high confidence)

**Before:**
```
eq(dataExportTemplates.tenantId, tenantId),
```

**After:**
```
eq(dataExportTemplates.tenant_id, tenantId),
```

---

### `server\services\executive-reporting-service.ts`

✅ **Line 139** (high confidence)

**Before:**
```
const cacheKey = `executive-dashboard:${userContext.tenantId}:${JSON.stringify(dateRange)}`;
```

**After:**
```
const cacheKey = `executive-dashboard:${userContext.tenant_id}:${JSON.stringify(dateRange)}`;
```

---

✅ **Line 156** (high confidence)

**Before:**
```
WHERE o.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 165** (high confidence)

**Before:**
```
WHERE u.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 166** (high confidence)

**Before:**
```
AND br.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND br.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 167** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\equipment-lifecycle-state-machine.ts`

✅ **Line 238** (high confidence)

**Before:**
```
eq(equipmentLifecycle.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycle.tenant_id, tenantId),
```

---

✅ **Line 281** (high confidence)

**Before:**
```
eq(equipmentLifecycle.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycle.tenant_id, tenantId),
```

---

✅ **Line 333** (high confidence)

**Before:**
```
eq(equipmentLifecycleTransitions.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycleTransitions.tenant_id, tenantId),
```

---

✅ **Line 362** (high confidence)

**Before:**
```
eq(equipmentLifecycleTransitions.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycleTransitions.tenant_id, tenantId),
```

---

✅ **Line 399** (high confidence)

**Before:**
```
eq(equipmentLifecycleTransitions.tenantId, tenantId),
```

**After:**
```
eq(equipmentLifecycleTransitions.tenant_id, tenantId),
```

---

### `server\services\email-monitor-service.ts`

✅ **Line 49** (high confidence)

**Before:**
```
this.tenantId = tenantId;
```

**After:**
```
this.tenant_id = tenantId;
```

---

✅ **Line 249** (high confidence)

**Before:**
```
const aiParserService = new AIEmailParserService(this.tenantId);
```

**After:**
```
const aiParserService = new AIEmailParserService(this.tenant_id);
```

---

✅ **Line 258** (high confidence)

**Before:**
```
const ticketService = new TicketCreationService(this.tenantId);
```

**After:**
```
const ticketService = new TicketCreationService(this.tenant_id);
```

---

✅ **Line 271** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 298** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 324** (high confidence)

**Before:**
```
where: eq(emailMonitorConfig.tenantId, this.tenantId),
```

**After:**
```
where: eq(emailMonitorConfig.tenant_id, this.tenant_id),
```

---

✅ **Line 352** (high confidence)

**Before:**
```
.where(eq(emailMonitorConfig.tenantId, this.tenantId));
```

**After:**
```
.where(eq(emailMonitorConfig.tenant_id, this.tenant_id));
```

---

✅ **Line 391** (high confidence)

**Before:**
```
where: eq(emailMonitorConfig.tenantId, tenantId),
```

**After:**
```
where: eq(emailMonitorConfig.tenant_id, tenantId),
```

---

✅ **Line 472** (high confidence)

**Before:**
```
await startEmailMonitor(config.tenantId);
```

**After:**
```
await startEmailMonitor(config.tenant_id);
```

---

✅ **Line 474** (high confidence)

**Before:**
```
console.error(`[EmailMonitor] Failed to start monitor for tenant ${config.tenantId}:`, error);
```

**After:**
```
console.error(`[EmailMonitor] Failed to start monitor for tenant ${config.tenant_id}:`, error);
```

---

### `server\services\dpa-management-service.ts`

✅ **Line 115** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

✅ **Line 153** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

✅ **Line 194** (high confidence)

**Before:**
```
const conditions = [eq(dataProcessingAgreements.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(dataProcessingAgreements.tenant_id, tenantId)];
```

---

⚠️ **Line 223** (medium confidence)

**Before:**
```
.orderBy(desc(dataProcessingAgreements.createdAt))
```

**After:**
```
.orderBy(desc(dataProcessingAgreements.created_at))
```

---

✅ **Line 332** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

✅ **Line 396** (high confidence)

**Before:**
```
where: and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenantId, tenantId)),
```

**After:**
```
where: and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenant_id, tenantId)),
```

---

✅ **Line 413** (high confidence)

**Before:**
```
eq(dpaComplianceChecks.tenantId, tenantId),
```

**After:**
```
eq(dpaComplianceChecks.tenant_id, tenantId),
```

---

✅ **Line 445** (high confidence)

**Before:**
```
.where(and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(dpaComplianceChecks.id, checkId), eq(dpaComplianceChecks.tenant_id, tenantId)))
```

---

✅ **Line 461** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

✅ **Line 558** (high confidence)

**Before:**
```
.where(eq(dataProcessingAgreements.tenantId, tenantId)),
```

**After:**
```
.where(eq(dataProcessingAgreements.tenant_id, tenantId)),
```

---

✅ **Line 562** (high confidence)

**Before:**
```
.where(eq(dataProcessingAgreements.tenantId, tenantId))
```

**After:**
```
.where(eq(dataProcessingAgreements.tenant_id, tenantId))
```

---

✅ **Line 567** (high confidence)

**Before:**
```
.where(eq(dataProcessingAgreements.tenantId, tenantId))
```

**After:**
```
.where(eq(dataProcessingAgreements.tenant_id, tenantId))
```

---

✅ **Line 574** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

✅ **Line 585** (high confidence)

**Before:**
```
eq(dataProcessingAgreements.tenantId, tenantId),
```

**After:**
```
eq(dataProcessingAgreements.tenant_id, tenantId),
```

---

### `server\services\document-ocr-ai-service.ts`

✅ **Line 465** (high confidence)

**Before:**
```
if (!upload || upload.tenantId !== tenantId) {
```

**After:**
```
if (!upload || upload.tenant_id !== tenantId) {
```

---

### `server\services\document-generation-service.ts`

✅ **Line 141** (high confidence)

**Before:**
```
and(eq(records.id, contextIds.businessRecordId!), eq(records.tenantId, tenantId)),
```

**After:**
```
and(eq(records.id, contextIds.businessRecordId!), eq(records.tenant_id, tenantId)),
```

---

✅ **Line 153** (high confidence)

**Before:**
```
and(eq(quotes.id, contextIds.quoteId!), eq(quotes.tenantId, tenantId)),
```

**After:**
```
and(eq(quotes.id, contextIds.quoteId!), eq(quotes.tenant_id, tenantId)),
```

---

✅ **Line 167** (high confidence)

**Before:**
```
and(eq(deals.id, contextIds.dealId!), eq(deals.tenantId, tenantId)),
```

**After:**
```
and(eq(deals.id, contextIds.dealId!), eq(deals.tenant_id, tenantId)),
```

---

✅ **Line 178** (high confidence)

**Before:**
```
and(eq(calls.id, contextIds.serviceCallId!), eq(calls.tenantId, tenantId)),
```

**After:**
```
and(eq(calls.id, contextIds.serviceCallId!), eq(calls.tenant_id, tenantId)),
```

---

✅ **Line 189** (high confidence)

**Before:**
```
and(eq(invoices.id, contextIds.invoiceId!), eq(invoices.tenantId, tenantId)),
```

**After:**
```
and(eq(invoices.id, contextIds.invoiceId!), eq(invoices.tenant_id, tenantId)),
```

---

✅ **Line 363** (high confidence)

**Before:**
```
and(eq(templates.id, templateId), eq(templates.tenantId, tenantId)),
```

**After:**
```
and(eq(templates.id, templateId), eq(templates.tenant_id, tenantId)),
```

---

✅ **Line 516** (high confidence)

**Before:**
```
and(eq(templates.id, templateId), eq(templates.tenantId, tenantId)),
```

**After:**
```
and(eq(templates.id, templateId), eq(templates.tenant_id, tenantId)),
```

---

### `server\services\director-reporting-service.ts`

✅ **Line 132** (high confidence)

**Before:**
```
const cacheKey = `company-sales-performance:${userContext.tenantId}:${JSON.stringify(dateRange)}`;
```

**After:**
```
const cacheKey = `company-sales-performance:${userContext.tenant_id}:${JSON.stringify(dateRange)}`;
```

---

✅ **Line 150** (high confidence)

**Before:**
```
WHERE o.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 157** (high confidence)

**Before:**
```
WHERE q.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE q.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 171** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 174** (high confidence)

**Before:**
```
AND q.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND q.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 175** (high confidence)

**Before:**
```
WHERE r.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 186** (high confidence)

**Before:**
```
AND o.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND o.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 188** (high confidence)

**Before:**
```
WHERE u.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE u.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 251** (high confidence)

**Before:**
```
const cacheKey = `company-service-performance:${userContext.tenantId}:${JSON.stringify(dateRange)}`;
```

**After:**
```
const cacheKey = `company-service-performance:${userContext.tenant_id}:${JSON.stringify(dateRange)}`;
```

---

✅ **Line 272** (high confidence)

**Before:**
```
AND te.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND te.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 274** (high confidence)

**Before:**
```
WHERE sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 289** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 291** (high confidence)

**Before:**
```
WHERE r.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE r.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 302** (high confidence)

**Before:**
```
AND sc.tenant_id = ${userContext.tenantId}
```

**After:**
```
AND sc.tenant_id = ${userContext.tenant_id}
```

---

✅ **Line 304** (high confidence)

**Before:**
```
WHERE u.tenant_id = ${userContext.tenantId}
```

**After:**
```
WHERE u.tenant_id = ${userContext.tenant_id}
```

---

### `server\services\data-retention-service.ts`

✅ **Line 76** (high confidence)

**Before:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenantId, tenantId)),
```

**After:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenant_id, tenantId)),
```

---

✅ **Line 94** (high confidence)

**Before:**
```
const conditions = [eq(dataRetentionPolicies.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(dataRetentionPolicies.tenant_id, tenantId)];
```

---

✅ **Line 138** (high confidence)

**Before:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenantId, tenantId)),
```

**After:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenant_id, tenantId)),
```

---

✅ **Line 152** (high confidence)

**Before:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenantId, tenantId)),
```

**After:**
```
and(eq(dataRetentionPolicies.id, policyId), eq(dataRetentionPolicies.tenant_id, tenantId)),
```

---

✅ **Line 206** (high confidence)

**Before:**
```
.where(and(eq(dataPurgeJobs.id, jobId), eq(dataPurgeJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(dataPurgeJobs.id, jobId), eq(dataPurgeJobs.tenant_id, tenantId)));
```

---

✅ **Line 225** (high confidence)

**Before:**
```
const conditions = [eq(dataPurgeJobs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(dataPurgeJobs.tenant_id, tenantId)];
```

---

⚠️ **Line 234** (medium confidence)

**Before:**
```
conditions.push(gte(dataPurgeJobs.createdAt, options.startDate));
```

**After:**
```
conditions.push(gte(dataPurgeJobs.created_at, options.startDate));
```

---

⚠️ **Line 237** (medium confidence)

**Before:**
```
conditions.push(lte(dataPurgeJobs.createdAt, options.endDate));
```

**After:**
```
conditions.push(lte(dataPurgeJobs.created_at, options.endDate));
```

---

⚠️ **Line 245** (medium confidence)

**Before:**
```
.orderBy(desc(dataPurgeJobs.createdAt))
```

**After:**
```
.orderBy(desc(dataPurgeJobs.created_at))
```

---

✅ **Line 623** (high confidence)

**Before:**
```
await executePurge(policy.id, policy.tenantId, undefined, 'scheduled');
```

**After:**
```
await executePurge(policy.id, policy.tenant_id, undefined, 'scheduled');
```

---

✅ **Line 660** (high confidence)

**Before:**
```
.where(eq(dataRetentionPolicies.tenantId, tenantId));
```

**After:**
```
.where(eq(dataRetentionPolicies.tenant_id, tenantId));
```

---

### `server\services\customer-portal-service.ts`

✅ **Line 140** (high confidence)

**Before:**
```
customer.tenantId,
```

**After:**
```
customer.tenant_id,
```

---

✅ **Line 251** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId),
```

---

✅ **Line 314** (high confidence)

**Before:**
```
const conditions = [eq(customerServiceRequests.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(customerServiceRequests.tenant_id, tenantId)];
```

---

✅ **Line 342** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId),
```

---

✅ **Line 377** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId),
```

---

✅ **Line 426** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId), // CRITICAL: tenant constraint for security
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId), // CRITICAL: tenant constraint for security
```

---

✅ **Line 504** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId),
```

---

✅ **Line 520** (high confidence)

**Before:**
```
eq(customerServiceRequestStatusHistory.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequestStatusHistory.tenant_id, tenantId),
```

---

⚠️ **Line 524** (medium confidence)

**Before:**
```
.orderBy(desc(customerServiceRequestStatusHistory.createdAt));
```

**After:**
```
.orderBy(desc(customerServiceRequestStatusHistory.created_at));
```

---

✅ **Line 567** (high confidence)

**Before:**
```
eq(customerMeterSubmissions.tenantId, tenantId),
```

**After:**
```
eq(customerMeterSubmissions.tenant_id, tenantId),
```

---

✅ **Line 664** (high confidence)

**Before:**
```
eq(customerSupplyOrders.tenantId, tenantId),
```

**After:**
```
eq(customerSupplyOrders.tenant_id, tenantId),
```

---

⚠️ **Line 683** (medium confidence)

**Before:**
```
.orderBy(desc(customerSupplyOrders.createdAt))
```

**After:**
```
.orderBy(desc(customerSupplyOrders.created_at))
```

---

✅ **Line 748** (high confidence)

**Before:**
```
and(eq(customerPayments.tenantId, tenantId), eq(customerPayments.customerId, customerId)),
```

**After:**
```
and(eq(customerPayments.tenant_id, tenantId), eq(customerPayments.customerId, customerId)),
```

---

✅ **Line 767** (high confidence)

**Before:**
```
eq(customerNotifications.tenantId, tenantId),
```

**After:**
```
eq(customerNotifications.tenant_id, tenantId),
```

---

⚠️ **Line 779** (medium confidence)

**Before:**
```
.orderBy(desc(customerNotifications.createdAt))
```

**After:**
```
.orderBy(desc(customerNotifications.created_at))
```

---

✅ **Line 797** (high confidence)

**Before:**
```
eq(customerNotifications.tenantId, tenantId),
```

**After:**
```
eq(customerNotifications.tenant_id, tenantId),
```

---

✅ **Line 855** (high confidence)

**Before:**
```
eq(customerServiceRequests.tenantId, tenantId),
```

**After:**
```
eq(customerServiceRequests.tenant_id, tenantId),
```

---

✅ **Line 867** (high confidence)

**Before:**
```
eq(customerPayments.tenantId, tenantId),
```

**After:**
```
eq(customerPayments.tenant_id, tenantId),
```

---

✅ **Line 879** (high confidence)

**Before:**
```
eq(customerMeterSubmissions.tenantId, tenantId),
```

**After:**
```
eq(customerMeterSubmissions.tenant_id, tenantId),
```

---

✅ **Line 894** (high confidence)

**Before:**
```
eq(customerNotifications.tenantId, tenantId),
```

**After:**
```
eq(customerNotifications.tenant_id, tenantId),
```

---

✅ **Line 906** (high confidence)

**Before:**
```
eq(customerSupplyOrders.tenantId, tenantId),
```

**After:**
```
eq(customerSupplyOrders.tenant_id, tenantId),
```

---

✅ **Line 1008** (high confidence)

**Before:**
```
eq(customerPortalAccess.tenantId, tenantId),
```

**After:**
```
eq(customerPortalAccess.tenant_id, tenantId),
```

---

✅ **Line 1396** (high confidence)

**Before:**
```
eq(customerMeterSubmissions.tenantId, tenantId),
```

**After:**
```
eq(customerMeterSubmissions.tenant_id, tenantId),
```

---

✅ **Line 1409** (high confidence)

**Before:**
```
eq(customerMeterSubmissions.tenantId, tenantId),
```

**After:**
```
eq(customerMeterSubmissions.tenant_id, tenantId),
```

---

✅ **Line 2156** (high confidence)

**Before:**
```
eq(customerMaintenanceAppointments.tenantId, tenantId),
```

**After:**
```
eq(customerMaintenanceAppointments.tenant_id, tenantId),
```

---

✅ **Line 2212** (high confidence)

**Before:**
```
eq(customerMaintenanceAppointments.tenantId, tenantId),
```

**After:**
```
eq(customerMaintenanceAppointments.tenant_id, tenantId),
```

---

✅ **Line 2278** (high confidence)

**Before:**
```
eq(customerMaintenanceAppointments.tenantId, tenantId),
```

**After:**
```
eq(customerMaintenanceAppointments.tenant_id, tenantId),
```

---

✅ **Line 2331** (high confidence)

**Before:**
```
eq(customerMaintenanceAppointments.tenantId, tenantId),
```

**After:**
```
eq(customerMaintenanceAppointments.tenant_id, tenantId),
```

---

### `server\services\customer-notification-service.ts`

✅ **Line 81** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenant_id, tenantId)))
```

---

### `server\services\csv-import-service.ts`

✅ **Line 599** (high confidence)

**Before:**
```
const whereConditions: any[] = [eq(businessRecords.tenantId, tenantId)];
```

**After:**
```
const whereConditions: any[] = [eq(businessRecords.tenant_id, tenantId)];
```

---

✅ **Line 632** (high confidence)

**Before:**
```
const whereConditions: any[] = [eq(enhancedContacts.tenantId, tenantId)];
```

**After:**
```
const whereConditions: any[] = [eq(enhancedContacts.tenant_id, tenantId)];
```

---

✅ **Line 665** (high confidence)

**Before:**
```
const whereConditions: any[] = [eq(equipment.tenantId, tenantId)];
```

**After:**
```
const whereConditions: any[] = [eq(equipment.tenant_id, tenantId)];
```

---

✅ **Line 698** (high confidence)

**Before:**
```
const whereConditions: any[] = [eq(inventoryItems.tenantId, tenantId)];
```

**After:**
```
const whereConditions: any[] = [eq(inventoryItems.tenant_id, tenantId)];
```

---

✅ **Line 823** (high confidence)

**Before:**
```
tenantId: params.tenantId,
```

**After:**
```
tenantId: params.tenant_id,
```

---

⚠️ **Line 824** (medium confidence)

**Before:**
```
userId: params.userId,
```

**After:**
```
userId: params.user_id,
```

---

✅ **Line 860** (high confidence)

**Before:**
```
const tenantId = job.tenantId;
```

**After:**
```
const tenantId = job.tenant_id;
```

---

⚠️ **Line 960** (medium confidence)

**Before:**
```
resolvedBy: params.userId,
```

**After:**
```
resolvedBy: params.user_id,
```

---

⚠️ **Line 978** (medium confidence)

**Before:**
```
resolvedBy: params.userId,
```

**After:**
```
resolvedBy: params.user_id,
```

---

✅ **Line 1026** (high confidence)

**Before:**
```
const tenantId = job.tenantId;
```

**After:**
```
const tenantId = job.tenant_id;
```

---

✅ **Line 1149** (high confidence)

**Before:**
```
const conditions = [eq(csvImportJobs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(csvImportJobs.tenant_id, tenantId)];
```

---

⚠️ **Line 1162** (medium confidence)

**Before:**
```
.orderBy(sql`${csvImportJobs.createdAt} DESC`)
```

**After:**
```
.orderBy(sql`${csvImportJobs.created_at} DESC`)
```

---

### `server\services\contract-renewal-workflow.ts`

✅ **Line 131** (high confidence)

**Before:**
```
eq(serviceContracts.tenantId, tenantId),
```

**After:**
```
eq(serviceContracts.tenant_id, tenantId),
```

---

✅ **Line 166** (high confidence)

**Before:**
```
eq(tasks.tenantId, tenantId),
```

**After:**
```
eq(tasks.tenant_id, tenantId),
```

---

### `server\services\contract-renewal-service.ts`

✅ **Line 75** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 262** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 405** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 511** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 592** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 602** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 613** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 621** (high confidence)

**Before:**
```
.where(and(eq(renewalProposals.tenantId, tenantId), sql`status IN ('sent', 'viewed')`))
```

**After:**
```
.where(and(eq(renewalProposals.tenant_id, tenantId), sql`status IN ('sent', 'viewed')`))
```

---

✅ **Line 628** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 641** (high confidence)

**Before:**
```
where: and(eq(renewalAnalytics.tenantId, tenantId), eq(renewalAnalytics.periodType, 'monthly')),
```

**After:**
```
where: and(eq(renewalAnalytics.tenant_id, tenantId), eq(renewalAnalytics.periodType, 'monthly')),
```

---

✅ **Line 665** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 679** (high confidence)

**Before:**
```
eq(contractRenewalTracking.tenantId, tenantId),
```

**After:**
```
eq(contractRenewalTracking.tenant_id, tenantId),
```

---

✅ **Line 693** (high confidence)

**Before:**
```
where: eq(renewalAutomationRules.tenantId, tenantId),
```

**After:**
```
where: eq(renewalAutomationRules.tenant_id, tenantId),
```

---

### `server\services\content-gap-analysis-service.ts`

✅ **Line 113** (high confidence)

**Before:**
```
eq(knowledgeSearchQueries.tenantId, tenantId),
```

**After:**
```
eq(knowledgeSearchQueries.tenant_id, tenantId),
```

---

⚠️ **Line 114** (medium confidence)

**Before:**
```
sql`${knowledgeSearchQueries.createdAt} > ${ninetyDaysAgo}`,
```

**After:**
```
sql`${knowledgeSearchQueries.created_at} > ${ninetyDaysAgo}`,
```

---

✅ **Line 166** (high confidence)

**Before:**
```
and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.feedbackType, 'unhelpful')),
```

**After:**
```
and(eq(articleFeedback.tenant_id, tenantId), eq(articleFeedback.feedbackType, 'unhelpful')),
```

---

✅ **Line 263** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

✅ **Line 308** (high confidence)

**Before:**
```
and(eq(knowledgeCategories.tenantId, tenantId), eq(knowledgeCategories.isActive, true)),
```

**After:**
```
and(eq(knowledgeCategories.tenant_id, tenantId), eq(knowledgeCategories.isActive, true)),
```

---

✅ **Line 319** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

### `server\services\contact-deduplication-service.ts`

✅ **Line 181** (high confidence)

**Before:**
```
eq(duplicateDetectionRules.tenantId, tenantId),
```

**After:**
```
eq(duplicateDetectionRules.tenant_id, tenantId),
```

---

✅ **Line 192** (high confidence)

**Before:**
```
eq(duplicateDetectionRules.tenantId, tenantId),
```

**After:**
```
eq(duplicateDetectionRules.tenant_id, tenantId),
```

---

⚠️ **Line 202** (medium confidence)

**Before:**
```
orderBy: [desc(duplicateDetectionRules.createdAt)],
```

**After:**
```
orderBy: [desc(duplicateDetectionRules.created_at)],
```

---

✅ **Line 218** (high confidence)

**Before:**
```
and(eq(duplicateDetectionRules.id, ruleId), eq(duplicateDetectionRules.tenantId, tenantId)),
```

**After:**
```
and(eq(duplicateDetectionRules.id, ruleId), eq(duplicateDetectionRules.tenant_id, tenantId)),
```

---

✅ **Line 323** (high confidence)

**Before:**
```
where: eq(businessRecords.tenantId, tenantId),
```

**After:**
```
where: eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 330** (high confidence)

**Before:**
```
where: eq(enhancedContacts.tenantId, tenantId),
```

**After:**
```
where: eq(enhancedContacts.tenant_id, tenantId),
```

---

✅ **Line 462** (high confidence)

**Before:**
```
eq(duplicateMatches.tenantId, tenantId),
```

**After:**
```
eq(duplicateMatches.tenant_id, tenantId),
```

---

✅ **Line 523** (high confidence)

**Before:**
```
const conditions = [eq(duplicateMatches.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(duplicateMatches.tenant_id, tenantId)];
```

---

✅ **Line 574** (high confidence)

**Before:**
```
.where(and(eq(duplicateMatches.id, matchId), eq(duplicateMatches.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(duplicateMatches.id, matchId), eq(duplicateMatches.tenant_id, tenantId)))
```

---

✅ **Line 605** (high confidence)

**Before:**
```
where: and(eq(table.id, survivingRecordId), eq(table.tenantId, tenantId)),
```

**After:**
```
where: and(eq(table.id, survivingRecordId), eq(table.tenant_id, tenantId)),
```

---

✅ **Line 608** (high confidence)

**Before:**
```
where: and(eq(table.id, mergedRecordId), eq(table.tenantId, tenantId)),
```

**After:**
```
where: and(eq(table.id, mergedRecordId), eq(table.tenant_id, tenantId)),
```

---

⚠️ **Line 671** (medium confidence)

**Before:**
```
updates.updatedAt = new Date();
```

**After:**
```
updates.updated_at = new Date();
```

---

✅ **Line 697** (high confidence)

**Before:**
```
eq(enhancedContacts.tenantId, tenantId),
```

**After:**
```
eq(enhancedContacts.tenant_id, tenantId),
```

---

✅ **Line 790** (high confidence)

**Before:**
```
eq(contactMergeHistory.tenantId, tenantId),
```

**After:**
```
eq(contactMergeHistory.tenant_id, tenantId),
```

---

✅ **Line 851** (high confidence)

**Before:**
```
eq(enhancedContacts.tenantId, tenantId),
```

**After:**
```
eq(enhancedContacts.tenant_id, tenantId),
```

---

✅ **Line 893** (high confidence)

**Before:**
```
eq(contactMergeHistory.tenantId, tenantId),
```

**After:**
```
eq(contactMergeHistory.tenant_id, tenantId),
```

---

✅ **Line 931** (high confidence)

**Before:**
```
where: and(eq(duplicateScanJobs.id, jobId), eq(duplicateScanJobs.tenantId, tenantId)),
```

**After:**
```
where: and(eq(duplicateScanJobs.id, jobId), eq(duplicateScanJobs.tenant_id, tenantId)),
```

---

✅ **Line 1039** (high confidence)

**Before:**
```
const conditions = [eq(duplicateScanJobs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(duplicateScanJobs.tenant_id, tenantId)];
```

---

⚠️ **Line 1052** (medium confidence)

**Before:**
```
.orderBy(desc(duplicateScanJobs.createdAt))
```

**After:**
```
.orderBy(desc(duplicateScanJobs.created_at))
```

---

✅ **Line 1080** (high confidence)

**Before:**
```
.where(eq(duplicateMatches.tenantId, tenantId)),
```

**After:**
```
.where(eq(duplicateMatches.tenant_id, tenantId)),
```

---

✅ **Line 1085** (high confidence)

**Before:**
```
and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'pending')),
```

**After:**
```
and(eq(duplicateMatches.tenant_id, tenantId), eq(duplicateMatches.status, 'pending')),
```

---

✅ **Line 1091** (high confidence)

**Before:**
```
and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'merged')),
```

**After:**
```
and(eq(duplicateMatches.tenant_id, tenantId), eq(duplicateMatches.status, 'merged')),
```

---

✅ **Line 1097** (high confidence)

**Before:**
```
and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'dismissed')),
```

**After:**
```
and(eq(duplicateMatches.tenant_id, tenantId), eq(duplicateMatches.status, 'dismissed')),
```

---

✅ **Line 1102** (high confidence)

**Before:**
```
.where(eq(duplicateMatches.tenantId, tenantId)),
```

**After:**
```
.where(eq(duplicateMatches.tenant_id, tenantId)),
```

---

✅ **Line 1104** (high confidence)

**Before:**
```
where: eq(duplicateScanJobs.tenantId, tenantId),
```

**After:**
```
where: eq(duplicateScanJobs.tenant_id, tenantId),
```

---

⚠️ **Line 1105** (medium confidence)

**Before:**
```
orderBy: [desc(duplicateScanJobs.createdAt)],
```

**After:**
```
orderBy: [desc(duplicateScanJobs.created_at)],
```

---

### `server\services\consent-management-service.ts`

✅ **Line 117** (high confidence)

**Before:**
```
eq(consentRecords.tenantId, tenantId),
```

**After:**
```
eq(consentRecords.tenant_id, tenantId),
```

---

✅ **Line 192** (high confidence)

**Before:**
```
where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenantId, tenantId)),
```

**After:**
```
where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenant_id, tenantId)),
```

---

✅ **Line 260** (high confidence)

**Before:**
```
where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenantId, tenantId)),
```

**After:**
```
where: and(eq(consentRecords.id, consentId), eq(consentRecords.tenant_id, tenantId)),
```

---

✅ **Line 302** (high confidence)

**Before:**
```
eq(consentRecords.tenantId, tenantId),
```

**After:**
```
eq(consentRecords.tenant_id, tenantId),
```

---

⚠️ **Line 306** (medium confidence)

**Before:**
```
orderBy: [desc(consentRecords.createdAt)],
```

**After:**
```
orderBy: [desc(consentRecords.created_at)],
```

---

✅ **Line 321** (high confidence)

**Before:**
```
eq(consentRecords.tenantId, tenantId),
```

**After:**
```
eq(consentRecords.tenant_id, tenantId),
```

---

✅ **Line 353** (high confidence)

**Before:**
```
where: and(eq(consentRecords.tenantId, tenantId), eq(consentRecords.subjectId, subjectId)),
```

**After:**
```
where: and(eq(consentRecords.tenant_id, tenantId), eq(consentRecords.subjectId, subjectId)),
```

---

⚠️ **Line 354** (medium confidence)

**Before:**
```
orderBy: [desc(consentRecords.createdAt)],
```

**After:**
```
orderBy: [desc(consentRecords.created_at)],
```

---

✅ **Line 488** (high confidence)

**Before:**
```
eq(consentAuditTrail.tenantId, tenantId),
```

**After:**
```
eq(consentAuditTrail.tenant_id, tenantId),
```

---

✅ **Line 511** (high confidence)

**Before:**
```
const conditions = [eq(consentRecords.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(consentRecords.tenant_id, tenantId)];
```

---

⚠️ **Line 530** (medium confidence)

**Before:**
```
.orderBy(desc(consentRecords.createdAt))
```

**After:**
```
.orderBy(desc(consentRecords.created_at))
```

---

✅ **Line 573** (high confidence)

**Before:**
```
eq(consentPreferencesTemplate.tenantId, tenantId),
```

**After:**
```
eq(consentPreferencesTemplate.tenant_id, tenantId),
```

---

✅ **Line 596** (high confidence)

**Before:**
```
eq(consentPreferencesTemplate.tenantId, tenantId),
```

**After:**
```
eq(consentPreferencesTemplate.tenant_id, tenantId),
```

---

⚠️ **Line 601** (medium confidence)

**Before:**
```
desc(consentPreferencesTemplate.createdAt),
```

**After:**
```
desc(consentPreferencesTemplate.created_at),
```

---

✅ **Line 613** (high confidence)

**Before:**
```
eq(consentPreferencesTemplate.tenantId, tenantId),
```

**After:**
```
eq(consentPreferencesTemplate.tenant_id, tenantId),
```

---

✅ **Line 637** (high confidence)

**Before:**
```
.where(eq(consentRecords.tenantId, tenantId)),
```

**After:**
```
.where(eq(consentRecords.tenant_id, tenantId)),
```

---

✅ **Line 641** (high confidence)

**Before:**
```
.where(eq(consentRecords.tenantId, tenantId))
```

**After:**
```
.where(eq(consentRecords.tenant_id, tenantId))
```

---

✅ **Line 646** (high confidence)

**Before:**
```
.where(eq(consentRecords.tenantId, tenantId))
```

**After:**
```
.where(eq(consentRecords.tenant_id, tenantId))
```

---

✅ **Line 653** (high confidence)

**Before:**
```
eq(consentRecords.tenantId, tenantId),
```

**After:**
```
eq(consentRecords.tenant_id, tenantId),
```

---

### `server\services\company-deduplication-service.ts`

⚠️ **Line 83** (medium confidence)

**Before:**
```
if (!oldest.createdAt) return current;
```

**After:**
```
if (!oldest.created_at) return current;
```

---

⚠️ **Line 84** (medium confidence)

**Before:**
```
if (!current.createdAt) return oldest;
```

**After:**
```
if (!current.created_at) return oldest;
```

---

⚠️ **Line 85** (medium confidence)

**Before:**
```
return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
```

**After:**
```
return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
```

---

✅ **Line 100** (high confidence)

**Before:**
```
.where(eq(companies.tenantId, tenantId))
```

**After:**
```
.where(eq(companies.tenant_id, tenantId))
```

---

⚠️ **Line 101** (medium confidence)

**Before:**
```
.orderBy(companies.createdAt);
```

**After:**
```
.orderBy(companies.created_at);
```

---

✅ **Line 182** (high confidence)

**Before:**
```
.where(and(eq(companies.id, survivorId), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(companies.id, survivorId), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 200** (high confidence)

**Before:**
```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 209** (high confidence)

**Before:**
```
eq(companyContacts.tenantId, tenantId),
```

**After:**
```
eq(companyContacts.tenant_id, tenantId),
```

---

✅ **Line 223** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

✅ **Line 237** (high confidence)

**Before:**
```
eq(enhancedContacts.tenantId, tenantId),
```

**After:**
```
eq(enhancedContacts.tenant_id, tenantId),
```

---

✅ **Line 265** (high confidence)

**Before:**
```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(inArray(companies.id, duplicateIds), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 352** (high confidence)

**Before:**
```
const candidates = await db.select().from(companies).where(eq(companies.tenantId, tenantId));
```

**After:**
```
const candidates = await db.select().from(companies).where(eq(companies.tenant_id, tenantId));
```

---

✅ **Line 385** (high confidence)

**Before:**
```
.where(and(inArray(companies.id, companyIds), eq(companies.tenantId, tenantId)));
```

**After:**
```
.where(and(inArray(companies.id, companyIds), eq(companies.tenant_id, tenantId)));
```

---

✅ **Line 391** (high confidence)

**Before:**
```
and(inArray(companyContacts.companyId, companyIds), eq(companyContacts.tenantId, tenantId)),
```

**After:**
```
and(inArray(companyContacts.companyId, companyIds), eq(companyContacts.tenant_id, tenantId)),
```

---

✅ **Line 400** (high confidence)

**Before:**
```
eq(businessRecordActivities.tenantId, tenantId),
```

**After:**
```
eq(businessRecordActivities.tenant_id, tenantId),
```

---

### `server\services\change-management-service.ts`

⚠️ **Line 48** (medium confidence)

**Before:**
```
sql`EXTRACT(YEAR FROM ${changeRequests.createdAt}) = ${year}
```

**After:**
```
sql`EXTRACT(YEAR FROM ${changeRequests.created_at}) = ${year}
```

---

⚠️ **Line 49** (medium confidence)

**Before:**
```
AND EXTRACT(MONTH FROM ${changeRequests.createdAt}) = ${month + 1}`,
```

**After:**
```
AND EXTRACT(MONTH FROM ${changeRequests.created_at}) = ${month + 1}`,
```

---

✅ **Line 103** (high confidence)

**Before:**
```
.where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenant_id, tenantId)));
```

---

✅ **Line 125** (high confidence)

**Before:**
```
const conditions = [eq(changeRequests.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(changeRequests.tenant_id, tenantId)];
```

---

⚠️ **Line 143** (medium confidence)

**Before:**
```
conditions.push(gte(changeRequests.createdAt, options.startDate));
```

**After:**
```
conditions.push(gte(changeRequests.created_at, options.startDate));
```

---

⚠️ **Line 146** (medium confidence)

**Before:**
```
conditions.push(lte(changeRequests.createdAt, options.endDate));
```

**After:**
```
conditions.push(lte(changeRequests.created_at, options.endDate));
```

---

⚠️ **Line 154** (medium confidence)

**Before:**
```
.orderBy(desc(changeRequests.createdAt))
```

**After:**
```
.orderBy(desc(changeRequests.created_at))
```

---

✅ **Line 194** (high confidence)

**Before:**
```
.where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenant_id, tenantId)))
```

---

✅ **Line 308** (high confidence)

**Before:**
```
eq(changeRequests.tenantId, tenantId),
```

**After:**
```
eq(changeRequests.tenant_id, tenantId),
```

---

✅ **Line 752** (high confidence)

**Before:**
```
eq(changeRequests.tenantId, tenantId),
```

**After:**
```
eq(changeRequests.tenant_id, tenantId),
```

---

⚠️ **Line 753** (medium confidence)

**Before:**
```
gte(changeRequests.createdAt, startDate),
```

**After:**
```
gte(changeRequests.created_at, startDate),
```

---

⚠️ **Line 754** (medium confidence)

**Before:**
```
lte(changeRequests.createdAt, endDate),
```

**After:**
```
lte(changeRequests.created_at, endDate),
```

---

⚠️ **Line 779** (medium confidence)

**Before:**
```
new Date(change.actualStartDate || change.updatedAt).getTime() -
```

**After:**
```
new Date(change.actualStartDate || change.updated_at).getTime() -
```

---

### `server\services\billing-engine-service.ts`

✅ **Line 303** (high confidence)

**Before:**
```
eq(autoInvoiceGeneration.tenantId, tenantId),
```

**After:**
```
eq(autoInvoiceGeneration.tenant_id, tenantId),
```

---

✅ **Line 769** (high confidence)

**Before:**
```
eq(billingRules.tenantId, tenantId),
```

**After:**
```
eq(billingRules.tenant_id, tenantId),
```

---

✅ **Line 823** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 842** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 861** (high confidence)

**Before:**
```
eq(autoInvoiceGeneration.tenantId, tenantId),
```

**After:**
```
eq(autoInvoiceGeneration.tenant_id, tenantId),
```

---

✅ **Line 935** (high confidence)

**Before:**
```
.where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contracts.id, contractId), eq(contracts.tenant_id, tenantId)))
```

---

✅ **Line 953** (high confidence)

**Before:**
```
eq(meterReadings.tenantId, tenantId),
```

**After:**
```
eq(meterReadings.tenant_id, tenantId),
```

---

✅ **Line 971** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.equipmentId, equipmentId), eq(meterReadings.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(meterReadings.equipmentId, equipmentId), eq(meterReadings.tenant_id, tenantId)))
```

---

✅ **Line 1085** (high confidence)

**Before:**
```
.where(eq(invoices.tenantId, tenantId))
```

**After:**
```
.where(eq(invoices.tenant_id, tenantId))
```

---

⚠️ **Line 1086** (medium confidence)

**Before:**
```
.orderBy(desc(invoices.createdAt))
```

**After:**
```
.orderBy(desc(invoices.created_at))
```

---

✅ **Line 1161** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 1196** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)));
```

---

### `server\services\billing-analytics-service.ts`

✅ **Line 178** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 341** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.status, 'active')))
```

**After:**
```
.where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.status, 'active')))
```

---

✅ **Line 481** (high confidence)

**Before:**
```
const conditions = [eq(businessRecords.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(businessRecords.tenant_id, tenantId)];
```

---

⚠️ **Line 490** (medium confidence)

**Before:**
```
createdAt: businessRecords.createdAt,
```

**After:**
```
createdAt: businessRecords.created_at,
```

---

⚠️ **Line 499** (medium confidence)

**Before:**
```
.groupBy(businessRecords.id, businessRecords.companyName, businessRecords.createdAt);
```

**After:**
```
.groupBy(businessRecords.id, businessRecords.companyName, businessRecords.created_at);
```

---

⚠️ **Line 505** (medium confidence)

**Before:**
```
const firstDate = customer.firstInvoiceDate || customer.createdAt;
```

**After:**
```
const firstDate = customer.firstInvoiceDate || customer.created_at;
```

---

### `server\services\automated-billing-service.ts`

✅ **Line 66** (high confidence)

**Before:**
```
eq(billingSchedules.tenantId, tenantId),
```

**After:**
```
eq(billingSchedules.tenant_id, tenantId),
```

---

✅ **Line 106** (high confidence)

**Before:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenant_id, tenantId)))
```

---

✅ **Line 127** (high confidence)

**Before:**
```
.where(and(eq(contracts.id, schedule.contractId), eq(contracts.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(contracts.id, schedule.contractId), eq(contracts.tenant_id, tenantId)))
```

---

✅ **Line 141** (high confidence)

**Before:**
```
eq(contracts.tenantId, tenantId),
```

**After:**
```
eq(contracts.tenant_id, tenantId),
```

---

✅ **Line 150** (high confidence)

**Before:**
```
.where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, 'active')));
```

**After:**
```
.where(and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active')));
```

---

✅ **Line 263** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 281** (high confidence)

**Before:**
```
eq(meterReadings.tenantId, tenantId),
```

**After:**
```
eq(meterReadings.tenant_id, tenantId),
```

---

✅ **Line 474** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.billingStatus, 'pending')))
```

**After:**
```
.where(and(eq(meterReadings.tenant_id, tenantId), eq(meterReadings.billingStatus, 'pending')))
```

---

✅ **Line 587** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'open')));
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), eq(invoices.status, 'open')));
```

---

✅ **Line 593** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')));
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), eq(invoices.status, 'overdue')));
```

---

✅ **Line 599** (high confidence)

**Before:**
```
.where(and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.billingStatus, 'pending')));
```

**After:**
```
.where(and(eq(meterReadings.tenant_id, tenantId), eq(meterReadings.billingStatus, 'pending')));
```

---

✅ **Line 610** (high confidence)

**Before:**
```
eq(billingSchedules.tenantId, tenantId),
```

**After:**
```
eq(billingSchedules.tenant_id, tenantId),
```

---

✅ **Line 620** (high confidence)

**Before:**
```
.where(eq(invoiceGenerationLogs.tenantId, tenantId))
```

**After:**
```
.where(eq(invoiceGenerationLogs.tenant_id, tenantId))
```

---

⚠️ **Line 621** (medium confidence)

**Before:**
```
.orderBy(desc(invoiceGenerationLogs.createdAt))
```

**After:**
```
.orderBy(desc(invoiceGenerationLogs.created_at))
```

---

### `server\services\auto-supply-replenishment-service.ts`

✅ **Line 60** (high confidence)

**Before:**
```
eq(supplyMonitoring.tenantId, tenantId),
```

**After:**
```
eq(supplyMonitoring.tenant_id, tenantId),
```

---

✅ **Line 72** (high confidence)

**Before:**
```
eq(supplyUsageHistory.tenantId, tenantId),
```

**After:**
```
eq(supplyUsageHistory.tenant_id, tenantId),
```

---

✅ **Line 259** (high confidence)

**Before:**
```
eq(supplyMonitoring.tenantId, tenantId),
```

**After:**
```
eq(supplyMonitoring.tenant_id, tenantId),
```

---

✅ **Line 276** (high confidence)

**Before:**
```
eq(autoSupplyOrders.tenantId, tenantId),
```

**After:**
```
eq(autoSupplyOrders.tenant_id, tenantId),
```

---

✅ **Line 320** (high confidence)

**Before:**
```
and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenantId, tenantId)),
```

**After:**
```
and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenant_id, tenantId)),
```

---

✅ **Line 335** (high confidence)

**Before:**
```
where: and(eq(supplyMonitoring.tenantId, tenantId), eq(supplyMonitoring.status, 'monitoring')),
```

**After:**
```
where: and(eq(supplyMonitoring.tenant_id, tenantId), eq(supplyMonitoring.status, 'monitoring')),
```

---

✅ **Line 400** (high confidence)

**Before:**
```
.where(eq(supplyMonitoring.tenantId, tenantId))
```

**After:**
```
.where(eq(supplyMonitoring.tenant_id, tenantId))
```

---

✅ **Line 405** (high confidence)

**Before:**
```
.where(eq(supplyMonitoring.tenantId, tenantId))
```

**After:**
```
.where(eq(supplyMonitoring.tenant_id, tenantId))
```

---

✅ **Line 414** (high confidence)

**Before:**
```
.where(and(eq(supplyMonitoring.tenantId, tenantId), lt(supplyMonitoring.currentLevel, 20)))
```

**After:**
```
.where(and(eq(supplyMonitoring.tenant_id, tenantId), lt(supplyMonitoring.currentLevel, 20)))
```

---

✅ **Line 421** (high confidence)

**Before:**
```
eq(autoSupplyOrders.tenantId, tenantId),
```

**After:**
```
eq(autoSupplyOrders.tenant_id, tenantId),
```

---

✅ **Line 438** (high confidence)

**Before:**
```
and(eq(autoSupplyOrders.tenantId, tenantId), gte(autoSupplyOrders.orderDate, startOfMonth)),
```

**After:**
```
and(eq(autoSupplyOrders.tenant_id, tenantId), gte(autoSupplyOrders.orderDate, startOfMonth)),
```

---

✅ **Line 445** (high confidence)

**Before:**
```
eq(supplyReplenishmentAnalytics.tenantId, tenantId),
```

**After:**
```
eq(supplyReplenishmentAnalytics.tenant_id, tenantId),
```

---

✅ **Line 478** (high confidence)

**Before:**
```
where: and(eq(supplyMonitoring.tenantId, tenantId), lt(supplyMonitoring.currentLevel, 20)),
```

**After:**
```
where: and(eq(supplyMonitoring.tenant_id, tenantId), lt(supplyMonitoring.currentLevel, 20)),
```

---

✅ **Line 489** (high confidence)

**Before:**
```
where: eq(autoSupplyOrders.tenantId, tenantId),
```

**After:**
```
where: eq(autoSupplyOrders.tenant_id, tenantId),
```

---

✅ **Line 500** (high confidence)

**Before:**
```
where: eq(supplyReplenishmentRules.tenantId, tenantId),
```

**After:**
```
where: eq(supplyReplenishmentRules.tenant_id, tenantId),
```

---

### `server\services\auto-lead-routing-service.ts`

✅ **Line 95** (high confidence)

**Before:**
```
where: and(eq(businessRecords.id, leadId), eq(businessRecords.tenantId, tenantId)),
```

**After:**
```
where: and(eq(businessRecords.id, leadId), eq(businessRecords.tenant_id, tenantId)),
```

---

⚠️ **Line 116** (medium confidence)

**Before:**
```
await this.assignLeadToRep(leadId, bestRep.userId, tenantId, 'auto_ai_routing', leadScore);
```

**After:**
```
await this.assignLeadToRep(leadId, bestRep.user_id, tenantId, 'auto_ai_routing', leadScore);
```

---

⚠️ **Line 129** (medium confidence)

**Before:**
```
assignedTo: bestRep.userId,
```

**After:**
```
assignedTo: bestRep.user_id,
```

---

✅ **Line 148** (high confidence)

**Before:**
```
where: and(eq(leadScoringRules.tenantId, tenantId), eq(leadScoringRules.isActive, true)),
```

**After:**
```
where: and(eq(leadScoringRules.tenant_id, tenantId), eq(leadScoringRules.isActive, true)),
```

---

✅ **Line 181** (high confidence)

**Before:**
```
eq(bantQualificationCriteria.tenantId, tenantId),
```

**After:**
```
eq(bantQualificationCriteria.tenant_id, tenantId),
```

---

✅ **Line 331** (high confidence)

**Before:**
```
where: and(eq(repCapacity.tenantId, tenantId), eq(repCapacity.isAvailable, true)),
```

**After:**
```
where: and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.isAvailable, true)),
```

---

✅ **Line 380** (high confidence)

**Before:**
```
eq(salesTerritories.tenantId, tenantId),
```

**After:**
```
eq(salesTerritories.tenant_id, tenantId),
```

---

⚠️ **Line 381** (medium confidence)

**Before:**
```
eq(salesTerritories.ownerId, rep.userId),
```

**After:**
```
eq(salesTerritories.ownerId, rep.user_id),
```

---

⚠️ **Line 405** (medium confidence)

**Before:**
```
const userName = await getUserFullName(rep.userId);
```

**After:**
```
const userName = await getUserFullName(rep.user_id);
```

---

⚠️ **Line 408** (medium confidence)

**Before:**
```
userId: rep.userId,
```

**After:**
```
userId: rep.user_id,
```

---

✅ **Line 447** (high confidence)

**Before:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(businessRecords.id, leadId), eq(businessRecords.tenant_id, tenantId)));
```

---

### `server\services\audit-archival-service.ts`

✅ **Line 71** (high confidence)

**Before:**
```
eq(auditLogs.tenantId, tenantId),
```

**After:**
```
eq(auditLogs.tenant_id, tenantId),
```

---

✅ **Line 118** (high confidence)

**Before:**
```
.where(and(eq(auditLogArchives.id, archiveId), eq(auditLogArchives.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(auditLogArchives.id, archiveId), eq(auditLogArchives.tenant_id, tenantId)));
```

---

✅ **Line 137** (high confidence)

**Before:**
```
const conditions = [eq(auditLogArchives.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(auditLogArchives.tenant_id, tenantId)];
```

---

✅ **Line 242** (high confidence)

**Before:**
```
eq(auditLogs.tenantId, archive.tenantId),
```

**After:**
```
eq(auditLogs.tenant_id, archive.tenant_id),
```

---

✅ **Line 316** (high confidence)

**Before:**
```
// await deleteArchivedLogs(archive.tenantId, archive.startDate, archive.endDate);
```

**After:**
```
// await deleteArchivedLogs(archive.tenant_id, archive.startDate, archive.endDate);
```

---

✅ **Line 523** (high confidence)

**Before:**
```
.where(and(eq(auditLogArchives.id, archiveId), eq(auditLogArchives.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(auditLogArchives.id, archiveId), eq(auditLogArchives.tenant_id, tenantId)))
```

---

✅ **Line 568** (high confidence)

**Before:**
```
.where(and(eq(auditArchiveJobs.id, jobId), eq(auditArchiveJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(auditArchiveJobs.id, jobId), eq(auditArchiveJobs.tenant_id, tenantId)));
```

---

✅ **Line 586** (high confidence)

**Before:**
```
const conditions = [eq(auditArchiveJobs.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(auditArchiveJobs.tenant_id, tenantId)];
```

---

⚠️ **Line 603** (medium confidence)

**Before:**
```
.orderBy(desc(auditArchiveJobs.createdAt))
```

**After:**
```
.orderBy(desc(auditArchiveJobs.created_at))
```

---

✅ **Line 635** (high confidence)

**Before:**
```
.where(and(eq(auditLogs.tenantId, tenantId), lt(auditLogs.timestamp, endDate)));
```

**After:**
```
.where(and(eq(auditLogs.tenant_id, tenantId), lt(auditLogs.timestamp, endDate)));
```

---

✅ **Line 688** (high confidence)

**Before:**
```
and(eq(auditLogArchives.tenantId, tenantId), sql`${auditLogArchives.deletedAt} IS NULL`),
```

**After:**
```
and(eq(auditLogArchives.tenant_id, tenantId), sql`${auditLogArchives.deletedAt} IS NULL`),
```

---

✅ **Line 743** (high confidence)

**Before:**
```
eq(auditLogArchives.tenantId, tenantId),
```

**After:**
```
eq(auditLogArchives.tenant_id, tenantId),
```

---

### `server\services\approval-workflow-service.ts`

✅ **Line 55** (high confidence)

**Before:**
```
.where(and(eq(approvalRules.tenantId, tenantId), eq(approvalRules.isActive, true)))
```

**After:**
```
.where(and(eq(approvalRules.tenant_id, tenantId), eq(approvalRules.isActive, true)))
```

---

⚠️ **Line 228** (medium confidence)

**Before:**
```
const approverId = approver.userId || `role:${approver.roleId}`;
```

**After:**
```
const approverId = approver.user_id || `role:${approver.roleId}`;
```

---

⚠️ **Line 236** (medium confidence)

**Before:**
```
let resolvedUserId = approver.userId;
```

**After:**
```
let resolvedUserId = approver.user_id;
```

---

⚠️ **Line 240** (medium confidence)

**Before:**
```
if (approver.roleId && !approver.userId) {
```

**After:**
```
if (approver.roleId && !approver.user_id) {
```

---

✅ **Line 251** (high confidence)

**Before:**
```
.where(and(eq(users.tenantId, tenantId), eq(users.roleId, approver.roleId)))
```

**After:**
```
.where(and(eq(users.tenant_id, tenantId), eq(users.roleId, approver.roleId)))
```

---

⚠️ **Line 256** (medium confidence)

**Before:**
```
resolvedUserId = user.userId;
```

**After:**
```
resolvedUserId = user.user_id;
```

---

✅ **Line 295** (high confidence)

**Before:**
```
eq(approvalDelegations.tenantId, tenantId),
```

**After:**
```
eq(approvalDelegations.tenant_id, tenantId),
```

---

✅ **Line 315** (high confidence)

**Before:**
```
const approvalChain = await this.buildApprovalChain(requestData.tenantId, matchedRules);
```

**After:**
```
const approvalChain = await this.buildApprovalChain(requestData.tenant_id, matchedRules);
```

---

✅ **Line 551** (high confidence)

**Before:**
```
eq(approvalRequests.tenantId, tenantId),
```

**After:**
```
eq(approvalRequests.tenant_id, tenantId),
```

---

### `server\services\api-key-service.ts`

⚠️ **Line 129** (medium confidence)

**Before:**
```
createdAt: apiKey.createdAt,
```

**After:**
```
createdAt: apiKey.created_at,
```

---

✅ **Line 549** (high confidence)

**Before:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenant_id, tenantId)));
```

---

✅ **Line 566** (high confidence)

**Before:**
```
const conditions = [eq(apiKeys.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(apiKeys.tenant_id, tenantId)];
```

---

⚠️ **Line 579** (medium confidence)

**Before:**
```
.orderBy(desc(apiKeys.createdAt))
```

**After:**
```
.orderBy(desc(apiKeys.created_at))
```

---

✅ **Line 608** (high confidence)

**Before:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenant_id, tenantId)))
```

---

✅ **Line 633** (high confidence)

**Before:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenant_id, tenantId)))
```

---

✅ **Line 712** (high confidence)

**Before:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(apiKeys.id, id), eq(apiKeys.tenant_id, tenantId)))
```

---

✅ **Line 745** (high confidence)

**Before:**
```
eq(apiKeyUsageLogs.tenantId, tenantId),
```

**After:**
```
eq(apiKeyUsageLogs.tenant_id, tenantId),
```

---

### `server\services\ai-search-knowledge-service.ts`

⚠️ **Line 232** (medium confidence)

**Before:**
```
const freshnessScore = this.calculateFreshnessScore(contentData.createdAt);
```

**After:**
```
const freshnessScore = this.calculateFreshnessScore(contentData.created_at);
```

---

⚠️ **Line 250** (medium confidence)

**Before:**
```
contentCreatedAt: contentData.createdAt,
```

**After:**
```
contentCreatedAt: contentData.created_at,
```

---

✅ **Line 494** (high confidence)

**Before:**
```
tenantId: query.tenantId,
```

**After:**
```
tenantId: query.tenant_id,
```

---

### `server\services\ai-email-parser-service.ts`

✅ **Line 72** (high confidence)

**Before:**
```
this.tenantId = tenantId;
```

**After:**
```
this.tenant_id = tenantId;
```

---

✅ **Line 238** (high confidence)

**Before:**
```
where: and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, customer.id)),
```

**After:**
```
where: and(eq(equipment.tenant_id, this.tenant_id), eq(equipment.customerId, customer.id)),
```

---

### `server\services\ai-csv-refinement-service.ts`

✅ **Line 436** (high confidence)

**Before:**
```
.where(and(eq(csvImportJobs.id, jobId), eq(csvImportJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(csvImportJobs.id, jobId), eq(csvImportJobs.tenant_id, tenantId)));
```

---

✅ **Line 465** (high confidence)

**Before:**
```
.where(and(eq(csvImportJobs.id, jobId), eq(csvImportJobs.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(csvImportJobs.id, jobId), eq(csvImportJobs.tenant_id, tenantId)));
```

---

### `server\services\advanced-scheduling-service.ts`

⚠️ **Line 196** (medium confidence)

**Before:**
```
.filter((h) => h.tasks.some((t) => t.userId === userId));
```

**After:**
```
.filter((h) => h.tasks.some((t) => t.user_id === userId));
```

---

⚠️ **Line 323** (medium confidence)

**Before:**
```
if (task1.userId === task2.userId) {
```

**After:**
```
if (task1.user_id === task2.user_id) {
```

---

⚠️ **Line 429** (medium confidence)

**Before:**
```
const pattern = this.userPatterns.get(task.userId);
```

**After:**
```
const pattern = this.userPatterns.get(task.user_id);
```

---

⚠️ **Line 474** (medium confidence)

**Before:**
```
const pattern = this.userPatterns.get(task.userId);
```

**After:**
```
const pattern = this.userPatterns.get(task.user_id);
```

---

⚠️ **Line 512** (medium confidence)

**Before:**
```
const pattern = this.userPatterns.get(task.userId);
```

**After:**
```
const pattern = this.userPatterns.get(task.user_id);
```

---

⚠️ **Line 545** (medium confidence)

**Before:**
```
if (!userTasks.has(task.userId)) {
```

**After:**
```
if (!userTasks.has(task.user_id)) {
```

---

⚠️ **Line 546** (medium confidence)

**Before:**
```
userTasks.set(task.userId, []);
```

**After:**
```
userTasks.set(task.user_id, []);
```

---

⚠️ **Line 548** (medium confidence)

**Before:**
```
userTasks.get(task.userId)!.push(task);
```

**After:**
```
userTasks.get(task.user_id)!.push(task);
```

---

⚠️ **Line 596** (medium confidence)

**Before:**
```
const userResource = resources.find((r) => r.id === task.userId && r.type === 'user');
```

**After:**
```
const userResource = resources.find((r) => r.id === task.user_id && r.type === 'user');
```

---

⚠️ **Line 712** (medium confidence)

**Before:**
```
(st) => tasks.find((t) => t.id === st.taskId)?.userId === userId,
```

**After:**
```
(st) => tasks.find((t) => t.id === st.taskId)?.user_id === userId,
```

---

### `server\routes\workflow-automation-routes.ts`

✅ **Line 32** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 55** (high confidence)

**Before:**
```
const workflows = await storage.getWorkflows(user.tenantId, status as string);
```

**After:**
```
const workflows = await storage.getWorkflows(user.tenant_id, status as string);
```

---

✅ **Line 72** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 104** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 133** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 156** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 196** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 234** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 265** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 288** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 317** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 376** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 394** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 430** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 452** (high confidence)

**Before:**
```
if (!execution || execution.tenantId !== user.tenantId) {
```

**After:**
```
if (!execution || execution.tenant_id !== user.tenant_id) {
```

---

✅ **Line 481** (high confidence)

**Before:**
```
const executions = await storage.getWorkflowExecutionsByTenant(user.tenantId, limit);
```

**After:**
```
const executions = await storage.getWorkflowExecutionsByTenant(user.tenant_id, limit);
```

---

✅ **Line 550** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 619** (high confidence)

**Before:**
```
if (!workflow || workflow.tenantId !== user.tenantId) {
```

**After:**
```
if (!workflow || workflow.tenant_id !== user.tenant_id) {
```

---

✅ **Line 640** (high confidence)

**Before:**
```
storage.getWorkflows(user.tenantId),
```

**After:**
```
storage.getWorkflows(user.tenant_id),
```

---

✅ **Line 641** (high confidence)

**Before:**
```
storage.getWorkflowExecutionsByTenant(user.tenantId, 100),
```

**After:**
```
storage.getWorkflowExecutionsByTenant(user.tenant_id, 100),
```

---

✅ **Line 678** (high confidence)

**Before:**
```
const groups = await storage.getAssignmentGroups(user.tenantId);
```

**After:**
```
const groups = await storage.getAssignmentGroups(user.tenant_id);
```

---

✅ **Line 695** (high confidence)

**Before:**
```
if (!group || group.tenantId !== user.tenantId) {
```

**After:**
```
if (!group || group.tenant_id !== user.tenant_id) {
```

---

✅ **Line 721** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 746** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 776** (high confidence)

**Before:**
```
if (!group || group.tenantId !== user.tenantId) {
```

**After:**
```
if (!group || group.tenant_id !== user.tenant_id) {
```

---

✅ **Line 799** (high confidence)

**Before:**
```
const approvals = await storage.getUserApprovals(user.id, user.tenantId, status as string);
```

**After:**
```
const approvals = await storage.getUserApprovals(user.id, user.tenant_id, status as string);
```

---

✅ **Line 816** (high confidence)

**Before:**
```
if (!approval || approval.tenantId !== user.tenantId) {
```

**After:**
```
if (!approval || approval.tenant_id !== user.tenant_id) {
```

---

✅ **Line 842** (high confidence)

**Before:**
```
if (!approval || approval.tenantId !== user.tenantId) {
```

**After:**
```
if (!approval || approval.tenant_id !== user.tenant_id) {
```

---

✅ **Line 879** (high confidence)

**Before:**
```
const approvals = await storage.getExecutionApprovals(req.params.executionId, user.tenantId);
```

**After:**
```
const approvals = await storage.getExecutionApprovals(req.params.executionId, user.tenant_id);
```

---

### `server\routes\team-collaboration-routes.ts`

✅ **Line 25** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 47** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 70** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 93** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 134** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 269** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 293** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 325** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 358** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 413** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

### `server\routes\sso-routes.ts`

✅ **Line 67** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

⚠️ **Line 87** (medium confidence)

**Before:**
```
createdAt: p.createdAt,
```

**After:**
```
createdAt: p.created_at,
```

---

⚠️ **Line 88** (medium confidence)

**Before:**
```
updatedAt: p.updatedAt,
```

**After:**
```
updatedAt: p.updated_at,
```

---

✅ **Line 104** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 136** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 174** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 213** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 239** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

⚠️ **Line 303** (medium confidence)

**Before:**
```
(req.session as any).userId = result.user!.id;
```

**After:**
```
(req.session as any).user_id = result.user!.id;
```

---

✅ **Line 304** (high confidence)

**Before:**
```
(req.session as any).tenantId = result.user!.tenantId;
```

**After:**
```
(req.session as any).tenant_id = result.user!.tenant_id;
```

---

⚠️ **Line 374** (medium confidence)

**Before:**
```
(req.session as any).userId = result.user!.id;
```

**After:**
```
(req.session as any).user_id = result.user!.id;
```

---

✅ **Line 375** (high confidence)

**Before:**
```
(req.session as any).tenantId = result.user!.tenantId;
```

**After:**
```
(req.session as any).tenant_id = result.user!.tenant_id;
```

---

✅ **Line 492** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 576** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

### `server\routes\signature-routes.ts`

✅ **Line 21** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 49** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 79** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 115** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 159** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 175** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 195** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 212** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 232** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 248** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 265** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 303** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 328** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 344** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 383** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 424** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 440** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 460** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 484** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 504** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 524** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 540** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 560** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 584** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 604** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 624** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 640** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

### `server\routes\sales-reports-api.ts`

⚠️ **Line 225** (medium confidence)

**Before:**
```
const myPosition = leaderboard.find((entry) => entry.userId === req.user!.id);
```

**After:**
```
const myPosition = leaderboard.find((entry) => entry.user_id === req.user!.id);
```

---

⚠️ **Line 298** (medium confidence)

**Before:**
```
userId: member.userId,
```

**After:**
```
userId: member.user_id,
```

---

### `server\routes\route-optimization-routes.ts`

✅ **Line 57** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 90** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 130** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 164** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 198** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

### `server\routes\reporting-api.ts`

✅ **Line 164** (high confidence)

**Before:**
```
tenantId: user?.tenantId,
```

**After:**
```
tenantId: user?.tenant_id,
```

---

✅ **Line 389** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, req.user.tenant_id),
```

---

✅ **Line 463** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 490** (medium confidence)

**Before:**
```
eq(userReportPreferences.userId, req.user.id),
```

**After:**
```
eq(userReportPreferences.user_id, req.user.id),
```

---

✅ **Line 531** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, req.user.tenant_id),
```

---

✅ **Line 559** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 629** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 657** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 697** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, req.user.tenant_id),
```

---

✅ **Line 786** (high confidence)

**Before:**
```
eq(reportDefinitions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportDefinitions.tenant_id, req.user.tenant_id),
```

---

✅ **Line 808** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 855** (high confidence)

**Before:**
```
eq(reportSchedules.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportSchedules.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 860** (medium confidence)

**Before:**
```
.orderBy(desc(reportSchedules.createdAt));
```

**After:**
```
.orderBy(desc(reportSchedules.created_at));
```

---

✅ **Line 895** (high confidence)

**Before:**
```
eq(reportSchedules.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportSchedules.tenant_id, req.user.tenant_id),
```

---

✅ **Line 939** (high confidence)

**Before:**
```
eq(reportExecutions.tenantId, req.user.tenantId),
```

**After:**
```
eq(reportExecutions.tenant_id, req.user.tenant_id),
```

---

⚠️ **Line 940** (medium confidence)

**Before:**
```
eq(reportExecutions.userId, req.user.id),
```

**After:**
```
eq(reportExecutions.user_id, req.user.id),
```

---

⚠️ **Line 943** (medium confidence)

**Before:**
```
.orderBy(desc(reportExecutions.createdAt))
```

**After:**
```
.orderBy(desc(reportExecutions.created_at))
```

---

### `server\routes\reading-history-routes.ts`

⚠️ **Line 16** (medium confidence)

**Before:**
```
if (!req.session || !req.session.userId) {
```

**After:**
```
if (!req.session || !req.session.user_id) {
```

---

✅ **Line 25** (high confidence)

**Before:**
```
(req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
```

**After:**
```
(req as any).tenant_id || (req.session as any).tenant_id || '00000000-0000-0000-0000-000000000000'
```

---

⚠️ **Line 31** (medium confidence)

**Before:**
```
return req.session?.userId || (req.session as any).user?.id || '';
```

**After:**
```
return req.session?.user_id || (req.session as any).user?.id || '';
```

---

✅ **Line 45** (high confidence)

**Before:**
```
eq(readingHistory.tenantId, tenantId),
```

**After:**
```
eq(readingHistory.tenant_id, tenantId),
```

---

⚠️ **Line 46** (medium confidence)

**Before:**
```
eq(readingHistory.userId, userId),
```

**After:**
```
eq(readingHistory.user_id, userId),
```

---

⚠️ **Line 129** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.userId, userId), eq(readingHistory.articleId, articleId)))
```

**After:**
```
.where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)))
```

---

✅ **Line 222** (high confidence)

**Before:**
```
eq(readingHistory.tenantId, tenantId),
```

**After:**
```
eq(readingHistory.tenant_id, tenantId),
```

---

⚠️ **Line 223** (medium confidence)

**Before:**
```
eq(readingHistory.userId, userId),
```

**After:**
```
eq(readingHistory.user_id, userId),
```

---

⚠️ **Line 266** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.userId, userId)));
```

**After:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.user_id, userId)));
```

---

✅ **Line 266** (high confidence)

**Before:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.userId, userId)));
```

**After:**
```
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.userId, userId)));
```

---

⚠️ **Line 274** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.userId, userId)))
```

**After:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.user_id, userId)))
```

---

✅ **Line 274** (high confidence)

**Before:**
```
.where(and(eq(readingHistory.tenantId, tenantId), eq(readingHistory.userId, userId)))
```

**After:**
```
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.userId, userId)))
```

---

✅ **Line 310** (high confidence)

**Before:**
```
eq(readingHistory.tenantId, tenantId),
```

**After:**
```
eq(readingHistory.tenant_id, tenantId),
```

---

⚠️ **Line 311** (medium confidence)

**Before:**
```
eq(readingHistory.userId, userId),
```

**After:**
```
eq(readingHistory.user_id, userId),
```

---

⚠️ **Line 359** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.userId, userId), eq(readingHistory.articleId, articleId)))
```

**After:**
```
.where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)))
```

---

⚠️ **Line 388** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.userId, userId), eq(readingHistory.articleId, articleId)));
```

**After:**
```
.where(and(eq(readingHistory.user_id, userId), eq(readingHistory.articleId, articleId)));
```

---

### `server\routes\mileage-routes.ts`

✅ **Line 52** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 98** (high confidence)

**Before:**
```
const record = await mileageService.recordDailyMileage(user.tenantId, targetTechnicianId, data);
```

**After:**
```
const record = await mileageService.recordDailyMileage(user.tenant_id, targetTechnicianId, data);
```

---

✅ **Line 132** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 164** (high confidence)

**Before:**
```
const recordsCreated = await mileageService.autoGenerateDailyMileage(user.tenantId, targetDate);
```

**After:**
```
const recordsCreated = await mileageService.autoGenerateDailyMileage(user.tenant_id, targetDate);
```

---

✅ **Line 191** (high confidence)

**Before:**
```
.where(eq(mileageReports.tenantId, user.tenantId))
```

**After:**
```
.where(eq(mileageReports.tenant_id, user.tenant_id))
```

---

⚠️ **Line 192** (medium confidence)

**Before:**
```
.orderBy(desc(mileageReports.createdAt));
```

**After:**
```
.orderBy(desc(mileageReports.created_at));
```

---

✅ **Line 197** (high confidence)

**Before:**
```
and(eq(mileageReports.tenantId, user.tenantId), eq(mileageReports.technicianId, user.id)),
```

**After:**
```
and(eq(mileageReports.tenant_id, user.tenant_id), eq(mileageReports.technicianId, user.id)),
```

---

✅ **Line 233** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 262** (high confidence)

**Before:**
```
.where(and(eq(mileageReports.id, req.params.id), eq(mileageReports.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(mileageReports.id, req.params.id), eq(mileageReports.tenant_id, user.tenant_id)))
```

---

✅ **Line 289** (high confidence)

**Before:**
```
const report = await mileageService.submitReport(req.params.id, user.tenantId, user.id);
```

**After:**
```
const report = await mileageService.submitReport(req.params.id, user.tenant_id, user.id);
```

---

✅ **Line 314** (high confidence)

**Before:**
```
const report = await mileageService.approveReport(req.params.id, user.tenantId, user.id);
```

**After:**
```
const report = await mileageService.approveReport(req.params.id, user.tenant_id, user.id);
```

---

✅ **Line 345** (high confidence)

**Before:**
```
const report = await mileageService.rejectReport(req.params.id, user.tenantId, user.id, reason);
```

**After:**
```
const report = await mileageService.rejectReport(req.params.id, user.tenant_id, user.id, reason);
```

---

✅ **Line 374** (high confidence)

**Before:**
```
.where(eq(mileageReimbursementRates.tenantId, user.tenantId))
```

**After:**
```
.where(eq(mileageReimbursementRates.tenant_id, user.tenant_id))
```

---

✅ **Line 405** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 439** (high confidence)

**Before:**
```
const log = await mileageService.getIrsMileageLog(user.tenantId, targetTechnicianId, year);
```

**After:**
```
const log = await mileageService.getIrsMileageLog(user.tenant_id, targetTechnicianId, year);
```

---

✅ **Line 465** (high confidence)

**Before:**
```
const csv = await mileageService.exportIrsMileageLog(user.tenantId, targetTechnicianId, year);
```

**After:**
```
const csv = await mileageService.exportIrsMileageLog(user.tenant_id, targetTechnicianId, year);
```

---

✅ **Line 511** (high confidence)

**Before:**
```
const entry = await mileageService.createIrsLogEntry(user.tenantId, targetTechnicianId, {
```

**After:**
```
const entry = await mileageService.createIrsLogEntry(user.tenant_id, targetTechnicianId, {
```

---

✅ **Line 551** (high confidence)

**Before:**
```
.where(eq(vehicleAssignments.tenantId, user.tenantId));
```

**After:**
```
.where(eq(vehicleAssignments.tenant_id, user.tenant_id));
```

---

✅ **Line 578** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

### `server\routes\mfa-routes.ts`

✅ **Line 172** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 193** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 212** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 230** (high confidence)

**Before:**
```
const { codes } = await storage.generateBackupCodes(user.id, user.tenantId || null, 10);
```

**After:**
```
const { codes } = await storage.generateBackupCodes(user.id, user.tenant_id || null, 10);
```

---

✅ **Line 235** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 284** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 298** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 311** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 378** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 424** (high confidence)

**Before:**
```
const { codes } = await storage.generateBackupCodes(user.id, user.tenantId || null, 10);
```

**After:**
```
const { codes } = await storage.generateBackupCodes(user.id, user.tenant_id || null, 10);
```

---

✅ **Line 475** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 496** (high confidence)

**Before:**
```
if (!user.tenantId) {
```

**After:**
```
if (!user.tenant_id) {
```

---

✅ **Line 501** (high confidence)

**Before:**
```
const report = await storage.getMfaComplianceReport(user.tenantId);
```

**After:**
```
const report = await storage.getMfaComplianceReport(user.tenant_id);
```

---

✅ **Line 516** (high confidence)

**Before:**
```
if (!user.tenantId) {
```

**After:**
```
if (!user.tenant_id) {
```

---

✅ **Line 521** (high confidence)

**Before:**
```
const users = await storage.getUsersWithoutMfa(user.tenantId);
```

**After:**
```
const users = await storage.getUsersWithoutMfa(user.tenant_id);
```

---

✅ **Line 562** (high confidence)

**Before:**
```
if (!user.tenantId) {
```

**After:**
```
if (!user.tenant_id) {
```

---

✅ **Line 577** (high confidence)

**Before:**
```
const logs = await storage.getMfaAuditLogsByTenant(user.tenantId, filters);
```

**After:**
```
const logs = await storage.getMfaAuditLogsByTenant(user.tenant_id, filters);
```

---

✅ **Line 619** (high confidence)

**Before:**
```
user.tenantId || null,
```

**After:**
```
user.tenant_id || null,
```

---

✅ **Line 663** (high confidence)

**Before:**
```
const result = await sendSmsOtp(user.id, phoneNumber, user.tenantId || null);
```

**After:**
```
const result = await sendSmsOtp(user.id, phoneNumber, user.tenant_id || null);
```

---

✅ **Line 705** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 719** (high confidence)

**Before:**
```
tenantId: user.tenantId || null,
```

**After:**
```
tenantId: user.tenant_id || null,
```

---

✅ **Line 812** (high confidence)

**Before:**
```
user.tenantId || null,
```

**After:**
```
user.tenant_id || null,
```

---

✅ **Line 826** (high confidence)

**Before:**
```
const smsResult = await sendSmsOtp(user.id, phoneNumber, user.tenantId || null);
```

**After:**
```
const smsResult = await sendSmsOtp(user.id, phoneNumber, user.tenant_id || null);
```

---

### `server\routes\meeting-transcription-routes.ts`

✅ **Line 91** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 125** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 179** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 322** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 573** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 601** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 631** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 661** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 690** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 748** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 788** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 816** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

### `server\routes\meeting-scheduling-routes.ts`

✅ **Line 25** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 75** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 158** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 242** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 346** (medium confidence)

**Before:**
```
m.participants.some((p) => p.userId === participant),
```

**After:**
```
m.participants.some((p) => p.user_id === participant),
```

---

✅ **Line 372** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 870** (high confidence)

**Before:**
```
const analytics = await MeetingSchedulingService.getMeetingAnalytics(req.user.tenantId, {
```

**After:**
```
const analytics = await MeetingSchedulingService.getMeetingAnalytics(req.user.tenant_id, {
```

---

✅ **Line 902** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

### `server\routes\manufacturer-order-routes.ts`

✅ **Line 56** (high confidence)

**Before:**
```
const connections = await storage.getManufacturerConnections(user.tenantId, {
```

**After:**
```
const connections = await storage.getManufacturerConnections(user.tenant_id, {
```

---

✅ **Line 83** (high confidence)

**Before:**
```
if (!connection || connection.tenantId !== user.tenantId) {
```

**After:**
```
if (!connection || connection.tenant_id !== user.tenant_id) {
```

---

✅ **Line 117** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 146** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 151** (high confidence)

**Before:**
```
const updated = await storage.updateManufacturerConnection(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateManufacturerConnection(req.params.id, user.tenant_id, data);
```

---

✅ **Line 179** (high confidence)

**Before:**
```
if (!connection || connection.tenantId !== user.tenantId) {
```

**After:**
```
if (!connection || connection.tenant_id !== user.tenant_id) {
```

---

✅ **Line 183** (high confidence)

**Before:**
```
await storage.deleteManufacturerConnection(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteManufacturerConnection(req.params.id, user.tenant_id);
```

---

✅ **Line 200** (high confidence)

**Before:**
```
if (!connection || connection.tenantId !== user.tenantId) {
```

**After:**
```
if (!connection || connection.tenant_id !== user.tenant_id) {
```

---

✅ **Line 204** (high confidence)

**Before:**
```
const result = await storage.testManufacturerConnection(req.params.id, user.tenantId);
```

**After:**
```
const result = await storage.testManufacturerConnection(req.params.id, user.tenant_id);
```

---

✅ **Line 221** (high confidence)

**Before:**
```
if (!connection || connection.tenantId !== user.tenantId) {
```

**After:**
```
if (!connection || connection.tenant_id !== user.tenant_id) {
```

---

✅ **Line 233** (high confidence)

**Before:**
```
const updated = await storage.updateConnectionHealth(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateConnectionHealth(req.params.id, user.tenant_id, data);
```

---

✅ **Line 257** (high confidence)

**Before:**
```
const orders = await storage.getManufacturerOrders(user.tenantId, {
```

**After:**
```
const orders = await storage.getManufacturerOrders(user.tenant_id, {
```

---

✅ **Line 281** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 303** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 325** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 330** (high confidence)

**Before:**
```
const updated = await storage.updateManufacturerOrder(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateManufacturerOrder(req.params.id, user.tenant_id, data);
```

---

✅ **Line 351** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 355** (high confidence)

**Before:**
```
await storage.deleteManufacturerOrder(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteManufacturerOrder(req.params.id, user.tenant_id);
```

---

✅ **Line 372** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 376** (high confidence)

**Before:**
```
const submitted = await storage.submitOrder(req.params.id, user.tenantId);
```

**After:**
```
const submitted = await storage.submitOrder(req.params.id, user.tenant_id);
```

---

✅ **Line 393** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 404** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 427** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 438** (high confidence)

**Before:**
```
const updated = await storage.updateOrderFulfillment(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateOrderFulfillment(req.params.id, user.tenant_id, data);
```

---

✅ **Line 462** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 484** (high confidence)

**Before:**
```
if (!lineItem || lineItem.tenantId !== user.tenantId) {
```

**After:**
```
if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
```

---

✅ **Line 505** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 512** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 536** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 548** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 572** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 577** (high confidence)

**Before:**
```
const updated = await storage.updateOrderLineItem(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateOrderLineItem(req.params.id, user.tenant_id, data);
```

---

✅ **Line 598** (high confidence)

**Before:**
```
if (!lineItem || lineItem.tenantId !== user.tenantId) {
```

**After:**
```
if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
```

---

✅ **Line 602** (high confidence)

**Before:**
```
await storage.deleteOrderLineItem(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteOrderLineItem(req.params.id, user.tenant_id);
```

---

✅ **Line 619** (high confidence)

**Before:**
```
if (!lineItem || lineItem.tenantId !== user.tenantId) {
```

**After:**
```
if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
```

---

✅ **Line 630** (high confidence)

**Before:**
```
const updated = await storage.updateLineItemShipment(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateLineItemShipment(req.params.id, user.tenant_id, data);
```

---

✅ **Line 654** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 676** (high confidence)

**Before:**
```
if (!confirmation || confirmation.tenantId !== user.tenantId) {
```

**After:**
```
if (!confirmation || confirmation.tenant_id !== user.tenant_id) {
```

---

✅ **Line 697** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 704** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 727** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 732** (high confidence)

**Before:**
```
const updated = await storage.updateOrderConfirmation(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateOrderConfirmation(req.params.id, user.tenant_id, data);
```

---

✅ **Line 753** (high confidence)

**Before:**
```
if (!confirmation || confirmation.tenantId !== user.tenantId) {
```

**After:**
```
if (!confirmation || confirmation.tenant_id !== user.tenant_id) {
```

---

✅ **Line 757** (high confidence)

**Before:**
```
const processed = await storage.processConfirmation(req.params.id, user.tenantId);
```

**After:**
```
const processed = await storage.processConfirmation(req.params.id, user.tenant_id);
```

---

✅ **Line 777** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 799** (high confidence)

**Before:**
```
if (!shipment || shipment.tenantId !== user.tenantId) {
```

**After:**
```
if (!shipment || shipment.tenant_id !== user.tenant_id) {
```

---

✅ **Line 820** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 844** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 851** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 874** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 879** (high confidence)

**Before:**
```
const updated = await storage.updateOrderShipment(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateOrderShipment(req.params.id, user.tenant_id, data);
```

---

✅ **Line 900** (high confidence)

**Before:**
```
if (!shipment || shipment.tenantId !== user.tenantId) {
```

**After:**
```
if (!shipment || shipment.tenant_id !== user.tenant_id) {
```

---

✅ **Line 904** (high confidence)

**Before:**
```
await storage.deleteOrderShipment(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteOrderShipment(req.params.id, user.tenant_id);
```

---

✅ **Line 921** (high confidence)

**Before:**
```
if (!shipment || shipment.tenantId !== user.tenantId) {
```

**After:**
```
if (!shipment || shipment.tenant_id !== user.tenant_id) {
```

---

✅ **Line 932** (high confidence)

**Before:**
```
const updated = await storage.updateShipmentTracking(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateShipmentTracking(req.params.id, user.tenant_id, data);
```

---

✅ **Line 953** (high confidence)

**Before:**
```
if (!shipment || shipment.tenantId !== user.tenantId) {
```

**After:**
```
if (!shipment || shipment.tenant_id !== user.tenant_id) {
```

---

✅ **Line 964** (high confidence)

**Before:**
```
const delivered = await storage.deliverShipment(req.params.id, user.tenantId, data);
```

**After:**
```
const delivered = await storage.deliverShipment(req.params.id, user.tenant_id, data);
```

---

✅ **Line 988** (high confidence)

**Before:**
```
if (!order || order.tenantId !== user.tenantId) {
```

**After:**
```
if (!order || order.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1010** (high confidence)

**Before:**
```
const exceptions = await storage.getUnresolvedExceptions(user.tenantId, {
```

**After:**
```
const exceptions = await storage.getUnresolvedExceptions(user.tenant_id, {
```

---

✅ **Line 1032** (high confidence)

**Before:**
```
if (!exception || exception.tenantId !== user.tenantId) {
```

**After:**
```
if (!exception || exception.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1054** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 1076** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1081** (high confidence)

**Before:**
```
const updated = await storage.updateOrderException(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateOrderException(req.params.id, user.tenant_id, data);
```

---

✅ **Line 1102** (high confidence)

**Before:**
```
if (!exception || exception.tenantId !== user.tenantId) {
```

**After:**
```
if (!exception || exception.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1113** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 1137** (high confidence)

**Before:**
```
if (!exception || exception.tenantId !== user.tenantId) {
```

**After:**
```
if (!exception || exception.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1141** (high confidence)

**Before:**
```
const result = await storage.retryFailedOrder(req.params.id, user.tenantId);
```

**After:**
```
const result = await storage.retryFailedOrder(req.params.id, user.tenant_id);
```

---

✅ **Line 1168** (high confidence)

**Before:**
```
const analytics = await storage.getManufacturerOrderAnalytics(user.tenantId, {
```

**After:**
```
const analytics = await storage.getManufacturerOrderAnalytics(user.tenant_id, {
```

---

### `server\routes\lease-routes.ts`

✅ **Line 17** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 32** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 51** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 66** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 81** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 103** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 127** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 144** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 159** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 175** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 190** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 210** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 229** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 246** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 261** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 276** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 292** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 314** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 333** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 350** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 365** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 380** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 402** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 425** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 442** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 481** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 517** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

✅ **Line 558** (high confidence)

**Before:**
```
const tenantId = req.session.user?.tenantId;
```

**After:**
```
const tenantId = req.session.user?.tenant_id;
```

---

### `server\routes\lead-scoring-routes.ts`

✅ **Line 47** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 70** (high confidence)

**Before:**
```
const rules = await storage.getLeadScoringRules(user.tenantId, category as string);
```

**After:**
```
const rules = await storage.getLeadScoringRules(user.tenant_id, category as string);
```

---

✅ **Line 86** (high confidence)

**Before:**
```
const rules = await storage.getActiveLeadScoringRules(user.tenantId);
```

**After:**
```
const rules = await storage.getActiveLeadScoringRules(user.tenant_id);
```

---

✅ **Line 103** (high confidence)

**Before:**
```
if (!rule || rule.tenantId !== user.tenantId) {
```

**After:**
```
if (!rule || rule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 130** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 163** (high confidence)

**Before:**
```
if (!rule || rule.tenantId !== user.tenantId) {
```

**After:**
```
if (!rule || rule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 189** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 194** (high confidence)

**Before:**
```
const rules = await storage.getActiveLeadScoringRules(user.tenantId);
```

**After:**
```
const rules = await storage.getActiveLeadScoringRules(user.tenant_id);
```

---

✅ **Line 258** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 341** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 387** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 420** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 441** (high confidence)

**Before:**
```
const topLeads = await storage.getTopScoredLeads(user.tenantId, limit);
```

**After:**
```
const topLeads = await storage.getTopScoredLeads(user.tenant_id, limit);
```

---

✅ **Line 477** (high confidence)

**Before:**
```
const leads = await storage.getLeadsByGrade(user.tenantId, grade);
```

**After:**
```
const leads = await storage.getLeadsByGrade(user.tenant_id, grade);
```

---

✅ **Line 517** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 552** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 581** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 613** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 638** (high confidence)

**Before:**
```
const qualifiedLeads = await storage.getQualifiedLeads(user.tenantId, minScore);
```

**After:**
```
const qualifiedLeads = await storage.getQualifiedLeads(user.tenant_id, minScore);
```

---

✅ **Line 678** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 686** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 712** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

✅ **Line 741** (high confidence)

**Before:**
```
const analytics = await storage.getLeadScoringAnalytics(user.tenantId);
```

**After:**
```
const analytics = await storage.getLeadScoringAnalytics(user.tenant_id);
```

---

✅ **Line 764** (high confidence)

**Before:**
```
const analytics = await storage.getBantAnalytics(user.tenantId);
```

**After:**
```
const analytics = await storage.getBantAnalytics(user.tenant_id);
```

---

✅ **Line 783** (high confidence)

**Before:**
```
if (!lead || lead.tenantId !== user.tenantId) {
```

**After:**
```
if (!lead || lead.tenant_id !== user.tenant_id) {
```

---

### `server\routes\lead-intelligence-routes.ts`

✅ **Line 18** (high confidence)

**Before:**
```
if (!user?.tenantId) return null;
```

**After:**
```
if (!user?.tenant_id) return null;
```

---

✅ **Line 20** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 39** (high confidence)

**Before:**
```
context.tenantId,
```

**After:**
```
context.tenant_id,
```

---

✅ **Line 63** (high confidence)

**Before:**
```
context.tenantId,
```

**After:**
```
context.tenant_id,
```

---

⚠️ **Line 64** (medium confidence)

**Before:**
```
context.userId,
```

**After:**
```
context.user_id,
```

---

✅ **Line 91** (high confidence)

**Before:**
```
context.tenantId,
```

**After:**
```
context.tenant_id,
```

---

⚠️ **Line 92** (medium confidence)

**Before:**
```
context.userId,
```

**After:**
```
context.user_id,
```

---

✅ **Line 119** (high confidence)

**Before:**
```
context.tenantId,
```

**After:**
```
context.tenant_id,
```

---

⚠️ **Line 120** (medium confidence)

**Before:**
```
context.userId,
```

**After:**
```
context.user_id,
```

---

✅ **Line 151** (high confidence)

**Before:**
```
context.tenantId,
```

**After:**
```
context.tenant_id,
```

---

⚠️ **Line 152** (medium confidence)

**Before:**
```
context.userId,
```

**After:**
```
context.user_id,
```

---

✅ **Line 176** (high confidence)

**Before:**
```
const analytics = await leadIntelligenceService.getScoringAnalytics(context.tenantId);
```

**After:**
```
const analytics = await leadIntelligenceService.getScoringAnalytics(context.tenant_id);
```

---

✅ **Line 197** (high confidence)

**Before:**
```
const leads = await leadIntelligenceService.getLeadsRequiringAttention(context.tenantId, limit);
```

**After:**
```
const leads = await leadIntelligenceService.getLeadsRequiringAttention(context.tenant_id, limit);
```

---

### `server\routes\knowledge-base-routes.ts`

✅ **Line 19** (high confidence)

**Before:**
```
const tenantId = (req as any).user?.tenantId;
```

**After:**
```
const tenantId = (req as any).user?.tenant_id;
```

---

✅ **Line 58** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 59** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 84** (high confidence)

**Before:**
```
const tenantId = (req as any).user?.tenantId;
```

**After:**
```
const tenantId = (req as any).user?.tenant_id;
```

---

✅ **Line 141** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 142** (medium confidence)

**Before:**
```
const userId = (req as any).userId;
```

**After:**
```
const userId = (req as any).user_id;
```

---

✅ **Line 178** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 179** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 202** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 203** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 227** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 228** (medium confidence)

**Before:**
```
const userId = (req as any).userId;
```

**After:**
```
const userId = (req as any).user_id;
```

---

✅ **Line 255** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 256** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 296** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 328** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 358** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

### `server\routes\knowledge-base-admin-routes.ts`

✅ **Line 54** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 70** (high confidence)

**Before:**
```
.where(eq(knowledgeArticles.tenantId, tenantId));
```

**After:**
```
.where(eq(knowledgeArticles.tenant_id, tenantId));
```

---

✅ **Line 81** (high confidence)

**Before:**
```
.where(eq(articleViews.tenantId, tenantId));
```

**After:**
```
.where(eq(articleViews.tenant_id, tenantId));
```

---

✅ **Line 91** (high confidence)

**Before:**
```
.where(eq(articleFeedback.tenantId, tenantId));
```

**After:**
```
.where(eq(articleFeedback.tenant_id, tenantId));
```

---

✅ **Line 102** (high confidence)

**Before:**
```
.where(eq(aiContentGenerationQueue.tenantId, tenantId));
```

**After:**
```
.where(eq(aiContentGenerationQueue.tenant_id, tenantId));
```

---

✅ **Line 107** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

✅ **Line 116** (high confidence)

**Before:**
```
where: and(eq(knowledgeArticles.tenantId, tenantId), eq(knowledgeArticles.status, 'review')),
```

**After:**
```
where: and(eq(knowledgeArticles.tenant_id, tenantId), eq(knowledgeArticles.status, 'review')),
```

---

✅ **Line 147** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 148** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 178** (high confidence)

**Before:**
```
and(eq(knowledgeArticles.tenantId, tenantId), inArray(knowledgeArticles.id, articleIds)),
```

**After:**
```
and(eq(knowledgeArticles.tenant_id, tenantId), inArray(knowledgeArticles.id, articleIds)),
```

---

✅ **Line 205** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 216** (high confidence)

**Before:**
```
.where(and(eq(articleViews.tenantId, tenantId), inArray(articleViews.articleId, articleIds)));
```

**After:**
```
.where(and(eq(articleViews.tenant_id, tenantId), inArray(articleViews.articleId, articleIds)));
```

---

✅ **Line 221** (high confidence)

**Before:**
```
and(eq(articleFeedback.tenantId, tenantId), inArray(articleFeedback.articleId, articleIds)),
```

**After:**
```
and(eq(articleFeedback.tenant_id, tenantId), inArray(articleFeedback.articleId, articleIds)),
```

---

✅ **Line 227** (high confidence)

**Before:**
```
and(eq(articleVersions.tenantId, tenantId), inArray(articleVersions.articleId, articleIds)),
```

**After:**
```
and(eq(articleVersions.tenant_id, tenantId), inArray(articleVersions.articleId, articleIds)),
```

---

✅ **Line 234** (high confidence)

**Before:**
```
and(eq(knowledgeArticles.tenantId, tenantId), inArray(knowledgeArticles.id, articleIds)),
```

**After:**
```
and(eq(knowledgeArticles.tenant_id, tenantId), inArray(knowledgeArticles.id, articleIds)),
```

---

✅ **Line 260** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 264** (high confidence)

**Before:**
```
where: and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.resolved, false)),
```

**After:**
```
where: and(eq(articleFeedback.tenant_id, tenantId), eq(articleFeedback.resolved, false)),
```

---

⚠️ **Line 267** (medium confidence)

**Before:**
```
orderBy: [desc(articleFeedback.createdAt)],
```

**After:**
```
orderBy: [desc(articleFeedback.created_at)],
```

---

✅ **Line 308** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 309** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 326** (high confidence)

**Before:**
```
.where(and(eq(articleFeedback.id, id), eq(articleFeedback.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(articleFeedback.id, id), eq(articleFeedback.tenant_id, tenantId)))
```

---

✅ **Line 349** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 352** (high confidence)

**Before:**
```
const conditions = [eq(aiContentGenerationQueue.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(aiContentGenerationQueue.tenant_id, tenantId)];
```

---

⚠️ **Line 361** (medium confidence)

**Before:**
```
orderBy: [desc(aiContentGenerationQueue.createdAt)],
```

**After:**
```
orderBy: [desc(aiContentGenerationQueue.created_at)],
```

---

✅ **Line 384** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 394** (high confidence)

**Before:**
```
and(eq(aiContentGenerationQueue.id, id), eq(aiContentGenerationQueue.tenantId, tenantId)),
```

**After:**
```
and(eq(aiContentGenerationQueue.id, id), eq(aiContentGenerationQueue.tenant_id, tenantId)),
```

---

✅ **Line 418** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 422** (high confidence)

**Before:**
```
where: and(eq(articleVersions.articleId, id), eq(articleVersions.tenantId, tenantId)),
```

**After:**
```
where: and(eq(articleVersions.articleId, id), eq(articleVersions.tenant_id, tenantId)),
```

---

✅ **Line 449** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 450** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 463** (high confidence)

**Before:**
```
eq(articleVersions.tenantId, tenantId),
```

**After:**
```
eq(articleVersions.tenant_id, tenantId),
```

---

✅ **Line 503** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 504** (medium confidence)

**Before:**
```
const userId = (req as any).userId || 'demo-user';
```

**After:**
```
const userId = (req as any).user_id || 'demo-user';
```

---

✅ **Line 572** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 575** (high confidence)

**Before:**
```
const conditions = [eq(knowledgeArticles.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(knowledgeArticles.tenant_id, tenantId)];
```

---

⚠️ **Line 606** (medium confidence)

**Before:**
```
a.createdAt,
```

**After:**
```
a.created_at,
```

---

✅ **Line 630** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

⚠️ **Line 643** (medium confidence)

**Before:**
```
uniqueUsers: sql<number>`count(distinct ${articleViews.userId})::int`,
```

**After:**
```
uniqueUsers: sql<number>`count(distinct ${articleViews.user_id})::int`,
```

---

✅ **Line 649** (high confidence)

**Before:**
```
eq(articleViews.tenantId, tenantId),
```

**After:**
```
eq(articleViews.tenant_id, tenantId),
```

---

✅ **Line 666** (high confidence)

**Before:**
```
.where(eq(knowledgeArticles.tenantId, tenantId))
```

**After:**
```
.where(eq(knowledgeArticles.tenant_id, tenantId))
```

---

✅ **Line 672** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, tenantId),
```

**After:**
```
eq(knowledgeArticles.tenant_id, tenantId),
```

---

⚠️ **Line 673** (medium confidence)

**Before:**
```
gte(articleViews.createdAt, start),
```

**After:**
```
gte(articleViews.created_at, start),
```

---

⚠️ **Line 674** (medium confidence)

**Before:**
```
lte(articleViews.createdAt, end),
```

**After:**
```
lte(articleViews.created_at, end),
```

---

⚠️ **Line 676** (medium confidence)

**Before:**
```
orderBy: [desc(articleViews.createdAt)],
```

**After:**
```
orderBy: [desc(articleViews.created_at)],
```

---

✅ **Line 704** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId || 'demo-tenant';
```

**After:**
```
const tenantId = (req as any).tenant_id || 'demo-tenant';
```

---

✅ **Line 722** (high confidence)

**Before:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(knowledgeCategories.id, id), eq(knowledgeCategories.tenant_id, tenantId)));
```

---

### `server\routes\gps-tracking-routes.ts`

✅ **Line 52** (high confidence)

**Before:**
```
const locations = await storage.getActiveTechnicianLocations(user.tenantId);
```

**After:**
```
const locations = await storage.getActiveTechnicianLocations(user.tenant_id);
```

---

✅ **Line 68** (high confidence)

**Before:**
```
const location = await storage.getTechnicianLocation(req.params.id, user.tenantId);
```

**After:**
```
const location = await storage.getTechnicianLocation(req.params.id, user.tenant_id);
```

---

✅ **Line 92** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 115** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 148** (high confidence)

**Before:**
```
const allLocations = await storage.getActiveTechnicianLocations(user.tenantId);
```

**After:**
```
const allLocations = await storage.getActiveTechnicianLocations(user.tenant_id);
```

---

✅ **Line 189** (high confidence)

**Before:**
```
const history = await storage.getGpsLocationHistory(req.params.id, user.tenantId, filters);
```

**After:**
```
const history = await storage.getGpsLocationHistory(req.params.id, user.tenant_id, filters);
```

---

✅ **Line 209** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 230** (high confidence)

**Before:**
```
const timeline = await storage.getTicketActivityTimeline(req.params.ticketId, user.tenantId);
```

**After:**
```
const timeline = await storage.getTicketActivityTimeline(req.params.ticketId, user.tenant_id);
```

---

✅ **Line 258** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 292** (high confidence)

**Before:**
```
const routes = await storage.getRouteAssignments(user.tenantId, filters);
```

**After:**
```
const routes = await storage.getRouteAssignments(user.tenant_id, filters);
```

---

✅ **Line 309** (high confidence)

**Before:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 333** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 355** (high confidence)

**Before:**
```
const existing = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const existing = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 361** (high confidence)

**Before:**
```
const updated = await storage.updateRouteAssignment(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateRouteAssignment(req.params.id, user.tenant_id, data);
```

---

✅ **Line 381** (high confidence)

**Before:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 386** (high confidence)

**Before:**
```
await storage.deleteRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 402** (high confidence)

**Before:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 417** (high confidence)

**Before:**
```
const updated = await storage.startRoute(req.params.id, user.tenantId, startLocation);
```

**After:**
```
const updated = await storage.startRoute(req.params.id, user.tenant_id, startLocation);
```

---

✅ **Line 437** (high confidence)

**Before:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 455** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 478** (high confidence)

**Before:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
```

**After:**
```
const route = await storage.getRouteAssignment(req.params.id, user.tenant_id);
```

---

✅ **Line 490** (high confidence)

**Before:**
```
const updated = await storage.updateRouteProgress(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateRouteProgress(req.params.id, user.tenant_id, data);
```

---

✅ **Line 521** (high confidence)

**Before:**
```
const deviations = await storage.getRouteDeviations(user.tenantId, filters);
```

**After:**
```
const deviations = await storage.getRouteDeviations(user.tenant_id, filters);
```

---

✅ **Line 538** (high confidence)

**Before:**
```
const deviations = await storage.getRouteDeviations(user.tenantId, { resolved: false });
```

**After:**
```
const deviations = await storage.getRouteDeviations(user.tenant_id, { resolved: false });
```

---

✅ **Line 555** (high confidence)

**Before:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);
```

**After:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenant_id);
```

---

✅ **Line 579** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 600** (high confidence)

**Before:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);
```

**After:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenant_id);
```

---

✅ **Line 613** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 635** (high confidence)

**Before:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);
```

**After:**
```
const deviation = await storage.getRouteDeviation(req.params.id, user.tenant_id);
```

---

✅ **Line 649** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 681** (high confidence)

**Before:**
```
const etas = await storage.getEtaCalculations(user.tenantId, filters);
```

**After:**
```
const etas = await storage.getEtaCalculations(user.tenant_id, filters);
```

---

✅ **Line 698** (high confidence)

**Before:**
```
const eta = await storage.getEtaCalculation(req.params.id, user.tenantId);
```

**After:**
```
const eta = await storage.getEtaCalculation(req.params.id, user.tenant_id);
```

---

✅ **Line 722** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 743** (high confidence)

**Before:**
```
const eta = await storage.getLatestEtaForTicket(req.params.ticketId, user.tenantId);
```

**After:**
```
const eta = await storage.getLatestEtaForTicket(req.params.ticketId, user.tenant_id);
```

---

✅ **Line 764** (high confidence)

**Before:**
```
const eta = await storage.getEtaCalculation(req.params.id, user.tenantId);
```

**After:**
```
const eta = await storage.getEtaCalculation(req.params.id, user.tenant_id);
```

---

✅ **Line 775** (high confidence)

**Before:**
```
const updated = await storage.updateEtaArrival(req.params.id, user.tenantId, actualArrivalTime);
```

**After:**
```
const updated = await storage.updateEtaArrival(req.params.id, user.tenant_id, actualArrivalTime);
```

---

✅ **Line 800** (high confidence)

**Before:**
```
const accuracy = await storage.getEtaAccuracyMetrics(req.params.id, user.tenantId, start, end);
```

**After:**
```
const accuracy = await storage.getEtaAccuracyMetrics(req.params.id, user.tenant_id, start, end);
```

---

✅ **Line 826** (high confidence)

**Before:**
```
const geofences = await storage.getGeofences(user.tenantId, filters);
```

**After:**
```
const geofences = await storage.getGeofences(user.tenant_id, filters);
```

---

✅ **Line 843** (high confidence)

**Before:**
```
const geofence = await storage.getGeofence(req.params.id, user.tenantId);
```

**After:**
```
const geofence = await storage.getGeofence(req.params.id, user.tenant_id);
```

---

✅ **Line 873** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 901** (high confidence)

**Before:**
```
const existing = await storage.getGeofence(req.params.id, user.tenantId);
```

**After:**
```
const existing = await storage.getGeofence(req.params.id, user.tenant_id);
```

---

✅ **Line 907** (high confidence)

**Before:**
```
const updated = await storage.updateGeofence(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateGeofence(req.params.id, user.tenant_id, data);
```

---

✅ **Line 933** (high confidence)

**Before:**
```
const geofence = await storage.getGeofence(req.params.id, user.tenantId);
```

**After:**
```
const geofence = await storage.getGeofence(req.params.id, user.tenant_id);
```

---

✅ **Line 938** (high confidence)

**Before:**
```
await storage.deleteGeofence(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteGeofence(req.params.id, user.tenant_id);
```

---

✅ **Line 962** (high confidence)

**Before:**
```
const geofence = await storage.getGeofence(geofenceId, user.tenantId);
```

**After:**
```
const geofence = await storage.getGeofence(geofenceId, user.tenant_id);
```

---

✅ **Line 967** (high confidence)

**Before:**
```
const isInside = await storage.checkGeofence(geofenceId, user.tenantId, latitude, longitude);
```

**After:**
```
const isInside = await storage.checkGeofence(geofenceId, user.tenant_id, latitude, longitude);
```

---

✅ **Line 997** (high confidence)

**Before:**
```
const events = await storage.getGeofenceEvents(user.tenantId, filters);
```

**After:**
```
const events = await storage.getGeofenceEvents(user.tenant_id, filters);
```

---

✅ **Line 1017** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 1047** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 1066** (high confidence)

**Before:**
```
const events = await storage.getGeofenceEventsForTicket(req.params.ticketId, user.tenantId);
```

**After:**
```
const events = await storage.getGeofenceEventsForTicket(req.params.ticketId, user.tenant_id);
```

---

### `server\routes\geofence-alerts-routes.ts`

✅ **Line 39** (high confidence)

**Before:**
```
let whereConditions = [eq(geofenceAlertRules.tenantId, user.tenantId)];
```

**After:**
```
let whereConditions = [eq(geofenceAlertRules.tenant_id, user.tenant_id)];
```

---

✅ **Line 80** (high confidence)

**Before:**
```
eq(geofenceAlertRules.tenantId, user.tenantId),
```

**After:**
```
eq(geofenceAlertRules.tenant_id, user.tenant_id),
```

---

✅ **Line 117** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 149** (high confidence)

**Before:**
```
eq(geofenceAlertRules.tenantId, user.tenantId),
```

**After:**
```
eq(geofenceAlertRules.tenant_id, user.tenant_id),
```

---

✅ **Line 197** (high confidence)

**Before:**
```
eq(geofenceAlertRules.tenantId, user.tenantId),
```

**After:**
```
eq(geofenceAlertRules.tenant_id, user.tenant_id),
```

---

✅ **Line 227** (high confidence)

**Before:**
```
let whereConditions = [eq(geofenceAlerts.tenantId, user.tenantId)];
```

**After:**
```
let whereConditions = [eq(geofenceAlerts.tenant_id, user.tenant_id)];
```

---

✅ **Line 277** (high confidence)

**Before:**
```
const alerts = await geofenceAlertsService.getUnacknowledgedAlerts(user.tenantId, {
```

**After:**
```
const alerts = await geofenceAlertsService.getUnacknowledgedAlerts(user.tenant_id, {
```

---

✅ **Line 300** (high confidence)

**Before:**
```
.where(and(eq(geofenceAlerts.id, req.params.id), eq(geofenceAlerts.tenantId, user.tenantId)))
```

**After:**
```
.where(and(eq(geofenceAlerts.id, req.params.id), eq(geofenceAlerts.tenant_id, user.tenant_id)))
```

---

✅ **Line 330** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 366** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 403** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 450** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 481** (high confidence)

**Before:**
```
const alerts = await geofenceAlertsService.checkDwellAlerts(user.tenantId);
```

**After:**
```
const alerts = await geofenceAlertsService.checkDwellAlerts(user.tenant_id);
```

---

✅ **Line 501** (high confidence)

**Before:**
```
let whereConditions = [eq(technicianDwellSessions.tenantId, user.tenantId)];
```

**After:**
```
let whereConditions = [eq(technicianDwellSessions.tenant_id, user.tenant_id)];
```

---

✅ **Line 553** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 597** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 633** (high confidence)

**Before:**
```
eq(geofenceAlertSubscriptions.tenantId, user.tenantId),
```

**After:**
```
eq(geofenceAlertSubscriptions.tenant_id, user.tenant_id),
```

---

⚠️ **Line 634** (medium confidence)

**Before:**
```
eq(geofenceAlertSubscriptions.userId, user.id),
```

**After:**
```
eq(geofenceAlertSubscriptions.user_id, user.id),
```

---

✅ **Line 662** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 690** (high confidence)

**Before:**
```
eq(geofenceAlertSubscriptions.tenantId, user.tenantId),
```

**After:**
```
eq(geofenceAlertSubscriptions.tenant_id, user.tenant_id),
```

---

⚠️ **Line 691** (medium confidence)

**Before:**
```
eq(geofenceAlertSubscriptions.userId, user.id),
```

**After:**
```
eq(geofenceAlertSubscriptions.user_id, user.id),
```

---

✅ **Line 728** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

### `server\routes\field-service-routes.ts`

✅ **Line 18** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 34** (high confidence)

**Before:**
```
const installations = await storage.getInstallations(req.session.user.tenantId, filters);
```

**After:**
```
const installations = await storage.getInstallations(req.session.user.tenant_id, filters);
```

---

✅ **Line 43** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 49** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 64** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 81** (high confidence)

**Before:**
```
tenantId: req.session.user.tenantId,
```

**After:**
```
tenantId: req.session.user.tenant_id,
```

---

✅ **Line 87** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 100** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 118** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 134** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 138** (high confidence)

**Before:**
```
await storage.deleteInstallation(req.params.id, req.session.user.tenantId);
```

**After:**
```
await storage.deleteInstallation(req.params.id, req.session.user.tenant_id);
```

---

✅ **Line 151** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 164** (high confidence)

**Before:**
```
const signatures = await storage.getServiceSignatures(req.session.user.tenantId, filters);
```

**After:**
```
const signatures = await storage.getServiceSignatures(req.session.user.tenant_id, filters);
```

---

✅ **Line 173** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 179** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 194** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 211** (high confidence)

**Before:**
```
tenantId: req.session.user.tenantId,
```

**After:**
```
tenantId: req.session.user.tenant_id,
```

---

✅ **Line 224** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 242** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 258** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 262** (high confidence)

**Before:**
```
await storage.deleteServiceSignature(req.params.id, req.session.user.tenantId);
```

**After:**
```
await storage.deleteServiceSignature(req.params.id, req.session.user.tenant_id);
```

---

✅ **Line 275** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 281** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 291** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 297** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 312** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 329** (high confidence)

**Before:**
```
tenantId: req.session.user.tenantId,
```

**After:**
```
tenantId: req.session.user.tenant_id,
```

---

✅ **Line 341** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 364** (high confidence)

**Before:**
```
tenantId: req.session.user!.tenantId,
```

**After:**
```
tenantId: req.session.user!.tenant_id,
```

---

✅ **Line 376** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 394** (high confidence)

**Before:**
```
req.session.user.tenantId,
```

**After:**
```
req.session.user.tenant_id,
```

---

✅ **Line 410** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 414** (high confidence)

**Before:**
```
await storage.deleteInstallationChecklist(req.params.id, req.session.user.tenantId);
```

**After:**
```
await storage.deleteInstallationChecklist(req.params.id, req.session.user.tenant_id);
```

---

### `server\routes\email-marketing-routes.ts`

✅ **Line 18** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 22** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 40** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 43** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 60** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 63** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 85** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 88** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 110** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 126** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 129** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 147** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 150** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 167** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 170** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 193** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 196** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 214** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 217** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 230** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 233** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 251** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 254** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 267** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 270** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 287** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 290** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 310** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 313** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 335** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 338** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 356** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 359** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 372** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 375** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 392** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 395** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 415** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 418** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 436** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 439** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 456** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId || !req.session?.user?.id) {
```

**After:**
```
if (!req.session?.user?.tenant_id || !req.session?.user?.id) {
```

---

✅ **Line 459** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 482** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 485** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 503** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 506** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 519** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 522** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 540** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 543** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 560** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 563** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 580** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 583** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 603** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 606** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 628** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 631** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 649** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 652** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 665** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 668** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 685** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 688** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

✅ **Line 708** (high confidence)

**Before:**
```
if (!req.session?.user?.tenantId) {
```

**After:**
```
if (!req.session?.user?.tenant_id) {
```

---

✅ **Line 711** (high confidence)

**Before:**
```
const tenantId = req.session.user.tenantId;
```

**After:**
```
const tenantId = req.session.user.tenant_id;
```

---

### `server\routes\customer-success-routes.ts`

✅ **Line 34** (high confidence)

**Before:**
```
const scores = await storage.getHealthScores(user.tenantId, filters);
```

**After:**
```
const scores = await storage.getHealthScores(user.tenant_id, filters);
```

---

✅ **Line 52** (high confidence)

**Before:**
```
if (!score || score.tenantId !== user.tenantId) {
```

**After:**
```
if (!score || score.tenant_id !== user.tenant_id) {
```

---

✅ **Line 73** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 94** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 98** (high confidence)

**Before:**
```
const updated = await storage.updateHealthScore(req.params.id, user.tenantId, req.body);
```

**After:**
```
const updated = await storage.updateHealthScore(req.params.id, user.tenant_id, req.body);
```

---

✅ **Line 114** (high confidence)

**Before:**
```
const score = await storage.getHealthScoreByCustomer(req.params.customerId, user.tenantId);
```

**After:**
```
const score = await storage.getHealthScoreByCustomer(req.params.customerId, user.tenant_id);
```

---

✅ **Line 138** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 160** (high confidence)

**Before:**
```
const scores = await storage.getScoresDueForCalculation(user.tenantId);
```

**After:**
```
const scores = await storage.getScoresDueForCalculation(user.tenant_id);
```

---

✅ **Line 176** (high confidence)

**Before:**
```
const scores = await storage.getCustomersAtRisk(user.tenantId);
```

**After:**
```
const scores = await storage.getCustomersAtRisk(user.tenant_id);
```

---

✅ **Line 200** (high confidence)

**Before:**
```
const predictions = await storage.getChurnPredictions(user.tenantId, filters);
```

**After:**
```
const predictions = await storage.getChurnPredictions(user.tenant_id, filters);
```

---

✅ **Line 218** (high confidence)

**Before:**
```
if (!prediction || prediction.tenantId !== user.tenantId) {
```

**After:**
```
if (!prediction || prediction.tenant_id !== user.tenant_id) {
```

---

✅ **Line 245** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 269** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 273** (high confidence)

**Before:**
```
const updated = await storage.updateChurnPrediction(req.params.id, user.tenantId, req.body);
```

**After:**
```
const updated = await storage.updateChurnPrediction(req.params.id, user.tenant_id, req.body);
```

---

✅ **Line 291** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 313** (high confidence)

**Before:**
```
const predictions = await storage.getHighRiskChurns(user.tenantId);
```

**After:**
```
const predictions = await storage.getHighRiskChurns(user.tenant_id);
```

---

✅ **Line 333** (high confidence)

**Before:**
```
const predictions = await storage.getExpiredPredictions(user.tenantId);
```

**After:**
```
const predictions = await storage.getExpiredPredictions(user.tenant_id);
```

---

✅ **Line 349** (high confidence)

**Before:**
```
const predictions = await storage.getPredictionsRequiringIntervention(user.tenantId);
```

**After:**
```
const predictions = await storage.getPredictionsRequiringIntervention(user.tenant_id);
```

---

✅ **Line 375** (high confidence)

**Before:**
```
const interventions = await storage.getInterventions(user.tenantId, filters);
```

**After:**
```
const interventions = await storage.getInterventions(user.tenant_id, filters);
```

---

✅ **Line 393** (high confidence)

**Before:**
```
if (!intervention || intervention.tenantId !== user.tenantId) {
```

**After:**
```
if (!intervention || intervention.tenant_id !== user.tenant_id) {
```

---

✅ **Line 414** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 435** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 439** (high confidence)

**Before:**
```
const updated = await storage.updateIntervention(req.params.id, user.tenantId, req.body);
```

**After:**
```
const updated = await storage.updateIntervention(req.params.id, user.tenant_id, req.body);
```

---

✅ **Line 457** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 481** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 490** (high confidence)

**Before:**
```
const assigned = await storage.assignIntervention(req.params.id, user.tenantId, userId);
```

**After:**
```
const assigned = await storage.assignIntervention(req.params.id, user.tenant_id, userId);
```

---

✅ **Line 507** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 518** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 544** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 553** (high confidence)

**Before:**
```
const cancelled = await storage.cancelIntervention(req.params.id, user.tenantId, reason);
```

**After:**
```
const cancelled = await storage.cancelIntervention(req.params.id, user.tenant_id, reason);
```

---

✅ **Line 569** (high confidence)

**Before:**
```
const interventions = await storage.getOverdueInterventions(user.tenantId);
```

**After:**
```
const interventions = await storage.getOverdueInterventions(user.tenant_id);
```

---

✅ **Line 585** (high confidence)

**Before:**
```
const interventions = await storage.getMyInterventions(user.id, user.tenantId);
```

**After:**
```
const interventions = await storage.getMyInterventions(user.id, user.tenant_id);
```

---

✅ **Line 610** (high confidence)

**Before:**
```
const journeys = await storage.getJourneys(user.tenantId, filters);
```

**After:**
```
const journeys = await storage.getJourneys(user.tenant_id, filters);
```

---

✅ **Line 628** (high confidence)

**Before:**
```
if (!journey || journey.tenantId !== user.tenantId) {
```

**After:**
```
if (!journey || journey.tenant_id !== user.tenant_id) {
```

---

✅ **Line 649** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 669** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 673** (high confidence)

**Before:**
```
const updated = await storage.updateJourney(req.params.id, user.tenantId, req.body);
```

**After:**
```
const updated = await storage.updateJourney(req.params.id, user.tenant_id, req.body);
```

---

✅ **Line 689** (high confidence)

**Before:**
```
const journey = await storage.getJourneyByCustomer(req.params.customerId, user.tenantId);
```

**After:**
```
const journey = await storage.getJourneyByCustomer(req.params.customerId, user.tenant_id);
```

---

✅ **Line 711** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 720** (high confidence)

**Before:**
```
const advanced = await storage.advanceJourneyStage(req.params.id, user.tenantId, newStage);
```

**After:**
```
const advanced = await storage.advanceJourneyStage(req.params.id, user.tenant_id, newStage);
```

---

✅ **Line 737** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 748** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 766** (high confidence)

**Before:**
```
const journeys = await storage.getJourneysNeedingAttention(user.tenantId);
```

**After:**
```
const journeys = await storage.getJourneysNeedingAttention(user.tenant_id);
```

---

✅ **Line 791** (high confidence)

**Before:**
```
const renewals = await storage.getRenewalOpportunities(user.tenantId, filters);
```

**After:**
```
const renewals = await storage.getRenewalOpportunities(user.tenant_id, filters);
```

---

✅ **Line 809** (high confidence)

**Before:**
```
if (!renewal || renewal.tenantId !== user.tenantId) {
```

**After:**
```
if (!renewal || renewal.tenant_id !== user.tenant_id) {
```

---

✅ **Line 830** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 851** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 855** (high confidence)

**Before:**
```
const updated = await storage.updateRenewalOpportunity(req.params.id, user.tenantId, req.body);
```

**After:**
```
const updated = await storage.updateRenewalOpportunity(req.params.id, user.tenant_id, req.body);
```

---

✅ **Line 871** (high confidence)

**Before:**
```
const renewals = await storage.getRenewalsByCustomer(req.params.customerId, user.tenantId);
```

**After:**
```
const renewals = await storage.getRenewalsByCustomer(req.params.customerId, user.tenant_id);
```

---

✅ **Line 887** (high confidence)

**Before:**
```
const renewal = await storage.getRenewalByContract(req.params.contractId, user.tenantId);
```

**After:**
```
const renewal = await storage.getRenewalByContract(req.params.contractId, user.tenant_id);
```

---

✅ **Line 915** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 924** (high confidence)

**Before:**
```
const assigned = await storage.assignRenewalCsm(req.params.id, user.tenantId, csmId);
```

**After:**
```
const assigned = await storage.assignRenewalCsm(req.params.id, user.tenant_id, csmId);
```

---

✅ **Line 941** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 953** (high confidence)

**Before:**
```
const closed = await storage.closeRenewal(req.params.id, user.tenantId, won, notes);
```

**After:**
```
const closed = await storage.closeRenewal(req.params.id, user.tenant_id, won, notes);
```

---

✅ **Line 974** (high confidence)

**Before:**
```
const renewals = await storage.getUpcomingRenewals(user.tenantId, days);
```

**After:**
```
const renewals = await storage.getUpcomingRenewals(user.tenant_id, days);
```

---

✅ **Line 995** (high confidence)

**Before:**
```
const renewals = await storage.getHighValueRenewals(user.tenantId, minMrr);
```

**After:**
```
const renewals = await storage.getHighValueRenewals(user.tenant_id, minMrr);
```

---

### `server\routes\content-gap-analysis-routes.ts`

⚠️ **Line 14** (medium confidence)

**Before:**
```
if (!req.session || !req.session.userId) {
```

**After:**
```
if (!req.session || !req.session.user_id) {
```

---

⚠️ **Line 22** (medium confidence)

**Before:**
```
if (!req.session || !req.session.userId) {
```

**After:**
```
if (!req.session || !req.session.user_id) {
```

---

✅ **Line 36** (high confidence)

**Before:**
```
(req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
```

**After:**
```
(req as any).tenant_id || (req.session as any).tenant_id || '00000000-0000-0000-0000-000000000000'
```

---

### `server\routes\chrome-extension-routes.ts`

✅ **Line 121** (high confidence)

**Before:**
```
const conditions = [eq(businessRecords.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(businessRecords.tenant_id, tenantId)];
```

---

✅ **Line 135** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 153** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 171** (high confidence)

**Before:**
```
eq(businessRecords.tenantId, tenantId),
```

**After:**
```
eq(businessRecords.tenant_id, tenantId),
```

---

✅ **Line 205** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 403** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

⚠️ **Line 425** (medium confidence)

**Before:**
```
createdAt: duplicateCheck.record.createdAt,
```

**After:**
```
createdAt: duplicateCheck.record.created_at,
```

---

✅ **Line 454** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

✅ **Line 497** (high confidence)

**Before:**
```
const tenantId = req.user.tenantId;
```

**After:**
```
const tenantId = req.user.tenant_id;
```

---

### `server\routes\billing.ts`

✅ **Line 48** (high confidence)

**Before:**
```
if (!req.tenantId && !req.user?.tenantId) {
```

**After:**
```
if (!req.tenant_id && !req.user?.tenant_id) {
```

---

✅ **Line 51** (high confidence)

**Before:**
```
req.tenantId = req.tenantId || req.user?.tenantId;
```

**After:**
```
req.tenant_id = req.tenant_id || req.user?.tenant_id;
```

---

⚠️ **Line 59** (medium confidence)

**Before:**
```
if (!req.user && !req.session?.userId) {
```

**After:**
```
if (!req.user && !req.session?.user_id) {
```

---

✅ **Line 96** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 101** (high confidence)

**Before:**
```
.where(eq(subscriptionPaymentMethods.tenantId, tenantId))
```

**After:**
```
.where(eq(subscriptionPaymentMethods.tenant_id, tenantId))
```

---

⚠️ **Line 104** (medium confidence)

**Before:**
```
desc(subscriptionPaymentMethods.createdAt),
```

**After:**
```
desc(subscriptionPaymentMethods.created_at),
```

---

✅ **Line 120** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 148** (high confidence)

**Before:**
```
.where(eq(subscriptionPaymentMethods.tenantId, tenantId));
```

**After:**
```
.where(eq(subscriptionPaymentMethods.tenant_id, tenantId));
```

---

✅ **Line 187** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 197** (high confidence)

**Before:**
```
eq(subscriptionPaymentMethods.tenantId, tenantId),
```

**After:**
```
eq(subscriptionPaymentMethods.tenant_id, tenantId),
```

---

✅ **Line 211** (high confidence)

**Before:**
```
.where(eq(subscriptionPaymentMethods.tenantId, tenantId));
```

**After:**
```
.where(eq(subscriptionPaymentMethods.tenant_id, tenantId));
```

---

✅ **Line 241** (high confidence)

**Before:**
```
.where(eq(subscriptionPaymentMethods.tenantId, tenantId))
```

**After:**
```
.where(eq(subscriptionPaymentMethods.tenant_id, tenantId))
```

---

✅ **Line 270** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

⚠️ **Line 303** (medium confidence)

**Before:**
```
createdAt: invoices.createdAt,
```

**After:**
```
createdAt: invoices.created_at,
```

---

⚠️ **Line 304** (medium confidence)

**Before:**
```
updatedAt: invoices.updatedAt,
```

**After:**
```
updatedAt: invoices.updated_at,
```

---

✅ **Line 310** (high confidence)

**Before:**
```
const conditions = [eq(invoices.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(invoices.tenant_id, tenantId)];
```

---

⚠️ **Line 345** (medium confidence)

**Before:**
```
gte(invoices.createdAt, sql`NOW() - INTERVAL '7 days'`),
```

**After:**
```
gte(invoices.created_at, sql`NOW() - INTERVAL '7 days'`),
```

---

⚠️ **Line 352** (medium confidence)

**Before:**
```
.orderBy(desc(invoices.createdAt))
```

**After:**
```
.orderBy(desc(invoices.created_at))
```

---

✅ **Line 392** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

⚠️ **Line 423** (medium confidence)

**Before:**
```
createdAt: invoices.createdAt,
```

**After:**
```
createdAt: invoices.created_at,
```

---

⚠️ **Line 424** (medium confidence)

**Before:**
```
updatedAt: invoices.updatedAt,
```

**After:**
```
updatedAt: invoices.updated_at,
```

---

✅ **Line 428** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)));
```

---

✅ **Line 456** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

⚠️ **Line 457** (medium confidence)

**Before:**
```
const userId = req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const userId = req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 502** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 511** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 531** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 538** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)));
```

---

✅ **Line 554** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)));
```

---

✅ **Line 578** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 599** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 705** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 738** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 746** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)));
```

---

✅ **Line 771** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 787** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 794** (high confidence)

**Before:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
```

---

✅ **Line 843** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 846** (high confidence)

**Before:**
```
const conditions = [eq(autoInvoiceGeneration.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(autoInvoiceGeneration.tenant_id, tenantId)];
```

---

✅ **Line 875** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 912** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 938** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 955** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 960** (high confidence)

**Before:**
```
.where(eq(invoices.tenantId, tenantId));
```

**After:**
```
.where(eq(invoices.tenant_id, tenantId));
```

---

✅ **Line 968** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'paid')));
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), eq(invoices.invoiceStatus, 'paid')));
```

---

✅ **Line 976** (high confidence)

**Before:**
```
.where(and(eq(invoices.tenantId, tenantId), eq(invoices.invoiceStatus, 'sent')));
```

**After:**
```
.where(and(eq(invoices.tenant_id, tenantId), eq(invoices.invoiceStatus, 'sent')));
```

---

✅ **Line 986** (high confidence)

**Before:**
```
eq(invoices.tenantId, tenantId),
```

**After:**
```
eq(invoices.tenant_id, tenantId),
```

---

✅ **Line 1026** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1034** (high confidence)

**Before:**
```
eq(subscriptionPaymentMethods.tenantId, tenantId),
```

**After:**
```
eq(subscriptionPaymentMethods.tenant_id, tenantId),
```

---

✅ **Line 1055** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1064** (high confidence)

**Before:**
```
eq(subscriptionPaymentMethods.tenantId, tenantId),
```

**After:**
```
eq(subscriptionPaymentMethods.tenant_id, tenantId),
```

---

✅ **Line 1138** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1214** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1218** (high confidence)

**Before:**
```
const conditions = [eq(billingRules.tenantId, tenantId)];
```

**After:**
```
const conditions = [eq(billingRules.tenant_id, tenantId)];
```

---

⚠️ **Line 1240** (medium confidence)

**Before:**
```
.orderBy(desc(billingRules.priority), desc(billingRules.createdAt))
```

**After:**
```
.orderBy(desc(billingRules.priority), desc(billingRules.created_at))
```

---

✅ **Line 1271** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1277** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1297** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

⚠️ **Line 1298** (medium confidence)

**Before:**
```
const userId = req.user?.claims?.sub || req.session?.userId;
```

**After:**
```
const userId = req.user?.claims?.sub || req.session?.user_id;
```

---

✅ **Line 1330** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1337** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1350** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1369** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1376** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1390** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1413** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1422** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1447** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1456** (high confidence)

**Before:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
```

**After:**
```
.where(and(eq(billingRules.id, ruleId), eq(billingRules.tenant_id, tenantId)))
```

---

✅ **Line 1481** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1505** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 1535** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

### `server\routes\automated-billing-routes.ts`

✅ **Line 33** (high confidence)

**Before:**
```
let whereConditions = [eq(billingSchedules.tenantId, user.tenantId)];
```

**After:**
```
let whereConditions = [eq(billingSchedules.tenant_id, user.tenant_id)];
```

---

✅ **Line 68** (high confidence)

**Before:**
```
const dueSchedules = await automatedBillingService.getDueSchedules(user.tenantId);
```

**After:**
```
const dueSchedules = await automatedBillingService.getDueSchedules(user.tenant_id);
```

---

✅ **Line 105** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 136** (high confidence)

**Before:**
```
and(eq(billingSchedules.id, req.params.id), eq(billingSchedules.tenantId, user.tenantId)),
```

**After:**
```
and(eq(billingSchedules.id, req.params.id), eq(billingSchedules.tenant_id, user.tenant_id)),
```

---

✅ **Line 193** (high confidence)

**Before:**
```
and(eq(billingSchedules.id, req.params.id), eq(billingSchedules.tenantId, user.tenantId)),
```

**After:**
```
and(eq(billingSchedules.id, req.params.id), eq(billingSchedules.tenant_id, user.tenant_id)),
```

---

✅ **Line 226** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 249** (high confidence)

**Before:**
```
const dueSchedules = await automatedBillingService.getDueSchedules(user.tenantId);
```

**After:**
```
const dueSchedules = await automatedBillingService.getDueSchedules(user.tenant_id);
```

---

✅ **Line 255** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 290** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 309** (high confidence)

**Before:**
```
const status = await automatedBillingService.getMeterCollectionStatus(user.tenantId);
```

**After:**
```
const status = await automatedBillingService.getMeterCollectionStatus(user.tenant_id);
```

---

✅ **Line 327** (high confidence)

**Before:**
```
const metrics = await automatedBillingService.getBillingDashboardMetrics(user.tenantId);
```

**After:**
```
const metrics = await automatedBillingService.getBillingDashboardMetrics(user.tenant_id);
```

---

✅ **Line 345** (high confidence)

**Before:**
```
let whereConditions = [eq(invoiceGenerationLogs.tenantId, user.tenantId)];
```

**After:**
```
let whereConditions = [eq(invoiceGenerationLogs.tenant_id, user.tenant_id)];
```

---

⚠️ **Line 359** (medium confidence)

**Before:**
```
.orderBy(desc(invoiceGenerationLogs.createdAt));
```

**After:**
```
.orderBy(desc(invoiceGenerationLogs.created_at));
```

---

✅ **Line 395** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 435** (high confidence)

**Before:**
```
const result = await billingEngine.generateBulkInvoices(data.contractIds, user.tenantId, {
```

**After:**
```
const result = await billingEngine.generateBulkInvoices(data.contractIds, user.tenant_id, {
```

---

### `server\routes\article-ratings-routes.ts`

⚠️ **Line 21** (medium confidence)

**Before:**
```
if (!req.session || !req.session.userId) {
```

**After:**
```
if (!req.session || !req.session.user_id) {
```

---

✅ **Line 30** (high confidence)

**Before:**
```
(req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
```

**After:**
```
(req as any).tenant_id || (req.session as any).tenant_id || '00000000-0000-0000-0000-000000000000'
```

---

⚠️ **Line 36** (medium confidence)

**Before:**
```
return req.session?.userId || (req.session as any).user?.id || '';
```

**After:**
```
return req.session?.user_id || (req.session as any).user?.id || '';
```

---

✅ **Line 60** (high confidence)

**Before:**
```
.where(and(eq(articleRatings.articleId, articleId), eq(articleRatings.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(articleRatings.articleId, articleId), eq(articleRatings.tenant_id, tenantId)));
```

---

✅ **Line 71** (high confidence)

**Before:**
```
.where(and(eq(articleVotes.articleId, articleId), eq(articleVotes.tenantId, tenantId)));
```

**After:**
```
.where(and(eq(articleVotes.articleId, articleId), eq(articleVotes.tenant_id, tenantId)));
```

---

⚠️ **Line 81** (medium confidence)

**Before:**
```
createdAt: articleRatings.createdAt,
```

**After:**
```
createdAt: articleRatings.created_at,
```

---

✅ **Line 87** (high confidence)

**Before:**
```
eq(articleRatings.tenantId, tenantId),
```

**After:**
```
eq(articleRatings.tenant_id, tenantId),
```

---

⚠️ **Line 91** (medium confidence)

**Before:**
```
.orderBy(desc(articleRatings.createdAt))
```

**After:**
```
.orderBy(desc(articleRatings.created_at))
```

---

⚠️ **Line 156** (medium confidence)

**Before:**
```
eq(readingHistory.userId, userId),
```

**After:**
```
eq(readingHistory.user_id, userId),
```

---

⚠️ **Line 171** (medium confidence)

**Before:**
```
eq(articleRatings.userId, userId),
```

**After:**
```
eq(articleRatings.user_id, userId),
```

---

⚠️ **Line 243** (medium confidence)

**Before:**
```
eq(articleRatings.userId, userId),
```

**After:**
```
eq(articleRatings.user_id, userId),
```

---

⚠️ **Line 294** (medium confidence)

**Before:**
```
.where(and(eq(articleVotes.userId, userId), eq(articleVotes.articleId, articleId)))
```

**After:**
```
.where(and(eq(articleVotes.user_id, userId), eq(articleVotes.articleId, articleId)))
```

---

⚠️ **Line 355** (medium confidence)

**Before:**
```
.where(and(eq(articleVotes.userId, userId), eq(articleVotes.articleId, articleId)))
```

**After:**
```
.where(and(eq(articleVotes.user_id, userId), eq(articleVotes.articleId, articleId)))
```

---

⚠️ **Line 386** (medium confidence)

**Before:**
```
.where(and(eq(articleRatings.id, ratingId), eq(articleRatings.userId, userId)))
```

**After:**
```
.where(and(eq(articleRatings.id, ratingId), eq(articleRatings.user_id, userId)))
```

---

⚠️ **Line 425** (medium confidence)

**Before:**
```
.where(and(eq(articleVotes.id, voteId), eq(articleVotes.userId, userId)))
```

**After:**
```
.where(and(eq(articleVotes.id, voteId), eq(articleVotes.user_id, userId)))
```

---

### `server\routes\article-bookmarks-routes.ts`

⚠️ **Line 16** (medium confidence)

**Before:**
```
if (!req.session || !req.session.userId) {
```

**After:**
```
if (!req.session || !req.session.user_id) {
```

---

✅ **Line 25** (high confidence)

**Before:**
```
(req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
```

**After:**
```
(req as any).tenant_id || (req.session as any).tenant_id || '00000000-0000-0000-0000-000000000000'
```

---

⚠️ **Line 31** (medium confidence)

**Before:**
```
return req.session?.userId || (req.session as any).user?.id || '';
```

**After:**
```
return req.session?.user_id || (req.session as any).user?.id || '';
```

---

⚠️ **Line 59** (medium confidence)

**Before:**
```
.where(and(eq(articleBookmarks.tenantId, tenantId), eq(articleBookmarks.userId, userId)))
```

**After:**
```
.where(and(eq(articleBookmarks.tenantId, tenantId), eq(articleBookmarks.user_id, userId)))
```

---

✅ **Line 59** (high confidence)

**Before:**
```
.where(and(eq(articleBookmarks.tenantId, tenantId), eq(articleBookmarks.userId, userId)))
```

**After:**
```
.where(and(eq(articleBookmarks.tenant_id, tenantId), eq(articleBookmarks.userId, userId)))
```

---

⚠️ **Line 60** (medium confidence)

**Before:**
```
.orderBy(desc(articleBookmarks.createdAt))
```

**After:**
```
.orderBy(desc(articleBookmarks.created_at))
```

---

✅ **Line 68** (high confidence)

**Before:**
```
eq(articleBookmarks.tenantId, tenantId),
```

**After:**
```
eq(articleBookmarks.tenant_id, tenantId),
```

---

⚠️ **Line 69** (medium confidence)

**Before:**
```
eq(articleBookmarks.userId, userId),
```

**After:**
```
eq(articleBookmarks.user_id, userId),
```

---

✅ **Line 83** (high confidence)

**Before:**
```
eq(articleBookmarks.tenantId, tenantId),
```

**After:**
```
eq(articleBookmarks.tenant_id, tenantId),
```

---

⚠️ **Line 84** (medium confidence)

**Before:**
```
eq(articleBookmarks.userId, userId),
```

**After:**
```
eq(articleBookmarks.user_id, userId),
```

---

⚠️ **Line 134** (medium confidence)

**Before:**
```
.where(and(eq(articleBookmarks.userId, userId), eq(articleBookmarks.articleId, articleId)))
```

**After:**
```
.where(and(eq(articleBookmarks.user_id, userId), eq(articleBookmarks.articleId, articleId)))
```

---

⚠️ **Line 187** (medium confidence)

**Before:**
```
.where(and(eq(articleBookmarks.id, id), eq(articleBookmarks.userId, userId)))
```

**After:**
```
.where(and(eq(articleBookmarks.id, id), eq(articleBookmarks.user_id, userId)))
```

---

⚠️ **Line 237** (medium confidence)

**Before:**
```
.where(and(eq(articleBookmarks.id, id), eq(articleBookmarks.userId, userId)))
```

**After:**
```
.where(and(eq(articleBookmarks.id, id), eq(articleBookmarks.user_id, userId)))
```

---

✅ **Line 282** (high confidence)

**Before:**
```
eq(articleBookmarks.tenantId, tenantId),
```

**After:**
```
eq(articleBookmarks.tenant_id, tenantId),
```

---

⚠️ **Line 283** (medium confidence)

**Before:**
```
eq(articleBookmarks.userId, userId),
```

**After:**
```
eq(articleBookmarks.user_id, userId),
```

---

⚠️ **Line 319** (medium confidence)

**Before:**
```
.where(and(eq(articleBookmarks.userId, userId), eq(articleBookmarks.articleId, articleId)))
```

**After:**
```
.where(and(eq(articleBookmarks.user_id, userId), eq(articleBookmarks.articleId, articleId)))
```

---

### `server\routes\apollo-routes.ts`

✅ **Line 43** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 155** (high confidence)

**Before:**
```
tenantId: req.session.user.tenantId,
```

**After:**
```
tenantId: req.session.user.tenant_id,
```

---

✅ **Line 177** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 278** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 391** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 418** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

⚠️ **Line 435** (medium confidence)

**Before:**
```
createdAt: credential.createdAt,
```

**After:**
```
createdAt: credential.created_at,
```

---

⚠️ **Line 436** (medium confidence)

**Before:**
```
updatedAt: credential.updatedAt,
```

**After:**
```
updatedAt: credential.updated_at,
```

---

✅ **Line 454** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 535** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

✅ **Line 560** (high confidence)

**Before:**
```
tenantId: credential?.tenantId,
```

**After:**
```
tenantId: credential?.tenant_id,
```

---

✅ **Line 612** (high confidence)

**Before:**
```
const tenantId = (req.user as any)?.tenantId;
```

**After:**
```
const tenantId = (req.user as any)?.tenant_id;
```

---

### `server\routes\api-key-routes.ts`

✅ **Line 19** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 56** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

⚠️ **Line 93** (medium confidence)

**Before:**
```
createdAt: key.createdAt,
```

**After:**
```
createdAt: key.created_at,
```

---

⚠️ **Line 94** (medium confidence)

**Before:**
```
updatedAt: key.updatedAt,
```

**After:**
```
updatedAt: key.updated_at,
```

---

✅ **Line 113** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 142** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 178** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 206** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 241** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 267** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

### `server\routes\ai-search-knowledge-routes.ts`

✅ **Line 40** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 129** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 163** (high confidence)

**Before:**
```
const entity = await AISearchKnowledgeService.createKnowledgeEntity(req.user.tenantId, {
```

**After:**
```
const entity = await AISearchKnowledgeService.createKnowledgeEntity(req.user.tenant_id, {
```

---

✅ **Line 200** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 232** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 264** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 296** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

⚠️ **Line 370** (medium confidence)

**Before:**
```
aValue = a.updatedAt.getTime();
```

**After:**
```
aValue = a.updated_at.getTime();
```

---

⚠️ **Line 371** (medium confidence)

**Before:**
```
bValue = b.updatedAt.getTime();
```

**After:**
```
bValue = b.updated_at.getTime();
```

---

✅ **Line 418** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 586** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 622** (high confidence)

**Before:**
```
const analytics = await AISearchKnowledgeService.getSearchAnalytics(req.user.tenantId, {
```

**After:**
```
const analytics = await AISearchKnowledgeService.getSearchAnalytics(req.user.tenant_id, {
```

---

### `server\routes\ai-employee-routes.ts`

⚠️ **Line 10** (medium confidence)

**Before:**
```
(req as any).userId = 'mock-user-id'; // Replace with actual user ID from auth
```

**After:**
```
(req as any).user_id = 'mock-user-id'; // Replace with actual user ID from auth
```

---

✅ **Line 11** (high confidence)

**Before:**
```
(req as any).tenantId = 'mock-tenant-id'; // Replace with actual tenant ID from auth
```

**After:**
```
(req as any).tenant_id = 'mock-tenant-id'; // Replace with actual tenant ID from auth
```

---

✅ **Line 22** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

⚠️ **Line 23** (medium confidence)

**Before:**
```
const userId = (req as any).userId;
```

**After:**
```
const userId = (req as any).user_id;
```

---

✅ **Line 54** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 87** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 120** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 146** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 174** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 212** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 238** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

✅ **Line 265** (high confidence)

**Before:**
```
const tenantId = (req as any).tenantId;
```

**After:**
```
const tenantId = (req as any).tenant_id;
```

---

### `server\routes\ai-documentation-routes.ts`

✅ **Line 30** (high confidence)

**Before:**
```
const document = await AIDocumentationService.createDocument(req.user.tenantId, req.user.id, {
```

**After:**
```
const document = await AIDocumentationService.createDocument(req.user.tenant_id, req.user.id, {
```

---

✅ **Line 59** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 95** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 129** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 209** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 430** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 511** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 535** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 583** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

✅ **Line 686** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 710** (high confidence)

**Before:**
```
const analytics = await AIDocumentationService.getWritingAnalytics(req.user.tenantId, {
```

**After:**
```
const analytics = await AIDocumentationService.getWritingAnalytics(req.user.tenant_id, {
```

---

### `server\routes\advanced-billing-routes.ts`

✅ **Line 44** (high confidence)

**Before:**
```
const rules = await storage.getBillingRules(user.tenantId, filters);
```

**After:**
```
const rules = await storage.getBillingRules(user.tenant_id, filters);
```

---

✅ **Line 62** (high confidence)

**Before:**
```
if (!rule || rule.tenantId !== user.tenantId) {
```

**After:**
```
if (!rule || rule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 90** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 119** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 124** (high confidence)

**Before:**
```
const updated = await storage.updateBillingRule(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateBillingRule(req.params.id, user.tenant_id, data);
```

---

✅ **Line 151** (high confidence)

**Before:**
```
if (!rule || rule.tenantId !== user.tenantId) {
```

**After:**
```
if (!rule || rule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 155** (high confidence)

**Before:**
```
await storage.deleteBillingRule(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteBillingRule(req.params.id, user.tenant_id);
```

---

✅ **Line 171** (high confidence)

**Before:**
```
const rules = await storage.getBillingRulesByCustomer(req.params.customerId, user.tenantId);
```

**After:**
```
const rules = await storage.getBillingRulesByCustomer(req.params.customerId, user.tenant_id);
```

---

✅ **Line 187** (high confidence)

**Before:**
```
const rules = await storage.getBillingRulesByContract(req.params.contractId, user.tenantId);
```

**After:**
```
const rules = await storage.getBillingRulesByContract(req.params.contractId, user.tenant_id);
```

---

✅ **Line 214** (high confidence)

**Before:**
```
const anomalies = await storage.getMeterAnomalies(user.tenantId, filters);
```

**After:**
```
const anomalies = await storage.getMeterAnomalies(user.tenant_id, filters);
```

---

✅ **Line 230** (high confidence)

**Before:**
```
const anomalies = await storage.getUnresolvedMeterAnomalies(user.tenantId);
```

**After:**
```
const anomalies = await storage.getUnresolvedMeterAnomalies(user.tenant_id);
```

---

✅ **Line 248** (high confidence)

**Before:**
```
if (!anomaly || anomaly.tenantId !== user.tenantId) {
```

**After:**
```
if (!anomaly || anomaly.tenant_id !== user.tenant_id) {
```

---

✅ **Line 270** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 292** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 300** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 321** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 330** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 352** (high confidence)

**Before:**
```
const anomalies = await storage.getAnomaliesByEquipment(req.params.equipmentId, user.tenantId);
```

**After:**
```
const anomalies = await storage.getAnomaliesByEquipment(req.params.equipmentId, user.tenant_id);
```

---

✅ **Line 380** (high confidence)

**Before:**
```
const disputes = await storage.getBillingDisputes(user.tenantId, filters);
```

**After:**
```
const disputes = await storage.getBillingDisputes(user.tenant_id, filters);
```

---

✅ **Line 396** (high confidence)

**Before:**
```
const disputes = await storage.getOpenBillingDisputes(user.tenantId);
```

**After:**
```
const disputes = await storage.getOpenBillingDisputes(user.tenant_id);
```

---

✅ **Line 414** (high confidence)

**Before:**
```
if (!dispute || dispute.tenantId !== user.tenantId) {
```

**After:**
```
if (!dispute || dispute.tenant_id !== user.tenant_id) {
```

---

✅ **Line 436** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 459** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 464** (high confidence)

**Before:**
```
const updated = await storage.updateBillingDispute(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateBillingDispute(req.params.id, user.tenant_id, data);
```

---

✅ **Line 491** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 500** (high confidence)

**Before:**
```
const assigned = await storage.assignBillingDispute(req.params.id, user.tenantId, assignedTo);
```

**After:**
```
const assigned = await storage.assignBillingDispute(req.params.id, user.tenant_id, assignedTo);
```

---

✅ **Line 518** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 522** (high confidence)

**Before:**
```
const acknowledged = await storage.acknowledgeBillingDispute(req.params.id, user.tenantId);
```

**After:**
```
const acknowledged = await storage.acknowledgeBillingDispute(req.params.id, user.tenant_id);
```

---

✅ **Line 546** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 557** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 585** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 596** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 618** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 636** (high confidence)

**Before:**
```
const disputes = await storage.getBillingDisputesByInvoice(req.params.invoiceId, user.tenantId);
```

**After:**
```
const disputes = await storage.getBillingDisputesByInvoice(req.params.invoiceId, user.tenant_id);
```

---

✅ **Line 663** (high confidence)

**Before:**
```
const logs = await storage.getInvoiceGenerationLogs(user.tenantId, filters);
```

**After:**
```
const logs = await storage.getInvoiceGenerationLogs(user.tenant_id, filters);
```

---

✅ **Line 681** (high confidence)

**Before:**
```
if (!log || log.tenantId !== user.tenantId) {
```

**After:**
```
if (!log || log.tenant_id !== user.tenant_id) {
```

---

✅ **Line 715** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 753** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 775** (high confidence)

**Before:**
```
const failedLogs = await storage.getFailedInvoiceGenerations(user.tenantId);
```

**After:**
```
const failedLogs = await storage.getFailedInvoiceGenerations(user.tenant_id);
```

---

✅ **Line 794** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

✅ **Line 824** (high confidence)

**Before:**
```
const schedules = await storage.getBillingSchedules(user.tenantId, filters);
```

**After:**
```
const schedules = await storage.getBillingSchedules(user.tenant_id, filters);
```

---

✅ **Line 840** (high confidence)

**Before:**
```
const schedules = await storage.getActiveBillingSchedules(user.tenantId);
```

**After:**
```
const schedules = await storage.getActiveBillingSchedules(user.tenant_id);
```

---

✅ **Line 856** (high confidence)

**Before:**
```
const schedules = await storage.getDueBillingSchedules(user.tenantId);
```

**After:**
```
const schedules = await storage.getDueBillingSchedules(user.tenant_id);
```

---

✅ **Line 874** (high confidence)

**Before:**
```
if (!schedule || schedule.tenantId !== user.tenantId) {
```

**After:**
```
if (!schedule || schedule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 902** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 931** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 936** (high confidence)

**Before:**
```
const updated = await storage.updateBillingSchedule(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateBillingSchedule(req.params.id, user.tenant_id, data);
```

---

✅ **Line 963** (high confidence)

**Before:**
```
if (!schedule || schedule.tenantId !== user.tenantId) {
```

**After:**
```
if (!schedule || schedule.tenant_id !== user.tenant_id) {
```

---

✅ **Line 967** (high confidence)

**Before:**
```
await storage.deleteBillingSchedule(req.params.id, user.tenantId);
```

**After:**
```
await storage.deleteBillingSchedule(req.params.id, user.tenant_id);
```

---

✅ **Line 993** (high confidence)

**Before:**
```
const creditMemos = await storage.getCreditMemos(user.tenantId, filters);
```

**After:**
```
const creditMemos = await storage.getCreditMemos(user.tenant_id, filters);
```

---

✅ **Line 1009** (high confidence)

**Before:**
```
const creditMemos = await storage.getPendingCreditMemos(user.tenantId);
```

**After:**
```
const creditMemos = await storage.getPendingCreditMemos(user.tenant_id);
```

---

✅ **Line 1027** (high confidence)

**Before:**
```
if (!creditMemo || creditMemo.tenantId !== user.tenantId) {
```

**After:**
```
if (!creditMemo || creditMemo.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1055** (high confidence)

**Before:**
```
tenantId: user.tenantId,
```

**After:**
```
tenantId: user.tenant_id,
```

---

✅ **Line 1078** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1083** (high confidence)

**Before:**
```
const updated = await storage.updateCreditMemo(req.params.id, user.tenantId, data);
```

**After:**
```
const updated = await storage.updateCreditMemo(req.params.id, user.tenant_id, data);
```

---

✅ **Line 1110** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1114** (high confidence)

**Before:**
```
const approved = await storage.approveCreditMemo(req.params.id, user.tenantId, user.id);
```

**After:**
```
const approved = await storage.approveCreditMemo(req.params.id, user.tenant_id, user.id);
```

---

✅ **Line 1138** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1142** (high confidence)

**Before:**
```
const issued = await storage.issueCreditMemo(req.params.id, user.tenantId);
```

**After:**
```
const issued = await storage.issueCreditMemo(req.params.id, user.tenant_id);
```

---

✅ **Line 1166** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1175** (high confidence)

**Before:**
```
const applied = await storage.applyCreditMemo(req.params.id, user.tenantId, invoiceId);
```

**After:**
```
const applied = await storage.applyCreditMemo(req.params.id, user.tenant_id, invoiceId);
```

---

✅ **Line 1199** (high confidence)

**Before:**
```
if (!existing || existing.tenantId !== user.tenantId) {
```

**After:**
```
if (!existing || existing.tenant_id !== user.tenant_id) {
```

---

✅ **Line 1208** (high confidence)

**Before:**
```
const voided = await storage.voidCreditMemo(req.params.id, user.tenantId, user.id, voidReason);
```

**After:**
```
const voided = await storage.voidCreditMemo(req.params.id, user.tenant_id, user.id, voidReason);
```

---

✅ **Line 1227** (high confidence)

**Before:**
```
user.tenantId,
```

**After:**
```
user.tenant_id,
```

---

### `server\openapi\config.ts`

✅ **Line 45** (high confidence)

**Before:**
```
- **JWT Claim**: \`app_metadata.tenantId\` (automatic)
```

**After:**
```
- **JWT Claim**: \`app_metadata.tenant_id\` (automatic)
```

---

### `server\middleware\tenancy.ts`

✅ **Line 58** (high confidence)

**Before:**
```
const userTenantId = req.supabaseUser?.tenantId || req.user?.tenantId;
```

**After:**
```
const userTenantId = req.supabaseUser?.tenant_id || req.user?.tenant_id;
```

---

✅ **Line 119** (high confidence)

**Before:**
```
* 1. Supabase JWT app_metadata.tenantId (highest priority)
```

**After:**
```
* 1. Supabase JWT app_metadata.tenant_id (highest priority)
```

---

✅ **Line 121** (high confidence)

**Before:**
```
* 3. req.user.tenantId (set by isAuthenticated after DB lookup)
```

**After:**
```
* 3. req.user.tenant_id (set by isAuthenticated after DB lookup)
```

---

✅ **Line 122** (high confidence)

**Before:**
```
* 4. Already set req.tenantId (by isAuthenticated or other middleware)
```

**After:**
```
* 4. Already set req.tenant_id (by isAuthenticated or other middleware)
```

---

✅ **Line 130** (high confidence)

**Before:**
```
const jwtTenantId = req.supabaseUser?.tenantId;
```

**After:**
```
const jwtTenantId = req.supabaseUser?.tenant_id;
```

---

✅ **Line 141** (high confidence)

**Before:**
```
req.tenantId = headerTenantId;
```

**After:**
```
req.tenant_id = headerTenantId;
```

---

✅ **Line 159** (high confidence)

**Before:**
```
req.tenantId = jwtTenantId;
```

**After:**
```
req.tenant_id = jwtTenantId;
```

---

✅ **Line 160** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using Supabase JWT tenant: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using Supabase JWT tenant: ${req.tenant_id}`);
```

---

✅ **Line 177** (high confidence)

**Before:**
```
req.tenantId = validation.tenantId;
```

**After:**
```
req.tenant_id = validation.tenant_id;
```

---

✅ **Line 178** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using validated x-tenant-id header: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using validated x-tenant-id header: ${req.tenant_id}`);
```

---

✅ **Line 183** (high confidence)

**Before:**
```
if (req.user?.tenantId) {
```

**After:**
```
if (req.user?.tenant_id) {
```

---

✅ **Line 184** (high confidence)

**Before:**
```
req.tenantId = req.user.tenantId;
```

**After:**
```
req.tenant_id = req.user.tenant_id;
```

---

✅ **Line 185** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using user tenantId from isAuthenticated: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using user tenantId from isAuthenticated: ${req.tenant_id}`);
```

---

✅ **Line 190** (high confidence)

**Before:**
```
if ((req as any).tenantId) {
```

**After:**
```
if ((req as any).tenant_id) {
```

---

✅ **Line 191** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using existing req.tenantId: ${(req as any).tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using existing req.tenant_id: ${(req as any).tenant_id}`);
```

---

✅ **Line 231** (high confidence)

**Before:**
```
if (req.user?.tenantId) {
```

**After:**
```
if (req.user?.tenant_id) {
```

---

✅ **Line 232** (high confidence)

**Before:**
```
req.tenantId = req.user.tenantId;
```

**After:**
```
req.tenant_id = req.user.tenant_id;
```

---

✅ **Line 233** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using user tenant: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using user tenant: ${req.tenant_id}`);
```

---

✅ **Line 234** (high confidence)

**Before:**
```
} else if ((req.session as any)?.tenantId) {
```

**After:**
```
} else if ((req.session as any)?.tenant_id) {
```

---

✅ **Line 235** (high confidence)

**Before:**
```
req.tenantId = (req.session as any).tenantId;
```

**After:**
```
req.tenant_id = (req.session as any).tenant_id;
```

---

✅ **Line 236** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using session tenant: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using session tenant: ${req.tenant_id}`);
```

---

✅ **Line 239** (high confidence)

**Before:**
```
req.tenantId = process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
```

**After:**
```
req.tenant_id = process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
```

---

✅ **Line 240** (high confidence)

**Before:**
```
// console.log(`[TENANT DEBUG] Using default demo tenant: ${req.tenantId}`);
```

**After:**
```
// console.log(`[TENANT DEBUG] Using default demo tenant: ${req.tenant_id}`);
```

---

✅ **Line 251** (high confidence)

**Before:**
```
req.tenantId = tenant.id;
```

**After:**
```
req.tenant_id = tenant.id;
```

---

✅ **Line 256** (high confidence)

**Before:**
```
(req.session as any).tenantId = tenant.id;
```

**After:**
```
(req.session as any).tenant_id = tenant.id;
```

---

✅ **Line 279** (high confidence)

**Before:**
```
if (!req.tenant && !req.tenantId) {
```

**After:**
```
if (!req.tenant && !req.tenant_id) {
```

---

### `server\middleware\supabase-auth.ts`

✅ **Line 160** (high confidence)

**Before:**
```
tenantId: appMetadata.tenantId,
```

**After:**
```
tenantId: appMetadata.tenant_id,
```

---

✅ **Line 232** (high confidence)

**Before:**
```
supabaseUser.tenantId = userRecord.tenantId || supabaseUser.tenantId;
```

**After:**
```
supabaseUser.tenant_id = userRecord.tenant_id || supabaseUser.tenant_id;
```

---

✅ **Line 267** (high confidence)

**Before:**
```
if (req.supabaseUser.tenantId) {
```

**After:**
```
if (req.supabaseUser.tenant_id) {
```

---

✅ **Line 268** (high confidence)

**Before:**
```
(req as any).tenantId = req.supabaseUser.tenantId;
```

**After:**
```
(req as any).tenant_id = req.supabaseUser.tenant_id;
```

---

✅ **Line 334** (high confidence)

**Before:**
```
const tenantId = req.supabaseUser?.tenantId || (req as any).tenantId;
```

**After:**
```
const tenantId = req.supabaseUser?.tenant_id || (req as any).tenant_id;
```

---

✅ **Line 345** (high confidence)

**Before:**
```
(req as any).tenantId = tenantId;
```

**After:**
```
(req as any).tenant_id = tenantId;
```

---

⚠️ **Line 398** (medium confidence)

**Before:**
```
return req.supabaseUser?.id || (req as any).session?.userId || (req as any).user?.id;
```

**After:**
```
return req.supabaseUser?.id || (req as any).session?.user_id || (req as any).user?.id;
```

---

✅ **Line 405** (high confidence)

**Before:**
```
return req.supabaseUser?.tenantId || (req as any).tenantId || (req as any).session?.tenantId;
```

**After:**
```
return req.supabaseUser?.tenant_id || (req as any).tenant_id || (req as any).session?.tenant_id;
```

---

### `server\middleware\subscription.ts`

✅ **Line 26** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 47** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 110** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 169** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 216** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 250** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 299** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 329** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

✅ **Line 385** (high confidence)

**Before:**
```
const tenantId = req.tenantId;
```

**After:**
```
const tenantId = req.tenant_id;
```

---

### `server\middleware\session-timeout.ts`

⚠️ **Line 200** (medium confidence)

**Before:**
```
if (!session?.userId) {
```

**After:**
```
if (!session?.user_id) {
```

---

✅ **Line 206** (high confidence)

**Before:**
```
const config = await getSessionConfig(session.tenantId);
```

**After:**
```
const config = await getSessionConfig(session.tenant_id);
```

---

⚠️ **Line 214** (medium confidence)

**Before:**
```
`[SESSION] Session expired due to ${reason} timeout for user ${session.userId}`,
```

**After:**
```
`[SESSION] Session expired due to ${reason} timeout for user ${session.user_id}`,
```

---

⚠️ **Line 286** (medium confidence)

**Before:**
```
userId: metadata.userId,
```

**After:**
```
userId: metadata.user_id,
```

---

✅ **Line 287** (high confidence)

**Before:**
```
tenantId: metadata.tenantId || '',
```

**After:**
```
tenantId: metadata.tenant_id || '',
```

---

⚠️ **Line 290** (medium confidence)

**Before:**
```
createdAt: new Date(metadata.createdAt),
```

**After:**
```
createdAt: new Date(metadata.created_at),
```

---

⚠️ **Line 313** (medium confidence)

**Before:**
```
if (session?.sessionMetadata && session?.userId) {
```

**After:**
```
if (session?.sessionMetadata && session?.user_id) {
```

---

✅ **Line 315** (high confidence)

**Before:**
```
const config = await getSessionConfig(session.tenantId);
```

**After:**
```
const config = await getSessionConfig(session.tenant_id);
```

---

⚠️ **Line 350** (medium confidence)

**Before:**
```
eq(securitySessions.userId, userId),
```

**After:**
```
eq(securitySessions.user_id, userId),
```

---

⚠️ **Line 407** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)));
```

**After:**
```
.where(and(eq(securitySessions.user_id, userId), eq(securitySessions.isActive, true)));
```

---

⚠️ **Line 414** (medium confidence)

**Before:**
```
createdAt: session.createdAt,
```

**After:**
```
createdAt: session.created_at,
```

---

⚠️ **Line 440** (medium confidence)

**Before:**
```
.where(and(eq(securitySessions.id, sessionId), eq(securitySessions.userId, userId)));
```

**After:**
```
.where(and(eq(securitySessions.id, sessionId), eq(securitySessions.user_id, userId)));
```

---

### `server\middleware\requireTenant.ts`

✅ **Line 12** (high confidence)

**Before:**
```
if (!req.tenantId) {
```

**After:**
```
if (!req.tenant_id) {
```

---

### `server\middleware\rbac-route-helper.ts`

✅ **Line 413** (high confidence)

**Before:**
```
tenantId: req.user.tenantId,
```

**After:**
```
tenantId: req.user.tenant_id,
```

---

### `server\middleware\mfa-enforcement.ts`

✅ **Line 172** (high confidence)

**Before:**
```
const tenantSettings = user.tenantId
```

**After:**
```
const tenantSettings = user.tenant_id
```

---

✅ **Line 173** (high confidence)

**Before:**
```
? await getTenantMfaSettings(user.tenantId)
```

**After:**
```
? await getTenantMfaSettings(user.tenant_id)
```

---

✅ **Line 344** (high confidence)

**Before:**
```
const allUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
```

**After:**
```
const allUsers = await db.select().from(users).where(eq(users.tenant_id, tenantId));
```

---

### `server\middleware\logging-middleware.ts`

⚠️ **Line 192** (medium confidence)

**Before:**
```
userId: reqWithSession.session?.userId || reqWithSession.user?.id,
```

**After:**
```
userId: reqWithSession.session?.user_id || reqWithSession.user?.id,
```

---

✅ **Line 193** (high confidence)

**Before:**
```
tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
```

**After:**
```
tenantId: req.tenant_id || reqWithSession.session?.tenant_id || req.header('x-tenant-id'),
```

---

⚠️ **Line 253** (medium confidence)

**Before:**
```
userId: reqWithSession.session?.userId || reqWithSession.user?.id,
```

**After:**
```
userId: reqWithSession.session?.user_id || reqWithSession.user?.id,
```

---

✅ **Line 254** (high confidence)

**Before:**
```
tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
```

**After:**
```
tenantId: req.tenant_id || reqWithSession.session?.tenant_id || req.header('x-tenant-id'),
```

---

⚠️ **Line 333** (medium confidence)

**Before:**
```
userId: reqWithSession.session?.userId || reqWithSession.user?.id,
```

**After:**
```
userId: reqWithSession.session?.user_id || reqWithSession.user?.id,
```

---

✅ **Line 334** (high confidence)

**Before:**
```
tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
```

**After:**
```
tenantId: req.tenant_id || reqWithSession.session?.tenant_id || req.header('x-tenant-id'),
```

---

⚠️ **Line 385** (medium confidence)

**Before:**
```
userId: reqWithSession.session?.userId || reqWithSession.user?.id,
```

**After:**
```
userId: reqWithSession.session?.user_id || reqWithSession.user?.id,
```

---

✅ **Line 386** (high confidence)

**Before:**
```
tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
```

**After:**
```
tenantId: req.tenant_id || reqWithSession.session?.tenant_id || req.header('x-tenant-id'),
```

---

### `server\middleware\ip-whitelist.ts`

✅ **Line 247** (high confidence)

**Before:**
```
const tenantId = session?.tenantId || (req.headers['x-tenant-id'] as string);
```

**After:**
```
const tenantId = session?.tenant_id || (req.headers['x-tenant-id'] as string);
```

---

### `server\middleware\hierarchical-query-builder.ts`

✅ **Line 106** (high confidence)

**Before:**
```
filters.push(sql`${sql.identifier(tenantField)} = ${this.userContext.tenantId}`);
```

**After:**
```
filters.push(sql`${sql.identifier(tenantField)} = ${this.userContext.tenant_id}`);
```

---

✅ **Line 208** (high confidence)

**Before:**
```
eq(organizationalUnits.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(organizationalUnits.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 227** (high confidence)

**Before:**
```
eq(organizationalUnits.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(organizationalUnits.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 241** (high confidence)

**Before:**
```
eq(organizationalUnits.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(organizationalUnits.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 282** (high confidence)

**Before:**
```
eq(organizationalUnits.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(organizationalUnits.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 316** (high confidence)

**Before:**
```
eq(organizationalUnits.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(organizationalUnits.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 344** (high confidence)

**Before:**
```
.where(eq(users.tenantId, this.userContext.tenantId));
```

**After:**
```
.where(eq(users.tenant_id, this.userContext.tenant_id));
```

---

✅ **Line 358** (high confidence)

**Before:**
```
eq(users.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(users.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 371** (high confidence)

**Before:**
```
eq(users.tenantId, this.userContext.tenantId),
```

**After:**
```
eq(users.tenant_id, this.userContext.tenant_id),
```

---

✅ **Line 472** (high confidence)

**Before:**
```
filters.push(sql`${sql.identifier(`${prefix}tenant_id`)} = ${this.userContext.tenantId}`);
```

**After:**
```
filters.push(sql`${sql.identifier(`${prefix}tenant_id`)} = ${this.userContext.tenant_id}`);
```

---

### `server\middleware\enhanced-rbac-middleware.ts`

⚠️ **Line 107** (medium confidence)

**Before:**
```
eq(permissionCache.userId, userId),
```

**After:**
```
eq(permissionCache.user_id, userId),
```

---

✅ **Line 109** (high confidence)

**Before:**
```
eq(permissionCache.tenantId, tenantId),
```

**After:**
```
eq(permissionCache.tenant_id, tenantId),
```

---

⚠️ **Line 187** (medium confidence)

**Before:**
```
await db.delete(permissionCache).where(eq(permissionCache.userId, userId));
```

**After:**
```
await db.delete(permissionCache).where(eq(permissionCache.user_id, userId));
```

---

⚠️ **Line 234** (medium confidence)

**Before:**
```
eq(userRoleAssignments.userId, userId),
```

**After:**
```
eq(userRoleAssignments.user_id, userId),
```

---

✅ **Line 235** (high confidence)

**Before:**
```
eq(userRoleAssignments.tenantId, tenantId),
```

**After:**
```
eq(userRoleAssignments.tenant_id, tenantId),
```

---

⚠️ **Line 360** (medium confidence)

**Before:**
```
eq(permissionOverrides.userId, userId),
```

**After:**
```
eq(permissionOverrides.user_id, userId),
```

---

⚠️ **Line 485** (medium confidence)

**Before:**
```
const userId = req.session?.userId || req.user?.id;
```

**After:**
```
const userId = req.session?.user_id || req.user?.id;
```

---

✅ **Line 486** (high confidence)

**Before:**
```
const tenantId = req.session?.tenantId || req.user?.tenantId;
```

**After:**
```
const tenantId = req.session?.tenant_id || req.user?.tenant_id;
```

---

⚠️ **Line 523** (medium confidence)

**Before:**
```
eq(userRoleAssignments.userId, userId),
```

**After:**
```
eq(userRoleAssignments.user_id, userId),
```

---

✅ **Line 524** (high confidence)

**Before:**
```
eq(userRoleAssignments.tenantId, tenantId),
```

**After:**
```
eq(userRoleAssignments.tenant_id, tenantId),
```

---

⚠️ **Line 929** (medium confidence)

**Before:**
```
eq(permissionOverrides.userId, userId),
```

**After:**
```
eq(permissionOverrides.user_id, userId),
```

---

✅ **Line 974** (high confidence)

**Before:**
```
req.user.tenantId,
```

**After:**
```
req.user.tenant_id,
```

---

✅ **Line 1062** (high confidence)

**Before:**
```
tenantId: req.user?.tenantId,
```

**After:**
```
tenantId: req.user?.tenant_id,
```

---

✅ **Line 1093** (high confidence)

**Before:**
```
tenantId: req.user?.tenantId || null,
```

**After:**
```
tenantId: req.user?.tenant_id || null,
```

---

### `server\middleware\api-key-auth.ts`

✅ **Line 188** (high confidence)

**Before:**
```
tenantId: key.tenantId,
```

**After:**
```
tenantId: key.tenant_id,
```

---

✅ **Line 195** (high confidence)

**Before:**
```
(req as any).tenantId = key.tenantId;
```

**After:**
```
(req as any).tenant_id = key.tenant_id;
```

---

✅ **Line 251** (high confidence)

**Before:**
```
req.apiKey.tenantId,
```

**After:**
```
req.apiKey.tenant_id,
```

---

✅ **Line 406** (high confidence)

**Before:**
```
tenantId: key.tenantId,
```

**After:**
```
tenantId: key.tenant_id,
```

---

✅ **Line 411** (high confidence)

**Before:**
```
(req as any).tenantId = key.tenantId;
```

**After:**
```
(req as any).tenant_id = key.tenant_id;
```

---

⚠️ **Line 419** (medium confidence)

**Before:**
```
if (session?.userId) {
```

**After:**
```
if (session?.user_id) {
```

---

### `server\lib\apm.ts`

⚠️ **Line 305** (medium confidence)

**Before:**
```
userId: (req as Request & { session?: { userId?: string } }).session?.userId,
```

**After:**
```
userId: (req as Request & { session?: { userId?: string } }).session?.user_id,
```

---

⚠️ **Line 321** (medium confidence)

**Before:**
```
if (session?.userId) {
```

**After:**
```
if (session?.user_id) {
```

---

⚠️ **Line 322** (medium confidence)

**Before:**
```
apmInstance.setUser({ id: session.userId });
```

**After:**
```
apmInstance.setUser({ id: session.user_id });
```

---

### `server\integrations\routes.ts`

✅ **Line 58** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 74** (high confidence)

**Before:**
```
and(eq(integrationMetrics.tenantId, tenantId), gte(integrationMetrics.periodStart, today)),
```

**After:**
```
and(eq(integrationMetrics.tenant_id, tenantId), gte(integrationMetrics.periodStart, today)),
```

---

✅ **Line 89** (high confidence)

**Before:**
```
eq(integrationApiLogs.tenantId, tenantId),
```

**After:**
```
eq(integrationApiLogs.tenant_id, tenantId),
```

---

✅ **Line 163** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 241** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 290** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

✅ **Line 311** (high confidence)

**Before:**
```
const tenantId = req.user?.tenantId;
```

**After:**
```
const tenantId = req.user?.tenant_id;
```

---

### `server\integrations\integration-service.ts`

✅ **Line 134** (high confidence)

**Before:**
```
tenantId: integration.tenantId!,
```

**After:**
```
tenantId: integration.tenant_id!,
```

---

✅ **Line 152** (high confidence)

**Before:**
```
.where(eq(systemIntegrations.tenantId, tenantId));
```

**After:**
```
.where(eq(systemIntegrations.tenant_id, tenantId));
```

---

✅ **Line 156** (high confidence)

**Before:**
```
tenantId: integration.tenantId!,
```

**After:**
```
tenantId: integration.tenant_id!,
```

---

✅ **Line 254** (high confidence)

**Before:**
```
and(eq(systemIntegrations.id, integrationId), eq(systemIntegrations.tenantId, tenantId)),
```

**After:**
```
and(eq(systemIntegrations.id, integrationId), eq(systemIntegrations.tenant_id, tenantId)),
```

---

✅ **Line 413** (high confidence)

**Before:**
```
and(eq(systemIntegrations.id, integrationId), eq(systemIntegrations.tenantId, tenantId)),
```

**After:**
```
and(eq(systemIntegrations.id, integrationId), eq(systemIntegrations.tenant_id, tenantId)),
```

---

✅ **Line 420** (high confidence)

**Before:**
```
tenantId: integration.tenantId!,
```

**After:**
```
tenantId: integration.tenant_id!,
```

---

### `server\integrations\error-monitor.ts`

⚠️ **Line 246** (medium confidence)

**Before:**
```
error.updatedAt = new Date();
```

**After:**
```
error.updated_at = new Date();
```

---

⚠️ **Line 276** (medium confidence)

**Before:**
```
error.updatedAt = new Date();
```

**After:**
```
error.updated_at = new Date();
```

---

⚠️ **Line 429** (medium confidence)

**Before:**
```
(error) => error.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000),
```

**After:**
```
(error) => error.created_at > new Date(Date.now() - 24 * 60 * 60 * 1000),
```

---

⚠️ **Line 452** (medium confidence)

**Before:**
```
lastError: errors.length > 0 ? errors[errors.length - 1].createdAt : undefined,
```

**After:**
```
lastError: errors.length > 0 ? errors[errors.length - 1].created_at : undefined,
```

---

⚠️ **Line 469** (medium confidence)

**Before:**
```
const recentErrors = errors.filter((error) => error.createdAt > last24Hours);
```

**After:**
```
const recentErrors = errors.filter((error) => error.created_at > last24Hours);
```

---

⚠️ **Line 492** (medium confidence)

**Before:**
```
.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
```

**After:**
```
.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
```

---

⚠️ **Line 501** (medium confidence)

**Before:**
```
.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
```

**After:**
```
.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
```

---

⚠️ **Line 511** (medium confidence)

**Before:**
```
error.updatedAt = new Date();
```

**After:**
```
error.updated_at = new Date();
```

---

⚠️ **Line 540** (medium confidence)

**Before:**
```
if (error.createdAt < cutoffDate && error.resolved) {
```

**After:**
```
if (error.created_at < cutoffDate && error.resolved) {
```

---

### `server\integrations\dashboard-service.ts`

✅ **Line 47** (high confidence)

**Before:**
```
.where(eq(systemIntegrations.tenantId, tenantId));
```

**After:**
```
.where(eq(systemIntegrations.tenant_id, tenantId));
```

---

✅ **Line 77** (high confidence)

**Before:**
```
and(eq(integrationMetrics.tenantId, tenantId), gte(integrationMetrics.periodStart, today)),
```

**After:**
```
and(eq(integrationMetrics.tenant_id, tenantId), gte(integrationMetrics.periodStart, today)),
```

---

✅ **Line 139** (high confidence)

**Before:**
```
and(eq(integrationMetrics.tenantId, tenantId), gte(integrationMetrics.periodStart, today)),
```

**After:**
```
and(eq(integrationMetrics.tenant_id, tenantId), gte(integrationMetrics.periodStart, today)),
```

---

✅ **Line 156** (high confidence)

**Before:**
```
eq(integrationApiLogs.tenantId, tenantId),
```

**After:**
```
eq(integrationApiLogs.tenant_id, tenantId),
```

---

⚠️ **Line 192** (medium confidence)

**Before:**
```
configuredAt: integration.config?.createdAt || new Date(),
```

**After:**
```
configuredAt: integration.config?.created_at || new Date(),
```

---

✅ **Line 342** (high confidence)

**Before:**
```
.where(eq(systemIntegrations.tenantId, tenantId));
```

**After:**
```
.where(eq(systemIntegrations.tenant_id, tenantId));
```

---

### `server\cli\kb-cli.ts`

⚠️ **Line 61** (medium confidence)

**Before:**
```
console.log(`   Created: ${article.createdAt}`);
```

**After:**
```
console.log(`   Created: ${article.created_at}`);
```

---

✅ **Line 214** (high confidence)

**Before:**
```
and(eq(knowledgeArticles.id, options.id), eq(knowledgeArticles.tenantId, options.tenant)),
```

**After:**
```
and(eq(knowledgeArticles.id, options.id), eq(knowledgeArticles.tenant_id, options.tenant)),
```

---

✅ **Line 244** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, options.tenant),
```

**After:**
```
eq(knowledgeArticles.tenant_id, options.tenant),
```

---

✅ **Line 253** (high confidence)

**Before:**
```
eq(knowledgeArticles.tenantId, options.tenant),
```

**After:**
```
eq(knowledgeArticles.tenant_id, options.tenant),
```

---

⚠️ **Line 414** (medium confidence)

**Before:**
```
a.createdAt,
```

**After:**
```
a.created_at,
```

---

✅ **Line 496** (high confidence)

**Before:**
```
eq(articleFeedback.tenantId, options.tenant),
```

**After:**
```
eq(articleFeedback.tenant_id, options.tenant),
```

---

⚠️ **Line 514** (medium confidence)

**Before:**
```
console.log(`Created: ${fb.createdAt}`);
```

**After:**
```
console.log(`Created: ${fb.created_at}`);
```

---

✅ **Line 533** (high confidence)

**Before:**
```
eq(articleFeedback.tenantId, options.tenant),
```

**After:**
```
eq(articleFeedback.tenant_id, options.tenant),
```

---

### `server\cli\company-dedup-cli.ts`

⚠️ **Line 86** (medium confidence)

**Before:**
```
console.log(`             Created: ${company.createdAt}`);
```

**After:**
```
console.log(`             Created: ${company.created_at}`);
```

---

⚠️ **Line 223** (medium confidence)

**Before:**
```
console.log(`  Created: ${company.createdAt}`);
```

**After:**
```
console.log(`  Created: ${company.created_at}`);
```

---

⚠️ **Line 280** (medium confidence)

**Before:**
```
console.log(`Created: ${existing.createdAt}\n`);
```

**After:**
```
console.log(`Created: ${existing.created_at}\n`);
```

---

### `server\database-updater\updaters\ServiceTicketUpdater.ts`

✅ **Line 114** (high confidence)

**Before:**
```
tenantId: ticket.tenantId,
```

**After:**
```
tenantId: ticket.tenant_id,
```

---

⚠️ **Line 131** (medium confidence)

**Before:**
```
createdAt: ticket.createdAt,
```

**After:**
```
createdAt: ticket.created_at,
```

---

⚠️ **Line 132** (medium confidence)

**Before:**
```
updatedAt: ticket.updatedAt,
```

**After:**
```
updatedAt: ticket.updated_at,
```

---

✅ **Line 155** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 498** (high confidence)

**Before:**
```
.where(eq(serviceTickets.tenantId, this.tenantId))
```

**After:**
```
.where(eq(serviceTickets.tenant_id, this.tenant_id))
```

---

⚠️ **Line 499** (medium confidence)

**Before:**
```
.orderBy(serviceTickets.createdAt)
```

**After:**
```
.orderBy(serviceTickets.created_at)
```

---

✅ **Line 526** (high confidence)

**Before:**
```
and(eq(equipment.tenantId, this.tenantId), eq(equipment.customerId, this.customerId!)),
```

**After:**
```
and(eq(equipment.tenant_id, this.tenant_id), eq(equipment.customerId, this.customerId!)),
```

---

### `server\database-updater\updaters\BusinessRecordUpdater.ts`

✅ **Line 131** (high confidence)

**Before:**
```
tenantId: lead.tenantId,
```

**After:**
```
tenantId: lead.tenant_id,
```

---

⚠️ **Line 156** (medium confidence)

**Before:**
```
createdAt: lead.createdAt,
```

**After:**
```
createdAt: lead.created_at,
```

---

⚠️ **Line 157** (medium confidence)

**Before:**
```
updatedAt: lead.updatedAt,
```

**After:**
```
updatedAt: lead.updated_at,
```

---

✅ **Line 186** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

### `server\database-updater\updaters\BusinessRecordActivityUpdater.ts`

✅ **Line 96** (high confidence)

**Before:**
```
tenantId: activity.tenantId,
```

**After:**
```
tenantId: activity.tenant_id,
```

---

⚠️ **Line 107** (medium confidence)

**Before:**
```
createdAt: activity.createdAt,
```

**After:**
```
createdAt: activity.created_at,
```

---

⚠️ **Line 108** (medium confidence)

**Before:**
```
updatedAt: activity.updatedAt,
```

**After:**
```
updatedAt: activity.updated_at,
```

---

✅ **Line 131** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 400** (high confidence)

**Before:**
```
.where(eq(businessRecords.tenantId, this.tenantId))
```

**After:**
```
.where(eq(businessRecords.tenant_id, this.tenant_id))
```

---

### `server\database-updater\seeders\report-seeder.ts`

✅ **Line 3266** (high confidence)

**Before:**
```
target: [reportDefinitions.code, reportDefinitions.tenantId],
```

**After:**
```
target: [reportDefinitions.code, reportDefinitions.tenant_id],
```

---

### `server\database-updater\seeders\kpi-seeder.ts`

✅ **Line 1434** (high confidence)

**Before:**
```
target: [kpiDefinitions.code, kpiDefinitions.tenantId],
```

**After:**
```
target: [kpiDefinitions.code, kpiDefinitions.tenant_id],
```

---

### `server\database-updater\core\UpdaterRegistry.ts`

✅ **Line 268** (high confidence)

**Before:**
```
if (!config.tenantId) {
```

**After:**
```
if (!config.tenant_id) {
```

---

### `server\database-updater\core\BaseUpdater.ts`

✅ **Line 50** (high confidence)

**Before:**
```
this.tenantId = options.tenantId;
```

**After:**
```
this.tenant_id = options.tenant_id;
```

---

✅ **Line 74** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

✅ **Line 155** (high confidence)

**Before:**
```
tenantId: this.tenantId,
```

**After:**
```
tenantId: this.tenant_id,
```

---

