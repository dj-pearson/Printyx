# Schema-of-record manifest

**PA-031.** Every table name the code queries that is declared in no `shared/*.ts` `pgTable()` and created by no migration, classified against a database built from the migrations alone.

`check:phantom-tables` finds these names but is explicit that absence from the repo does not prove absence from a database. This resolves that: since PA-032, `npm run db:migrate` builds a complete database from the repo, so the question has a definite answer.

Regenerate with:

```bash
DATABASE_URL=… npm run manifest:schema-of-record
```

Counted **85** distinct table name(s) across 115 reference(s): 74 missing, 11 with a rename candidate, 0 present after all.

## Absent, with no candidate (74)

Each of these needs a decision: give the feature a schema and a migration, or delete the endpoint. A handler that swallows the 42P01 and returns an empty list is the worst of the three outcomes, because nobody ever sees it fail.

| Table                             | Referenced by                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apollo_contacts`                 | `supabase/functions/apollo/index.ts`                                                                     |
| `apollo_saved_searches`           | `supabase/functions/apollo/index.ts`                                                                     |
| `apollo_tenant_leads`             | `supabase/functions/apollo/index.ts`                                                                     |
| `automation_rules`                | `supabase/functions/automation/index.ts`                                                                 |
| `bin_locations`                   | `supabase/functions/warehouse-operations/index.ts`                                                       |
| `commission_statements`           | `supabase/functions/commission/index.ts`                                                                 |
| `contract_equipment`              | `supabase/functions/service-contracts/index.ts`                                                          |
| `crm_activity_reports`            | `supabase/functions/crm-goals/index.ts`                                                                  |
| `crm_goals`                       | `supabase/functions/crm-goals/index.ts`                                                                  |
| `crm_teams`                       | `supabase/functions/crm-goals/index.ts`                                                                  |
| `customer_segment_members`        | `supabase/functions/customer-segments/index.ts`<br>`supabase/functions/email-campaigns/index.ts`         |
| `customer_segments`               | `supabase/functions/customer-segments/index.ts`                                                          |
| `dashboard_card_configs`          | `supabase/functions/card-config/index.ts`                                                                |
| `dashboard_configs`               | `supabase/functions/dashboard-modules/index.ts`<br>`supabase/functions/dashboards/index.ts`              |
| `deal_desk_requests`              | `supabase/functions/today-dashboard/index.ts`                                                            |
| `device_readings`                 | `supabase/functions/remote-monitoring/index.ts`                                                          |
| `discovered_devices`              | `supabase/functions/client-metrics/index.ts`<br>`supabase/functions/printer-monitoring/index.ts`         |
| `document_folders`                | `supabase/functions/document-management/index.ts`                                                        |
| `email_campaign_sends`            | `supabase/functions/email-campaigns/index.ts`                                                            |
| `enrichment_campaigns`            | `supabase/functions/data-enrichment/index.ts`<br>`supabase/functions/enrichment/index.ts`                |
| `file_uploads`                    | `supabase/functions/files/index.ts`                                                                      |
| `files`                           | `supabase/functions/file-storage/index.ts`                                                               |
| `fleet_fuel_logs`                 | `supabase/functions/fleet/index.ts`                                                                      |
| `fleet_maintenance`               | `supabase/functions/fleet/index.ts`                                                                      |
| `fleet_vehicle_locations`         | `supabase/functions/fleet/index.ts`                                                                      |
| `fleet_vehicles`                  | `supabase/functions/fleet/index.ts`                                                                      |
| `gdpr_audit_log`                  | `supabase/functions/gdpr/index.ts`                                                                       |
| `import_export_jobs`              | `supabase/functions/import-export/index.ts`                                                              |
| `integrations`                    | `supabase/functions/deployment-readiness/index.ts`<br>`supabase/functions/quickbooks/index.ts`           |
| `intent_signals`                  | `supabase/functions/data-enrichment/index.ts`<br>`supabase/functions/enrichment/index.ts`                |
| `inventory_transactions`          | `supabase/functions/warehouse-operations/index.ts`                                                       |
| `inventory_transfers`             | `supabase/functions/warehouse-operations/index.ts`                                                       |
| `lead_routing_rules`              | `supabase/functions/auto-lead-routing/index.ts`                                                          |
| `maintenance_records`             | `supabase/functions/maintenance/index.ts`                                                                |
| `maintenance_schedules`           | `supabase/functions/maintenance/index.ts`                                                                |
| `managed_services_contracts`      | `supabase/functions/managed-services/index.ts`                                                           |
| `manufacturer_sync_logs`          | `supabase/functions/manufacturer-integrations/index.ts`                                                  |
| `mps_billing_records`             | `supabase/functions/managed-services/index.ts`                                                           |
| `mps_covered_devices`             | `supabase/functions/managed-services/index.ts`                                                           |
| `mps_meter_readings`              | `supabase/functions/managed-services/index.ts`                                                           |
| `oid_presets`                     | `supabase/functions/printer-monitoring/index.ts`                                                         |
| `onboarding_sections`             | `supabase/functions/onboarding-checklists/index.ts`                                                      |
| `order_items`                     | `supabase/functions/warehouse-operations/index.ts`                                                       |
| `part_equipment_compatibility`    | `supabase/functions/parts-inventory/index.ts`                                                            |
| `parts_requests`                  | `supabase/functions/mobile-field/index.ts`                                                               |
| `parts_reservations`              | `supabase/functions/parts-inventory/index.ts`                                                            |
| `parts_transactions`              | `supabase/functions/parts-inventory/index.ts`                                                            |
| `parts_transfers`                 | `supabase/functions/parts-inventory/index.ts`                                                            |
| `pricing_rules`                   | `supabase/functions/pricing-rules/index.ts`                                                              |
| `pricing_visibility`              | `supabase/functions/pricing-settings/index.ts`                                                           |
| `printer_metrics`                 | `supabase/functions/printer-monitoring/index.ts`                                                         |
| `product_accessory_compatibility` | `supabase/functions/catalog/index.ts`                                                                    |
| `professional_services_projects`  | `supabase/functions/professional-services/index.ts`                                                      |
| `project_tasks`                   | `supabase/functions/professional-services/index.ts`                                                      |
| `purchase_order_line_items`       | `supabase/functions/purchase-orders/index.ts`                                                            |
| `quickbooks_mappings`             | `supabase/functions/quickbooks/index.ts`                                                                 |
| `rbac_audit_log`                  | `supabase/functions/rbac/index.ts`                                                                       |
| `sales_handoffs`                  | `supabase/functions/sales-handoffs/index.ts`                                                             |
| `sales_quotas`                    | `supabase/functions/sales-reports/index.ts`                                                              |
| `scheduled_tasks`                 | `supabase/functions/automation/index.ts`                                                                 |
| `service_analyses`                | `supabase/functions/service-analysis/index.ts`                                                           |
| `service_analysis_parts`          | `supabase/functions/service-analysis/index.ts`                                                           |
| `service_appointments`            | `supabase/functions/appointments/index.ts`                                                               |
| `task_time_entries`               | `supabase/functions/task-comments/index.ts`                                                              |
| `tax_rates`                       | `supabase/functions/tax-rates/index.ts`                                                                  |
| `technician_skills`               | `supabase/functions/technician-management/index.ts`                                                      |
| `templates`                       | `supabase/functions/templates/index.ts`                                                                  |
| `tenant_settings`                 | `supabase/functions/auto-supply-replenishment/index.ts`<br>`supabase/functions/tenant-settings/index.ts` |
| `ticket_notes`                    | `supabase/functions/mobile-field/index.ts`                                                               |
| `user_preferences`                | `supabase/functions/user/index.ts`                                                                       |
| `warehouses`                      | `supabase/functions/warehouse-operations/index.ts`                                                       |
| `work_order_labor`                | `supabase/functions/work-orders/index.ts`                                                                |
| `work_order_notes`                | `supabase/functions/work-orders/index.ts`                                                                |
| `work_order_parts`                | `supabase/functions/work-orders/index.ts`                                                                |

## Absent, but a real table serves the feature (11)

The handler is querying the wrong name. Re-point it — no schema change needed. Confirm the candidate against the columns the handler actually reads before repointing; the mapping here is by feature, not by column.

| Table              | Real table                          | Referenced by                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activities`       | `business_record_activities`        | `supabase/functions/crm-goals/index.ts`<br>`supabase/functions/gdpr/index.ts`<br>`supabase/functions/sales-reports/index.ts`<br>`supabase/functions/team-reports/index.ts`<br>`supabase/functions/today-dashboard/index.ts`                                                                                                       |
| `appointments`     | `customer_maintenance_appointments` | `supabase/functions/scheduling/index.ts`<br>`supabase/functions/today-dashboard/index.ts`                                                                                                                                                                                                                                         |
| `customers`        | `business_records`                  | `supabase/functions/companies/index.ts`<br>`supabase/functions/import/index.ts`                                                                                                                                                                                                                                                   |
| `devices`          | `equipment`                         | `supabase/functions/customer-devices/index.ts`<br>`supabase/functions/customer-metrics/index.ts`<br>`supabase/functions/devices/index.ts`<br>`supabase/functions/fleet-dashboard/index.ts`<br>`supabase/functions/fleet-devices/index.ts`<br>`supabase/functions/order-toner/index.ts`                                            |
| `inventory`        | `inventory_items`                   | `supabase/functions/auto-supply-replenishment/index.ts`<br>`supabase/functions/cross-module/index.ts`<br>`supabase/functions/mobile-field/index.ts`<br>`supabase/functions/warehouse-operations/index.ts`                                                                                                                         |
| `leads`            | `business_records`                  | `supabase/functions/assign-lead/index.ts`<br>`supabase/functions/companies/index.ts`<br>`supabase/functions/crm-goals/index.ts`<br>`supabase/functions/import/index.ts`<br>`supabase/functions/lead-assignment-queue/index.ts`<br>`supabase/functions/today-dashboard/index.ts`<br>`supabase/functions/user-assignments/index.ts` |
| `parts`            | `parts_orders`                      | `supabase/functions/parts-inventory/index.ts`                                                                                                                                                                                                                                                                                     |
| `payments`         | `customer_payments`                 | `supabase/functions/payment-processing/index.ts`                                                                                                                                                                                                                                                                                  |
| `pricing_settings` | `company_pricing_settings`          | `supabase/functions/pricing-settings/index.ts`<br>`supabase/functions/proposals/index.ts`                                                                                                                                                                                                                                         |
| `team_members`     | `sales_team_members`                | `supabase/functions/team-reports/index.ts`                                                                                                                                                                                                                                                                                        |
| `work_orders`      | `service_tickets`                   | `supabase/functions/service-contracts/index.ts`<br>`supabase/functions/technician-management/index.ts`<br>`supabase/functions/work-orders/index.ts`                                                                                                                                                                               |

## Exists after all (0)

The relation is in the migration-built database, so these are stale entries in the phantom-table baseline rather than defects. Tighten the baseline.

_None._
