# Schema Auto-Fix Report

**Generated:** 2026-01-27T03:43:17.164Z
**Mode:** auto

## Summary

- **Files Modified:** 166
- **Total Fixes:** 764
- **Backup Location:** `C:\Users\pears\Documents\Printyx\Printyx\tests\backups\2026-01-27T03-43-16.643Z`

## CASE MISMATCH

Found 764 fix(es)

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

### `server\seed-sales-metrics.ts`

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

### `server\seed-crm-goals.ts`

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

⚠️ **Line 323** (medium confidence)

**Before:**
```
where: (logs, { eq, and }) => and(eq(logs.tenant_id, tenantId), eq(logs.userId, subjectId)),
```

**After:**
```
where: (logs, { eq, and }) => and(eq(logs.tenant_id, tenantId), eq(logs.user_id, subjectId)),
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

### `server\routes-warehouse-fpy.ts`

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

### `server\routes-user-profile.ts`

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

### `server\routes-user-lifecycle.ts`

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

### `server\routes-territory-management.ts`

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

### `server\routes-tenant-onboarding.ts`

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

### `server\routes-technician-management.ts`

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

⚠️ **Line 342** (medium confidence)

**Before:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), gte(serviceTickets.createdAt, daysAgo)))
```

**After:**
```
.where(and(eq(serviceTickets.tenant_id, tenantId), gte(serviceTickets.created_at, daysAgo)))
```

---

### `server\routes-subscriptions.ts`

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

### `server\routes-software-products.ts`

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

### `server\routes-social-media.ts`

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

### `server\routes-service-analysis.ts`

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

### `server\routes-sales-forecasting.ts`

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

### `server\routes-root-admin.ts`

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

### `server\routes-proposals.ts`

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

### `server\routes-product-models.ts`

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

### `server\routes-pagination.ts`

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

### `server\routes-onboarding.ts`

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

### `server\routes-mobile-technician.ts`

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

### `server\routes-manufacturer-integration.ts`

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

### `server\routes-lead-assignment.ts`

⚠️ **Line 247** (medium confidence)

**Before:**
```
where: and(eq(repCapacity.userId, userId), eq(repCapacity.tenant_id, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.user_id, userId), eq(repCapacity.tenant_id, tenantId)),
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
where: and(eq(repCapacity.userId, capacityData.userId), eq(repCapacity.tenant_id, tenantId)),
```

**After:**
```
where: and(eq(repCapacity.user_id, capacityData.user_id), eq(repCapacity.tenant_id, tenantId)),
```

---

⚠️ **Line 333** (medium confidence)

**Before:**
```
.where(and(eq(repCapacity.userId, userId), eq(repCapacity.tenant_id, tenantId)))
```

**After:**
```
.where(and(eq(repCapacity.user_id, userId), eq(repCapacity.tenant_id, tenantId)))
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

### `server\routes-integrations-real.ts`

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

### `server\routes-export.ts`

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

### `server\routes-enhanced-tasks.ts`

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

### `server\routes-enhanced-service.ts`

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

### `server\routes-enhanced-rbac.ts`

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

### `server\routes-documents.ts`

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

### `server\routes-device-monitoring.ts`

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

### `server\routes-deals-management.ts`

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

### `server\routes-deal-desk.ts`

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

### `server\routes-data-enrichment.ts`

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

### `server\routes-dashboard-layouts.ts`

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

### `server\routes-dashboard-customization.ts`

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

### `server\routes-customer-portal.ts`

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

### `server\routes-customer-numbers.ts`

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

### `server\routes-custom-reports.ts`

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

### `server\routes-csv-import.ts`

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

### `server\routes-crm-goals.ts`

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

### `server\routes-content-marketing.ts`

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

### `server\routes-company-ids.ts`

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

### `server\routes-client-monitoring.ts`

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

### `server\routes-client-metrics.ts`

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

### `server\routes-clickup-tasks.ts`

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

### `server\routes-breach-detection.ts`

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

### `server\routes-auto-lead-routing.ts`

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

### `server\replitAuth.ts`

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

### `server\enhanced-rbac-schema.ts`

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

### `server\routes\sso-routes.ts`

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

### `server\routes\reporting-api.ts`

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
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.userId, userId)));
```

