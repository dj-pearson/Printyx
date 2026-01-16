# Database Schema Validation Report

**Generated**: 2026-01-16T14:57:13.348Z

**Total Issues**: 634

---

## Top Invalid Columns

| Column Name | Occurrences | Suggestion |
|-------------|-------------|------------|
| `app_metadata` | 85 | `—` |
| `user_metadata` | 71 | `—` |
| `company_name` | 12 | `—` |
| `view_location` | 10 | `—` |
| `create_location` | 10 | `—` |
| `create_company` | 9 | `—` |
| `record_type` | 8 | `—` |
| `region_id` | 8 | `—` |
| `region_name` | 8 | `—` |
| `location_count` | 8 | `—` |
| `location_id` | 8 | `location` |
| `location_name` | 8 | `—` |
| `create_regional` | 7 | `—` |
| `expires_in` | 7 | `—` |
| `user_name` | 7 | `—` |
| `customer_name` | 6 | `—` |
| `token_type` | 6 | `—` |
| `conversion_rate` | 6 | `—` |
| `device_status` | 6 | `—` |
| `total_activities` | 6 | `—` |
| `url_slug` | 5 | `—` |
| `churn_risk_score` | 5 | `—` |
| `view_own` | 5 | `—` |
| `total_revenue` | 5 | `—` |
| `total_calls` | 5 | `—` |
| `avg_satisfaction` | 5 | `—` |
| `total_value` | 5 | `—` |
| `quota_amount` | 5 | `—` |
| `average_deal_size` | 5 | `—` |
| `primary_contact_email` | 4 | `—` |

---

## Most Problematic Files

| File | Issues |
|------|--------|
| `server\services\service-manager-reporting-service.ts` | 38 |
| `server\routes-sales-pipeline.ts` | 34 |
| `server\services\sales-reporting-service.ts` | 34 |
| `server\services\service-supervisor-reporting-service.ts` | 34 |
| `server\services\service-reporting-service.ts` | 33 |
| `server\database-updater\seeders\rbac-seeder.ts` | 29 |
| `server\services\sales-manager-reporting-service.ts` | 29 |
| `server\services\sales-supervisor-reporting-service.ts` | 27 |
| `supabase\functions\me\index.ts` | 27 |
| `server\services\team-reporting-service.ts` | 25 |
| `server\routes.ts` | 24 |
| `client\src\pages\LeadsManagement.tsx` | 17 |
| `client\src\pages\ServiceAnalytics.tsx` | 16 |
| `server\services\director-reporting-service.ts` | 14 |
| `server\fix-data-consistency.ts` | 11 |
| `server\storage.ts` | 11 |
| `server\enhanced-rbac-seeder.ts` | 9 |
| `server\services\executive-reporting-service.ts` | 9 |
| `server\services\manufacturer-adapters\fmaudit-adapter.ts` | 9 |
| `server\middleware\rbac-route-helper.ts` | 7 |

---

## Issues by Table

| Table | Issues |
|-------|--------|
| `unknown` | 632 |
| `deals` | 2 |

---

## Detailed Issues

### server\services\service-manager-reporting-service.ts

**Line 238**: Invalid column `region_id`
```typescript
regionId: row.region_id,
```

**Line 239**: Invalid column `region_name`
```typescript
regionName: row.region_name,
```

**Line 242**: Invalid column `call_count`
```typescript
callCount: parseInt(row.call_count || 0),
```

**Line 243**: Invalid column `avg_duration`
```typescript
avgDuration: parseFloat(row.avg_duration || 0),
```

**Line 244**: Invalid column `ftf_rate`
```typescript
firstTimeFixRate: parseFloat(row.ftf_rate || 0),
```

**Line 245**: Invalid column `avg_satisfaction`
```typescript
avgSatisfaction: parseFloat(row.avg_satisfaction || 0),
```

**Line 246**: Invalid column `location_count`
```typescript
locationCount: parseInt(row.location_count || 0),
```

