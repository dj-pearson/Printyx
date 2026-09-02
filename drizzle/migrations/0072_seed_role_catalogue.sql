-- The canonical role catalogue (WF-R-02).
--
-- WHY A MIGRATION. supabase/functions/signup/ looks up roles.code='COMPANY_ADMIN'
-- and deletes the tenant it just created, answering MISSING_ADMIN_ROLE, when the
-- row is absent. The only files that wrote System A roles -
-- server/role-seeder.ts, server/multi-location-role-seeder.ts and
-- server/initialize-roles.ts - had NO IMPORTER and NO npm script between them, so
-- on a fresh database signup could not succeed at all. `npm run seed:rbac` fills
-- System B, which signup never reads. roles has NO tenant_id and code is UNIQUE,
-- so the catalogue is global and a one-time idempotent insert is the right shape:
-- it runs with db:migrate, needs no runtime code, and cannot double-insert.
--
-- WHICH CODES. 45: the 35 role templates in
-- server/database-updater/seeders/rbac-seeder.ts (the dealer org chart this repo
-- already documents - CEO through CSR) plus every code a LIVE CONSUMER names that
-- the templates omit - the ROLE_LEVEL rungs in supabase/functions/_shared/rbac.ts
-- and the layout keys in client/src/lib/dashboard-widget-registry.ts. Not the 33
-- in multi-location-role-seeder.ts: that set does not contain COMPANY_ADMIN at
-- all, so seeding it would leave signup failing exactly as before.
--
-- THE LEVELS COME FROM ROLE_LEVEL WHERE THE TWO DISAGREE, and that is a correction
-- rather than a preference. Every overlapping code matches rbac-seeder.ts's
-- hierarchyLevel except one: COMPANY_ADMIN, which both rbac-seeder.ts and
-- role-seeder.ts put at level 5 while _shared/rbac.ts - the side doing the
-- enforcing, read by every edge-function gate - defines it as 7. A company admin
-- seeded at 5 fails requireRoleLevel(ctx, ROLE_LEVEL.COMPANY_ADMIN) on its own
-- platform, so it is seeded at 7. role-seeder.ts also put ROOT_ADMIN at 7 against
-- the ladder's 8.
--
-- SERVICE_TECH is deliberately absent: the dashboard registry and the level ladder
-- both speak TECHNICIAN, and one code per concept is the point. FIELD_TECHNICIAN
-- is kept because rbac-seeder.ts names it as a distinct template.
--
-- permissions is '{}' ON PURPOSE. Per docs/rbac-decision.md the vocabulary is
-- three-segment module.resource.action and level is the enforcement primitive
-- until WF-R-03 puts claims in the token; authoring 45 permission sets here would
-- be inventing authorization ahead of the story that defines it. The can_* flags
-- ARE set, because they are columns the admin edge function already reads.
--
-- Idempotent: ON CONFLICT (code) DO NOTHING, so an environment that already has a
-- catalogue keeps it and this neither duplicates nor overwrites. If a row exists
-- with a level that disagrees with the ladder above, this migration will NOT
-- correct it - check with the query in docs/rbac-decision.md before assuming a
-- fresh deploy is consistent.
INSERT INTO roles (name, code, role_type, department, level, description, permissions, can_access_all_tenants, can_view_system_metrics, can_access_all_locations, can_manage_company_users, can_create_locations, can_view_company_financials, can_manage_regional_users, can_view_regional_reports, can_approve_regional_deals, can_manage_location_users, can_view_location_reports, can_approve_location_deals)
VALUES
  ('Platform Administrator', 'PLATFORM_ADMIN', 'platform_role', 'platform', 8, 'Platform Administrator (platform, level 8)', '{}'::jsonb, true, true, true, true, true, true, false, false, false, false, false, false),
  ('Root Administrator', 'ROOT_ADMIN', 'platform_role', 'platform', 8, 'Root Administrator (platform, level 8)', '{}'::jsonb, true, true, true, true, true, true, false, false, false, false, false, false),
  ('Printyx Support Specialist', 'PRINTYX_SUPPORT', 'platform_role', 'platform', 6, 'Printyx Support Specialist (platform, level 6)', '{}'::jsonb, true, true, false, false, false, false, false, false, false, false, false, false),
  ('Printyx Technical Specialist', 'PRINTYX_TECHNICAL', 'platform_role', 'platform', 6, 'Printyx Technical Specialist (platform, level 6)', '{}'::jsonb, true, true, false, false, false, false, false, false, false, false, false, false),
  ('Company Administrator', 'COMPANY_ADMIN', 'company_role', 'admin', 7, 'Company Administrator (admin, level 7)', '{}'::jsonb, false, false, true, true, true, true, false, false, false, false, false, false),
  ('Executive', 'EXECUTIVE', 'company_role', 'admin', 7, 'Executive (admin, level 7)', '{}'::jsonb, false, false, true, false, false, true, false, false, false, false, false, false),
  ('Regional Manager', 'REGIONAL_MANAGER', 'regional_role', 'admin', 6, 'Regional Manager (admin, level 6)', '{}'::jsonb, false, false, false, false, false, false, true, true, true, false, false, false),
  ('Location Manager', 'LOCATION_MANAGER', 'location_role', 'admin', 4, 'Location Manager (admin, level 4)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, true, true, true),
  ('Sales Director', 'SALES_DIRECTOR', 'department_role', 'sales', 5, 'Sales Director (sales, level 5)', '{}'::jsonb, false, false, false, false, false, true, false, false, false, false, false, false),
  ('Sales Manager', 'SALES_MANAGER', 'department_role', 'sales', 4, 'Sales Manager (sales, level 4)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, true),
  ('Sales Supervisor', 'SALES_SUPERVISOR', 'department_role', 'sales', 3, 'Sales Supervisor (sales, level 3)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, false),
  ('Senior Sales Representative', 'SENIOR_SALES_REP', 'department_role', 'sales', 2, 'Senior Sales Representative (sales, level 2)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Sales Representative', 'SALES_REP', 'department_role', 'sales', 1, 'Sales Representative (sales, level 1)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Service Director', 'SERVICE_DIRECTOR', 'department_role', 'service', 5, 'Service Director (service, level 5)', '{}'::jsonb, false, false, false, false, false, true, false, false, false, false, false, false),
  ('Service Manager', 'SERVICE_MANAGER', 'department_role', 'service', 4, 'Service Manager (service, level 4)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, false),
  ('Service Supervisor', 'SERVICE_SUPERVISOR', 'department_role', 'service', 3, 'Service Supervisor (service, level 3)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, false),
  ('Technician', 'TECHNICIAN', 'department_role', 'service', 1, 'Technician (service, level 1)', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Finance Director', 'FINANCE_DIRECTOR', 'department_role', 'finance', 5, 'Finance Director (finance, level 5)', '{}'::jsonb, false, false, false, false, false, true, false, false, false, false, false, false),
  ('Finance Manager', 'FINANCE_MANAGER', 'department_role', 'finance', 4, 'Finance Manager (finance, level 4)', '{}'::jsonb, false, false, false, false, false, true, false, false, false, false, false, false),
  ('CEO / President', 'CEO', 'company_role', 'executive', 7, 'Chief Executive Officer - highest company authority', '{}'::jsonb, false, false, true, true, true, true, false, false, false, false, false, false),
  ('CFO', 'CFO', 'company_role', 'finance', 7, 'Chief Financial Officer - financial oversight', '{}'::jsonb, false, false, true, false, false, true, false, false, false, false, false, false),
  ('COO', 'COO', 'company_role', 'operations', 7, 'Chief Operating Officer - operations oversight', '{}'::jsonb, false, false, true, true, true, true, false, false, false, false, false, false),
  ('VP Sales / Sales Director', 'VP_SALES', 'company_role', 'sales', 6, 'Vice President of Sales - company-wide sales leadership', '{}'::jsonb, false, false, true, false, false, true, false, true, true, false, false, false),
  ('VP Service / Service Director', 'VP_SERVICE', 'company_role', 'service', 6, 'Vice President of Service - company-wide service leadership', '{}'::jsonb, false, false, true, false, false, false, false, true, false, false, false, false),
  ('Director of Operations', 'DIRECTOR_OPERATIONS', 'company_role', 'operations', 6, 'Director of Operations - company-wide operations', '{}'::jsonb, false, false, true, false, false, false, false, true, false, false, false, false),
  ('Controller / Finance Director', 'CONTROLLER', 'company_role', 'finance', 6, 'Controller - company-wide financial management', '{}'::jsonb, false, false, true, false, false, true, false, true, false, false, false, false),
  ('Regional Sales Director', 'REGIONAL_SALES_DIRECTOR', 'regional_role', 'sales', 5, 'Regional Sales Director - multi-location sales management', '{}'::jsonb, false, false, false, false, false, false, true, true, true, false, false, false),
  ('Regional Service Manager', 'REGIONAL_SERVICE_MANAGER', 'regional_role', 'service', 5, 'Regional Service Manager - multi-location service management', '{}'::jsonb, false, false, false, false, false, false, true, true, false, false, false, false),
  ('Operations Manager', 'OPERATIONS_MANAGER', 'department_role', 'operations', 4, 'Operations Manager - location-level operations', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, false),
  ('Branch Manager', 'BRANCH_MANAGER', 'location_role', 'admin', 4, 'Branch Manager - all departments at location', '{}'::jsonb, false, false, false, false, false, false, false, false, false, true, true, true),
  ('Warehouse Supervisor', 'WAREHOUSE_SUPERVISOR', 'department_role', 'operations', 3, 'Warehouse Supervisor - warehouse team supervision', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, true, false),
  ('Senior Field Technician', 'SENIOR_TECHNICIAN', 'department_role', 'service', 2, 'Senior Field Technician - individual + mentoring', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Field Service Technician', 'FIELD_TECHNICIAN', 'department_role', 'service', 1, 'Field Service Technician - individual contributor', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Warehouse Associate', 'WAREHOUSE_ASSOCIATE', 'department_role', 'operations', 1, 'Warehouse Associate - individual contributor', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Accounting Clerk', 'ACCOUNTING_CLERK', 'department_role', 'finance', 1, 'Accounting Clerk - individual contributor', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Area Manager', 'AREA_MANAGER', 'regional_role', 'sales', 6, 'Area Manager - oversees multiple regions in a geographic area', '{}'::jsonb, false, false, true, false, false, false, true, true, true, false, false, false),
  ('District Manager', 'DISTRICT_MANAGER', 'regional_role', 'sales', 5, 'District Manager - manages sales/service across a district of locations', '{}'::jsonb, false, false, false, false, false, false, true, true, true, false, false, false),
  ('IT Administrator', 'IT_ADMIN', 'department_role', 'it', 4, 'IT Administrator - manages system configuration and user access', '{}'::jsonb, false, false, true, true, false, false, false, false, false, false, false, false),
  ('HR Manager', 'HR_MANAGER', 'department_role', 'hr', 4, 'HR Manager - manages employee records and onboarding', '{}'::jsonb, false, false, false, true, false, false, false, false, false, false, false, false),
  ('VP Administration', 'VP_ADMIN', 'company_role', 'admin', 6, 'VP of Administration - company-wide admin, IT, and HR oversight', '{}'::jsonb, false, false, true, true, false, true, false, true, false, false, false, false),
  ('Account Executive', 'ACCOUNT_EXECUTIVE', 'department_role', 'sales', 3, 'Account Executive - manages major/enterprise accounts', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Inside Sales Representative', 'INSIDE_SALES_REP', 'department_role', 'sales', 2, 'Inside Sales Representative - phone/online sales with team visibility', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Dispatch Coordinator', 'DISPATCH_COORDINATOR', 'department_role', 'service', 1, 'Dispatch Coordinator - schedules service calls and manages dispatch board', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Solutions Consultant', 'SOLUTIONS_CONSULTANT', 'department_role', 'sales', 2, 'Solutions Consultant - pre-sales technical assessment and configuration', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false),
  ('Customer Service Representative', 'CSR', 'department_role', 'service', 1, 'Customer Service Representative - handles supplies orders and basic inquiries', '{}'::jsonb, false, false, false, false, false, false, false, false, false, false, false, false)
ON CONFLICT (code) DO NOTHING;