**After:**
```
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.user_id, userId)));
```

---

⚠️ **Line 274** (medium confidence)

**Before:**
```
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.userId, userId)))
```

**After:**
```
.where(and(eq(readingHistory.tenant_id, tenantId), eq(readingHistory.user_id, userId)))
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

### `server\routes\meeting-scheduling-routes.ts`

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

### `server\routes\lead-intelligence-routes.ts`

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

### `server\routes\knowledge-base-routes.ts`

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

### `server\routes\knowledge-base-admin-routes.ts`

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

### `server\routes\geofence-alerts-routes.ts`

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

### `server\routes\chrome-extension-routes.ts`

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

### `server\routes\billing.ts`

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

### `server\routes\automated-billing-routes.ts`

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
.where(and(eq(articleBookmarks.tenant_id, tenantId), eq(articleBookmarks.userId, userId)))
```

**After:**
```
.where(and(eq(articleBookmarks.tenant_id, tenantId), eq(articleBookmarks.user_id, userId)))
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

### `server\routes\api-key-routes.ts`

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

### `server\routes\ai-search-knowledge-routes.ts`

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

### `server\middleware\supabase-auth.ts`

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

### `server\middleware\api-key-auth.ts`

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

### `server\storage\security-storage.ts`

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

### `server\services\workflow-triggers.ts`

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

### `server\services\workflow-execution-service.ts`

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

### `server\services\usage-tracking-service.ts`

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

### `server\services\trial-management-service.ts`

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

### `server\services\territory-management-service.ts`

⚠️ **Line 449** (medium confidence)

**Before:**
```
where: and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.userId, userId)),
```

**After:**
```
where: and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.user_id, userId)),
```

---

⚠️ **Line 477** (medium confidence)

**Before:**
```
.where(and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.userId, userId)))
```

**After:**
```
.where(and(eq(repCapacity.tenant_id, tenantId), eq(repCapacity.user_id, userId)))
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

### `server\services\team-collaboration-service.ts`

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

### `server\services\sso-service.ts`

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

### `server\services\service-supervisor-reporting-service.ts`

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

### `server\services\sales-reporting-service.ts`

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

### `server\services\predictive-service-dispatch-service.ts`

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

### `server\services\payment-audit-service.ts`

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

### `server\services\manufacturer-integration-service.ts`

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

### `server\services\lead-intelligence-service.ts`

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

### `server\services\knowledge-base-service.ts`

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

### `server\services\intelligent-alerts-service.ts`

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

### `server\services\gdpr-data-export-service.ts`

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
where: and(eq(dataAccessLogs.tenant_id, tenantId), eq(dataAccessLogs.userId, subjectId)),
```

**After:**
```
where: and(eq(dataAccessLogs.tenant_id, tenantId), eq(dataAccessLogs.user_id, subjectId)),
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

### `server\services\dpa-management-service.ts`

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

### `server\services\data-retention-service.ts`

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

### `server\services\customer-portal-service.ts`

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

### `server\services\csv-import-service.ts`

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

### `server\services\content-gap-analysis-service.ts`

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

### `server\services\contact-deduplication-service.ts`

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

### `server\services\billing-analytics-service.ts`

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

### `server\services\auto-lead-routing-service.ts`

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

### `server\services\audit-archival-service.ts`

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

### `server\services\approval-workflow-service.ts`

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

### `supabase\functions\technicians\index.ts`

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

### `supabase\functions\notifications\index.ts`

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

### `supabase\functions\import\index.ts`

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

### `server\database-updater\updaters\ServiceTicketUpdater.ts`

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

### `server\database-updater\updaters\BusinessRecordUpdater.ts`

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

### `server\database-updater\updaters\BusinessRecordActivityUpdater.ts`

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