**Line 350**: Invalid column `region_id`
```typescript
regionId: row.region_id,
```

**Line 351**: Invalid column `region_name`
```typescript
regionName: row.region_name,
```

**Line 352**: Invalid column `location_count`
```typescript
locationCount: parseInt(row.location_count || 0),
```

... and 28 more issues

### server\routes-sales-pipeline.ts

**Line 108**: Invalid column `company_name`
```typescript
company_name: row.company_name,
```

**Line 109**: Invalid column `contact_name`
```typescript
contact_name: row.contact_name,
```

**Line 110**: Invalid column `contact_email`
```typescript
contact_email: row.contact_email,
```

**Line 111**: Invalid column `contact_phone`
```typescript
contact_phone: row.contact_phone,
```

**Line 113**: Invalid column `estimated_value`
```typescript
estimated_value: parseFloat(row.estimated_value) || 0,
```

**Line 115**: Invalid column `expected_close_date`
```typescript
expected_close_date: row.expected_close_date || new Date().toISOString(),
```

**Line 116**: Invalid column `assigned_rep`
💡 Suggestion: Use `assigned_to`
```typescript
assigned_rep: row.assigned_rep,
```

**Line 117**: Invalid column `last_activity`
💡 Suggestion: Use `last_activity_at`
```typescript
last_activity: row.last_activity || row.created_at,
```

**Line 118**: Invalid column `next_action`
```typescript
next_action: row.next_action,
```

**Line 119**: Invalid column `days_in_stage`
```typescript
days_in_stage: parseInt(row.days_in_stage) || 0,
```

... and 24 more issues

### server\services\sales-reporting-service.ts

**Line 205**: Invalid column `total_value`
```typescript
totalValue: parseFloat(row.total_value || 0),
```

**Line 206**: Invalid column `weighted_value`
```typescript
weightedValue: parseFloat(row.weighted_value || 0),
```

**Line 207**: Invalid column `average_deal_size`
```typescript
averageDealSize: parseFloat(row.average_deal_size || 0),
```

**Line 208**: Invalid column `conversion_rate`
```typescript
conversionRate: parseFloat(row.conversion_rate || 0),
```

**Line 330**: Invalid column `user_name`
```typescript
userName: row.user_name,
```

**Line 331**: Invalid column `quota_amount`
```typescript
quotaAmount: parseFloat(row.quota_amount || 0),
```

**Line 332**: Invalid column `actual_revenue`
```typescript
actualRevenue: parseFloat(row.actual_revenue || 0),
```

**Line 333**: Invalid column `attainment_percent`
```typescript
attainmentPercent: parseFloat(row.attainment_percent || 0),
```

**Line 334**: Invalid column `deals_won`
```typescript
dealsWon: parseInt(row.deals_won || 0),
```

**Line 335**: Invalid column `average_deal_size`
```typescript
averageDealSize: parseFloat(row.average_deal_size || 0),
```

... and 24 more issues

### server\services\service-supervisor-reporting-service.ts

**Line 232**: Invalid column `location_id`
💡 Suggestion: Use `location`
```typescript
locationId: row.location_id,
```

**Line 233**: Invalid column `location_name`
```typescript
locationName: row.location_name,
```

**Line 236**: Invalid column `call_count`
```typescript
callCount: parseInt(row.call_count || 0),
```

**Line 237**: Invalid column `avg_duration`
```typescript
avgDuration: parseFloat(row.avg_duration || 0),
```

**Line 238**: Invalid column `ftf_rate`
```typescript
firstTimeFixRate: parseFloat(row.ftf_rate || 0),
```

**Line 239**: Invalid column `avg_satisfaction`
```typescript
avgSatisfaction: parseFloat(row.avg_satisfaction || 0),
```

**Line 341**: Invalid column `location_id`
💡 Suggestion: Use `location`
```typescript
locationId: row.location_id,
```

**Line 342**: Invalid column `location_name`
```typescript
locationName: row.location_name,
```

**Line 343**: Invalid column `technician_count`
```typescript
technicianCount: parseInt(row.technician_count || 0),
```

**Line 344**: Invalid column `total_calls`
```typescript
totalCalls: parseInt(row.total_calls || 0),
```

... and 24 more issues

### server\services\service-reporting-service.ts

**Line 243**: Invalid column `ticket_id`
```typescript
ticketId: row.ticket_id,
```

**Line 244**: Invalid column `ticket_number`
```typescript
ticketNumber: row.ticket_number,
```

**Line 245**: Invalid column `customer_name`
```typescript
customerName: row.customer_name,
```

**Line 246**: Invalid column `equipment_model`
```typescript
equipmentModel: row.equipment_model,
```

**Line 247**: Invalid column `serial_number`
```typescript
serialNumber: row.serial_number,
```

**Line 250**: Invalid column `scheduled_date`
```typescript
scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : null,
```

**Line 250**: Invalid column `scheduled_date`
```typescript
scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : null,
```

**Line 251**: Invalid column `completed_date`
💡 Suggestion: Use `completed_at`
```typescript
completedDate: row.completed_date ? new Date(row.completed_date) : null,
```

**Line 251**: Invalid column `completed_date`
💡 Suggestion: Use `completed_at`
```typescript
completedDate: row.completed_date ? new Date(row.completed_date) : null,
```

**Line 254**: Invalid column `resolution_type`
```typescript
resolutionType: row.resolution_type,
```

... and 23 more issues

### server\database-updater\seeders\rbac-seeder.ts

**Line 317**: Invalid column `view_own`
```typescript
code: 'sales.customer.view_own',
```

**Line 327**: Invalid column `edit_own`
```typescript
code: 'sales.customer.edit_own',
```

**Line 337**: Invalid column `view_location`
```typescript
code: 'sales.customer.view_location',
```

**Line 966**: Invalid column `create_location`
```typescript
code: 'admin.user.create_location',
```

**Line 977**: Invalid column `create_regional`
```typescript
code: 'admin.user.create_regional',
```

**Line 988**: Invalid column `create_company`
```typescript
code: 'admin.user.create_company',
```

**Line 999**: Invalid column `edit_profile`
```typescript
code: 'admin.user.edit_profile',
```

**Line 1009**: Invalid column `manage_permissions`
```typescript
code: 'admin.user.manage_permissions',
```

**Line 1381**: Invalid column `view_location`
```typescript
'sales.customer.view_location',
```

**Line 1389**: Invalid column `create_company`
```typescript
'admin.user.create_company',
```

... and 19 more issues

### server\services\sales-manager-reporting-service.ts

**Line 234**: Invalid column `region_id`
```typescript
regionId: row.region_id,
```

**Line 235**: Invalid column `region_name`
```typescript
regionName: row.region_name,
```

**Line 237**: Invalid column `deal_count`
```typescript
dealCount: parseInt(row.deal_count || 0),
```

**Line 238**: Invalid column `total_value`
```typescript
totalValue: parseFloat(row.total_value || 0),
```

**Line 239**: Invalid column `weighted_value`
```typescript
weightedValue: parseFloat(row.weighted_value || 0),
```

**Line 240**: Invalid column `conversion_rate`
```typescript
conversionRate: parseFloat(row.conversion_rate || 0),
```

**Line 241**: Invalid column `location_count`
```typescript
locationCount: parseInt(row.location_count || 0),
```

**Line 368**: Invalid column `region_id`
```typescript
regionId: row.region_id,
```

**Line 369**: Invalid column `region_name`
```typescript
regionName: row.region_name,
```

**Line 370**: Invalid column `location_count`
```typescript
locationCount: parseInt(row.location_count || 0),
```

... and 19 more issues

### server\services\sales-supervisor-reporting-service.ts

**Line 228**: Invalid column `location_id`
💡 Suggestion: Use `location`
```typescript
locationId: row.location_id,
```

**Line 229**: Invalid column `location_name`
```typescript
locationName: row.location_name,
```

**Line 231**: Invalid column `deal_count`
```typescript
dealCount: parseInt(row.deal_count || 0),
```

**Line 232**: Invalid column `total_value`
```typescript
totalValue: parseFloat(row.total_value || 0),
```

**Line 233**: Invalid column `weighted_value`
```typescript
weightedValue: parseFloat(row.weighted_value || 0),
```

**Line 234**: Invalid column `conversion_rate`
```typescript
conversionRate: parseFloat(row.conversion_rate || 0),
```

**Line 357**: Invalid column `location_id`
💡 Suggestion: Use `location`
```typescript
locationId: row.location_id,
```

**Line 358**: Invalid column `location_name`
```typescript
locationName: row.location_name,
```

**Line 359**: Invalid column `team_size`
```typescript
teamSize: parseInt(row.team_size || 0),
```

**Line 360**: Invalid column `total_revenue`
```typescript
totalRevenue: parseFloat(row.total_revenue || 0),
```

... and 17 more issues

### supabase\functions\me\index.ts

**Line 84**: Invalid column `user_metadata`
```typescript
(user.user_metadata as any)?.firstName || (user.user_metadata as any)?.first_name,
```

**Line 84**: Invalid column `user_metadata`
```typescript
(user.user_metadata as any)?.firstName || (user.user_metadata as any)?.first_name,
```

**Line 85**: Invalid column `user_metadata`
```typescript
lastName: (user.user_metadata as any)?.lastName || (user.user_metadata as any)?.last_name,
```

**Line 85**: Invalid column `user_metadata`
```typescript
lastName: (user.user_metadata as any)?.lastName || (user.user_metadata as any)?.last_name,
```

**Line 86**: Invalid column `app_metadata`
```typescript
tenantId: (user.app_metadata as any)?.tenantId,
```

**Line 87**: Invalid column `app_metadata`
```typescript
roleId: (user.app_metadata as any)?.roleId,
```

**Line 88**: Invalid column `app_metadata`
```typescript
teamId: (user.app_metadata as any)?.teamId,
```

**Line 89**: Invalid column `app_metadata`
```typescript
accessScope: (user.app_metadata as any)?.accessScope || 'own',
```

**Line 90**: Invalid column `app_metadata`
```typescript
isPlatformUser: Boolean((user.app_metadata as any)?.isPlatformUser),
```

**Line 92**: Invalid column `app_metadata`
```typescript
id: (user.app_metadata as any)?.roleId || 'default',
```

... and 17 more issues

### server\services\team-reporting-service.ts

**Line 319**: Invalid column `quota_amount`
```typescript
const quotaAmount = Number(row.quota_amount) || 1; // Avoid division by zero
```

**Line 320**: Invalid column `pipeline_value`
```typescript
const pipelineValue = Number(row.pipeline_value);
```

**Line 324**: Invalid column `user_name`
```typescript
userName: row.user_name || 'Unknown',
```

**Line 325**: Invalid column `user_email`
```typescript
userEmail: row.user_email || '',
```

**Line 327**: Invalid column `weighted_pipeline_value`
```typescript
weightedPipelineValue: Number(row.weighted_pipeline_value),
```

**Line 328**: Invalid column `deal_count`
```typescript
dealCount: Number(row.deal_count),
```

**Line 329**: Invalid column `average_deal_size`
```typescript
averageDealSize: Number(row.average_deal_size),
```

**Line 418**: Invalid column `total_activities`
```typescript
const totalActivitiesSum = results.rows.reduce((sum, row: any) => sum + Number(row.total_activities), 0);
```

**Line 424**: Invalid column `total_activities`
```typescript
const totalActivities = Number(row.total_activities);
```

**Line 428**: Invalid column `user_name`
```typescript
userName: row.user_name || 'Unknown',
```

... and 15 more issues

